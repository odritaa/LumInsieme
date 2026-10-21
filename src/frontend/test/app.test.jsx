import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";

const USER = { id: "u-ana", name: "Ana Pérez", email: "ana@test", age: 30, city: "CABA", genres: ["Drama"], favoriteMovies: [] };

const sala = (overrides = {}) => ({
  id: "11111111-1111-4111-8111-111111111111",
  movie: "Dune: Parte Tres",
  place: "Multiplex Belgrano",
  date: "2030-01-01",
  time: "20:30",
  capacity: 4,
  note: "",
  host: "Bruno",
  hostId: "u-bruno",
  createdAt: "2026-10-20T10:00:00Z",
  members: [{ id: "u-bruno", name: "Bruno", genres: ["Terror"], isAdmin: true }],
  ...overrides,
});

const json = (status, body) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    statusText: status === 503 ? "Service Unavailable" : "",
    headers: { "Content-Type": "application/json" },
  });

let routes;
let calls;

// fetch simulado: "METODO /ruta" -> respuesta (o funcion que la arma).
function mockApi(table) {
  routes = { "GET /auth/me": () => json(200, { user: USER }), ...table };
  calls = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, options = {}) => {
    const key = `${options.method ?? "GET"} ${url}`;
    calls.push({ key, body: options.body ? JSON.parse(options.body) : undefined });
    const handler = routes[key];
    if (!handler) return json(404, { error: "not_mocked", key });
    return typeof handler === "function" ? handler(options) : handler;
  });
}

class FakeWebSocket {
  static OPEN = 1;
  constructor() {
    this.readyState = 0;
  }
  send() {}
  close() {}
}

beforeEach(() => {
  vi.stubGlobal("WebSocket", FakeWebSocket);
});

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );

describe("CU-01 Autenticacion — frontend", () => {
  it("PT-CU01-36 Sin sesión (/auth/me 401) una ruta interna → redirige al login", async () => {
    mockApi({ "GET /auth/me": json(401, { error: "unauthenticated" }) });
    renderAt("/feed");
    expect(await screen.findByRole("link", { name: /Iniciar sesión con Google/ })).toHaveAttribute("href", "/auth/google");
  });

  it("PT-CU01-37 Login con ?error=invalid_state → muestra 'La sesión de inicio expiró'", async () => {
    mockApi({ "GET /auth/me": json(401, { error: "unauthenticated" }) });
    renderAt("/?error=invalid_state");
    expect(await screen.findByRole("alert")).toHaveTextContent("La sesión de inicio expiró. Probá de nuevo.");
  });

  it("PT-CU01-38 Con sesión válida el login → redirige al feed", async () => {
    mockApi({ "GET /cartelera": json(200, { dates: [], date: null, screenings: [] }), "GET /salas": json(200, { salas: [] }) });
    renderAt("/");
    expect(await screen.findByRole("heading", { name: "¿Qué vemos?" })).toBeInTheDocument();
  });

  it("PT-CU01-39 Cerrar sesión desde el perfil → POST /auth/logout y vuelta al login", async () => {
    mockApi({ "POST /auth/logout": json(204) });
    renderAt("/perfil");
    await userEvent.click(await screen.findByRole("button", { name: "Cerrar sesión" }));
    expect(await screen.findByRole("link", { name: /Iniciar sesión con Google/ })).toBeInTheDocument();
    expect(calls.map((c) => c.key)).toContain("POST /auth/logout");
  });

  it("PT-CU01-40 Un 401 de /salas (JWT vencido) → la app cierra la sesión y vuelve al login", async () => {
    mockApi({ "GET /cartelera": json(200, { dates: [], date: null, screenings: [] }), "GET /salas": json(401, { error: "invalid_token" }) });
    renderAt("/feed");
    expect(await screen.findByRole("link", { name: /Iniciar sesión con Google/ })).toBeInTheDocument();
  });
});

describe("CU-03 Exploracion de feed y cartelera — frontend", () => {
  it("PT-CU03-27 Cartelera sin datos (dates: []) → 'La cartelera todavía no está disponible'", async () => {
    mockApi({ "GET /cartelera": json(200, { dates: [], date: null, screenings: [] }), "GET /salas": json(200, { salas: [] }) });
    renderAt("/feed");
    expect(await screen.findByText(/La cartelera todavía no está disponible/)).toBeInTheDocument();
  });

  it("PT-CU03-28 Cartelera con caché caída (503) → mensaje de error visible", async () => {
    mockApi({ "GET /cartelera": json(503, { error: "cache_unavailable" }), "GET /salas": json(200, { salas: [] }) });
    renderAt("/feed");
    expect(await screen.findByText(/No pudimos cargar la cartelera: Error 503/)).toBeInTheDocument();
  });

  it("PT-CU03-29 Pestaña 'Salas abiertas' → lista las salas en el orden recibido con contador", async () => {
    const salas = [sala({ id: "a", movie: "Primera" }), sala({ id: "b", movie: "Segunda" })];
    mockApi({ "GET /cartelera": json(200, { dates: [], date: null, screenings: [] }), "GET /salas": json(200, { salas }) });
    renderAt("/feed?vista=salas");
    await screen.findByRole("heading", { name: "Primera" });
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Primera", "Segunda"]);
    expect(screen.getByRole("tab", { name: /Salas abiertas/ })).toHaveTextContent("2");
  });

  it("PT-CU03-30 Elegir un día del selector → pide /cartelera?fecha=AAAA-MM-DD", async () => {
    mockApi({
      "GET /cartelera": json(200, { dates: ["2030-01-01", "2030-01-02"], date: "2030-01-01", screenings: [] }),
      "GET /cartelera?fecha=2030-01-02": json(200, { dates: ["2030-01-01", "2030-01-02"], date: "2030-01-02", screenings: [] }),
      "GET /salas": json(200, { salas: [] }),
    });
    renderAt("/feed");
    const tabs = await screen.findAllByRole("tab", { name: /ene/ });
    await userEvent.click(tabs[1]);
    await waitFor(() => expect(calls.map((c) => c.key)).toContain("GET /cartelera?fecha=2030-01-02"));
  });
});

describe("CU-02 Creacion de sala — frontend", () => {
  const routesFor = (create) => ({
    "GET /cartelera/peliculas": json(200, { movies: [] }),
    "POST /salas": create,
    [`GET /salas/${sala().id}`]: json(200, { sala: sala({ hostId: USER.id, members: [{ ...USER, isAdmin: true }] }) }),
    [`POST /salas/${sala().id}/chat-ticket`]: json(200, { ticket: "t" }),
  });

  it("PT-CU02-19 Enviar el formulario con cine, fecha y hora pero sin película → 'Elegí una película para la sala.' sin llamar a la API", async () => {
    mockApi(routesFor(json(201, { sala: sala() })));
    renderAt("/crear-sala");
    await userEvent.type(await screen.findByLabelText("Cine y Zona"), "Cine Gaumont");
    await userEvent.type(screen.getByLabelText("Fecha"), "2030-01-01");
    await userEvent.type(screen.getByLabelText("Horario"), "20:30");
    await userEvent.click(screen.getByRole("button", { name: "Crear Sala" }));
    expect(await screen.findByText("Elegí una película para la sala.")).toBeInTheDocument();
    expect(calls.map((c) => c.key)).not.toContain("POST /salas");
  });

  it("PT-CU02-20 Rechazo del backend (400 invalid_sala) → muestra los detalles de validación", async () => {
    mockApi(routesFor(json(400, { error: "invalid_sala", details: ["date no puede estar en el pasado"] })));
    render(
      <MemoryRouter
        initialEntries={[{ pathname: "/crear-sala", state: { movie: { title: "Dune", place: "Multiplex" }, date: "2030-01-01", time: "20:30" } }]}
      >
        <App />
      </MemoryRouter>
    );
    await userEvent.click(await screen.findByRole("button", { name: "Crear Sala" }));
    expect(await screen.findByText("date no puede estar en el pasado")).toBeInTheDocument();
  });

  it("PT-CU02-21 Formulario precargado desde la cartelera → POST /salas con los datos y navega a la sala", async () => {
    mockApi(routesFor(json(201, { sala: sala() })));
    render(
      <MemoryRouter
        initialEntries={[{ pathname: "/crear-sala", state: { movie: { title: "Dune: Parte Tres", place: "Multiplex Belgrano" }, date: "2030-01-01", time: "20:30" } }]}
      >
        <App />
      </MemoryRouter>
    );
    await userEvent.click(await screen.findByRole("button", { name: "5" }));
    await userEvent.click(screen.getByRole("button", { name: "Crear Sala" }));
    expect(await screen.findByRole("heading", { name: "Dune: Parte Tres" })).toBeInTheDocument();
    expect(calls.find((c) => c.key === "POST /salas").body).toEqual({
      movie: "Dune: Parte Tres",
      place: "Multiplex Belgrano",
      date: "2030-01-01",
      time: "20:30",
      capacity: 5,
      note: "",
    });
  });
});

describe("CU-04 / CU-06 Incorporacion y abandono — frontend", () => {
  const id = sala().id;

  it("PT-CU04-09 'Unirme a la Sala' → POST miembros y pasa a mostrar 'Salir de la Sala'", async () => {
    const joined = sala({ members: [...sala().members, { id: USER.id, name: USER.name, genres: [], isAdmin: false }] });
    mockApi({
      [`GET /salas/${id}`]: json(200, { sala: sala() }),
      [`POST /salas/${id}/miembros`]: json(200, { sala: joined }),
      [`POST /salas/${id}/chat-ticket`]: json(200, { ticket: "t" }),
    });
    renderAt(`/sala/${id}`);
    await userEvent.click(await screen.findByRole("button", { name: "Unirme a la Sala" }));
    expect(await screen.findByRole("button", { name: "Salir de la Sala" })).toBeInTheDocument();
    expect(screen.getByText("Miembros (2/4)")).toBeInTheDocument();
  });

  it("PT-CU04-10 Unirse a una sala que se llenó (409 sala_full) → 'La sala está completa.'", async () => {
    mockApi({
      [`GET /salas/${id}`]: json(200, { sala: sala() }),
      [`POST /salas/${id}/miembros`]: json(409, { error: "sala_full" }),
    });
    renderAt(`/sala/${id}`);
    await userEvent.click(await screen.findByRole("button", { name: "Unirme a la Sala" }));
    expect(await screen.findByText("La sala está completa.")).toBeInTheDocument();
  });

  it("PT-CU04-11 Sala con cupo lleno → botón deshabilitado 'Sala completa'", async () => {
    const llena = sala({
      capacity: 2,
      members: [...sala().members, { id: "u-caro", name: "Caro", genres: [], isAdmin: false }],
    });
    mockApi({ [`GET /salas/${id}`]: json(200, { sala: llena }) });
    renderAt(`/sala/${id}`);
    expect(await screen.findByRole("button", { name: "Sala completa" })).toBeDisabled();
  });

  it("PT-CU06-07 Último miembro sale (respuesta {sala: null}) → vuelve a 'Salas abiertas'", async () => {
    const propia = sala({ hostId: USER.id, members: [{ id: USER.id, name: USER.name, genres: [], isAdmin: true }] });
    mockApi({
      [`GET /salas/${id}`]: json(200, { sala: propia }),
      [`DELETE /salas/${id}/miembros/me`]: json(200, { sala: null }),
      [`POST /salas/${id}/chat-ticket`]: json(200, { ticket: "t" }),
      "GET /cartelera": json(200, { dates: [], date: null, screenings: [] }),
      "GET /salas": json(200, { salas: [] }),
    });
    renderAt(`/sala/${id}`);
    await userEvent.click(await screen.findByRole("button", { name: "Salir de la Sala" }));
    expect(await screen.findByText(/Todavía no hay salas abiertas/)).toBeInTheDocument();
  });

  it("PT-CU05-24 No miembro en la sala → chat deshabilitado con 'Unite a la sala para participar del chat'", async () => {
    mockApi({ [`GET /salas/${id}`]: json(200, { sala: sala() }) });
    renderAt(`/sala/${id}`);
    const input = await screen.findByRole("textbox", { name: "Mensaje" });
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute("placeholder", "Unite a la sala para participar del chat");
    expect(calls.map((c) => c.key)).not.toContain(`POST /salas/${id}/chat-ticket`);
  });
});
