import { randomUUID } from "node:crypto";
import { Router } from "express";
import db from "../db/database.js";
import { publicSurveySubmissionRateLimit } from "../middleware/public-survey-rate-limit.js";
import { validateAnswers } from "../utils/survey.js";

const router = Router();

router.get("/:code", (req, res, next) => {
  const survey = db.prepare(`
    SELECT id, title, description, questions
    FROM surveys WHERE public_code = ? AND status = 'published'
  `).get(req.params.code);

  if (!survey) {
    return next(Object.assign(new Error("Encuesta no encontrada o no disponible."), {
      statusCode: 404,
    }));
  }

  res.json({ survey: { ...survey, questions: JSON.parse(survey.questions) } });
});

router.post("/:code/responses", publicSurveySubmissionRateLimit, (req, res, next) => {
  const survey = db.prepare(`
    SELECT id, questions FROM surveys
    WHERE public_code = ? AND status = 'published'
  `).get(req.params.code);

  if (!survey) {
    return next(Object.assign(new Error("Encuesta no encontrada o no disponible."), {
      statusCode: 404,
    }));
  }

  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return next(Object.assign(new Error("Ingresa un correo electrónico válido."), {
      statusCode: 400,
    }));
  }

  let answers;
  try {
    answers = validateAnswers(JSON.parse(survey.questions), req.body?.answers);
  } catch (error) {
    return next(error);
  }

  try {
    const responseId = randomUUID();
    db.prepare(`
      INSERT INTO responses (id, survey_id, respondent_email, email_normalized, answers)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      responseId,
      survey.id,
      email,
      email.toLocaleLowerCase("en-US"),
      JSON.stringify(answers),
    );
    res.status(201).json({ id: responseId, surveyId: survey.id, submitted: true });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return next(Object.assign(new Error("Este correo ya respondió esta encuesta."), {
        statusCode: 409,
      }));
    }
    return next(error);
  }
});

export default router;
