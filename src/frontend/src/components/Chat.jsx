import { useAppContext } from "../contexts/AppContext";

export default function Chat() {
  const { activeRoom, messages, sendMessage, setView, user } = useAppContext();

  return (
    <div className="h-screen flex flex-col bg-black">
      <header className="p-4 border-b border-blue-900/50 flex justify-between items-center">
        <button
          onClick={() => setView("dashboard")}
          className="text-xs text-slate-500 hover:text-white"
        >
          ← VOLVER
        </button>
        <div className="text-center">
          <h2 className="text-xl italic font-serif">{activeRoom?.movie}</h2>
          <p className="text-[10px] text-blue-400 uppercase tracking-widest">{activeRoom?.place}</p>
        </div>
        <button
          onClick={() => setView("dashboard")}
          className="text-xs text-red-500 font-bold border border-red-500 px-2 py-1"
        >
          SALIR
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-4" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/carbon-fibre.png')" }}>
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.user === user.name ? "items-end" : "items-start"}`}
          >
            <span className="text-[10px] text-slate-500 mb-1 uppercase tracking-tighter">
              {m.user}
            </span>
            <div
              className={`max-w-[80%] p-3 rounded ${
                m.user === user.name ? "bg-blue-900 text-white" : "bg-slate-800 text-slate-200"
              }`}
            >
              <p className="text-sm">{m.text}</p>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={sendMessage} className="p-4 border-t border-blue-900/50 flex gap-2">
        <input
          name="msg"
          placeholder="Escribe un mensaje..."
          className="flex-1 bg-transparent border border-slate-700 p-3 outline-none focus:border-blue-500"
        />
        <button className="bg-white text-black px-6 font-bold uppercase text-xs">
          Enviar
        </button>
      </form>
    </div>
  );
}
