import jwt from "jsonwebtoken";
import config from "../config.js";

const SESSION_ISSUER = "luminsieme-login-controller";
const AUDIENCE = "luminsieme";
const CHAT_ISSUER = "luminsieme-reunion-controller";
const CHAT_AUDIENCE = "luminsieme-chat";

// algorithms explicito: sin esta lista jsonwebtoken acepta el algoritmo que declare
// el propio token, lo que habilita el ataque de confusion de algoritmos.
export function verifySession(token) {
  return jwt.verify(token, config.jwt.secret, {
    issuer: SESSION_ISSUER,
    audience: AUDIENCE,
    algorithms: ["HS256"],
  });
}

// El ticket prueba ante chat-controller que el usuario es miembro de la sala,
// sin que el chat tenga que consultar Postgres ni este servicio.
export function signChatTicket({ userId, name, salaId }) {
  return jwt.sign({ name, sala: salaId }, config.jwt.secret, {
    subject: userId,
    issuer: CHAT_ISSUER,
    audience: CHAT_AUDIENCE,
    expiresIn: config.jwt.chatTicketExpiresIn,
    algorithm: "HS256",
  });
}
