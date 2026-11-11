import { Router } from "express";
import db from "../db/database.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireRole("admin"));

router.get("/responses", (_req, res) => {
  const responses = db.prepare(`
    SELECT responses.id, responses.survey_id AS surveyId, surveys.title AS surveyTitle,
      responses.user_id AS respondentId, users.name AS respondentName,
      responses.respondent_email AS respondentEmail,
      responses.answers, responses.submitted_at AS submittedAt
    FROM responses
    JOIN surveys ON surveys.id = responses.survey_id
    LEFT JOIN users ON users.id = responses.user_id
    ORDER BY responses.submitted_at DESC
  `).all().map((response) => ({
    ...response,
    respondentName: response.respondentName || response.respondentEmail || "Encuestado",
    answers: JSON.parse(response.answers),
  }));
  res.json({ responses });
});

export default router;
