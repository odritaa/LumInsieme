// Avatares: iniciales y gradientes. Los mockups hardcodean un gradiente distinto
// por miembro; acá se derivan de forma estable a partir de un seed.

const GRADIENTS = [
  ["#3b82f6", "#1d4ed8"], // azul
  ["#a855f7", "#7e22ce"], // violeta
  ["#ec4899", "#be185d"], // rosa
  ["#22c55e", "#15803d"], // verde
  ["#ef4444", "#991b1b"], // rojo
  ["#f97316", "#9a3412"], // naranja
  ["#06b6d4", "#0e7490"], // cian
  ["#eab308", "#a16207"], // ámbar
];

const GOLD_GRADIENT = "linear-gradient(135deg, var(--accent-gold), #e5c158)";

/** Dos letras a partir de un nombre: "María López" -> "ML", "Auguste" -> "AU". */
export function getInitials(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function hash(seed) {
  const str = String(seed ?? "");
  let acc = 0;
  for (let i = 0; i < str.length; i++) acc = (acc * 31 + str.charCodeAt(i)) >>> 0;
  return acc;
}

/**
 * Estilo de avatar listo para pasar como prop `style`.
 * `isSelf` fuerza el dorado de la marca, como en los mockups.
 */
export function getAvatarStyle(seed, isSelf = false) {
  if (isSelf) return { background: GOLD_GRADIENT, color: "#1a1a1a" };
  const [from, to] = GRADIENTS[hash(seed) % GRADIENTS.length];
  return { background: `linear-gradient(135deg, ${from}, ${to})` };
}
