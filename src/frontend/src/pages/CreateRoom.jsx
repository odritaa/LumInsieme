import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAppContext } from "../contexts/AppContext";
import { fetchMovies } from "../services/movieService";
import Navbar from "../components/Navbar";
import { formatDate } from "../utils/format";

const CAPACITIES = [2, 3, 4, 5, 6];
const MAX_RESULTS = 8;

export default function CreateRoom() {
  const { createRoom } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = location.state?.movie ?? null;

  const [catalog, setCatalog] = useState([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(prefill);
  const [place, setPlace] = useState(prefill?.place ?? "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [capacity, setCapacity] = useState(3);
  const [note, setNote] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchMovies()
      .then((data) => { if (!cancelled) setCatalog(data); })
      .catch(() => { if (!cancelled) setCatalog([]); });
    return () => { cancelled = true; };
  }, []);

  // Títulos únicos que matchean lo tipeado. Sólo se listan si no hay una selección.
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const seen = new Set();
    return catalog
      .filter((m) => m.title.toLowerCase().includes(q))
      .filter((m) => (seen.has(m.title) ? false : seen.add(m.title)))
      .slice(0, MAX_RESULTS);
  }, [catalog, query]);

  // Cines donde se proyecta la película elegida.
  const cinemas = useMemo(() => {
    if (!selected) return [];
    const places = catalog
      .filter((m) => m.title === selected.title && m.place)
      .map((m) => m.place);
    if (selected.place) places.unshift(selected.place);
    return [...new Set(places)];
  }, [catalog, selected]);

  const pickMovie = (movie) => {
    setSelected({ title: movie.title, place: movie.place });
    setPlace(movie.place ?? "");
    if (movie.date) setDate(movie.date);
    setQuery("");
  };

  const clearMovie = () => {
    setSelected(null);
    setPlace("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selected) {
      setError("Elegí una película para la sala.");
      return;
    }
    if (!place.trim()) {
      setError("Indicá en qué cine se hace la función.");
      return;
    }
    const room = createRoom({
      movie: selected.title,
      place: place.trim(),
      date,
      time,
      capacity,
      note: note.trim(),
    });
    navigate(`/sala/${room.id}`, { replace: true });
  };

  return (
    <div className="page">
      <Navbar action={{ to: "/feed", label: "← Volver" }} />

      <div className="form-container">
        <div className="form-header">
          <h1>Crear Nueva Sala</h1>
          <p>Convocá cinéfilos para tu próxima función</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <label className="form-label" htmlFor="movie-search">
              Seleccionar Película
            </label>
            <input
              id="movie-search"
              type="text"
              className="input-dark"
              placeholder="Buscá la película..."
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            {results.length > 0 && (
              <div className="search-results">
                {results.map((m) => (
                  <button
                    key={`${m.title}-${m.place}`}
                    type="button"
                    className="search-result-item"
                    onClick={() => pickMovie(m)}
                  >
                    <p className="search-result-title">{m.title}</p>
                    <p className="search-result-meta">
                      {[m.place, formatDate(m.date)].filter(Boolean).join(" · ")}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {query.trim() && results.length === 0 && (
              <div className="search-results">
                <p className="search-empty">Sin resultados en la cartelera.</p>
              </div>
            )}

            {selected && (
              <div className="selected-movie">
                <div>
                  <p className="selected-movie-label">Película seleccionada:</p>
                  <p className="selected-movie-title">{selected.title}</p>
                </div>
                <button type="button" className="selected-movie-clear" onClick={clearMovie}>
                  Cambiar
                </button>
              </div>
            )}
          </div>

          <div className="form-section">
            <label className="form-label" htmlFor="place">
              Cine y Zona
            </label>
            {cinemas.length > 0 ? (
              <select
                id="place"
                className="input-dark"
                required
                value={place}
                onChange={(e) => setPlace(e.target.value)}
              >
                <option value="" disabled>
                  Seleccioná un cine...
                </option>
                {cinemas.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="place"
                type="text"
                className="input-dark"
                placeholder="Ej: Cine Capitol - Sala 2"
                required
                value={place}
                onChange={(e) => setPlace(e.target.value)}
              />
            )}
          </div>

          <div className="form-section">
            <div className="form-row">
              <div>
                <label className="form-label" htmlFor="date">
                  Fecha
                </label>
                <input
                  id="date"
                  type="date"
                  className="input-dark"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="time">
                  Horario
                </label>
                <input
                  id="time"
                  type="time"
                  className="input-dark"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <span className="form-label">Capacidad Máxima del Grupo</span>
            <div className="capacity-selector">
              {CAPACITIES.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`capacity-btn${capacity === n ? " active" : ""}`}
                  aria-pressed={capacity === n}
                  onClick={() => setCapacity(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="form-section">
            <label className="form-label" htmlFor="note">
              Nota para otros cinéfilos (Opcional)
            </label>
            <textarea
              id="note"
              className="input-dark"
              placeholder="Ej: Buscamos gente que ame el cine de autor, primer encuentro del grupo, etc."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="form-actions">
            <Link className="btn-secondary" to="/feed">
              Cancelar
            </Link>
            <button type="submit" className="btn-primary">
              Crear Sala
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
