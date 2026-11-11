import { randomBytes } from "node:crypto";

export function createSurveyCode(db) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = randomBytes(12).toString("base64url");
    const existing = db.prepare("SELECT 1 FROM surveys WHERE public_code = ?").get(code);
    if (!existing) return code;
  }

  throw new Error("Unable to generate a unique survey code. Please try again.");
}
