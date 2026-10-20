import { dayLabel } from "../utils/format";

/** Chips horizontales para elegir el día de la cartelera. Scrollean en mobile. */
export default function DaySelector({ dates, selected, onSelect }) {
  if (dates.length === 0) return null;

  return (
    <div className="day-selector" role="tablist" aria-label="Día de la cartelera">
      {dates.map((date) => {
        const active = date === selected;
        return (
          <button
            key={date}
            type="button"
            role="tab"
            aria-selected={active}
            className={`day-chip${active ? " active" : ""}`}
            onClick={() => onSelect(date)}
          >
            {dayLabel(date)}
          </button>
        );
      })}
    </div>
  );
}
