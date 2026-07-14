import { useAppContext } from "../contexts/AppContext";

export default function Navbar() {
  const { user, setIsModalOpen } = useAppContext();

  return (
    <nav className="p-6 border-b border-white/10 flex justify-between items-center sticky top-0 bg-black/90 backdrop-blur-md z-40">
      <h2 className="text-2xl font-bold italic tracking-tighter font-serif">LumInsieme</h2>
      <div className="flex gap-6 items-center">
        <span className="text-blue-400 text-sm">Sr/a. {user.name}</span>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-700 px-4 py-2 text-sm font-bold rounded"
        >
          CREAR SALA
        </button>
      </div>
    </nav>
  );
}
