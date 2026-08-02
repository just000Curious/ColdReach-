import { useState } from "react";
import { saveProfilesData } from "../api";

export default function ProfileManager({ profilesData, setProfilesData, onClose, toast }) {
  const [profiles, setProfiles] = useState([...profilesData.profiles]);
  const [activeId, setActiveId] = useState(profilesData.active_id);

  function saveAndClose() {
    const data = { profiles, active_id: activeId };
    saveProfilesData(data)
      .then(() => {
        setProfilesData(data);
        toast("Profiles saved successfully.");
        onClose();
      })
      .catch((err) => toast("Failed to save profiles: " + err.message, "error"));
  }

  function addProfile() {
    const newId = Math.random().toString(36).substring(2, 10);
    setProfiles([...profiles, { id: newId, role: "New Role", name: "", github: "", portfolio: "", linkedin: "" }]);
    if (!activeId) setActiveId(newId);
  }

  function deleteProfile(id) {
    if (profiles.length <= 1) return alert("Must have at least one profile.");
    const newProfiles = profiles.filter(p => p.id !== id);
    setProfiles(newProfiles);
    if (activeId === id) setActiveId(newProfiles[0].id);
  }

  function updateProfile(id, field, value) {
    setProfiles(profiles.map(p => p.id === id ? { ...p, [field]: value } : p));
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content profile-manager">
        <div className="modal-header">
          <h2>Manage Profiles</h2>
          <button className="btn btn-ghost" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="profile-list">
          {profiles.map(p => (
            <div key={p.id} className={`profile-card ${p.id === activeId ? "active-card" : ""}`}>
              <div className="profile-card-header">
                <input 
                  className="form-input" 
                  value={p.role} 
                  onChange={e => updateProfile(p.id, "role", e.target.value)} 
                  placeholder="Role (e.g. Data Scientist)" 
                  style={{ fontWeight: "bold", border: "none", paddingLeft: 0 }}
                />
                <button className="btn btn-ghost btn-sm" onClick={() => deleteProfile(p.id)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                </button>
              </div>

              <div className="form-group row">
                <input className="form-input" placeholder="Full Name" value={p.name} onChange={e => updateProfile(p.id, "name", e.target.value)} />
                <input className="form-input" placeholder="LinkedIn" value={p.linkedin} onChange={e => updateProfile(p.id, "linkedin", e.target.value)} />
              </div>
              <div className="form-group row">
                <input className="form-input" placeholder="GitHub" value={p.github} onChange={e => updateProfile(p.id, "github", e.target.value)} />
                <input className="form-input" placeholder="Portfolio" value={p.portfolio} onChange={e => updateProfile(p.id, "portfolio", e.target.value)} />
              </div>

              <div style={{ marginTop: 12 }}>
                <label className="checkbox-label">
                  <input type="radio" name="activeProfile" checked={p.id === activeId} onChange={() => setActiveId(p.id)} />
                  Set as Active Profile
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={addProfile}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
            Add Profile
          </button>
          <button className="btn btn-primary" onClick={saveAndClose}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}
