import { createHash } from "node:crypto";
import db from "../db/database.js";

export function requireAuth(req, _res, next) {
  const authorization = req.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(Object.assign(new Error("Authentication required."), { statusCode: 401 }));
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const session = db.prepare(`
    SELECT users.id, users.name, users.role, sessions.expires_at
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ?
  `).get(tokenHash);

  if (!session || session.expires_at <= Date.now()) {
    if (session) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
    return next(Object.assign(new Error("Invalid or expired session."), { statusCode: 401 }));
  }

  req.user = { id: session.id, name: session.name, role: session.role };
  next();
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(Object.assign(new Error("You do not have permission to access this resource."), {
        statusCode: 403,
      }));
    }
    next();
  };
}
