import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChatPanel from "../src/components/ChatPanel";
import useSalaChat from "../src/hooks/useSalaChat";
import { leaveSala, joinSala } from "../src/services/salaService";
import { getInitials } from "../src/utils/avatar";
import { formatDate, formatDateTime, formatMessageTime, posterLabel } from "../src/utils/format";

class FakeWebSocket {
  static OPEN = 1;
  static instances = [];
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    FakeWebSocket.instances.push(this);
  }
  send(data) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  receive(frame) {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
});

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("CU-05 Coordinacion — frontend del chat", () => {
  it("PT-CU05-25 useSalaChat → pide ticket, abre ws(s)://host/ws/chat?ticket=… y carga el history", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json(200, { ticket: "tk 1" }));
    const { result } = renderHook(() => useSalaChat("sala-1", true));
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const socket = FakeWebSocket.instances[0];
    expect(socket.url).toBe(`ws://${window.location.host}/ws/chat?ticket=tk%201`);
    act(() => {
      socket.open();
      socket.receive({ type: "history", payload: [{ userId: "u2", username: "Bruno", content: "hola", timestamp: Date.now() }] });
    });
    expect(result.current.status).toBe("open");
    expect(result.current.messages).toEqual([expect.objectContaining({ author: "Bruno", authorId: "u2", text: "hola" })]);

    act(() => socket.receive({ type: "message", payload: { userId: "u3", username: "Caro", content: "dale", timestamp: Date.now() } }));
    expect(result.current.messages.map((m) => m.text)).toEqual(["hola", "dale"]);

    let sent;
    act(() => {
      sent = result.current.send("  nos vemos  ");
    });
    expect(sent).toBe(true);
    expect(socket.sent).toEqual([{ content: "nos vemos" }]);
  });

  it("PT-CU05-26 useSalaChat con ticket rechazado (403) → estado 'error' sin reintentar", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(json(403, { error: "not_a_member" }));
    const { result } = renderHook(() => useSalaChat("sala-1", true));
    await waitFor(() => expect(result.current.status).toBe("error"));
    await act(() => vi.advanceTimersByTimeAsync(20000));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it("PT-CU05-27 ChatPanel → no envía mensajes vacíos y limpia el borrador tras enviar", async () => {
    const onSend = vi.fn(() => true);
    render(<ChatPanel messages={[]} onSend={onSend} currentUserId="u1" status="open" />);
    const input = screen.getByRole("textbox", { name: "Mensaje" });
    const send = screen.getByRole("button", { name: "Enviar" });
    await userEvent.type(input, "   ");
    expect(send).toBeDisabled();
    await userEvent.clear(input);
    await userEvent.type(input, "¿Pochoclos?");
    await userEvent.click(send);
    expect(onSend).toHaveBeenCalledWith("¿Pochoclos?");
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("maxLength", "1000");
  });

  it("PT-CU05-28 ChatPanel desconectado → 'Conectando…' y botón Enviar deshabilitado", async () => {
    render(<ChatPanel messages={[]} onSend={() => true} currentUserId="u1" status="connecting" />);
    expect(screen.getByText("Conectando…")).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: "Mensaje" }), "hola");
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
  });
});

describe("CU-04 / CU-06 — servicio de salas", () => {
  it("PT-CU04-12 joinSala con 409 sala_closed → error con mensaje 'La función de esta sala ya pasó.' y status 409", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json(409, { error: "sala_closed" }));
    await expect(joinSala("x")).rejects.toMatchObject({ status: 409, code: "sala_closed", message: "La función de esta sala ya pasó." });
  });

  it("PT-CU06-08 leaveSala cuando la sala se elimina → devuelve null", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json(200, { sala: null }));
    await expect(leaveSala("x")).resolves.toBeNull();
  });
});

describe("Transversal — utilidades de formato del frontend", () => {
  it("PT-TR-05 formatDate/formatDateTime → 'mar, 14 jul · 20:30 hs' sin corrimiento de día por UTC", () => {
    expect(formatDate("2026-07-14")).toBe("mar, 14 jul");
    expect(formatDateTime("2026-07-14", "20:30")).toBe("mar, 14 jul · 20:30 hs");
    expect(formatDate("")).toBe("");
  });

  it("PT-TR-06 formatMessageTime → solo hora si es de hoy; fecha y hora si no", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-21T21:00:00"));
    expect(formatMessageTime(new Date("2026-10-21T20:31:00").getTime())).toBe("20:31");
    expect(formatMessageTime(new Date("2026-10-20T20:31:00").getTime())).toBe("mar, 20 oct · 20:31");
    expect(formatMessageTime("no-numero")).toBe("");
  });

  it("PT-TR-07 posterLabel y getInitials → etiquetas cortas para pósters y avatares", () => {
    expect(posterLabel("Dune: Part Two")).toBe("Dune");
    expect(posterLabel("Interestelaresquisimo")).toBe("Interestela…");
    expect(getInitials("María López")).toBe("ML");
    expect(getInitials("Auguste")).toBe("AU");
    expect(getInitials("")).toBe("?");
  });
});
