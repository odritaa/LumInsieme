import { useAppContext } from "../contexts/AppContext";

export default function RoomCard({ room }) {
  const { handleJoin } = useAppContext();

  return (
    <div className="bg-slate-900/30 border border-blue-900/20 p-6 hover:border-blue-500 transition-all group">
      <h4 className="text-2xl mb-4 group-hover:text-blue-400 font-serif">{room.movie}</h4>
      <div className="text-slate-400 text-sm space-y-2 mb-6">
        <p>📍 {room.place}</p>
        <p>📅 {room.date} | ⏰ {room.time}</p>
        <p className="text-xs italic">Organizado por: {room.host}</p>
      </div>
      <button
        onClick={() => handleJoin(room)}
        className="w-full border border-white py-2 font-bold hover:bg-white hover:text-black transition-all text-xs"
      >
        UNIRSE A LA SALA
      </button>
    </div>
  );
}
