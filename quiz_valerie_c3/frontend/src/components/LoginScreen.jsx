import { useState } from "react";
import { apiRequest } from "../api.js";

function getSurveyCode(value) {
  const input = value.trim();
  if (!input) return "";

  if (input.includes("://") || input.startsWith("/")) {
    let url;
    try {
      url = new URL(input, window.location.origin);
    } catch {
      return "";
    }
    return url.searchParams.get("encuesta") || "";
  }

  return /^[A-Za-z0-9_-]{8,64}$/.test(input) ? input : "";
}

export default function LoginScreen({ onLogin, onSurveyCode }) {
  const [role, setRole] = useState("respondent");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [surveyCode, setSurveyCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");

    if (role === "respondent") {
      const code = getSurveyCode(surveyCode);
      if (!code) {
        setError("Ingresa un código válido o pega el enlace completo de la encuesta.");
        return;
      }
      onSurveyCode(code);
      return;
    }

    setBusy(true);
    try {
      const payload = await apiRequest("/auth/admin/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      onLogin(payload);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-layout">
      <section className="login-brand">
        <div className="brand-lockup"><span className="brand-mark">e</span> encuesta</div>
        <div className="brand-message">
          <span className="eyebrow eyebrow-light">PLATAFORMA DE ENCUESTAS</span>
          <h1>Las buenas decisiones empiezan escuchando.</h1>
          <p>Crea encuestas, comparte un enlace y convierte respuestas en ideas.</p>
        </div>
        <div className="brand-footer">Un espacio para escuchar mejor.</div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <span className="eyebrow">BIENVENIDO</span>
          <h2>{role === "admin" ? "Acceso de administrador" : "Participa en una encuesta"}</h2>
          <p className="muted">
            {role === "admin"
              ? "Inicia sesión para administrar tus encuestas y respuestas."
              : "Ingresa el código o pega el enlace que te compartieron."}
          </p>

          <div className="role-switch" aria-label="Tipo de acceso">
            <button type="button" className={role === "respondent" ? "selected" : ""}
              onClick={() => { setRole("respondent"); setError(""); }}>
              Responder encuesta
            </button>
            <button type="button" className={role === "admin" ? "selected" : ""}
              onClick={() => { setRole("admin"); setError(""); }}>
              Administrador
            </button>
          </div>

          <form onSubmit={submit} className="form-stack">
            {role === "admin" ? (
              <>
                <label>Usuario
                  <input autoComplete="username" value={username}
                    onChange={(event) => setUsername(event.target.value)} required />
                </label>
                <label>Contraseña
                  <input type="password" autoComplete="current-password" value={password}
                    onChange={(event) => setPassword(event.target.value)} required />
                </label>
              </>
            ) : (
              <label>Código o enlace de la encuesta
                <input autoComplete="url" value={surveyCode}
                  onChange={(event) => setSurveyCode(event.target.value)}
                  placeholder="Pega aquí el código o enlace" required />
                <span className="field-hint">No necesitas crear una cuenta para participar.</span>
              </label>
            )}
            {error && <div className="alert alert-error" role="alert">{error}</div>}
            <button className="button button-primary button-full" disabled={busy}>
              {busy ? "Ingresando..." : role === "admin" ? "Ingresar" : "Continuar"} <span aria-hidden="true">→</span>
            </button>
          </form>
          <p className="login-note">
            {role === "admin"
              ? "Los estudiantes ingresan con el código o enlace de su encuesta."
              : "Tu correo se solicitará dentro de la encuesta para evitar respuestas duplicadas."}
          </p>
        </div>
      </section>
    </main>
  );
}
