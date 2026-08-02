import { useState } from "react";
import { generateCold, addApplication } from "../api";

export default function ColdMail({ profile, resumeText, onDraftCreated, toast, setGlobalLoading }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [companyInfo, setCompanyInfo] = useState("");
  const [error, setError] = useState("");

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
      });

      await addApplication({
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
      onDraftCreated();
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

      <button className="btn btn-primary" onClick={handleGenerate}>
        Generate Cold Email
      </button>
    </div>
  );
}
