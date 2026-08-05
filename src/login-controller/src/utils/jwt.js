import jwt from "jsonwebtoken";
import config from "../config.js";

const ISSUER = "luminsieme-login-controller";
const AUDIENCE = "luminsieme";

export function signSession(user) {
  return jwt.sign({ email: user.email, name: user.name }, config.jwt.secret, {
    subject: user.id,
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: config.jwt.expiresIn,
    algorithm: "HS256",
  });
}

// algorithms explicito: sin esta lista jsonwebtoken acepta el algoritmo que declare
// el propio token, lo que habilita el ataque de confusion de algoritmos.
export function verifySession(token) {
  return jwt.verify(token, config.jwt.secret, {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithms: ["HS256"],
  });
}
