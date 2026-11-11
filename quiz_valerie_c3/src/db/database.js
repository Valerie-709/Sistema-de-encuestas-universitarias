import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { hashPassword } from "../utils/password.js";
import { createSurveyCode } from "../utils/survey-access-code.js";

const databasePath = resolve(process.env.DATABASE_PATH || "./data/surveys.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });

const db = new Database(databasePath);
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('admin', 'respondent')),
    name TEXT NOT NULL,
    username TEXT UNIQUE,
    password_hash TEXT,
    access_code_hash TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

  CREATE TABLE IF NOT EXISTS surveys (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    questions TEXT NOT NULL,
    public_code TEXT UNIQUE,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const surveyColumns = db.prepare("PRAGMA table_info(surveys)").all();
if (!surveyColumns.some((column) => column.name === "public_code")) {
  db.exec("ALTER TABLE surveys ADD COLUMN public_code TEXT");
  db.exec("CREATE UNIQUE INDEX surveys_public_code_idx ON surveys(public_code)");
}
const surveysMissingCode = db.prepare("SELECT id FROM surveys WHERE public_code IS NULL").all();
const setSurveyCode = db.prepare("UPDATE surveys SET public_code = ? WHERE id = ?");
for (const survey of surveysMissingCode) setSurveyCode.run(createSurveyCode(db), survey.id);

function createResponsesTable() {
  db.exec(`
    CREATE TABLE responses (
      id TEXT PRIMARY KEY,
      survey_id TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      respondent_email TEXT,
      email_normalized TEXT,
      answers TEXT NOT NULL,
      submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (survey_id, user_id),
      UNIQUE (survey_id, email_normalized),
      CHECK (
        (user_id IS NOT NULL AND email_normalized IS NULL) OR
        (user_id IS NULL AND respondent_email IS NOT NULL AND email_normalized IS NOT NULL)
      )
    );
    CREATE INDEX responses_user_id_idx ON responses(user_id);
  `);
}

const responseTable = db.prepare(`
  SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'responses'
`).get();
if (!responseTable) {
  createResponsesTable();
} else {
  const responseColumns = db.prepare("PRAGMA table_info(responses)").all();
  const userIdColumn = responseColumns.find((column) => column.name === "user_id");
  const needsRebuild = !responseColumns.some((column) => column.name === "email_normalized")
    || !userIdColumn || userIdColumn.notnull;

  if (needsRebuild) {
    const migrateResponses = db.transaction(() => {
      db.exec("DROP INDEX IF EXISTS responses_user_id_idx");
      db.exec("ALTER TABLE responses RENAME TO responses_legacy");
      createResponsesTable();
      db.exec(`
        INSERT INTO responses (id, survey_id, user_id, answers, submitted_at)
        SELECT id, survey_id, user_id, answers, submitted_at FROM responses_legacy
      `);
      db.exec("DROP TABLE responses_legacy");
    });
    migrateResponses();
  }
}

export function ensureAdminUser() {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password || password.length < 12) {
    throw new Error(
      "Set ADMIN_USERNAME and an ADMIN_PASSWORD of at least 12 characters in your .env file.",
    );
  }

  const existing = db.prepare("SELECT id, role FROM users WHERE username = ?").get(username);

  if (existing) {
    if (existing.role !== "admin") {
      throw new Error("ADMIN_USERNAME is already assigned to a non-admin user.");
    }
    return;
  }

  db.prepare(`
    INSERT INTO users (id, role, name, username, password_hash)
    VALUES (?, 'admin', ?, ?, ?)
  `).run(randomUUID(), username, username, hashPassword(password));
}

export default db;
