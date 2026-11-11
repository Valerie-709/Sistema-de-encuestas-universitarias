import { rateLimit } from "express-rate-limit";

export const publicSurveySubmissionRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      status: "error",
      message: "Demasiados intentos. Espera 15 minutos antes de volver a enviar.",
    });
  },
});
