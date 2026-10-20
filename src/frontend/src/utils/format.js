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

function pad(n) {
  return String(n).padStart(2, "0");
}

function toISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Fecha local de hoy, "AAAA-MM-DD" (sin pasar por UTC). */
export function todayISO() {
  return toISODate(new Date());
}

/** "Hoy", "Mañana" o "mié, 21 oct" para los selectores de día. */
export function dayLabel(date) {
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (date === toISODate(today)) return "Hoy";
  if (date === toISODate(tomorrow)) return "Mañana";
  return formatDate(date);
}

/** Hora "HH:MM" actual, para saber qué funciones de hoy ya empezaron. */
export function currentTime() {
  const now = new Date();
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/** Sello de un mensaje de chat: "20:31", o "mar, 14 jul · 20:31" si no es de hoy. */
export function formatMessageTime(timestamp) {
  const date = new Date(Number(timestamp));
  if (Number.isNaN(date.getTime())) return "";
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const day = toISODate(date);
  return day === todayISO() ? time : `${formatDate(day)} · ${time}`;
}

/** Etiqueta corta para los pósters placeholder: "Dune: Part Two" -> "Dune". */
export function posterLabel(title) {
  const clean = String(title || "").trim();
  if (!clean) return "?";
  const first = clean.split(/[:\-–]/)[0].trim();
  return first.length > 12 ? `${first.slice(0, 11)}…` : first;
}
