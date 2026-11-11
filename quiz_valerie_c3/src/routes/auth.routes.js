import { createHash, randomBytes } from "node:crypto";
import { Router } from "express";
import db from "../db/database.js";
import { requireAuth } from "../middleware/auth.js";
import { verifyPassword } from "../utils/password.js";

const router = Router();
const sessionLifetimeMs = 12 * 60 * 60 * 1000;

function createSession(user, res) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = Date.now() + sessionLifetimeMs;

  db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .run(tokenHash, user.id, expiresAt);

  res.json({
    token,
    expiresAt: new Date(expiresAt).toISOString(),
    user: { id: user.id, name: user.name, role: user.role },
  });
}

router.post("/admin/login", (req, res, next) => {
  const { username, password } = req.body || {};
  if (typeof username !== "string" || typeof password !== "string") {
    return next(Object.assign(new Error("Username and password are required."), { statusCode: 400 }));
  }

  const user = db.prepare(`
    SELECT id, name, role, password_hash FROM users WHERE username = ? AND role = 'admin'
  `).get(username.trim());

  if (!user || !verifyPassword(password, user.password_hash)) {
    return next(Object.assign(new Error("Invalid credentials."), { statusCode: 401 }));
  }

  createSession(user, res);
});

router.delete("/session", requireAuth, (req, res) => {
  const token = req.get("authorization").slice("Bearer ".length);
  const tokenHash = createHash("sha256").update(token).digest("hex");
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
  res.status(204).end();
});

export default router;
