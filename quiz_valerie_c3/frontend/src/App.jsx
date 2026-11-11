import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "./api.js";
import AdminDashboard from "./components/AdminDashboard.jsx";
import LoginScreen from "./components/LoginScreen.jsx";
import PublicSurvey from "./components/PublicSurvey.jsx";

const SESSION_KEY = "survey-session";

export default function App() {
  const [surveyCode, setSurveyCode] = useState(
    () => new URLSearchParams(window.location.search).get("encuesta"),
  );
  const [session, setSession] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY));
      if (saved?.user?.role === "admin" && saved?.expiresAt && new Date(saved.expiresAt) > new Date()) {
        return saved;
      }
    } catch {
      // Invalid cached sessions are cleared below.
    }
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  });
  const [checkingSession, setCheckingSession] = useState(Boolean(session));

  useEffect(() => {
    function syncSurveyCode() {
      setSurveyCode(new URLSearchParams(window.location.search).get("encuesta"));
    }

    window.addEventListener("popstate", syncSurveyCode);
    return () => window.removeEventListener("popstate", syncSurveyCode);
  }, []);

  const signOut = useCallback(async () => {
    if (session?.token) {
      try {
        await apiRequest("/auth/session", { method: "DELETE", token: session.token });
      } catch {
        // Clear the local session even if the API is unavailable.
      }
    }
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
    setCheckingSession(false);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const timeout = window.setTimeout(
      signOut,
      Math.max(0, new Date(session.expiresAt).getTime() - Date.now()),
    );
    setCheckingSession(false);
    return () => window.clearTimeout(timeout);
  }, [session, signOut]);

  function handleLogin(nextSession) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
  }

  function openSurvey(code) {
    window.history.pushState({}, "", `/?encuesta=${encodeURIComponent(code)}`);
    setSurveyCode(code);
  }

  if (surveyCode) return <PublicSurvey code={surveyCode} />;
  if (checkingSession) {
    return <main className="loading-screen"><span className="spinner" />Cargando tu sesión...</main>;
  }

  if (!session) return <LoginScreen onLogin={handleLogin} onSurveyCode={openSurvey} />;

  return <AdminDashboard session={session} onSignOut={signOut} />;
}
