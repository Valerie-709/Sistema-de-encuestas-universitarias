import { useCallback, useEffect, useState } from "react";
import { apiRequest, formatDate } from "../api.js";

const initialQuestion = () => ({ text: "", type: "single_choice", options: ["", ""], required: true });

export default function AdminDashboard({ session, onSignOut }) {
  const [tab, setTab] = useState("surveys");
  const [surveys, setSurveys] = useState([]);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showSurveyForm, setShowSurveyForm] = useState(false);
  const [surveyTitle, setSurveyTitle] = useState("");
  const [surveyDescription, setSurveyDescription] = useState("");
  const [questions, setQuestions] = useState([initialQuestion()]);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [surveyData, responseData] = await Promise.all([
        apiRequest("/surveys", { token: session.token }),
        apiRequest("/admin/responses", { token: session.token }),
      ]);
      setSurveys(surveyData.surveys);
      setResponses(responseData.responses);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [session.token]);

  useEffect(() => { loadData(); }, [loadData]);

  function updateQuestion(index, patch) {
    setQuestions((current) => current.map((question, itemIndex) =>
      itemIndex === index ? { ...question, ...patch } : question));
  }

  function updateOption(questionIndex, optionIndex, value) {
    setQuestions((current) => current.map((question, itemIndex) => {
      if (itemIndex !== questionIndex) return question;
      return {
        ...question,
        options: question.options.map((option, currentIndex) =>
          currentIndex === optionIndex ? value : option),
      };
    }));
  }

  async function createSurvey(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const normalizedQuestions = questions.map((question) => ({
        ...question,
        options: question.type === "text"
          ? undefined
          : question.options.map((option) => option.trim()).filter(Boolean),
      }));
      await apiRequest("/surveys", {
        method: "POST",
        token: session.token,
        body: JSON.stringify({
          title: surveyTitle,
          description: surveyDescription,
          questions: normalizedQuestions,
        }),
      });
      setSurveyTitle("");
      setSurveyDescription("");
      setQuestions([initialQuestion()]);
      setShowSurveyForm(false);
      setNotice("La encuesta se creó como borrador. Publícala cuando esté lista.");
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function changeSurveyStatus(survey) {
    setError("");
    try {
      await apiRequest(`/surveys/${survey.id}/status`, {
        method: "PATCH",
        token: session.token,
        body: JSON.stringify({ status: survey.status === "published" ? "draft" : "published" }),
      });
      setNotice(survey.status === "published" ? "Encuesta retirada." : "Encuesta publicada.");
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function copySurveyLink(survey) {
    const url = `${window.location.origin}/?encuesta=${encodeURIComponent(survey.publicCode)}`;
    try {
      await navigator.clipboard.writeText(url);
      setNotice(`Enlace de "${survey.title}" copiado. Compártelo con los estudiantes.`);
      setError("");
    } catch {
      setNotice(`Copia y comparte este enlace: ${url}`);
      setError("");
    }
  }

  const questionTextById = Object.fromEntries(
    surveys.flatMap((survey) => survey.questions.map((question) => [question.id, question.text])),
  );

  return (
    <DashboardShell session={session} onSignOut={onSignOut} activeTab={tab} onTab={setTab}
      responseCount={responses.length}>
      <div className="page-heading">
        <div>
          <span className="eyebrow">PANEL DE ADMINISTRACIÓN</span>
          <h1>{tab === "surveys" ? "Encuestas" : "Respuestas"}</h1>
          <p className="muted">
            {tab === "surveys" ? "Crea y administra las encuestas de tu comunidad."
              : "Consulta las respuestas recibidas."}
          </p>
        </div>
        {tab === "surveys" && (
          <button className="button button-primary" onClick={() => setShowSurveyForm((value) => !value)}>
            {showSurveyForm ? "Cancelar" : "+ Nueva encuesta"}
          </button>
        )}
      </div>

      <StatsRow items={[
        { label: "Encuestas", value: surveys.length, icon: "▤" },
        { label: "Publicadas", value: surveys.filter((survey) => survey.status === "published").length, icon: "↗" },
        { label: "Correos participantes", value: new Set(responses.map((response) =>
          response.respondentEmail).filter(Boolean)).size, icon: "◎" },
        { label: "Respuestas", value: responses.length, icon: "✳" },
      ]} />

      {(error || notice) && (
        <div className={`alert ${error ? "alert-error" : "alert-success"}`} role="status">
          {error || notice}
          <button className="alert-close" onClick={() => { setError(""); setNotice(""); }} aria-label="Cerrar">×</button>
        </div>
      )}

      {tab === "surveys" && (
        <>
          {showSurveyForm && (
            <form className="panel survey-builder" onSubmit={createSurvey}>
              <div className="panel-heading">
                <div><h2>Nueva encuesta</h2><p className="muted">Define las preguntas que responderán los participantes.</p></div>
              </div>
              <div className="form-grid">
                <label>Título de la encuesta
                  <input value={surveyTitle} onChange={(event) => setSurveyTitle(event.target.value)}
                    maxLength={200} required placeholder="Ej. Experiencia de atención" />
                </label>
                <label>Descripción <span className="optional">(opcional)</span>
                  <textarea rows="2" value={surveyDescription}
                    onChange={(event) => setSurveyDescription(event.target.value)}
                    maxLength={2000} placeholder="Cuéntale al encuestado de qué trata." />
                </label>
              </div>
              <div className="question-list">
                {questions.map((question, index) => (
                  <div className="question-editor" key={index}>
                    <div className="question-editor-top">
                      <strong>Pregunta {index + 1}</strong>
                      {questions.length > 1 && (
                        <button type="button" className="text-button danger-text"
                          onClick={() => setQuestions((current) => current.filter((_, i) => i !== index))}>
                          Eliminar
                        </button>
                      )}
                    </div>
                    <label className="visually-hidden" htmlFor={`question-${index}`}>Texto de pregunta {index + 1}</label>
                    <input id={`question-${index}`} value={question.text}
                      onChange={(event) => updateQuestion(index, { text: event.target.value })}
                      maxLength={500} required placeholder="Escribe tu pregunta" />
                    <div className="question-options-row">
                      <label className="compact-label">Tipo de respuesta
                        <select value={question.type}
                          onChange={(event) => updateQuestion(index, {
                            type: event.target.value,
                            options: event.target.value === "text" ? [] : ["", ""],
                          })}>
                          <option value="single_choice">Opción única</option>
                          <option value="multiple_choice">Selección múltiple</option>
                          <option value="text">Texto libre</option>
                        </select>
                      </label>
                      <label className="check-label">
                        <input type="checkbox" checked={question.required}
                          onChange={(event) => updateQuestion(index, { required: event.target.checked })} />
                        Obligatoria
                      </label>
                    </div>
                    {question.type !== "text" && (
                      <div className="option-editor">
                        <span className="field-hint">Opciones de respuesta</span>
                        {question.options.map((option, optionIndex) => (
                          <div className="option-input-row" key={optionIndex}>
                            <input value={option} maxLength={200} placeholder={`Opción ${optionIndex + 1}`}
                              onChange={(event) => updateOption(index, optionIndex, event.target.value)} />
                            {question.options.length > 2 && (
                              <button type="button" className="icon-button"
                                onClick={() => updateQuestion(index, {
                                  options: question.options.filter((_, i) => i !== optionIndex),
                                })} aria-label="Eliminar opción">×</button>
                            )}
                          </div>
                        ))}
                        {question.options.length < 20 && (
                          <button type="button" className="text-button"
                            onClick={() => updateQuestion(index, { options: [...question.options, ""] })}>
                            + Añadir opción
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {questions.length < 50 && (
                <button type="button" className="button button-secondary"
                  onClick={() => setQuestions((current) => [...current, initialQuestion()])}>
                  + Añadir pregunta
                </button>
              )}
              <div className="form-actions">
                <button className="button button-primary" disabled={saving}>
                  {saving ? "Guardando..." : "Guardar borrador"}
                </button>
              </div>
            </form>
          )}
          {loading ? <Loading /> : surveys.length === 0
            ? <EmptyState title="Aún no hay encuestas" text="Crea tu primera encuesta para comenzar." />
            : <div className="survey-grid">{surveys.map((survey) => (
              <article className="panel survey-card" key={survey.id}>
                <div className="survey-card-top">
                  <span className={`status-badge ${survey.status}`}>
                    <span className="status-dot" />{survey.status === "published" ? "Publicada" : "Borrador"}
                  </span>
                  <span className="card-date">{formatDate(survey.createdAt)}</span>
                </div>
                <h3>{survey.title}</h3>
                <p className="muted survey-description">{survey.description || "Sin descripción."}</p>
                <div className="survey-meta"><span>▤ {survey.questions.length} preguntas</span>
                  <span>◷ {responses.filter((response) => response.surveyId === survey.id).length} respuestas</span></div>
                {survey.status === "published" && (
                  <div className="survey-share">
                    <span>Código: <strong>{survey.publicCode}</strong></span>
                    <button className="text-button" onClick={() => copySurveyLink(survey)}>
                      Copiar enlace
                    </button>
                  </div>
                )}
                <button className={`button ${survey.status === "published" ? "button-secondary" : "button-primary"} button-full`}
                  onClick={() => changeSurveyStatus(survey)}>
                  {survey.status === "published" ? "Retirar encuesta" : "Publicar encuesta"}
                </button>
              </article>
            ))}</div>}
          </>
        )}

      {tab === "responses" && (
        <section className="panel responses-panel">
          <div className="panel-heading"><div><h2>Respuestas recibidas</h2>
            <p className="muted">Consulta las respuestas y los correos usados para participar.</p></div>
            <button className="button button-secondary" onClick={loadData}>Actualizar</button>
          </div>
          {loading ? <Loading /> : responses.length === 0
            ? <EmptyState title="Aún no hay respuestas" text="Cuando alguien responda una encuesta, aparecerá aquí." />
            : <div className="response-list">{responses.map((response) => (
              <article className="response-card" key={response.id}>
                <div className="response-card-heading">
                  <div><span className="eyebrow">CORREO DEL PARTICIPANTE</span><h3>{response.respondentEmail || response.respondentName}</h3></div>
                  <span className="card-date">{formatDate(response.submittedAt)}</span>
                </div>
                <div className="response-survey-title">{response.surveyTitle}</div>
                <div className="answer-list">{Object.entries(response.answers).map(([id, answer]) => (
                  <div className="answer-row" key={id}>
                    <strong>{questionTextById[id] || "Respuesta"}</strong>
                    <span>{Array.isArray(answer) ? answer.join(", ") : answer}</span>
                  </div>
                ))}</div>
              </article>
            ))}</div>}
        </section>
      )}
    </DashboardShell>
  );
}

function DashboardShell({ session, onSignOut, activeTab, onTab, children, responseCount }) {
  const navigation = [
    { id: "surveys", label: "Encuestas", icon: "▤" },
    { id: "responses", label: "Respuestas", icon: "✳", count: responseCount },
  ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand-lockup sidebar-brand" href="#" onClick={(event) => event.preventDefault()}>
          <span className="brand-mark">e</span> encuesta
        </a>
        <span className="sidebar-label">MENÚ PRINCIPAL</span>
        <nav className="sidebar-nav">
          {navigation.map((item) => (
            <button key={item.id} className={`nav-item ${activeTab === item.id ? "active" : ""}`}
              onClick={() => onTab(item.id)}>
              <span className="nav-icon">{item.icon}</span>{item.label}
              {item.count > 0 && <span className="nav-count">{item.count}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip"><span>✦</span><strong>Un buen dato empieza<br />con una buena pregunta.</strong></div>
          <div className="sidebar-user">
            <span className="avatar avatar-dark">{session.user.name.charAt(0).toUpperCase()}</span>
            <div className="sidebar-user-info"><strong>{session.user.name}</strong><span>Administrador</span></div>
            <button className="logout-button" onClick={onSignOut} title="Cerrar sesión" aria-label="Cerrar sesión">↗</button>
          </div>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <span className="topbar-context">Espacio de trabajo <span>/</span> {navigation.find((item) => item.id === activeTab)?.label}</span>
          <div className="topbar-user"><span className="online-dot" /> Conectado</div>
        </header>
        <div className="page-container">{children}</div>
      </main>
    </div>
  );
}

function StatsRow({ items }) {
  return <div className="stats-grid">{items.map((item) => (
    <div className="stat-card" key={item.label}>
      <span className="stat-icon">{item.icon}</span>
      <div><span className="stat-label">{item.label}</span><strong className="stat-value">{item.value}</strong></div>
    </div>
  ))}</div>;
}

function Loading() {
  return <div className="inline-loading"><span className="spinner" />Cargando datos...</div>;
}

function EmptyState({ title, text, compact = false }) {
  return <div className={`empty-state ${compact ? "compact" : ""}`}>
    <span className="empty-icon">✳</span><h3>{title}</h3><p>{text}</p>
  </div>;
}
