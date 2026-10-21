import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as cacheClient from "../src/clients/cacheClient.js";
import app from "../src/app.js";
import pool from "../src/database.js";
import { today } from "../src/services/cartelera.service.js";
import { addDays } from "./helpers.js";

vi.mock("../src/clients/cacheClient.js", () => ({ get: vi.fn(), health: vi.fn() }));

afterAll(() => pool.end());

const unpadded = (iso) => iso.split("-").map(Number).join("-");
const movie = (title, date, screenings, theater = "Multiplex Belgrano") => ({
  title,
  date,
  duration: "1 hora",
  theater,
  screenings,
});

beforeEach(() => {
  vi.mocked(cacheClient.get).mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("CU-03 Exploracion de cartelera — GET /cartelera", () => {
  it("PT-CU03-08 Formato actual del scrapper (días 'AAAA-M-D' sin ceros) → fechas normalizadas AAAA-MM-DD", async () => {
    vi.mocked(cacheClient.get).mockResolvedValue(
      JSON.stringify([{ "2030-8-4": [movie("Dune", "2030-08-04", [{ type: "2D", hours: ["21:00", "9:30"] }])] }])
    );
    const res = await request(app).get("/cartelera?fecha=2030-08-04");
    expect(res.status).toBe(200);
    expect(res.body.dates).toEqual(["2030-08-04"]);
    expect(res.body.screenings.map((s) => s.time)).toEqual(["09:30", "21:00"]);
    expect(res.body.screenings[0]).toEqual({
      time: "09:30",
      title: "Dune",
      format: "2D",
      place: "Multiplex Belgrano",
      duration: "1 hora",
    });
  });

  it("PT-CU03-09 Formato anterior del scrapper (lista plana con fecha ISO) → mismo resultado normalizado", async () => {
    vi.mocked(cacheClient.get).mockResolvedValue(
      JSON.stringify([movie("Dune", "2030-08-04T00:00:00", [{ type: "2D", hours: ["21:00"] }])])
    );
    const res = await request(app).get("/cartelera?fecha=2030-08-04");
    expect(res.body.dates).toEqual(["2030-08-04"]);
    expect(res.body.screenings).toHaveLength(1);
  });

  it("PT-CU03-10 Ambos formatos mezclados y una función repetida → cada función se lista una sola vez", async () => {
    const screenings = [{ type: "2D", hours: ["20:00", "20:00", "22:15"] }];
    vi.mocked(cacheClient.get).mockResolvedValue(
      JSON.stringify([
        { "2030-8-4": [movie("Dune", "2030-08-04", screenings), movie("Dune", "2030-08-04", screenings)] },
        movie("Dune", "2030-08-04", screenings),
      ])
    );
    const res = await request(app).get("/cartelera?fecha=2030-08-04");
    expect(res.body.screenings.map((s) => s.time)).toEqual(["20:00", "22:15"]);
  });

  it("PT-CU03-11 Funciones ordenadas por hora, luego título y formato", async () => {
    vi.mocked(cacheClient.get).mockResolvedValue(
      JSON.stringify([
        {
          "2030-8-4": [
            movie("Zama", "2030-08-04", [{ type: "2D", hours: ["18:00"] }]),
            movie("Argentina 1985", "2030-08-04", [
              { type: "3D", hours: ["18:00"] },
              { type: "2D", hours: ["18:00", "15:00"] },
            ]),
          ],
        },
      ])
    );
    const res = await request(app).get("/cartelera?fecha=2030-08-04");
    expect(res.body.screenings.map((s) => `${s.time} ${s.title} ${s.format}`)).toEqual([
      "15:00 Argentina 1985 2D",
      "18:00 Argentina 1985 2D",
      "18:00 Argentina 1985 3D",
      "18:00 Zama 2D",
    ]);
  });

  it("PT-CU03-12 Sin datos en caché (clave inexistente) → 200 con dates: [] y screenings: []", async () => {
    vi.mocked(cacheClient.get).mockResolvedValue(null);
    const res = await request(app).get("/cartelera");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ dates: [], date: null, screenings: [] });
  });

  it("PT-CU03-13 Caché caída (gRPC UNAVAILABLE) → 503 cache_unavailable", async () => {
    vi.mocked(cacheClient.get).mockRejectedValue(Object.assign(new Error("14 UNAVAILABLE"), { code: 14 }));
    const res = await request(app).get("/cartelera");
    expect(res.status).toBe(503);
    expect(res.body.error).toBe("cache_unavailable");
  });

  it("PT-CU03-14 scraped_data con JSON corrupto → 200 con dates: []", async () => {
    vi.mocked(cacheClient.get).mockResolvedValue("{no es json");
    const res = await request(app).get("/cartelera");
    expect(res.status).toBe(200);
    expect(res.body.dates).toEqual([]);
  });

  it("PT-CU03-15 Sin ?fecha → elige hoy o el próximo día con funciones (ignora días pasados)", async () => {
    const ayer = addDays(today(), -1);
    const manana = addDays(today(), 1);
    vi.mocked(cacheClient.get).mockResolvedValue(
      JSON.stringify([
        {
          [unpadded(ayer)]: [movie("Vieja", ayer, [{ type: "2D", hours: ["20:00"] }])],
          [unpadded(manana)]: [movie("Nueva", manana, [{ type: "2D", hours: ["20:00"] }])],
        },
      ])
    );
    const res = await request(app).get("/cartelera");
    expect(res.body.date).toBe(manana);
    expect(res.body.dates).toEqual([ayer, manana]);
    expect(res.body.screenings[0].title).toBe("Nueva");
  });

  it("PT-CU03-16 ?fecha con formato inválido → 400 invalid_date", async () => {
    const res = await request(app).get("/cartelera?fecha=04-08-2030");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_date");
  });

  it("PT-CU03-17 Películas sin título u horarios inválidos → se descartan", async () => {
    vi.mocked(cacheClient.get).mockResolvedValue(
      JSON.stringify([
        {
          "2030-8-4": [
            movie("", "2030-08-04", [{ type: "2D", hours: ["20:00"] }]),
            movie("Válida", "2030-08-04", [{ type: "2D", hours: ["mediodía", "20:00"] }, { type: "3D", hours: [] }]),
          ],
        },
      ])
    );
    const res = await request(app).get("/cartelera?fecha=2030-08-04");
    expect(res.body.screenings).toEqual([expect.objectContaining({ title: "Válida", time: "20:00", format: "2D" })]);
  });

  it("PT-CU03-18 GET /cartelera/peliculas → catálogo plano normalizado", async () => {
    vi.mocked(cacheClient.get).mockResolvedValue(
      JSON.stringify([{ "2030-8-4": [movie("Dune", "2030-08-04", [{ type: "2D", hours: ["20:00"] }])] }])
    );
    const res = await request(app).get("/cartelera/peliculas");
    expect(res.status).toBe(200);
    expect(res.body.movies).toEqual([
      { title: "Dune", date: "2030-08-04", place: "Multiplex Belgrano", duration: "1 hora", screenings: [{ type: "2D", hours: ["20:00"] }] },
    ]);
  });
});

describe("Transversal — salud del reunion-controller", () => {
  it("PT-TR-01 GET /health con base OK y caché caída → 200 status degraded", async () => {
    vi.mocked(cacheClient.health).mockRejectedValue(new Error("UNAVAILABLE"));
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "degraded", db: "ok", cache: "error" });
  });

  it("PT-TR-02 GET /health con base y caché OK → 200 status ok", async () => {
    vi.mocked(cacheClient.health).mockResolvedValue(true);
    const res = await request(app).get("/health");
    expect(res.body).toEqual({ status: "ok", db: "ok", cache: "ok" });
  });
});
