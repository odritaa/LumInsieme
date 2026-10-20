import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { currentTime, todayISO } from "../utils/format";

function groupByHour(screenings) {
  const groups = [];
  for (const screening of screenings) {
    const hour = `${screening.time.slice(0, 2)}:00`;
    const last = groups[groups.length - 1];
    if (last?.hour === hour) last.items.push(screening);
    else groups.push({ hour, items: [screening] });
  }
  return groups;
}

/**
 * Funciones de un día agrupadas por franja horaria (llegan ya ordenadas por hora).
 * Elegir una abre Crear Sala con película, cine, fecha y horario precargados.
 */
export default function ScreeningTimeline({ date, screenings }) {
  const navigate = useNavigate();
  const groups = useMemo(() => groupByHour(screenings), [screenings]);
  const now = date === todayISO() ? currentTime() : null;

  const createRoomFor = (screening) =>
    navigate("/crear-sala", {
      state: {
        movie: { title: screening.title, place: screening.place },
        date,
        time: screening.time,
      },
    });

  return (
    <div className="timeline">
      {groups.map((group) => (
        <section key={group.hour} className="timeline-group">
          <h3 className="timeline-hour">{group.hour}</h3>
          <ul className="timeline-list">
            {group.items.map((s) => {
              const past = now !== null && s.time < now;
              return (
                <li key={`${s.time}-${s.title}-${s.format}-${s.place}`}>
                  <button
                    type="button"
                    className={`timeline-item${past ? " timeline-item-past" : ""}`}
                    disabled={past}
                    onClick={() => createRoomFor(s)}
                    title={past ? "Esta función ya empezó" : "Crear una sala para esta función"}
                  >
                    <span className="timeline-time">{s.time}</span>
                    <span className="timeline-info">
                      <span className="timeline-title">{s.title}</span>
                      <span className="timeline-meta">
                        {[s.format, s.place].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="timeline-cta" aria-hidden="true">
                      {past ? "Empezó" : "Crear sala →"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
