import { useState, useEffect } from "react";
import { getStatus, uploadResume, updateGeminiKey } from "../api";

export default function Settings({ resumeReady, setResumeReady, setResumeText, toast, notifSettings, setNotifSettings }) {
  const [status, setStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);

  async function loadData() {
    try {
      const stat = await getStatus();
      setStatus(stat);
    } catch (err) {
      toast("Failed to load settings: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line
  }, []);

  async function handleUpdateApiKey(e) {
    if (e) e.preventDefault();
    const key = apiKeyInput.trim();
    if (!key) {
      return toast("Please enter an API key", "error");
    }
    setSavingKey(true);
    try {
      const res = await updateGeminiKey(key);
      toast(res.message || "Gemini API key updated successfully!", "success");
      setApiKeyInput("");
      setShowApiKey(false);
      await loadData();
    } catch (err) {
      toast(err.message || "Failed to update Gemini API key", "error");
    } finally {
      setSavingKey(false);
    }
  }

  async function handleResume(e) {
    const file = e.target.files[0];
    if (!file) return;
    const name = (file.name || "").toLowerCase();
    if (!name.endsWith(".pdf") && !name.endsWith(".docx") && !name.endsWith(".doc")) {
      return toast("Only PDF and Word documents (.pdf, .doc, .docx) are supported", "error");
    }
    setResumeLoading(true);
    try {
      const res = await uploadResume(file);
      toast("Resume uploaded successfully!", "success");
      setResumeReady(true);
      setResumeText(res.text);
      await loadData();
    } catch (err) {
      toast("Resume upload failed: " + err.message, "error");
    } finally {
      setResumeLoading(false);
    }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading settings...</div>;
  }

  return (
    <div className="card" style={{ maxWidth: 800, margin: "0 auto" }}>
      <div className="card-header">
        <h2>Settings</h2>
        <p>Manage your integrations, API keys, and resume.</p>
      </div>

      <div className="card-body">
        {/* System Health */}
        <h3 style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: 12, marginTop: 10 }}>System Health</h3>
        <div className="metrics" style={{ marginBottom: 30 }}>
          <div className="metric">
            <div className="metric-label">Gemini API</div>
            <div className="metric-value">
              {status.gemini_api ? <span style={{ color: "var(--green)" }}>Connected</span> : <span style={{ color: "var(--red)" }}>Missing</span>}
            </div>
          </div>
          <div className="metric">
            <div className="metric-label">Email SMTP</div>
            <div className="metric-value">
              {status.email_configured ? <span style={{ color: "var(--green)" }}>Configured</span> : <span style={{ color: "var(--amber)" }}>Missing</span>}
            </div>
          </div>
          <div className="metric">
            <div className="metric-label">Resume</div>
            <div className="metric-value">
              {resumeReady ? <span style={{ color: "var(--green)" }}>Uploaded</span> : <span style={{ color: "var(--red)" }}>Missing</span>}
            </div>
          </div>
          <div className="metric">
            <div className="metric-label">Tokens Used (Today)</div>
            <div className="metric-value">
              <span style={{ color: "var(--accent)" }}>{status.total_tokens ? status.total_tokens.toLocaleString() : "0"}</span>
            </div>
          </div>
          <div className="metric">
            <div className="metric-label">Tokens Left (Today)</div>
            <div className="metric-value">
              <span style={{ color: status.tokens_left < 100000 ? "var(--red)" : "var(--green)" }}>
                {status.tokens_left ? status.tokens_left.toLocaleString() : "0"}
              </span>
            </div>
          </div>
        </div>

        {/* Resume */}
        <h3 style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: 12 }}>General</h3>
        <div className="form-group" style={{ marginBottom: 30, padding: 20, border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
          <label className="form-label">Resume Upload (PDF, DOC, DOCX)</label>
          <p style={{ fontSize: "0.84rem", color: "var(--text-muted)", marginBottom: 12 }}>
            Your resume is used by the AI to extract your skills and experience for cold emails. Supports PDF, DOC, and DOCX files.
          </p>
          <label className="btn btn-secondary" style={{ cursor: "pointer", display: "inline-block" }}>
            {resumeLoading ? "Uploading..." : (resumeReady ? "Replace Resume (PDF / DOCX)" : "Upload Resume (PDF / DOCX)")}
            <input type="file" accept=".pdf,.docx,.doc,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleResume} hidden />
          </label>
        </div>

        {/* Notification Preferences */}
        <h3 style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: 12 }}>Notification Preferences</h3>
        <div style={{ marginBottom: 30, padding: 20, border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
          <p style={{ fontSize: "0.84rem", color: "var(--text-muted)", marginBottom: 16 }}>
            Customize when and how you receive follow-up reminders in the notification bell.
          </p>

          {/* Cadence */}
          <label className="form-label" style={{ marginBottom: 8, display: "block" }}>Follow-up Cadence (days after last email)</label>
          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            {(notifSettings?.cadence || [3, 7, 14]).map((val, idx) => (
              <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                  {idx === 0 ? "1st follow-up" : idx === 1 ? "2nd follow-up" : "3rd follow-up"}
                </span>
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={val}
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(90, parseInt(e.target.value) || 1));
                    const newCadence = [...(notifSettings?.cadence || [3, 7, 14])];
                    newCadence[idx] = v;
                    setNotifSettings({ ...notifSettings, cadence: newCadence });
                  }}
                  style={{
                    width: 72, padding: "6px 10px", fontSize: "0.85rem",
                    border: "1px solid var(--border)", borderRadius: "var(--radius)",
                    background: "var(--sidebar-input-bg)", color: "var(--text-primary)",
                    textAlign: "center",
                  }}
                />
              </div>
            ))}
          </div>

          {/* Sound toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <input
              type="checkbox"
              id="notif-sound-toggle"
              checked={notifSettings?.soundEnabled !== false}
              onChange={(e) => setNotifSettings({ ...notifSettings, soundEnabled: e.target.checked })}
              style={{ accentColor: "var(--accent)", cursor: "pointer", width: 16, height: 16 }}
            />
            <label htmlFor="notif-sound-toggle" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", cursor: "pointer" }}>
              Play sound when new notifications appear
            </label>
          </div>

          {/* Stale draft threshold */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
              Flag drafts as stale after
            </label>
            <input
              type="number"
              min="1"
              max="30"
              value={notifSettings?.staleDraftDays || 3}
              onChange={(e) => {
                const v = Math.max(1, Math.min(30, parseInt(e.target.value) || 3));
                setNotifSettings({ ...notifSettings, staleDraftDays: v });
              }}
              style={{
                width: 56, padding: "6px 8px", fontSize: "0.85rem",
                border: "1px solid var(--border)", borderRadius: "var(--radius)",
                background: "var(--sidebar-input-bg)", color: "var(--text-primary)",
                textAlign: "center",
              }}
            />
            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>days</span>
          </div>
        </div>

        {/* Credentials & API Keys */}
        <h3 style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: 12 }}>Credentials &amp; API Keys</h3>
        
        {/* Gemini API Key Management */}
        <div style={{ marginBottom: 24, padding: 20, border: "1px solid var(--border)", borderRadius: "var(--radius)", backgroundColor: "var(--surface)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>Google Gemini API Key</span>
              {status.gemini_api ? (
                <span style={{ 
                  background: "rgba(16, 185, 129, 0.15)", 
                  color: "var(--green)", 
                  padding: "2px 8px", 
                  borderRadius: 12, 
                  fontSize: "0.75rem", 
                  fontWeight: 600 
                }}>
                  Active
                </span>
              ) : (
                <span style={{ 
                  background: "rgba(239, 68, 68, 0.15)", 
                  color: "var(--red)", 
                  padding: "2px 8px", 
                  borderRadius: 12, 
                  fontSize: "0.75rem", 
                  fontWeight: 600 
                }}>
                  Not Configured
                </span>
              )}
            </div>
            {status.masked_gemini_key && (
              <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontFamily: "monospace", background: "var(--surface-hover)", padding: "2px 8px", borderRadius: 4, border: "1px solid var(--border)" }}>
                Current: {status.masked_gemini_key}
              </span>
            )}
          </div>

          <p style={{ fontSize: "0.84rem", color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 }}>
            Update your Gemini API key directly from here when hitting rate limits. The new key is verified against Google's API and applied immediately without restarting.
          </p>

          <form onSubmit={handleUpdateApiKey} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 280 }}>
              <input
                type={showApiKey ? "text" : "password"}
                className="form-input"
                placeholder="Paste new Gemini API key (AQ... or AIza...)"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                style={{ 
                  width: "100%", 
                  paddingRight: 70, 
                  background: "var(--sidebar-input-bg)", 
                  fontFamily: "monospace",
                  fontSize: "0.88rem"
                }}
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                  padding: "4px 8px",
                  fontWeight: 500
                }}
              >
                {showApiKey ? "Hide" : "Show"}
              </button>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={savingKey || !apiKeyInput.trim()}
              style={{ whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}
            >
              {savingKey ? "Testing & Saving..." : "Test & Update Key"}
            </button>
          </form>
        </div>

        {/* Other System Credentials Note */}
        <div style={{ padding: "16px 20px", border: "1px solid var(--border)", borderRadius: "var(--radius)", backgroundColor: "var(--surface-hover)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text-secondary)" }}>Other System Credentials</span>
          </div>
          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
            Email sending credentials (<code style={{ fontSize: "0.78rem" }}>EMAIL_SENDER_ADDRESS</code> and <code style={{ fontSize: "0.78rem" }}>EMAIL_APP_PASSWORD</code>) and job search keys remain configured in your local <code style={{ fontSize: "0.78rem" }}>.env</code> file.
          </p>
        </div>
      </div>
    </div>
  );
}
