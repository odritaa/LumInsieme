import config from "../config.js";
import * as cacheClient from "../clients/cacheClient.js";
import httpError from "../utils/httpError.js";

// Clave donde el scrapper deja la cartelera: [{ "AAAA-M-D": [pelicula, ...] }, ...], una entrada por estrategia.
const SCRAPED_KEY = "scraped_data";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^(\d{1,2}):(\d{2})$/;

let lastRaw = null;
let lastMovies = [];

function normalizeDate(value) {
  const parts = String(value ?? "").trim().split("T")[0].split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) return null;
  const [year, month, day] = parts;
  const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return DATE_RE.test(date) ? date : null;
}

function normalizeTime(value) {
  const match = TIME_RE.exec(String(value ?? "").trim());
  if (!match) return null;
  const [, hours, minutes] = match;
  return `${hours.padStart(2, "0")}:${minutes}`;
}

function normalizeMovie(movie, fallbackDate) {
  const title = typeof movie?.title === "string" ? movie.title.trim() : "";
  const date = normalizeDate(movie?.date) ?? fallbackDate;
  if (!title || !date) return null;

  const screenings = (Array.isArray(movie.screenings) ? movie.screenings : [])
    .map((screening) => ({
      type: String(screening?.type ?? "").trim(),
      hours: [
        ...new Set((Array.isArray(screening?.hours) ? screening.hours : []).map(normalizeTime).filter(Boolean)),
      ].sort(),
    }))
    .filter((screening) => screening.hours.length > 0);

  return {
    title,
    date,
    place: String(movie.theater ?? "").trim(),
    duration: String(movie.duration ?? "").trim(),
    screenings,
  };
}

function parse(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    console.error("[cartelera] scraped_data no es JSON valido");
    return [];
  }

  const sources = Array.isArray(data) ? data : [data];
  const movies = [];
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    // Formato anterior del scrapper: lista plana de peliculas con fecha ISO.
    if (typeof source.title === "string") {
      const normalized = normalizeMovie(source, null);
      if (normalized) movies.push(normalized);
      continue;
    }
    for (const [day, list] of Object.entries(source)) {
      if (!Array.isArray(list)) continue;
      const fallbackDate = normalizeDate(day);
      for (const movie of list) {
        const normalized = normalizeMovie(movie, fallbackDate);
        if (normalized) movies.push(normalized);
      }
    }
  }
  return movies;
}

async function loadMovies() {
  let raw;
  try {
    raw = await cacheClient.get(SCRAPED_KEY);
  } catch (error) {
    console.error("[cartelera] cache-controller no responde:", error.message);
    throw httpError(503, "cache_unavailable");
  }
  if (raw === null) return [];
  if (raw !== lastRaw) {
    lastMovies = parse(raw);
    lastRaw = raw;
  }
  return lastMovies;
}

export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: config.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function pickDefaultDate(dates) {
  const current = today();
  return dates.find((date) => date >= current) ?? dates[0] ?? null;
}

export async function listMovies() {
  return loadMovies();
}

// Funciones de un dia, una por horario y formato, ordenadas por hora.
export async function getDay(requestedDate) {
  if (requestedDate !== undefined && !DATE_RE.test(requestedDate)) {
    throw httpError(400, "invalid_date", ["fecha debe tener formato AAAA-MM-DD"]);
  }

  const movies = await loadMovies();
  const dates = [...new Set(movies.map((movie) => movie.date))].sort();
  const date = requestedDate ?? pickDefaultDate(dates);

  // El scrapper puede repetir una misma pelicula en el dia: cada funcion se lista una sola vez.
  const seen = new Set();
  const screenings = movies
    .filter((movie) => movie.date === date)
    .flatMap((movie) =>
      movie.screenings.flatMap((screening) =>
        screening.hours.map((time) => ({
          time,
          title: movie.title,
          format: screening.type,
          place: movie.place,
          duration: movie.duration,
        }))
      )
    )
    .filter((s) => {
      const key = `${s.time}|${s.title}|${s.format}|${s.place}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort(
      (a, b) =>
        a.time.localeCompare(b.time) ||
        a.title.localeCompare(b.title, "es") ||
        a.format.localeCompare(b.format, "es")
    );

  return { dates, date, screenings };
}
