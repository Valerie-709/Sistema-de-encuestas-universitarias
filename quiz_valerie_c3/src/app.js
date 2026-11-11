import cors from "cors";
import express from "express";
import morgan from "morgan";
import adminRouter from "./routes/admin.routes.js";
import authRouter from "./routes/auth.routes.js";
import errorHandler from "./middleware/error-handler.js";
import notFound from "./middleware/not-found.js";
import healthRouter from "./routes/health.routes.js";
import publicSurveyRouter from "./routes/public-surveys.routes.js";
import surveyRouter from "./routes/surveys.routes.js";

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json());
app.use(morgan("dev"));

app.use("/api", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/surveys", surveyRouter);
app.use("/api/public-surveys", publicSurveyRouter);
app.use(notFound);
app.use(errorHandler);

export default app;
