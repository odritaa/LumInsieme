import { useEffect, useRef, useState } from "react";
import { CURRENT_USER_ID } from "../services/mockData";
import { getAvatarStyle, getInitials } from "../utils/avatar";

export default function ChatPanel({ messages, onSend, disabled = false, disabledHint }) {
  const [draft, setDraft] = useState("");
  const listRef = useRef(null);

  // Se mueve el scroll del propio contenedor: scrollIntoView arrastraría la página entera.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages.length]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    onSend(draft);
    setDraft("");
  };

  return (
    <div className="room-chat-container">
      <div className="room-chat-header">Coordinación de la salida</div>

      <div className="room-chat-messages" ref={listRef}>
        {messages.length === 0 && (
          <p className="chat-empty">Todavía no hay mensajes. Rompé el hielo.</p>
        )}
        {messages.map((m) => {
          const isOwn = m.authorId === CURRENT_USER_ID;
          return (
            <div key={m.id} className={`chat-message${isOwn ? " chat-message-own" : ""}`}>
              <div className="chat-message-avatar" style={getAvatarStyle(m.authorId, isOwn)}>
                {getInitials(m.author)}
              </div>
              <div className="chat-message-content">
                <div className="chat-message-header">
                  <span className="chat-message-author">{m.author}</span>
                  <span className="chat-message-time">{m.time}</span>
                </div>
                <div className="chat-message-bubble">{m.text}</div>
              </div>
            </div>
          );
        })}
      </div>

      <form className="room-chat-input-area" onSubmit={handleSubmit}>
        <input
          type="text"
          className="room-chat-input"
          placeholder={disabled ? disabledHint : "Escribí un mensaje..."}
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Mensaje"
        />
        <button type="submit" className="room-chat-send" disabled={disabled || !draft.trim()}>
          Enviar
        </button>
      </form>
    </div>
  );
}
