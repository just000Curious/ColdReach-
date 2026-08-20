import { useState, useEffect, useRef } from "react";
import { getStatus, saveProfilesData, parseLeadsDocument, addApplication, generateCold, updateApplication } from "../api";
import ProfileManager from "./ProfileManager";

export default function Sidebar({ profilesData, setProfilesData, resumeReady, setResumeReady, resumeText, setResumeText, theme, setTheme, toast, onDraftCreated }) {
  const [status, setStatus] = useState({});
  const [showProfileManager, setShowProfileManager] = useState(false);
  const [leads, setLeads] = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    getStatus().then(setStatus).catch(() => { });
  }, []);

  // Resume upload moved to Settings.jsx

  const activeProfile = profilesData.profiles.find(p => p.id === profilesData.active_id) || profilesData.profiles[0] || {};

  async function handleDocumentUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingLeads(true);
    try {
      toast("Parsing document...", "info");
      const res = await parseLeadsDocument(file);
      if (res.leads && res.leads.length > 0) {
        setLeads(res.leads);
        toast(`Found ${res.leads.length} leads!`, "success");
      } else {
        toast("No leads found in this document.", "error");
      }
    } catch (err) {
      toast("Error parsing document: " + err.message, "error");
    } finally {
      setLoadingLeads(false);
      e.target.value = null; // reset input
    }
  }

  async function handleDraftLead(lead) {
    toast(`Drafting email for ${lead.company}...`, "info");
    try {
      // 1. Add application as Draft
      const appRes = await addApplication({
        app_type: "Cold Email",
        company: lead.company,
        role: lead.role,
        email: lead.hr_email,
        subject: `Application for ${lead.role} - ${activeProfile.name}`,
        body: ""
      });
      const appId = appRes.id;

      // 2. Generate Cold Email Body
      const genRes = await generateCold({
        resume_text: resumeText,
        company_info: lead.company,
        target_role: lead.role,
        sender_name: activeProfile.name,
        github_url: activeProfile.github,
        portfolio_url: activeProfile.portfolio,
        linkedin_url: activeProfile.linkedin,
        tone: "Professional and direct"
      });

      // 3. Update application with generated body
      await updateApplication(appId, {
        body: genRes.body,
        subject: genRes.subject || `Application for ${lead.role}`
      });

      toast(`Draft created for ${lead.company}!`, "success");

      // Remove lead from list
      setLeads(leads.filter(l => l !== lead));

      // Switch to dashboard
      if (onDraftCreated) onDraftCreated(appId);
    } catch (err) {
      toast("Failed to draft: " + err.message, "error");
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
        </div>
        <div className="sidebar-brand-text">ColdReach</div>
      </div>

      <div className="sidebar-divider" />

      <div className="sidebar-section">
        <div className="sidebar-section-title">
          <span>Active Profile</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowProfileManager(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
          </button>
        </div>

        {profilesData.profiles.length > 0 ? (
          <select
            className="form-input"
            value={profilesData.active_id || ""}
            onChange={(e) => {
              const newData = { ...profilesData, active_id: e.target.value };
              setProfilesData(newData);
              saveProfilesData(newData).catch(() => { });
            }}
          >
            {profilesData.profiles.map(p => (
              <option key={p.id} value={p.id}>{p.role} - {p.name}</option>
            ))}
          </select>
        ) : (
          <div style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>No profiles found.</div>
        )}
      </div>

      <div className="sidebar-divider" />

      <div className="sidebar-section">
        <div className="sidebar-section-title">Resume</div>
        {resumeReady ? (
          <div className="sidebar-status">
            <span className="dot dot-green" />
            Resume saved & ready
          </div>
        ) : (
          <div className="sidebar-status" style={{ color: "var(--amber)" }}>
            <span className="dot dot-red" />
            Resume missing (Check Settings)
          </div>
        )}
      </div>

      <div className="sidebar-divider" />

      <div className="sidebar-section">
        <div className="sidebar-section-title" style={{ color: "var(--accent)" }}>HR Leads Auto-Mailer</div>
        <p style={{ fontSize: "0.75rem", color: "var(--sidebar-muted)", marginBottom: 12, lineHeight: 1.4 }}>
          Upload a Document (PDF/Word) containing a list of roles, companies, and HR emails. Select a role below to automatically generate a personalized cold email draft.
        </p>

        <input
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          style={{ display: "none" }}
          ref={fileInputRef}
          onChange={handleDocumentUpload}
        />
        <button
          className="btn btn-secondary"
          style={{ width: "100%", marginBottom: leads.length > 0 ? 12 : 0 }}
          onClick={() => fileInputRef.current?.click()}
          disabled={loadingLeads}
        >
          {loadingLeads ? "Parsing Document..." : "Upload Leads Document"}
        </button>

        {leads.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "250px", overflowY: "auto", paddingRight: 4 }}>
            {leads.map((lead, i) => (
              <div key={i} style={{ background: "rgba(0,0,0,0.1)", padding: 8, borderRadius: 6, fontSize: "0.75rem" }}>
                <div style={{ fontWeight: "bold", color: "var(--sidebar-heading)", marginBottom: 2 }}>{lead.role}</div>
                <div style={{ color: "var(--sidebar-text)", marginBottom: 2 }}>{lead.company}</div>
                {lead.skills && <div style={{ color: "var(--accent)", fontSize: "0.65rem", marginBottom: 2 }}>Skills: {lead.skills}</div>}
                <div style={{ color: "var(--sidebar-muted)", marginBottom: 6, fontSize: "0.7rem" }}>{lead.hr_email || "No email"}</div>
                <button
                  className="btn btn-primary"
                  style={{ width: "100%", padding: "4px 0", fontSize: "0.7rem" }}
                  onClick={() => handleDraftLead(lead)}
                  disabled={!resumeReady}
                >
                  Auto-Draft
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sidebar-divider" />

      <div className="sidebar-section">
        <div className="sidebar-section-title">System Status</div>
        <div className="sidebar-status">
          <span className={`dot ${status.gemini_api ? "dot-green" : "dot-red"}`} />
          Gemini API
        </div>
        <div className="sidebar-status">
          <span className={`dot ${status.email_configured ? "dot-green" : "dot-red"}`} />
          Email {status.email_configured ? "Connected" : "Missing"}
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <div className="sidebar-section" style={{ paddingBottom: 16 }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          style={{ width: "100%", justifyContent: "center" }}
        >
          {theme === "light" ? (
            <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg> Dark Mode</>
          ) : (
            <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg> Light Mode</>
          )}
        </button>
      </div>

      {showProfileManager && (
        <ProfileManager
          profilesData={profilesData}
          setProfilesData={setProfilesData}
          onClose={() => setShowProfileManager(false)}
          toast={toast}
        />
      )}
    </aside>
  );
}
