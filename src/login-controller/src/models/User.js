export const GENRES = [
  "Ciencia Ficción",
  "Drama",
  "Thriller Psicológico",
  "Cine Indie",
  "Cine de Autor",
  "Romance",
  "Suspenso",
  "Animación",
  "Comedia",
  "Acción",
  "Documental",
  "Terror",
  "Fantasía",
  "Musical",
];

const MAX_FAVORITES = 5;

export default class User {
  constructor({ id, googleSub, email, name, picture, age, city, genres, favoriteMovies }) {
    this.id = id;
    this.googleSub = googleSub;
    this.email = email;
    this.name = name;
    this.picture = picture;
    this.age = age;
    this.city = city;
    this.genres = genres;
    this.favoriteMovies = favoriteMovies;
  }

  static fromRow(row) {
    return new User({
      id: row.id,
      googleSub: row.google_sub,
      email: row.email,
      name: row.name,
      picture: row.picture,
      age: row.age,
      city: row.city,
      genres: row.genres,
      favoriteMovies: row.favorite_movies,
    });
  }

  // googleSub no viaja al cliente: identifica la cuenta de Google y no le aporta nada al front.
  toJSON() {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      picture: this.picture ?? null,
      age: this.age ?? null,
      city: this.city ?? "",
      genres: Array.isArray(this.genres) ? this.genres : [],
      favoriteMovies: Array.isArray(this.favoriteMovies) ? this.favoriteMovies : [],
    };
  }

  static sanitizeProfile(body) {
    const errors = [];
    const patch = {};

    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return { errors: ["el cuerpo debe ser un objeto"], patch };
    }

    if ("name" in body) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (name.length < 1 || name.length > 80) errors.push("name debe tener entre 1 y 80 caracteres");
      else patch.name = name;
    }

    if ("age" in body) {
      if (body.age === null || body.age === "") patch.age = null;
      else if (!Number.isInteger(body.age) || body.age < 13 || body.age > 120) {
        errors.push("age debe ser un entero entre 13 y 120, o null");
      } else patch.age = body.age;
    }

    if ("city" in body) {
      const city = typeof body.city === "string" ? body.city.trim() : null;
      if (city === null || city.length > 80) errors.push("city debe ser texto de hasta 80 caracteres");
      else patch.city = city;
    }

    if ("genres" in body) {
      if (!Array.isArray(body.genres)) errors.push("genres debe ser un arreglo");
      else {
        const unknown = body.genres.filter((genre) => !GENRES.includes(genre));
        if (unknown.length > 0) errors.push(`generos no reconocidos: ${unknown.join(", ")}`);
        else patch.genres = [...new Set(body.genres)];
      }
    }

    if ("favoriteMovies" in body) {
      if (!Array.isArray(body.favoriteMovies)) errors.push("favoriteMovies debe ser un arreglo");
      else if (body.favoriteMovies.length > MAX_FAVORITES) {
        errors.push(`favoriteMovies admite hasta ${MAX_FAVORITES} elementos`);
      } else {
        const movies = [];
        for (const movie of body.favoriteMovies) {
          const title = typeof movie?.title === "string" ? movie.title.trim() : "";
          if (!title) {
            errors.push("cada pelicula favorita necesita un title no vacio");
            break;
          }
          const initials = typeof movie.initials === "string" ? movie.initials.trim().slice(0, 2) : "";
          movies.push({ initials, title: title.slice(0, 120) });
        }
        if (errors.length === 0) patch.favoriteMovies = movies;
      }
    }

    if (errors.length === 0 && Object.keys(patch).length === 0) {
      errors.push("no se envio ningun campo editable");
    }

    return { errors, patch };
  }
}
