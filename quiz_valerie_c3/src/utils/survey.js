import { randomUUID } from "node:crypto";

export function validateSurveyInput(input) {
  const title = typeof input?.title === "string" ? input.title.trim() : "";
  const description = typeof input?.description === "string" ? input.description.trim() : "";
  const questions = input?.questions;

  if (!title || title.length > 200) {
    throw Object.assign(new Error("Survey title must be between 1 and 200 characters."), {
      statusCode: 400,
    });
  }
  if (description.length > 2000) {
    throw Object.assign(new Error("Survey description cannot exceed 2000 characters."), {
      statusCode: 400,
    });
  }
  if (!Array.isArray(questions) || questions.length < 1 || questions.length > 50) {
    throw Object.assign(new Error("A survey must have between 1 and 50 questions."), {
      statusCode: 400,
    });
  }

  const normalizedQuestions = questions.map((question) => {
    const text = typeof question?.text === "string" ? question.text.trim() : "";
    const type = question?.type;
    if (!text || text.length > 500 || !["text", "single_choice", "multiple_choice"].includes(type)) {
      throw Object.assign(new Error("Each question needs text and a supported type."), {
        statusCode: 400,
      });
    }

    const normalized = {
      id: randomUUID(),
      text,
      type,
      required: question.required !== false,
    };

    if (type !== "text") {
      const options = question.options;
      if (!Array.isArray(options) || options.length < 2 || options.length > 20
          || options.some((option) => typeof option !== "string" || !option.trim()
            || option.trim().length > 200)) {
        throw Object.assign(new Error("Choice questions need 2 to 20 valid options."), {
          statusCode: 400,
        });
      }
      normalized.options = [...new Set(options.map((option) => option.trim()))];
      if (normalized.options.length !== options.length) {
        throw Object.assign(new Error("Question options must be unique."), { statusCode: 400 });
      }
    }

    return normalized;
  });

  return { title, description, questions: normalizedQuestions };
}

export function validateAnswers(questions, answers) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    throw Object.assign(new Error("Answers must be an object keyed by question ID."), {
      statusCode: 400,
    });
  }

  const questionById = new Map(questions.map((question) => [question.id, question]));
  for (const id of Object.keys(answers)) {
    if (!questionById.has(id)) {
      throw Object.assign(new Error("Answers contain an unknown question ID."), { statusCode: 400 });
    }
  }

  for (const question of questions) {
    const answer = answers[question.id];
    const empty = answer === undefined || answer === null
      || (typeof answer === "string" && !answer.trim())
      || (Array.isArray(answer) && answer.length === 0);

    if (empty) {
      if (question.required) {
        throw Object.assign(new Error(`An answer is required for: ${question.text}`), {
          statusCode: 400,
        });
      }
      continue;
    }

    if (question.type === "text") {
      if (typeof answer !== "string" || answer.length > 5000) {
        throw Object.assign(new Error(`Answer for "${question.text}" must be text of at most 5000 characters.`), {
          statusCode: 400,
        });
      }
    } else if (question.type === "single_choice") {
      if (typeof answer !== "string" || !question.options.includes(answer)) {
        throw Object.assign(new Error(`Choose a valid option for: ${question.text}`), {
          statusCode: 400,
        });
      }
    } else if (!Array.isArray(answer) || answer.some((value) => !question.options.includes(value))
        || new Set(answer).size !== answer.length) {
      throw Object.assign(new Error(`Choose valid, non-repeating options for: ${question.text}`), {
        statusCode: 400,
      });
    }
  }

  return answers;
}
