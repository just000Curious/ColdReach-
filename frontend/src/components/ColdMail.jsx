import { useState } from "react";
import { generateCold, addApplication } from "../api";

export default function ColdMail({ apps = [], profile, resumeText, onDraftCreated, toast, setGlobalLoading }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [companyInfo, setCompanyInfo] = useState("");
  const [tone, setTone] = useState("Professional and direct");
  const [error, setError] = useState("");
  const [selectedApp, setSelectedApp] = useState(null);

  const history = apps.filter(a => a.type === "Cold Email");

  function handleSelectHistory(app) {
    setSelectedApp(app);
    setEmail(app.email || "");
    setRole(app.role || "");
    setCompanyInfo(app.company || "");
  }

  async function handleReuse() {
    if (!selectedApp) return;
    setGlobalLoading(true);
    try {
      const res = await addApplication({
        app_type: "Cold Email",
        company: selectedApp.company,
        role: selectedApp.role || "General",
        email: email.trim(),
        subject: selectedApp.subject,
        body: selectedApp.body,
      });
      setEmail("");
      setRole("");
      setCompanyInfo("");
      setSelectedApp(null);
      if (onDraftCreated) onDraftCreated(res.id);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setGlobalLoading(false);
    }
  }

  async function handleGenerate() {
    setError("");
    if (!email.trim()) return setError("HR Email is required.");
    if (!resumeText) return setError("Upload your resume first.");
    if (!profile.name) return setError("Please provide your name in the active profile.");

    setGlobalLoading(true);
    try {
      const draft = await generateCold({
        resume_text: resumeText,
        company_info: companyInfo,
        target_role: role,
        sender_name: profile.name,
        github_url: profile.github,
        portfolio_url: profile.portfolio,
        linkedin_url: profile.linkedin,
        tone: tone,
      });

      const res = await addApplication({
        app_type: "Cold Email",
        company: draft.company_name,
        role: role || "General",
        email: email.trim(),
        subject: draft.subject,
        body: draft.body,
      });

      setEmail("");
      setRole("");
      setCompanyInfo("");
      if (onDraftCreated) onDraftCreated(res.id);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setGlobalLoading(false);
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: "1.15rem", fontWeight: 600, marginBottom: 4 }}>Cold Mail</h2>
      <p style={{ fontSize: "0.84rem", color: "var(--text-muted)", marginBottom: 20 }}>
        Reach out to companies you're interested in — even without a job posting.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2.5fr", gap: "24px" }}>
        
        {/* Left Column: History */}
        <div style={{ borderRight: "1px solid var(--border)", paddingRight: "16px" }}>
          <h3 style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "12px", color: "var(--text-primary)" }}>Past Contacts</h3>
          {history.length === 0 ? (
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>No previous cold emails.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "500px", overflowY: "auto" }}>
              {history.map(app => (
                <div 
                  key={app.id} 
                  onClick={() => handleSelectHistory(app)}
                  style={{ 
                    padding: "10px", 
                    borderRadius: "6px", 
                    background: selectedApp?.id === app.id ? "var(--surface-hover)" : "transparent",
                    border: selectedApp?.id === app.id ? "1px solid var(--accent)" : "1px solid var(--border)",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: "0.8rem", color: "var(--text-primary)" }}>{app.company}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{app.email}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Form */}
        <div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">HR Email *</label>
          <input
            className="form-input"
            placeholder="hr@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Target Role</label>
          <input
            className="form-input"
            placeholder="e.g. Data Scientist"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Tone / Style</label>
        <select className="form-input" value={tone} onChange={(e) => setTone(e.target.value)}>
          <option value="Professional and direct">Professional and direct</option>
          <option value="Enthusiastic and passionate">Enthusiastic and passionate</option>
          <option value="Casual and conversational">Casual and conversational</option>
          <option value="Bold and confident">Bold and confident</option>
          <option value="Short and to the point">Short and to the point</option>
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Company Info (optional)</label>
        <textarea
          className="form-textarea"
          placeholder="Paste anything about the company — website, LinkedIn about section, etc."
          value={companyInfo}
          onChange={(e) => setCompanyInfo(e.target.value)}
          style={{ minHeight: 80 }}
        />
      </div>

      {error && <p style={{ color: "var(--red)", fontSize: "0.84rem", marginBottom: 12 }}>{error}</p>}

      <div style={{ display: "flex", gap: "12px" }}>
        <button className="btn btn-primary" onClick={handleGenerate}>
          {selectedApp ? "Generate Fresh Draft" : "Generate Cold Email"}
        </button>
        {selectedApp && (
          <button className="btn btn-secondary" onClick={handleReuse}>
            Reuse Exact Draft
          </button>
        )}
        {selectedApp && (
          <button className="btn btn-ghost" onClick={() => setSelectedApp(null)}>
            Clear Selection
          </button>
        )}
      </div>
      </div>
      </div>
    </div>
  );
}
