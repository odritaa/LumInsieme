const BASE = '/cartelera';

/** Funciones de un día ordenadas por hora. Sin fecha, el backend elige hoy o el próximo día con funciones. */
export async function fetchCarteleraDay(date) {
  const query = date ? `?fecha=${encodeURIComponent(date)}` : '';
  const res = await fetch(`${BASE}${query}`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  const json = await res.json();
  return {
    dates: Array.isArray(json.dates) ? json.dates : [],
    date: json.date ?? null,
    screenings: Array.isArray(json.screenings) ? json.screenings : [],
  };
}

/** Catálogo plano de películas (una entrada por película, cine y día) para el buscador de Crear Sala. */
export async function fetchCarteleraMovies() {
  const res = await fetch(`${BASE}/peliculas`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  const json = await res.json();
  return Array.isArray(json.movies) ? json.movies : [];
}
