import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppContext } from "../contexts/AppContext";
import Navbar from "../components/Navbar";
import ConfirmModal from "../components/ConfirmModal";
import { getInitials } from "../utils/avatar";

export default function Profile() {
  const { user, deleteAccount, logout } = useAppContext();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);

  const handleDelete = async () => {
    await deleteAccount();
    navigate("/", { replace: true });
  };

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const subtitle = [user.age && `${user.age} años`, user.city].filter(Boolean).join(" · ");

  return (
    <div className="page">
      <Navbar action={{ to: "/feed", label: "← Explorar Salas" }} />

      <div className="profile-header">
        <div className="profile-avatar-large">{getInitials(user.name)}</div>
        <div className="profile-info">
          <h1 className="profile-name">{user.name}</h1>
          {subtitle && <p className="profile-age">{subtitle}</p>}
          <div className="profile-actions">
            <Link className="profile-edit-btn" to="/perfil/editar">
              Editar perfil
            </Link>
            <button type="button" className="profile-edit-btn" onClick={handleLogout}>
              Cerrar sesión
            </button>
            <button type="button" className="btn-danger" onClick={() => setConfirming(true)}>
              Eliminar cuenta
            </button>
          </div>
        </div>
      </div>

      <div className="profile-content">
        <div className="profile-section animate-slide-in">
          <h3 className="profile-section-title">Géneros favoritos</h3>
          {user.genres.length > 0 ? (
            <div className="genres-grid">
              {user.genres.map((g) => (
                <div key={g} className="tag-genre">
                  {g}
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">Todavía no elegiste géneros.</p>
          )}
        </div>

        <div className="profile-section animate-slide-in" style={{ animationDelay: "0.1s" }}>
          <h3 className="profile-section-title">Mis 5 películas favoritas</h3>
          {user.favoriteMovies.some((m) => m.title) ? (
            <div className="movies-grid">
              {user.favoriteMovies
                .filter((m) => m.title)
                .map((m, i) => (
                  <div key={`${m.title}-${i}`} className="movie-card">
                    <div className="movie-card-icon">{m.initials || getInitials(m.title)}</div>
                    <div className="movie-card-title">{m.title}</div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="empty-state">Todavía no cargaste tus favoritas.</p>
          )}
        </div>

        <div className="cta-section">
          <Link className="btn-primary cta-button" to="/feed">
            Explorar salas disponibles
          </Link>
        </div>
      </div>

      {confirming && (
        <ConfirmModal
          title="Eliminar cuenta"
          message="Esta acción es permanente. Tu perfil y datos se borrarán y se cerrará tu sesión. ¿Querés continuar?"
          confirmLabel="Sí, eliminar"
          danger
          onConfirm={handleDelete}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
