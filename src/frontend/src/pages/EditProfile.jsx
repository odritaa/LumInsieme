import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppContext } from "../contexts/AppContext";
import { GENRES } from "../services/mockData";
import Navbar from "../components/Navbar";

const FAVORITES_SLOTS = 5;

export default function EditProfile() {
  const { user, updateUser } = useAppContext();
  const navigate = useNavigate();

  const [name, setName] = useState(user.name);
  const [age, setAge] = useState(user.age ?? "");
  const [city, setCity] = useState(user.city ?? "");
  const [genres, setGenres] = useState(user.genres);
  const [favorites, setFavorites] = useState(() =>
    Array.from({ length: FAVORITES_SLOTS }, (_, i) => user.favoriteMovies[i] ?? { initials: "", title: "" })
  );

  const toggleGenre = (g) =>
    setGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));

  const updateFavorite = (index, field, value) =>
    setFavorites((prev) => prev.map((f, i) => (i === index ? { ...f, [field]: value } : f)));

  const handleSubmit = (e) => {
    e.preventDefault();
    updateUser({
      name: name.trim(),
      age: age === "" ? null : Number(age),
      city: city.trim(),
      genres,
      favoriteMovies: favorites
        .filter((f) => f.title.trim())
        .map((f) => ({ initials: f.initials.trim(), title: f.title.trim() })),
    });
    navigate("/perfil");
  };

  return (
    <div className="page">
      <Navbar action={{ to: "/perfil", label: "← Volver al perfil" }} />

      <div className="form-container">
        <div className="form-header">
          <h1>Editar perfil</h1>
          <p>Actualizá tu información para encontrar mejores grupos</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <label className="form-label" htmlFor="name">
              Nombre
            </label>
            <input
              id="name"
              type="text"
              className="input-dark"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="form-section">
            <div className="form-row">
              <div>
                <label className="form-label" htmlFor="age">
                  Edad
                </label>
                <input
                  id="age"
                  type="number"
                  className="input-dark"
                  min="13"
                  max="120"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="city">
                  Ciudad
                </label>
                <input
                  id="city"
                  type="text"
                  className="input-dark"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <span className="form-label">Géneros favoritos</span>
            <div className="genres-grid">
              {GENRES.map((g) => {
                const active = genres.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    className={`tag-genre${active ? "" : " tag-genre-off"}`}
                    aria-pressed={active}
                    onClick={() => toggleGenre(g)}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="form-section">
            <span className="form-label">Mis 5 películas favoritas</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {favorites.map((fav, i) => (
                <div
                  key={i}
                  style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: "0.75rem" }}
                >
                  <input
                    type="text"
                    className="input-dark"
                    maxLength={2}
                    value={fav.initials}
                    onChange={(e) => updateFavorite(i, "initials", e.target.value)}
                    style={{ textAlign: "center", fontSize: "1.25rem" }}
                    aria-label={`Iniciales de la película ${i + 1}`}
                  />
                  <input
                    type="text"
                    className="input-dark"
                    value={fav.title}
                    onChange={(e) => updateFavorite(i, "title", e.target.value)}
                    placeholder={`Película ${i + 1}`}
                    aria-label={`Título de la película ${i + 1}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="form-actions">
            <Link className="btn-secondary" to="/perfil">
              Cancelar
            </Link>
            <button type="submit" className="btn-primary">
              Guardar cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
