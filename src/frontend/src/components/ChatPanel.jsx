import { useEffect, useRef, useState } from "react";
import { getAvatarStyle, getInitials } from "../utils/avatar";

const STATUS_LABELS = {
  connecting: "Conectando…",
  error: "Chat no disponible",
};

export default function ChatPanel({
  messages,
  onSend,
  currentUserId,
  status = "open",
  disabled = false,
  disabledHint,
}) {
  const [draft, setDraft] = useState("");
  const listRef = useRef(null);
  const offline = !disabled && status !== "open";

  // Se mueve el scroll del propio contenedor: scrollIntoView arrastraría la página entera.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages.length]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    if (onSend(draft) !== false) setDraft("");
  };

  return (
    <div className="room-chat-container">
      <div className="room-chat-header">
        Coordinación de la salida
        {!disabled && STATUS_LABELS[status] && (
          <span className="room-chat-status">{STATUS_LABELS[status]}</span>
        )}
      </div>

      <div className="room-chat-messages" ref={listRef}>
        {messages.length === 0 && (
          <p className="chat-empty">
            {disabled ? disabledHint : "Todavía no hay mensajes. Rompé el hielo."}
          </p>
        )}
        {messages.map((m) => {
          const isOwn = m.authorId === currentUserId;
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
          maxLength={1000}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Mensaje"
        />
        <button type="submit" className="room-chat-send" disabled={disabled || offline || !draft.trim()}>
          Enviar
        </button>
      </form>
    </div>
  );
}
