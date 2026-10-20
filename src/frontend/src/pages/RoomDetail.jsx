import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useAppContext } from "../contexts/AppContext";
import useSalaChat from "../hooks/useSalaChat";
import Navbar from "../components/Navbar";
import ChatPanel from "../components/ChatPanel";
import SessionLoader from "../components/SessionLoader";
import { getAvatarStyle, getInitials } from "../utils/avatar";
import { formatDateTime, posterLabel } from "../utils/format";

export default function RoomDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, getRoom, loadRoom, joinRoom, leaveRoom } = useAppContext();
  const [status, setStatus] = useState("loading");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const room = getRoom(id);
  const isMember = Boolean(room?.members.some((m) => m.id === user?.id));
  const chat = useSalaChat(room?.id, isMember);

  // Siempre se refresca: la copia del feed puede tener miembros desactualizados.
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    loadRoom(id)
      .then((fresh) => {
        if (!cancelled) setStatus(fresh ? "ready" : "missing");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [id, loadRoom]);

  if (!room) {
    if (status === "loading") return <SessionLoader message="Cargando sala…" />;
    if (status === "error") {
      return (
        <div className="page">
          <Navbar action={{ to: "/feed", label: "← Volver al Feed" }} />
          <p className="feed-state feed-state-error">No pudimos cargar la sala. Probá de nuevo.</p>
        </div>
      );
    }
    return <Navigate to="/feed?vista=salas" replace />;
  }

  const free = Math.max(room.capacity - room.members.length, 0);

  const runAction = async (action) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = () => runAction(() => joinRoom(room.id));

  const handleLeave = () =>
    runAction(async () => {
      const remaining = await leaveRoom(room.id);
      if (!remaining) navigate("/feed?vista=salas", { replace: true });
    });

  return (
    <div className="page page-column">
      <Navbar action={{ to: "/feed?vista=salas", label: "← Volver al Feed" }} />

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
                  <button type="button" className="btn-danger" disabled={busy} onClick={handleLeave}>
                    Salir de la Sala
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busy || free === 0}
                    onClick={handleJoin}
                  >
                    {free === 0 ? "Sala completa" : "Unirme a la Sala"}
                  </button>
                )}
              </div>
              {actionError && <p className="form-error">{actionError}</p>}
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
              const isSelf = m.id === user?.id;
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
          messages={chat.messages}
          onSend={chat.send}
          status={chat.status}
          currentUserId={user?.id}
          disabled={!isMember}
          disabledHint="Unite a la sala para participar del chat"
        />
      </div>
    </div>
  );
}
