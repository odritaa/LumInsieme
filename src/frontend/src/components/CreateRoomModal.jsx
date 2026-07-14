import { useAppContext } from "../contexts/AppContext";

export default function CreateRoomModal() {
  const { isModalOpen, prefillModal, createRoom, closeModal, user } = useAppContext();

  if (!isModalOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-6 z-50">
      <form onSubmit={createRoom} className="bg-slate-900 p-8 border border-blue-500 max-w-sm w-full space-y-4">
        <h3 className="text-2xl italic mb-4 font-serif">Nueva Proyección</h3>

        <input
          name="movie"
          placeholder="Película"
          required
          defaultValue={prefillModal?.title || ""}
          readOnly={!!prefillModal}
          className={`w-full bg-black border p-2 outline-none ${
            prefillModal ? "border-blue-700 text-blue-300" : "border-slate-700"
          }`}
        />

        <input
          name="place"
          placeholder="Cine / Lugar"
          required
          defaultValue={prefillModal?.place || ""}
          readOnly={!!prefillModal}
          className={`w-full bg-black border p-2 outline-none ${
            prefillModal ? "border-blue-700 text-blue-300" : "border-slate-700"
          }`}
        />

        <input
          name="host"
          type="hidden"
          value={user.name || "Anónimo"}
        />

        <input
          name="date"
          type="date"
          required
          className="w-full bg-black border border-slate-700 p-2 outline-none focus:border-blue-500"
        />

        <input
          name="time"
          type="time"
          required
          className="w-full bg-black border border-slate-700 p-2 outline-none focus:border-blue-500"
        />

        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 bg-white text-black py-2 font-bold hover:bg-blue-400 transition-colors"
          >
            CREAR
          </button>
          <button
            type="button"
            onClick={closeModal}
            className="flex-1 border border-white py-2 hover:bg-white hover:text-black transition-colors"
          >
            CANCELAR
          </button>
        </div>
      </form>
    </div>
  );
}
