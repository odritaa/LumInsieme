import { useState, useEffect } from "react";
import { useAppContext } from "../contexts/AppContext";
import { fetchMovies } from "../services/movieService";
import Navbar from "./Navbar";
import RoomCard from "./RoomCard";
import MovieCard from "./MovieCard";
import CreateRoomModal from "./CreateRoomModal";

export default function Dashboard() {
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
    <div className="min-h-screen bg-black">
      <Navbar />

      <main className="p-8 max-w-6xl mx-auto">
        <h3 className="text-4xl mb-10 opacity-80 uppercase tracking-widest text-center font-serif">
          Cartelera de Encuentros
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>

        <h3 className="text-4xl mb-10 opacity-80 uppercase tracking-widest text-center font-serif">
          Películas en Cartelera
        </h3>

        {loading && (
          <p className="text-center text-slate-400 py-12">Cargando películas...</p>
        )}
        {error && (
          <p className="text-center text-red-400 py-12">Error: {error}</p>
        )}
        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {movies.map((movie, i) => (
              <MovieCard key={i} movie={movie} />
            ))}
          </div>
        )}
      </main>

      <CreateRoomModal />
    </div>
  );
}
