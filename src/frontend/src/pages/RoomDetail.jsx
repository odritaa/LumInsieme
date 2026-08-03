import { Navigate, useParams } from "react-router-dom";
import { useAppContext } from "../contexts/AppContext";
import { CURRENT_USER_ID } from "../services/mockData";
import Navbar from "../components/Navbar";
import ChatPanel from "../components/ChatPanel";
import { getAvatarStyle, getInitials } from "../utils/avatar";
import { formatDateTime, posterLabel } from "../utils/format";

export default function RoomDetail() {
  const { id } = useParams();
  const { getRoom, joinRoom, leaveRoom, getMessages, sendMessage } = useAppContext();

  const room = getRoom(id);
  if (!room) return <Navigate to="/feed" replace />;

  const isMember = room.members.some((m) => m.id === CURRENT_USER_ID);
  const free = Math.max(room.capacity - room.members.length, 0);
  const messages = getMessages(room.id);

  return (
    <div className="page page-column">
      <Navbar action={{ to: "/feed", label: "← Volver al Feed" }} />

      <div className="room-header">
        <div className="room-header-content">
          <div className="room-movie-info">
            <div className="room-movie-poster">{posterLabel(room.movie)}</div>
            <div className="room-movie-details">
              <h2>{room.movie}</h2>
              <div className="room-cinema-info">{room.place}</div>
              <div className="room-date-time">{formatDateTime(room.date, room.time)}</div>
              {room.note && <p className="room-description">{room.note}</p>}
              <div className="room-actions">
                {isMember ? (
                  <button type="button" className="btn-danger" onClick={() => leaveRoom(room.id)}>
                    Salir de la Sala
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={free === 0}
                    onClick={() => joinRoom(room.id)}
                  >
                    {free === 0 ? "Sala completa" : "Unirme a la Sala"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="room-body">
        <div className="room-members-panel">
          <h3 className="room-members-title">
            Miembros ({room.members.length}/{room.capacity})
          </h3>
          <div className="room-member-list">
            {room.members.map((m) => {
              const isSelf = m.id === CURRENT_USER_ID;
              return (
                <div key={m.id} className="room-member-item">
                  <div className="room-member-avatar" style={getAvatarStyle(m.id, isSelf)}>
                    {getInitials(m.name)}
                  </div>
                  <div className="room-member-info">
                    <h4>{m.name}</h4>
                    <p className="room-member-genre">{(m.genres ?? []).join(" · ")}</p>
                  </div>
                  {m.isAdmin && <div className="room-member-admin">Admin</div>}
                  {isSelf && !m.isAdmin && (
                    <div className="room-member-admin room-member-admin-self">Tú</div>
                  )}
                </div>
              );
            })}

            {free > 0 && (
              <div className="available-spots">
                <strong>
                  +{free} {free === 1 ? "lugar" : "lugares"}
                </strong>
                <br />
                {free === 1 ? "disponible" : "disponibles"}
              </div>
            )}
          </div>
        </div>

        <ChatPanel
          messages={messages}
          onSend={(text) => sendMessage(room.id, text)}
          disabled={!isMember}
          disabledHint="Unite a la sala para participar del chat"
        />
      </div>
    </div>
  );
}
