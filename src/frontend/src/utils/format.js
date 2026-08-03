// Formato de fechas/horas con el estilo de los mockups: "vie, 22 mar · 20:30 hs".

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** "2026-07-14" -> "mar, 14 jul" (sin punto final ni mayúscula inicial). */
export function formatDate(date) {
  if (!date) return "";
  // Se parsea como fecha local para evitar el corrimiento de día de UTC.
  const [y, m, d] = String(date).split("-").map(Number);
  const parsed = y && m && d ? new Date(y, m - 1, d) : new Date(date);
  if (Number.isNaN(parsed.getTime())) return String(date);
  return dateFormatter.format(parsed).replace(/\./g, "");
}

/** "2026-07-14" + "20:30" -> "mar, 14 jul · 20:30 hs". */
export function formatDateTime(date, time) {
  const parts = [formatDate(date)];
  if (time) parts.push(`${time} hs`);
  return parts.filter(Boolean).join(" · ");
}

/** Hora actual "HH:MM", para sellar los mensajes de chat nuevos. */
export function currentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

/** Etiqueta corta para los pósters placeholder: "Dune: Part Two" -> "Dune". */
export function posterLabel(title) {
  const clean = String(title || "").trim();
  if (!clean) return "?";
  const first = clean.split(/[:\-–]/)[0].trim();
  return first.length > 12 ? `${first.slice(0, 11)}…` : first;
}
