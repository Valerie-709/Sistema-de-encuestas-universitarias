import { randomUUID } from "node:crypto";
import { Router } from "express";
import db from "../db/database.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { createSurveyCode } from "../utils/survey-access-code.js";
import { validateSurveyInput } from "../utils/survey.js";

const router = Router();
router.use(requireAuth, requireRole("admin"));

router.get("/", (req, res) => {
  const surveys = db.prepare(`
    SELECT id, title, description, status, questions, created_at AS createdAt,
      updated_at AS updatedAt, public_code AS publicCode
    FROM surveys ORDER BY created_at DESC
  `).all().map((survey) => ({ ...survey, questions: JSON.parse(survey.questions) }));
  res.json({ surveys });
});

router.post("/", requireRole("admin"), (req, res, next) => {
  try {
    const survey = validateSurveyInput(req.body);
    const id = randomUUID();
    const publicCode = createSurveyCode(db);
    db.prepare(`
      INSERT INTO surveys (id, title, description, questions, public_code, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, survey.title, survey.description, JSON.stringify(survey.questions),
      publicCode, req.user.id);
    res.status(201).json({
      survey: { id, ...survey, status: "draft", publicCode },
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/:surveyId/status", requireRole("admin"), (req, res, next) => {
  const { status } = req.body || {};
  if (!["draft", "published"].includes(status)) {
    return next(Object.assign(new Error('Status must be "draft" or "published".'), {
      statusCode: 400,
    }));
  }

  const result = db.prepare(`
    UPDATE surveys SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(status, req.params.surveyId);
  if (!result.changes) {
    return next(Object.assign(new Error("Survey not found."), { statusCode: 404 }));
  }

  res.json({ id: req.params.surveyId, status });
});

export default router;
