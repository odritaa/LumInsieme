import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import cacheClient from "../src/cache-client.js";

const PROTO_PATH = fileURLToPath(new URL("../../cache-controller/proto/cache.proto", import.meta.url));
const lists = new Map();
let grpcServer;

// cache-controller falso en el puerto de CACHE_GRPC_ADDR: ejercita el cliente gRPC real.
beforeAll(async () => {
  const definition = protoLoader.loadSync(PROTO_PATH, { keepCase: true, longs: String, defaults: true });
  const { CacheService } = grpc.loadPackageDefinition(definition).cache;
  grpcServer = new grpc.Server();
  grpcServer.addService(CacheService.service, {
    PushBatch: ({ request }, done) => {
      const list = lists.get(request.key) ?? [];
      list.push(...request.values);
      lists.set(request.key, list);
      done(null, { length: list.length });
    },
    Range: ({ request }, done) => {
      const list = lists.get(request.key) ?? [];
      const start = Number(request.start) < 0 ? Math.max(list.length + Number(request.start), 0) : Number(request.start);
      const stop = Number(request.stop) < 0 ? list.length + Number(request.stop) : Number(request.stop);
      done(null, { values: list.slice(start, stop + 1) });
    },
    Health: (_call, done) => done(null, { status: "healthy", redis_connected: true }),
  });
  await new Promise((resolve, reject) =>
    grpcServer.bindAsync("127.0.0.1:50999", grpc.ServerCredentials.createInsecure(), (err) => (err ? reject(err) : resolve()))
  );
});

afterAll(() => grpcServer.forceShutdown());

beforeEach(() => {
  lists.clear();
  cacheClient.buffers.clear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const msg = (i) => JSON.stringify({ userId: "u", username: "Ana", content: `m${i}`, timestamp: i });

describe("CU-05 Coordinacion — persistencia por lotes (PushBatch)", () => {
  it("PT-CU05-16 9 mensajes no disparan PushBatch; el 10.º envía el lote completo (chat:<sala>, TTL 3 días)", async () => {
    vi.useFakeTimers();
    const push = vi.spyOn(cacheClient, "pushBatch").mockResolvedValue(10);
    for (let i = 1; i <= 9; i++) cacheClient.enqueue("sala-lote", msg(i));
    expect(push).not.toHaveBeenCalled();
    cacheClient.enqueue("sala-lote", msg(10));
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("chat:sala-lote", Array.from({ length: 10 }, (_, i) => msg(i + 1)), 259200);
  });

  it("PT-CU05-17 3 mensajes sin completar el lote → PushBatch a los 3 s exactos (fake timers)", async () => {
    vi.useFakeTimers();
    const push = vi.spyOn(cacheClient, "pushBatch").mockResolvedValue(3);
    [1, 2, 3].forEach((i) => cacheClient.enqueue("sala-timer", msg(i)));
    await vi.advanceTimersByTimeAsync(2999);
    expect(push).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(push).toHaveBeenCalledWith("chat:sala-timer", [msg(1), msg(2), msg(3)], 259200);
  });

  it("PT-CU05-18 Lote completo antes de los 3 s → cancela el timer (no hay PushBatch vacío ni duplicado)", async () => {
    vi.useFakeTimers();
    const push = vi.spyOn(cacheClient, "pushBatch").mockResolvedValue(10);
    for (let i = 1; i <= 10; i++) cacheClient.enqueue("sala-cancel", msg(i));
    await vi.advanceTimersByTimeAsync(5000);
    expect(push).toHaveBeenCalledTimes(1);
    expect(cacheClient.flushTimers.has("chat:sala-cancel")).toBe(false);
  });

  it("PT-CU05-19 Buffers y timers independientes por sala", async () => {
    vi.useFakeTimers();
    const push = vi.spyOn(cacheClient, "pushBatch").mockResolvedValue(1);
    cacheClient.enqueue("sala-1", msg(1));
    await vi.advanceTimersByTimeAsync(1500);
    cacheClient.enqueue("sala-2", msg(2));
    await vi.advanceTimersByTimeAsync(1500);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenLastCalledWith("chat:sala-1", [msg(1)], 259200);
    await vi.advanceTimersByTimeAsync(1500);
    expect(push).toHaveBeenLastCalledWith("chat:sala-2", [msg(2)], 259200);
  });

  it("PT-CU05-20 PushBatch falla → los mensajes vuelven al buffer y se reintentan en el próximo intervalo de 3 s", async () => {
    vi.useFakeTimers();
    const push = vi
      .spyOn(cacheClient, "pushBatch")
      .mockRejectedValueOnce(new Error("UNAVAILABLE"))
      .mockResolvedValue(2);
    cacheClient.enqueue("sala-reintento", msg(1));
    cacheClient.enqueue("sala-reintento", msg(2));
    await vi.advanceTimersByTimeAsync(3000);
    expect(push).toHaveBeenCalledTimes(1);
    expect(cacheClient.buffers.get("chat:sala-reintento")).toEqual([msg(1), msg(2)]);
    await vi.advanceTimersByTimeAsync(3000);
    expect(push).toHaveBeenCalledTimes(2);
    expect(push).toHaveBeenLastCalledWith("chat:sala-reintento", [msg(1), msg(2)], 259200);
    expect(cacheClient.buffers.get("chat:sala-reintento")).toEqual([]);
  });

  it("PT-CU05-21 flushAll (apagado) persiste todos los buffers pendientes", async () => {
    const push = vi.spyOn(cacheClient, "pushBatch").mockResolvedValue(1);
    cacheClient.enqueue("sala-x", msg(1));
    cacheClient.enqueue("sala-y", msg(2));
    await cacheClient.flushAll();
    expect(push.mock.calls.map((c) => c[0]).sort()).toEqual(["chat:sala-x", "chat:sala-y"]);
  });
});

describe("CU-05 Coordinacion — cliente gRPC contra un cache-controller simulado", () => {
  it("PT-CU05-22 pushBatch + range por gRPC → los mensajes se guardan y se leen en orden", async () => {
    expect(await cacheClient.pushBatch("chat:grpc", [msg(1), msg(2), msg(3)])).toBe("3");
    expect(await cacheClient.range("chat:grpc", -2, -1)).toEqual([msg(2), msg(3)]);
  });

  it("PT-CU05-23 health por gRPC → redis_connected true", async () => {
    expect(await cacheClient.health()).toMatchObject({ status: "healthy", redis_connected: true });
  });
});
