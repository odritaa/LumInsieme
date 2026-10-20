export const MIN_CAPACITY = 2;
export const MAX_CAPACITY = 6;
const MAX_TEXT = 120;
const MAX_NOTE = 500;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function isRealDate(value) {
  if (!DATE_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export default class Sala {
  constructor({ id, hostId, hostName, movie, place, date, time, capacity, note, createdAt, members }) {
    this.id = id;
    this.hostId = hostId;
    this.hostName = hostName;
    this.movie = movie;
    this.place = place;
    this.date = date;
    this.time = time;
    this.capacity = capacity;
    this.note = note;
    this.createdAt = createdAt;
    this.members = members;
  }

  static fromRow(row) {
    return new Sala({
      id: row.id,
      hostId: row.host_id,
      hostName: row.host_name,
      movie: row.movie,
      place: row.place,
      date: row.date,
      time: row.time,
      capacity: row.capacity,
      note: row.note,
      createdAt: row.created_at,
      members: Array.isArray(row.members) ? row.members : [],
    });
  }

  isMember(userId) {
    return this.members.some((member) => member.id === userId);
  }

  // Solo nombre y generos de cada miembro: email, edad y ciudad no salen del perfil propio.
  toJSON() {
    return {
      id: this.id,
      movie: this.movie,
      place: this.place,
      date: this.date,
      time: this.time,
      capacity: this.capacity,
      note: this.note,
      host: this.hostName,
      hostId: this.hostId,
      createdAt: this.createdAt,
      members: this.members.map((member) => ({
        id: member.id,
        name: member.name,
        genres: Array.isArray(member.genres) ? member.genres : [],
        isAdmin: member.id === this.hostId,
      })),
    };
  }

  static sanitizeNew(body, today) {
    const errors = [];

    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return { errors: ["el cuerpo debe ser un objeto"], sala: null };
    }

    const movie = typeof body.movie === "string" ? body.movie.trim() : "";
    if (movie.length < 1 || movie.length > MAX_TEXT) errors.push(`movie debe tener entre 1 y ${MAX_TEXT} caracteres`);

    const place = typeof body.place === "string" ? body.place.trim() : "";
    if (place.length < 1 || place.length > MAX_TEXT) errors.push(`place debe tener entre 1 y ${MAX_TEXT} caracteres`);

    const date = typeof body.date === "string" ? body.date.trim() : "";
    if (!isRealDate(date)) errors.push("date debe ser una fecha AAAA-MM-DD valida");
    else if (date < today) errors.push("date no puede estar en el pasado");

    const time = typeof body.time === "string" ? body.time.trim() : "";
    if (!TIME_RE.test(time)) errors.push("time debe tener formato HH:MM");

    const { capacity } = body;
    if (!Number.isInteger(capacity) || capacity < MIN_CAPACITY || capacity > MAX_CAPACITY) {
      errors.push(`capacity debe ser un entero entre ${MIN_CAPACITY} y ${MAX_CAPACITY}`);
    }

    let note = "";
    if (body.note !== undefined && body.note !== null) {
      if (typeof body.note !== "string" || body.note.trim().length > MAX_NOTE) {
        errors.push(`note debe ser texto de hasta ${MAX_NOTE} caracteres`);
      } else note = body.note.trim();
    }

    if (errors.length > 0) return { errors, sala: null };
    return { errors, sala: { movie, place, date, time, capacity, note } };
  }
}
