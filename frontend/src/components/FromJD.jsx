import { useState } from "react";
import { generateJD, addApplication } from "../api";

export default function FromJD({ profile, resumeText, onDraftCreated, toast, setGlobalLoading }) {
  const [jdText, setJdText] = useState("");
  const [overrideEmail, setOverrideEmail] = useState("");
  const [overrideTitle, setOverrideTitle] = useState("");
  const [tone, setTone] = useState("Professional and direct");
  const [showOverride, setShowOverride] = useState(false);
  const [error, setError] = useState("");
  const [extracted, setExtracted] = useState(null);

  async function handleGenerate() {
    setError("");
    setExtracted(null);
    if (!jdText.trim()) return setError("Paste a job description first.");
    if (!resumeText) return setError("Upload your resume first.");
    if (!profile.name) return setError("Please provide your name in the active profile.");

    setGlobalLoading(true);
    try {
      const result = await generateJD({
        resume_text: resumeText,
        jd_text: jdText,
        sender_name: profile.name,
        github_url: profile.github,
        portfolio_url: profile.portfolio,
        linkedin_url: profile.linkedin,
        override_email: overrideEmail,
        override_title: overrideTitle,
        tone: tone,
      });

      setExtracted({
        email: result.extracted_email,
        title: result.extracted_title,
        company: result.extracted_company,
      });

      const validEmail = (result.extracted_email && result.extracted_email.toLowerCase() !== "not found") ? result.extracted_email : "";

      if (!validEmail) {
        toast("No email found in JD! Draft saved. Please add the email manually in the Dashboard.", "error");
      }

      await addApplication({
        app_type: "Job Application",
        company: result.extracted_company,
        role: result.extracted_title,
        email: validEmail,
        subject: result.subject,
        body: result.body,
      });

      setJdText("");
      setOverrideEmail("");
      setOverrideTitle("");
      onDraftCreated();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setGlobalLoading(false);
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: "1.15rem", fontWeight: 600, marginBottom: 4 }}>From Job Description</h2>
      <p style={{ fontSize: "0.84rem", color: "var(--text-muted)", marginBottom: 20 }}>
        Paste the JD — we auto-extract the email, job title, and company name.
      </p>

      <div className="form-group">
        <label className="form-label">Job Description *</label>
        <textarea
          className="form-textarea"
          placeholder="Paste the entire job description here. We'll extract everything automatically."
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          style={{ minHeight: 200 }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowOverride(!showOverride)}>
          {showOverride ? "▾ Hide overrides" : "▸ Override extracted fields (optional)"}
        </button>
        {showOverride && (
          <div className="form-row" style={{ marginTop: 10 }}>
            <div className="form-group">
              <label className="form-label">Override Email</label>
              <input
                className="form-input"
                placeholder="Leave blank to auto-extract"
                value={overrideEmail}
                onChange={(e) => setOverrideEmail(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Override Job Title</label>
              <input
                className="form-input"
                placeholder="Leave blank to auto-extract"
                value={overrideTitle}
                onChange={(e) => setOverrideTitle(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      <div className="form-group" style={{ marginBottom: 16 }}>
        <label className="form-label">Tone / Style</label>
        <select className="form-input" value={tone} onChange={(e) => setTone(e.target.value)}>
          <option value="Professional and direct">Professional and direct</option>
          <option value="Enthusiastic and passionate">Enthusiastic and passionate</option>
          <option value="Casual and conversational">Casual and conversational</option>
          <option value="Bold and confident">Bold and confident</option>
          <option value="Short and to the point">Short and to the point</option>
        </select>
      </div>

      {extracted && (
        <div className="extracted-bar">
          <strong>Extracted →</strong>{" "}
          Email: <code>{extracted.email || "Not found"}</code> ·{" "}
          Title: <code>{extracted.title}</code> ·{" "}
          Company: <code>{extracted.company}</code>
        </div>
      )}

      {error && <p style={{ color: "var(--red)", fontSize: "0.84rem", marginBottom: 12 }}>{error}</p>}

      <button className="btn btn-primary" onClick={handleGenerate}>
        Extract & Generate
      </button>
    </div>
  );
}
