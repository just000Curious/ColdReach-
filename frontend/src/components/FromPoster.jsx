import { useState, useEffect } from "react";
import { generatePoster, addApplication } from "../api";

export default function FromPoster({ profile, resumeText, onDraftCreated, toast, setGlobalLoading }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [overrideEmail, setOverrideEmail] = useState("");
  const [overrideTitle, setOverrideTitle] = useState("");
  const [tone, setTone] = useState("Professional and direct");
  const [showOverride, setShowOverride] = useState(false);
  const [error, setError] = useState("");
  const [extracted, setExtracted] = useState(null);

  useEffect(() => {
    const handlePaste = (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (let index in items) {
        const item = items[index];
        if (item.kind === 'file') {
          const blob = item.getAsFile();
          if (blob && blob.type.startsWith('image/')) {
            setFile(blob);
            setPreview(URL.createObjectURL(blob));
            setExtracted(null);
            setError("");
          }
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  function handleFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function handleGenerate() {
    setError("");
    setExtracted(null);
    if (!file) return setError("Upload a poster image first.");
    if (!resumeText) return setError("Upload your resume first.");
    if (!profile.name) return setError("Please provide your name in the active profile.");

    setGlobalLoading(true);
    try {
      const result = await generatePoster(file, {
        resume_text: resumeText,
        sender_name: profile.name,
        github_url: profile.github || "",
        portfolio_url: profile.portfolio || "",
        linkedin_url: profile.linkedin || "",
        override_email: overrideEmail,
        override_title: overrideTitle,
        tone: tone,
      });

      setExtracted({
        email: result.extracted_email,
        title: result.extracted_title,
        company: result.extracted_company,
        jd: result.extracted_jd,
      });

      const validEmail = (result.extracted_email && result.extracted_email.toLowerCase() !== "not found") ? result.extracted_email : "";

      if (!validEmail) {
        toast("No email found in poster! Draft saved. Please add the email manually in the Dashboard.", "error");
      }

      await addApplication({
        app_type: "Job Application",
        company: result.extracted_company,
        role: result.extracted_title,
        email: validEmail,
        subject: result.subject,
        body: result.body,
      });

      setFile(null);
      setPreview(null);
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
      <h2 style={{ fontSize: "1.15rem", fontWeight: 600, marginBottom: 4 }}>From Poster</h2>
      <p style={{ fontSize: "0.84rem", color: "var(--text-muted)", marginBottom: 20 }}>
        Upload a LinkedIn job flyer or screenshot — Gemini Vision extracts everything.
      </p>

      <div className="form-group">
        <label className="btn btn-secondary" style={{ cursor: "pointer", display: "inline-block", width: "100%", textAlign: "center", padding: "20px", border: "2px dashed var(--border)" }}>
          {file ? `File: ${file.name || 'Pasted Image'}` : "Upload Poster / Flyer or Paste Image (Ctrl+V)"}
          <input type="file" accept="image/png,image/jpeg,image/jpg" onChange={handleFile} hidden />
        </label>
      </div>

      {preview && (
        <div style={{ marginBottom: 16 }}>
          <img
            src={preview}
            alt="Poster preview"
            style={{ maxWidth: "100%", maxHeight: 300, borderRadius: 8, border: "1px solid var(--border)" }}
          />
        </div>
      )}

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
          {extracted.jd && (
            <div style={{ marginTop: 6, fontSize: "0.8rem", color: "var(--text-muted)" }}>
              <strong>JD:</strong> {extracted.jd}
            </div>
          )}
        </div>
      )}

      {error && <p style={{ color: "var(--red)", fontSize: "0.84rem", marginBottom: 12 }}>{error}</p>}

      <button className="btn btn-primary" onClick={handleGenerate}>
        Scan Poster & Generate
      </button>
    </div>
  );
}
