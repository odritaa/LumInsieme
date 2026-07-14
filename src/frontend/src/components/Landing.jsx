import { useAppContext } from "../contexts/AppContext";

export default function Landing() {
  const { setView } = useAppContext();

  return (
    <div className="h-screen flex flex-col items-center justify-center text-center p-6 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-black">
      <div className="mb-8 animate-pulse">
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
          <line x1="7" y1="2" x2="7" y2="22" />
          <line x1="17" y1="2" x2="17" y2="22" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <line x1="2" y1="7" x2="7" y2="7" />
          <line x1="2" y1="17" x2="7" y2="17" />
          <line x1="17" y1="17" x2="22" y2="17" />
          <line x1="17" y1="7" x2="22" y2="7" />
        </svg>
      </div>
      <h1 className="text-7xl font-bold mb-4 tracking-tighter italic font-serif">LumInsieme</h1>
      <p className="text-slate-400 max-w-md mb-8 italic">&ldquo;El cine es un trabajo de equipo. El encuentro comienza aquí.&rdquo;</p>
      <button
        onClick={() => setView("profile")}
        className="px-10 py-4 border border-white hover:bg-white hover:text-black transition-all duration-500 tracking-widest font-bold"
      >
        INGRESAR A LA FUNCIÓN
      </button>
    </div>
  );
}
