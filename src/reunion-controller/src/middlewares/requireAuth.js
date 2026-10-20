import config from "../config.js";
import { verifySession } from "../utils/jwt.js";

// Copia del middleware de login-controller: acepta cookie (navegador) o Authorization: Bearer.
export default function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : null;
  const token = req.cookies?.[config.cookieName] ?? bearer;

  if (!token) return res.status(401).json({ error: "unauthenticated" });

  try {
    req.auth = verifySession(token);
    next();
  } catch {
    res.status(401).json({ error: "invalid_token" });
  }
}
