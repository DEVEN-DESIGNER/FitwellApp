import { useState } from "react";
import { getApiUrl } from "./api";

export default function AdminLogin({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event) {
    event.preventDefault(); setError(""); setLoading(true);
    try {
      const response = await fetch(getApiUrl("/auth/login"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: username.trim(), password }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to sign in.");
      localStorage.setItem("fitwell-admin-token", data.token); onLogin(data);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  async function requestReset(event) {
    event.preventDefault(); setError(""); setNotice(""); setLoading(true);
    try {
      const response = await fetch(getApiUrl("/auth/forgot-password"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: username.trim() }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to generate reset code.");
      setResetToken(data.resetToken || ""); setNotice(data.message);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  async function resetPassword(event) {
    event.preventDefault(); setError(""); setNotice(""); setLoading(true);
    try {
      const response = await fetch(getApiUrl("/auth/reset-password"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: username.trim(), resetToken: resetCode, newPassword }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to reset password.");
      setNotice(data.message); setForgotMode(false); setResetToken(""); setResetCode(""); setNewPassword(""); setPassword("");
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  return <main className="login-page"><section className="login-card">
    <div className="login-brand"><span>F</span><div><strong>FITWELL</strong><small>ADMIN PANEL</small></div></div>
    <h1>{forgotMode ? "Reset password" : "Welcome back"}</h1><p className="login-subtitle">{forgotMode ? "Generate a one-time code and choose a new password." : "Sign in to access the Fitwell dashboard."}</p>
    {!forgotMode ? <form onSubmit={submit}>
      <label>Admin username<input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required /></label>
      <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
      {error && <p className="login-error" role="alert">{error}</p>}
      <button type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in to dashboard"}</button>
      <button type="button" className="login-link" onClick={() => { setForgotMode(true); setError(""); setNotice(""); }}>Forgot password?</button>
    </form> : <>
      <form onSubmit={requestReset}>
        <label>Admin username<input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required /></label>
        <button type="submit" disabled={loading}>{loading ? "Generating..." : "Generate reset code"}</button>
      </form>
      {resetToken && <form className="reset-form" onSubmit={resetPassword}>
        <label>6-digit reset code<input inputMode="numeric" pattern="[0-9]{6}" maxLength="6" value={resetCode} onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Enter 6-digit code" required /></label>
        <label>New password<input type="password" minLength="8" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required /></label>
        <button type="submit" disabled={loading}>{loading ? "Resetting..." : "Set new password"}</button>
      </form>}
      <button type="button" className="login-link" onClick={() => { setForgotMode(false); setError(""); setNotice(""); }}>Back to sign in</button>
    </>}
    {notice && <p className="login-notice" role="status">{notice}{resetToken && <><br /><strong>Local reset code:</strong> {resetToken}</>}</p>}
    {error && <p className="login-error" role="alert">{error}</p>}
  </section></main>;
}
