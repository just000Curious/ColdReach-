import { useState } from "react";
import { searchJobs, generateJD, addApplication } from "../api";

export default function JobSearch({ activeProfile, resumeText, onDraftCreated, toast }) {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [draftingId, setDraftingId] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  async function handleSearch(e) {
    e.preventDefault();
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await searchJobs({ query, location, country: "India", results_per_page: 15 });
      setJobs(res.jobs || []);
    } catch (err) {
      toast("Search failed: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDraft(job, idx) {
    if (!resumeText) return toast("Please upload your resume first.", "error");
    if (!activeProfile.name) return toast("Please provide your name in the active profile.", "error");

    setGlobalLoading(true);
    setDraftingId(idx);
    try {
      const jdText = `Job Title: ${job.title}\nCompany: ${job.company}\nDescription: ${job.description}\nSkills: ${(job.skills_required || []).join(", ")}`;
      const res = await generateJD({
        resume_text: resumeText,
        jd_text: jdText,
        sender_name: activeProfile.name,
        github_url: activeProfile.github || "",
        portfolio_url: activeProfile.portfolio || "",
        linkedin_url: activeProfile.linkedin || "",
        override_title: job.title,
      });

      await addApplication({
        app_type: "Job Search",
        company: res.company_name || job.company,
        role: res.extracted_title || job.title,
        email: (res.extracted_email && res.extracted_email.toLowerCase() !== "not found") ? res.extracted_email : "",
        subject: res.subject,
        body: res.body,
      });

      onDraftCreated();
    } catch (err) {
      toast("Draft generation failed: " + err.message, "error");
    } finally {
      setDraftingId(null);
      setGlobalLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2>Job Search</h2>
        <p>Find real jobs and draft personalized emails instantly.</p>
      </div>
      
      <div className="card-body">
        <form onSubmit={handleSearch} className="form-group row" style={{ marginBottom: 24 }}>
          <div style={{ flex: 2 }}>
            <label className="form-label">Keywords / Role</label>
            <input 
              className="form-input" 
              placeholder="e.g. Frontend Developer" 
              value={query} 
              onChange={e => setQuery(e.target.value)} 
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="form-label">Location</label>
            <input 
              className="form-input" 
              placeholder="e.g. Bangalore or Remote" 
              value={location} 
              onChange={e => setLocation(e.target.value)} 
            />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ height: "40px" }}>
              {loading ? "Searching..." : "Search Jobs"}
            </button>
          </div>
        </form>

        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
            <span className="spinner" style={{ marginRight: 8 }} /> Loading jobs...
          </div>
        ) : hasSearched && jobs.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
            No jobs found matching your criteria.
          </div>
        ) : (
          <div className="job-grid">
            {jobs.map((job, idx) => (
              <div key={idx} className="job-card">
                <div className="job-card-header">
                  <h3 className="job-title">{job.title}</h3>
                  <div className="job-company">{job.company}</div>
                </div>
                <div className="job-tags">
                  <span className="tag tag-location">{job.location || "N/A"}</span>
                  <span className="tag tag-time">{job.posted_days_ago}d ago</span>
                  {job.job_type && <span className="tag">{job.job_type}</span>}
                  {job.work_mode && <span className="tag">{job.work_mode}</span>}
                </div>
                <p className="job-desc">{job.description.substring(0, 150)}...</p>
                <div className="job-actions">
                  <a href={job.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ flex: 1, textAlign: "center" }}>
                    View Job
                  </a>
                  <button 
                    className="btn btn-primary btn-sm" 
                    style={{ flex: 1 }}
                    onClick={() => handleDraft(job, idx)}
                    disabled={draftingId === idx}
                  >
                    {draftingId === idx ? "Drafting..." : "Draft Email"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
