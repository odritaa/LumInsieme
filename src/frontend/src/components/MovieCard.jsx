import { useNavigate } from "react-router-dom";
import { formatDate, posterLabel } from "../utils/format";

/** Película de la cartelera (scrapper). Al elegirla se abre el alta de sala prellenada. */
export default function MovieCard({ movie, index = 0 }) {
  const navigate = useNavigate();

  const createRoomHere = () =>
    navigate("/crear-sala", { state: { movie: { title: movie.title, place: movie.place } } });

  const screenings = movie.screenings ?? [];

  return (
    <div className="room-card" style={{ animationDelay: `${index * 0.1}s` }}>
      <div className="room-card-header">
        <div className="cinema-poster-placeholder">{posterLabel(movie.title)}</div>
        <h3>{movie.title}</h3>
        <p className="room-cinema-info">{movie.place}</p>
      </div>

      <div className="divider-subtle" />
      <p className="room-card-datetime">
        {[formatDate(movie.date), movie.duration].filter(Boolean).join(" · ")}
      </p>

      {screenings.length > 0 && (
        <div className="screenings-list">
          {screenings.map((s, i) => (
            <div key={`${s.type}-${i}`}>
              <p className="screening-type">{s.type}</p>
              <div className="screening-hours">
                {(s.hours ?? []).map((h) => (
                  <span key={h} className="screening-hour">
                    {h}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <button type="button" className="btn-primary cta-button-full" onClick={createRoomHere}>
        Crear sala para esta función
      </button>
    </div>
  );
}
