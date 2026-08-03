import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../contexts/AppContext";
import { fetchMovies } from "../services/movieService";
import Navbar from "../components/Navbar";
import RoomCard from "../components/RoomCard";
import MovieCard from "../components/MovieCard";

export default function Feed() {
  const { rooms } = useAppContext();
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchMovies()
      .then((data) => { if (!cancelled) setMovies(data); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="page">
      <Navbar action={{ to: "/crear-sala", label: "+ Crear Sala" }} />

      <section className="feed-container">
        <div className="feed-header">
          <h1>Salas Disponibles</h1>
          <p>Encontrá el grupo perfecto para tu próxima noche de cine</p>
        </div>

        {rooms.length > 0 ? (
          <div className="cards-grid">
            {rooms.map((room, i) => (
              <RoomCard key={room.id} room={room} index={i} />
            ))}
          </div>
        ) : (
          <p className="feed-state">
            Todavía no hay salas abiertas. Creá la primera desde el botón + Crear Sala.
          </p>
        )}

        <h2 className="feed-section-title">Películas en Cartelera</h2>

        {loading && <p className="feed-state">Cargando películas...</p>}
        {error && <p className="feed-state feed-state-error">No pudimos cargar la cartelera: {error}</p>}
        {!loading && !error && movies.length === 0 && (
          <p className="feed-state">No hay funciones publicadas por ahora.</p>
        )}
        {!loading && !error && movies.length > 0 && (
          <div className="cards-grid">
            {movies.map((movie, i) => (
              <MovieCard key={`${movie.title}-${movie.place}-${i}`} movie={movie} index={i} />
            ))}
          </div>
        )}
      </section>

      <Link className="fab-button" to="/crear-sala" title="Crear nueva sala" aria-label="Crear nueva sala">
        +
      </Link>
    </div>
  );
}
