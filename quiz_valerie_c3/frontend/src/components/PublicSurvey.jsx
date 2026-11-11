import { useEffect, useState } from "react";
import { apiRequest } from "../api.js";

export default function PublicSurvey({ code }) {
  const [survey, setSurvey] = useState(null);
  const [email, setEmail] = useState("");
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;
    apiRequest(`/public-surveys/${encodeURIComponent(code)}`)
      .then((result) => { if (active) setSurvey(result.survey); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [code]);

  function setAnswer(questionId, value) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }

  function toggleMultipleAnswer(questionId, option) {
    const current = answers[questionId] || [];
    setAnswer(questionId, current.includes(option)
      ? current.filter((item) => item !== option)
      : [...current, option]);
  }

  async function submitResponse(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await apiRequest(`/public-surveys/${encodeURIComponent(code)}/responses`, {
        method: "POST",
        body: JSON.stringify({ email, answers }),
      });
      setSubmitted(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="public-survey-page">
      <header className="public-survey-header">
        <a className="brand-lockup" href="/" aria-label="Encuesta">
          <span className="brand-mark">e</span> encuesta
        </a>
        <span>Tu opinión cuenta</span>
      </header>
      <section className="public-survey-main">
        {loading ? (
          <div className="inline-loading"><span className="spinner" />Cargando encuesta...</div>
        ) : error && !survey ? (
          <div className="panel public-message">
            <span className="public-message-icon">!</span>
            <h1>Encuesta no disponible</h1>
            <p>{error}</p>
          </div>
        ) : submitted ? (
          <div className="panel public-message">
            <span className="public-message-icon success">✓</span>
            <span className="eyebrow">RESPUESTA REGISTRADA</span>
            <h1>¡Gracias por participar!</h1>
            <p>Tu respuesta para <strong>{survey.title}</strong> se guardó correctamente.</p>
          </div>
        ) : (
          <section className="panel public-survey-card">
            <div className="public-survey-intro">
              <span className="eyebrow">ENCUESTA UNIVERSITARIA</span>
              <h1>{survey.title}</h1>
              {survey.description && <p>{survey.description}</p>}
              <span className="public-question-count">{survey.questions.length} preguntas</span>
            </div>

            {error && <div className="alert alert-error" role="alert">{error}</div>}

            <form onSubmit={submitResponse} className="public-response-form">
              <label className="email-field">Correo electrónico
                <input type="email" autoComplete="email" maxLength={254} required
                  value={email} onChange={(event) => setEmail(event.target.value)}
                  placeholder="nombre@universidad.edu" />
                <span className="field-hint">
                  Se usa para verificar que no envíes más de una respuesta a esta encuesta.
                </span>
              </label>

              {survey.questions.map((question, index) => (
                <fieldset className="respondent-question" key={question.id}>
                  <legend>
                    <span className="question-number">{String(index + 1).padStart(2, "0")}</span>
                    {question.text}{question.required && <span className="required-mark"> *</span>}
                  </legend>
                  {question.type === "text" ? (
                    <textarea rows="4" maxLength={5000} required={question.required}
                      value={answers[question.id] || ""}
                      onChange={(event) => setAnswer(question.id, event.target.value)}
                      placeholder="Escribe tu respuesta aquí..." />
                  ) : question.type === "single_choice" ? (
                    <div className="choice-list">
                      {question.options.map((option) => (
                        <label className={`choice-option ${answers[question.id] === option ? "chosen" : ""}`} key={option}>
                          <input type="radio" name={question.id} value={option}
                            checked={answers[question.id] === option}
                            onChange={() => setAnswer(question.id, option)} required={question.required} />
                          <span className="custom-radio" />{option}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="choice-list">
                      {question.options.map((option) => (
                        <label className={`choice-option ${answers[question.id]?.includes(option) ? "chosen" : ""}`} key={option}>
                          <input type="checkbox"
                            checked={(answers[question.id] || []).includes(option)}
                            onChange={() => toggleMultipleAnswer(question.id, option)} />
                          <span className="custom-checkbox" />{option}
                        </label>
                      ))}
                      {question.required && <span className="field-hint">Selecciona al menos una opción.</span>}
                    </div>
                  )}
                </fieldset>
              ))}

              <button className="button button-primary button-full" disabled={submitting}>
                {submitting ? "Enviando..." : "Enviar respuestas"} <span>→</span>
              </button>
            </form>
            <p className="public-privacy-note">Tu correo será visible para el administrador de la encuesta.</p>
          </section>
        )}
      </section>
      <footer className="public-survey-footer">Encuesta · Gracias por compartir tu opinión</footer>
    </main>
  );
}
