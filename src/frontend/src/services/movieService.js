export async function fetchMovies() {
  const res = await fetch('/scrape/get_data');
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  const json = await res.json();
  const raw = json.data;
  if (!Array.isArray(raw)) return [];

  return raw.map((m) => ({
    title: m.title,
    place: m.theater,
    screenings: m.screenings ?? [],
    duration: m.duration,
    date: m.date,
  }));
}
