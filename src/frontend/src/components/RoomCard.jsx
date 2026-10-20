import { Link } from "react-router-dom";
import { useAppContext } from "../contexts/AppContext";
import { getAvatarStyle, getInitials } from "../utils/avatar";
import { formatDateTime, posterLabel } from "../utils/format";

export default function RoomCard({ room, index = 0 }) {
  const { user } = useAppContext();
  const taken = room.members.length;
  const free = Math.max(room.capacity - taken, 0);
  const isMember = room.members.some((m) => m.id === user?.id);

  return (
    <div className="room-card" style={{ animationDelay: `${index * 0.1}s` }}>
      <div className="room-card-header">
        <div className="cinema-poster-placeholder">{posterLabel(room.movie)}</div>
        <h3>{room.movie}</h3>
        <p className="room-cinema-info">{room.place}</p>
      </div>

      <div className="divider-subtle" />
      <p className="room-card-datetime">{formatDateTime(room.date, room.time)}</p>

      <div className="capacity-section">
        <span className="capacity-label">Capacidad</span>
        <span className="capacity-count">
          {taken} / {room.capacity}
        </span>
      </div>
      <div className="capacity-bar">
        <div
          className="capacity-bar-fill"
          style={{ width: `${Math.min((taken / room.capacity) * 100, 100)}%` }}
        />
      </div>

      <div className="members-section">
        <p className="members-label">Miembros</p>
        <div className="members-avatars">
          {room.members.map((m) => (
            <div
              key={m.id}
              className="avatar-small"
              style={getAvatarStyle(m.id, m.id === user?.id)}
              title={m.name}
            >
              {getInitials(m.name)}
            </div>
          ))}
          {free > 0 && (
            <div className="avatar-small avatar-more" title={`${free} lugares disponibles`}>
              +{free}
            </div>
          )}
        </div>
      </div>

      <Link className="btn-primary cta-button-full" to={`/sala/${room.id}`}>
        {isMember ? "Ver la sala" : free === 0 ? "Sala completa" : "Unirse a la Sala"}
      </Link>
    </div>
  );
}
