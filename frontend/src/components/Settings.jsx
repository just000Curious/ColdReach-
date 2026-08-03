import { useState, useEffect } from "react";
import { getStatus, uploadResume } from "../api";

export default function Settings({ resumeReady, setResumeReady, setResumeText, toast }) {
  const [status, setStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [resumeLoading, setResumeLoading] = useState(false);

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

  async function handleResume(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      return toast("Only PDF resumes are supported", "error");
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
            <div className="metric-label">Tokens Used</div>
            <div className="metric-value">
              <span style={{ color: "var(--accent)" }}>{status.total_tokens ? status.total_tokens.toLocaleString() : "0"}</span>
            </div>
          </div>
        </div>

        {/* Resume */}
        <h3 style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: 12 }}>General</h3>
        <div className="form-group" style={{ marginBottom: 30, padding: 20, border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
          <label className="form-label">Resume Upload (PDF)</label>
          <p style={{ fontSize: "0.84rem", color: "var(--text-muted)", marginBottom: 12 }}>
            Your resume is used by the AI to extract your skills and experience for cold emails.
          </p>
          <label className="btn btn-secondary" style={{ cursor: "pointer", display: "inline-block" }}>
            {resumeLoading ? "Uploading..." : (resumeReady ? "Replace Resume (PDF)" : "Upload Resume (PDF)")}
            <input type="file" accept="application/pdf" onChange={handleResume} hidden />
          </label>
        </div>

        {/* Credentials */}
        <h3 style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: 12 }}>Credentials & API Keys</h3>
        <div style={{ marginBottom: 30, padding: 20, border: "1px solid var(--border)", borderRadius: "var(--radius)", backgroundColor: "var(--surface-hover)" }}>
          <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: 12 }}>
            For security reasons, API keys and Email Passwords are not editable from the UI.
          </p>
          <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: 12 }}>
            Please configure your credentials by editing the following file in your project directory:
          </p>
          <code style={{ display: "block", padding: 12, backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, fontWeight: "bold" }}>
            .env
          </code>
          <p style={{ fontSize: "0.84rem", color: "var(--text-muted)", marginTop: 12 }}>
            Set <strong>GEMINI_API_KEY</strong>, <strong>EMAIL_SENDER_ADDRESS</strong>, and <strong>EMAIL_APP_PASSWORD</strong>.
            Restart the server after making changes.
          </p>
        </div>
      </div>
    </div>
  );
}
