import { useState, useEffect } from "react";
import { getStatus, saveProfilesData } from "../api";
import ProfileManager from "./ProfileManager";

export default function Sidebar({ profilesData, setProfilesData, resumeReady, setResumeReady, resumeText, setResumeText, theme, setTheme, toast }) {
  const [status, setStatus] = useState({});
  const [showProfileManager, setShowProfileManager] = useState(false);

  useEffect(() => {
    getStatus().then(setStatus).catch(() => {});
  }, []);

  // Resume upload moved to Settings.jsx

  const activeProfile = profilesData.profiles.find(p => p.id === profilesData.active_id) || profilesData.profiles[0] || {};

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
        </div>
        <div className="sidebar-brand-text">ColdReach</div>
      </div>

      <div className="sidebar-divider" />

      <div className="sidebar-section">
        <div className="sidebar-section-title">
          <span>Active Profile</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowProfileManager(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>
        </div>
        
        {profilesData.profiles.length > 0 ? (
          <select 
            className="form-input" 
            value={profilesData.active_id || ""}
            onChange={(e) => {
              const newData = { ...profilesData, active_id: e.target.value };
              setProfilesData(newData);
              saveProfilesData(newData).catch(() => {});
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
            <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> Dark Mode</>
          ) : (
            <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg> Light Mode</>
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
