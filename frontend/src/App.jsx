import { useState, useEffect, useCallback } from "react";
import "./App.css";
import { getProfilesData, getResumeStatus, getApplications } from "./api";
import Sidebar from "./components/Sidebar";
import ColdMail from "./components/ColdMail";
import FromJD from "./components/FromJD";
import FromPoster from "./components/FromPoster";
import Dashboard from "./components/Dashboard";
import JobSearch from "./components/JobSearch";
import Notifications from "./components/Notifications";
import Settings from "./components/Settings";

const TABS = [
  { id: "search", label: "Job Search" },
  { id: "cold", label: "Cold Mail" },
  { id: "jd", label: "From JD" },
  { id: "poster", label: "From Poster" },
  { id: "dash", label: "Dashboard" },
  { id: "settings", label: "Settings" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("search");
  const [profilesData, setProfilesData] = useState({ profiles: [], active_id: null });
  const [resumeReady, setResumeReady] = useState(false);
  const [resumeText, setResumeText] = useState("");
  const [apps, setApps] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [theme, setTheme] = useState("light");
  const [globalLoading, setGlobalLoading] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // ── Load initial data ──
  useEffect(() => {
    getProfilesData().then(setProfilesData).catch(() => {});
    getResumeStatus().then((r) => { setResumeReady(r.exists); setResumeText(r.text); }).catch(() => {});
    loadApps();
  }, []);

  const loadApps = useCallback(() => {
    getApplications().then(setApps).catch(() => {});
  }, []);

  // Get current active profile
  const activeProfile = profilesData.profiles.find((p) => p.id === profilesData.active_id) || profilesData.profiles[0] || { name: "", github: "", portfolio: "", linkedin: "" };

  // ── Toast system ──
  function toast(message, type = "success") {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }

  function handleDraftCreated() {
    toast("Draft created! Switch to Dashboard to review and send.");
    loadApps();
    setActiveTab("dash");
  }

  return (
    <div className="app-layout">
      <Sidebar
        profilesData={profilesData}
        setProfilesData={setProfilesData}
        resumeReady={resumeReady}
        setResumeReady={setResumeReady}
        resumeText={resumeText}
        setResumeText={setResumeText}
        theme={theme}
        setTheme={setTheme}
        toast={toast}
      />

      <main className="main-content">
        {/* Top bar */}
        <div className="main-header">
          <div className="main-header-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          </div>
          <div className="main-header-text">
            <h1>ColdReach</h1>
            <p>Send personalized job emails in 3 clicks</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable content area */}
        <div className="tab-content">
          <Notifications apps={apps} />

          {activeTab === "search" && (
            <JobSearch 
              activeProfile={activeProfile} 
              resumeText={resumeText} 
              onDraftCreated={handleDraftCreated} 
              toast={toast} 
              setGlobalLoading={setGlobalLoading}
            />
          )}
          {activeTab === "cold" && (
            <ColdMail profile={activeProfile} resumeText={resumeText} onDraftCreated={handleDraftCreated} toast={toast} setGlobalLoading={setGlobalLoading} />
          )}
          {activeTab === "jd" && (
            <FromJD profile={activeProfile} resumeText={resumeText} onDraftCreated={handleDraftCreated} toast={toast} setGlobalLoading={setGlobalLoading} />
          )}
          {activeTab === "poster" && (
            <FromPoster profile={activeProfile} resumeText={resumeText} onDraftCreated={handleDraftCreated} toast={toast} setGlobalLoading={setGlobalLoading} />
          )}
          {activeTab === "dash" && (
            <Dashboard apps={apps} onRefresh={loadApps} toast={toast} setGlobalLoading={setGlobalLoading} resumeText={resumeText} profile={activeProfile} />
          )}
          {activeTab === "settings" && (
            <Settings resumeReady={resumeReady} setResumeReady={setResumeReady} setResumeText={setResumeText} toast={toast} />
          )}
        </div>
      </main>

      {/* Toast Container */}
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.type}`}>
              {t.message}
            </div>
          ))}
        </div>
      )}

      {/* Global Loader Overlay */}
      {globalLoading && (
        <div className="global-loader-overlay">
          <div className="global-loader-content">
            <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3, borderColor: "rgba(255,255,255,0.2)", borderTopColor: "#fff" }} />
            <h3 style={{ marginTop: 16, color: "#fff", fontWeight: 500 }}>Working on it...</h3>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.85rem", marginTop: 4 }}>This might take a few seconds.</p>
          </div>
        </div>
      )}
    </div>
  );
}
