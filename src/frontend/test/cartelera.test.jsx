import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import DaySelector from "../src/components/DaySelector";
import ScreeningTimeline from "../src/components/ScreeningTimeline";

// Solo se congela Date: los timers reales siguen andando para userEvent.
function freezeAt(isoLocal) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(isoLocal));
}

const screening = (time, title = "Dune", format = "2D Subtitulada") => ({
  time,
  title,
  format,
  place: "Multiplex Belgrano",
  duration: "1 hora",
});

function LocationProbe() {
  const location = useLocation();
  return <pre data-testid="state">{JSON.stringify({ path: location.pathname, state: location.state })}</pre>;
}

function renderTimeline(props) {
  return render(
    <MemoryRouter initialEntries={["/feed"]}>
      <Routes>
        <Route path="/feed" element={<ScreeningTimeline {...props} />} />
        <Route path="/crear-sala" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("CU-03 Exploracion de cartelera — DaySelector", () => {
  it("PT-CU03-19 DaySelector sin fechas → no renderiza nada", () => {
    const { container } = render(<DaySelector dates={[]} selected={null} onSelect={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("PT-CU03-20 DaySelector → chips 'Hoy', 'Mañana' y fecha corta para el resto", () => {
    freezeAt("2026-10-21T12:00:00");
    render(<DaySelector dates={["2026-10-21", "2026-10-22", "2026-10-24"]} selected="2026-10-21" onSelect={() => {}} />);
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Hoy", "Mañana", "sáb, 24 oct"]);
  });

  it("PT-CU03-21 DaySelector → solo el día elegido tiene aria-selected=true", () => {
    render(<DaySelector dates={["2030-01-01", "2030-01-02"]} selected="2030-01-02" onSelect={() => {}} />);
    const [first, second] = screen.getAllByRole("tab");
    expect(first).toHaveAttribute("aria-selected", "false");
    expect(second).toHaveAttribute("aria-selected", "true");
    expect(second).toHaveClass("active");
  });

  it("PT-CU03-22 DaySelector al tocar un día → onSelect con la fecha AAAA-MM-DD", async () => {
    const onSelect = vi.fn();
    render(<DaySelector dates={["2030-01-01", "2030-01-02"]} selected="2030-01-01" onSelect={onSelect} />);
    await userEvent.click(screen.getAllByRole("tab")[1]);
    expect(onSelect).toHaveBeenCalledWith("2030-01-02");
  });
});

describe("CU-03 Exploracion de cartelera — ScreeningTimeline", () => {
  it("PT-CU03-23 ScreeningTimeline de hoy → funciones ya iniciadas deshabilitadas con 'Empezó'", () => {
    freezeAt("2026-10-21T18:00:00");
    renderTimeline({
      date: "2026-10-21",
      screenings: [screening("17:30", "Pasada"), screening("18:00", "Justa"), screening("21:00", "Futura")],
    });
    const pasada = screen.getByRole("button", { name: /Pasada/ });
    expect(pasada).toBeDisabled();
    expect(pasada).toHaveAttribute("title", "Esta función ya empezó");
    expect(pasada).toHaveTextContent("Empezó");
    expect(screen.getByRole("button", { name: /Justa/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Futura/ })).toBeEnabled();
  });

  it("PT-CU03-24 ScreeningTimeline de otro día → ninguna función deshabilitada", () => {
    freezeAt("2026-10-21T23:00:00");
    renderTimeline({ date: "2026-10-22", screenings: [screening("10:00"), screening("13:15", "Otra")] });
    screen.getAllByRole("button").forEach((button) => expect(button).toBeEnabled());
  });

  it("PT-CU03-25 ScreeningTimeline → agrupa por franja horaria (HH:00) respetando el orden", () => {
    renderTimeline({
      date: "2030-01-01",
      screenings: [screening("18:05", "A"), screening("18:40", "B"), screening("21:00", "C")],
    });
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["18:00", "21:00"]);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("PT-CU03-26 Elegir una función futura → navega a /crear-sala con película, cine, fecha y hora precargados", async () => {
    renderTimeline({ date: "2030-01-01", screenings: [screening("20:15", "El Secreto de sus Ojos")] });
    await userEvent.click(screen.getByRole("button", { name: /El Secreto de sus Ojos/ }));
    expect(JSON.parse(screen.getByTestId("state").textContent)).toEqual({
      path: "/crear-sala",
      state: {
        movie: { title: "El Secreto de sus Ojos", place: "Multiplex Belgrano" },
        date: "2030-01-01",
        time: "20:15",
      },
    });
  });
});
