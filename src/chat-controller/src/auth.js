import jwt from "jsonwebtoken";
import "dotenv/config";

const SECRET = process.env.JWT_SECRET;

if (!SECRET || SECRET.length < 32) {
  console.error("[auth] JWT_SECRET es obligatoria (minimo 32 caracteres) y debe coincidir con login y reunion");
  process.exit(1);
}

// El ticket lo emite reunion-controller solo a miembros de la sala: identidad y sala salen de ahi,
// nunca de parametros que el cliente pueda inventar.
export function verifyChatTicket(ticket) {
  const claims = jwt.verify(ticket, SECRET, {
    issuer: "luminsieme-reunion-controller",
    audience: "luminsieme-chat",
    algorithms: ["HS256"],
  });
  if (!claims.sub || !claims.sala) throw new Error("ticket incompleto");
  return { userId: claims.sub, username: claims.name ?? "Anónimo", eventId: claims.sala };
}
