import { useAppContext } from "../contexts/AppContext";

const genres = ["Noir", "Nouvelle Vague", "Expresionismo", "Mudo", "Sci-Fi"];

export default function Profile() {
  const { user, setUser, setView } = useAppContext();

  const toggleGenre = (g) => {
    setUser({
      ...user,
      genres: user.genres.includes(g)
        ? user.genres.filter((x) => x !== g)
        : [...user.genres, g],
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-black">
      <div className="max-w-md w-full bg-slate-900/50 p-10 border border-blue-900/30 rounded-lg">
        <h2 className="text-3xl mb-6 italic font-serif">Crea tu Perfil de Espectador</h2>
        <input
          type="text"
          placeholder="Tu Nombre"
          className="w-full bg-black border border-slate-700 p-3 mb-6 focus:border-blue-500 outline-none"
          onBlur={(e) => setUser({ ...user, name: e.target.value })}
        />
        <p className="text-sm text-slate-400 mb-4 uppercase tracking-widest">Estilos favoritos</p>
        <div className="flex flex-wrap gap-2 mb-8">
          {genres.map((g) => (
            <button
              key={g}
              onClick={() => toggleGenre(g)}
              className={`text-xs border px-3 py-1 hover:bg-blue-600 transition-colors ${
                user.genres.includes(g)
                  ? "bg-blue-600 border-blue-500"
                  : "border-slate-700"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
        <button
          onClick={() => setView("dashboard")}
          className="w-full bg-white text-black font-bold py-3 hover:bg-blue-400 transition-colors"
        >
          GUARDAR Y ENTRAR
        </button>
      </div>
    </div>
  );
}
