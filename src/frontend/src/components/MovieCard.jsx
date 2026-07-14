import { useAppContext } from "../contexts/AppContext";

export default function MovieCard({ movie }) {
  const { openModalWithMovie } = useAppContext();

  return (
    <div className="bg-slate-900/30 border border-blue-900/20 p-6 hover:border-blue-500 transition-all group cursor-pointer"
         onClick={() => openModalWithMovie(movie)}>
      <h4 className="text-2xl mb-4 group-hover:text-blue-400 font-serif">{movie.title}</h4>
      <div className="text-slate-400 text-sm space-y-2 mb-4">
        <p>📍 {movie.place}</p>
        <p>🎬 {movie.duration}</p>
      </div>
      <div className="space-y-1 mb-6">
        {movie.screenings.map((s, i) => (
          <p key={i} className="text-xs text-blue-300">
            {s.type}: {s.hours.join(" - ")}
          </p>
        ))}
      </div>
      <button className="w-full border border-white py-2 font-bold hover:bg-white hover:text-black transition-all text-xs">
        CREAR SALA
      </button>
    </div>
  );
}
