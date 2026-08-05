import config from "../config.js";
import { verifySession } from "../utils/jwt.js";

// Acepta cookie (navegador) o Authorization: Bearer (llamadas servicio a servicio).
export default function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : null;
  const token = req.cookies?.[config.cookie.name] ?? bearer;

  if (!token) return res.status(401).json({ error: "unauthenticated" });

  try {
    req.auth = verifySession(token);
    next();
  } catch {
    res.status(401).json({ error: "invalid_token" });
  }
}
