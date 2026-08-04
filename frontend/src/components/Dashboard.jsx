import { useState } from "react";
import {
  updateApplication, deleteApplication, sendEmail, bulkDelete,
  generateFollowUp, generateRewrite,
} from "../api";

const STATUS_ORDER = ["Draft", "Sent", "Follow-up Sent", "Replied", "Interview Scheduled", "Rejected", "Ghosted"];
const STATUS_EMOJI = {
  Draft: "", Sent: "", "Follow-up Sent": "",
  Replied: "", "Interview Scheduled": "", Rejected: "", Ghosted: "",
};
const BADGE_CLASS = {
  Draft: "badge-draft", Sent: "badge-sent", "Follow-up Sent": "badge-followup",
  Replied: "badge-replied", "Interview Scheduled": "badge-interview",
  Rejected: "badge-rejected", Ghosted: "badge-ghosted",
};
const KH_CLASS = {
  Draft: "kh-draft", Sent: "kh-sent", "Follow-up Sent": "kh-followup",
  Replied: "kh-replied", "Interview Scheduled": "kh-interview",
  Rejected: "kh-rejected", Ghosted: "kh-ghosted",
};
const CADENCE = [3, 7, 14];

export default function Dashboard({ apps, onRefresh, toast, setGlobalLoading, resumeText, profile }) {
  const [expandedId, setExpandedId] = useState(null);
  const [editState, setEditState] = useState({});
  const [loading, setLoading] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [sendConfirm, setSendConfirm] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(null);

  function triggerSendConfirm(app, type) {
    const e = getEdit(app);
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!e.email || !emailRegex.test(e.email.trim())) {
      toast("Invalid email address. Please fix it before sending.", "error");
      return;
    }
    setSendConfirm({ type, app, newAngle: "" });
  }

  if (!apps.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
        </div>
        <p>No applications yet. Use one of the tabs above to create one.</p>
      </div>
    );
  }

  const counts = {};
  STATUS_ORDER.forEach((s) => (counts[s] = 0));
  apps.forEach((a) => (counts[a.status] = (counts[a.status] || 0) + 1));
  const activeStatuses = STATUS_ORDER.filter((s) => counts[s] > 0);

  const filteredApps = apps.filter((a) => {
    const matchesSearch = !searchTerm ||
      a.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === "All" || a.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const sentTotal = counts.Sent + counts["Follow-up Sent"] + counts.Replied + counts["Interview Scheduled"] + counts.Rejected + counts.Ghosted;
  const responseRate = sentTotal > 0 ? Math.round(((counts.Replied + counts["Interview Scheduled"]) / sentTotal) * 100) : 0;

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => toast("Copied to clipboard!", "success"));
  }

  function getEdit(app) {
    return editState[app.id] || { email: app.email, subject: app.subject, body: app.body };
  }
  function setEdit(id, field, value) {
    setEditState((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: value },
    }));
  }

  function setLoadingFor(id, val) {
    setLoading((prev) => ({ ...prev, [id]: val }));
  }

  async function handleSaveEdits(app) {
    const e = getEdit(app);
    setLoadingFor(app.id, true);
    try {
      await updateApplication(app.id, { email: e.email, subject: e.subject, body: e.body });
      toast("Saved!", "success");
      onRefresh();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setLoadingFor(app.id, false);
    }
  }

  async function handleStatusChange(app, newStatus) {
    setLoadingFor(app.id, true);
    try {
      await updateApplication(app.id, { status: newStatus });
      toast(`Marked as ${newStatus}`, "success");
      onRefresh();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setLoadingFor(app.id, false);
    }
  }

  async function handleSend(app) {
    const e = getEdit(app);
    setGlobalLoading(true);
    try {
      await sendEmail({ to_email: e.email, subject: e.subject, body: e.body, attach_resume: true });
      await updateApplication(app.id, {
        status: "Sent",
        email: e.email,
        subject: e.subject,
        body: e.body,
        sent_at: new Date().toISOString(),
      });
      toast("Email sent!", "success");
      onRefresh();
    } catch (err) {
      toast("Send failed: " + err.message, "error");
    } finally {
      setGlobalLoading(false);
    }
  }

  async function handleFollowUp(app) {
    const e = getEdit(app);
    setGlobalLoading(true);
    try {
      const { body: fuBody } = await generateFollowUp({
        original_body: e.body,
        company: app.company,
        hr_name: "Hiring Manager",
        sender_name: profile?.name || "",
        github_url: profile?.github || "",
        portfolio_url: profile?.portfolio || "",
        linkedin_url: profile?.linkedin || "",
      });
      await sendEmail({ to_email: e.email, subject: `Re: ${e.subject}`, body: fuBody, attach_resume: true });
      await updateApplication(app.id, {
        status: "Follow-up Sent",
        follow_up_count: (app.follow_up_count || 0) + 1,
        follow_up_sent_at: new Date().toISOString(),
      });
      toast("Follow-up sent!", "success");
      onRefresh();
    } catch (err) {
      toast("Follow-up failed: " + err.message, "error");
    } finally {
      setGlobalLoading(false);
    }
  }

  async function handleResend(app, newAngle) {
    const e = getEdit(app);
    setGlobalLoading(true);
    try {
      const { body: newBody } = await generateRewrite({ 
        original_body: e.body, 
        app_type: app.type, 
        company: app.company, 
        resume_text: resumeText,
        new_angle: newAngle,
        sender_name: profile?.name || "",
        github_url: profile?.github || "",
        portfolio_url: profile?.portfolio || "",
        linkedin_url: profile?.linkedin || "",
      });
      await sendEmail({ to_email: e.email, subject: e.subject, body: newBody, attach_resume: true });
      await updateApplication(app.id, { body: newBody, sent_at: new Date().toISOString() });
      toast("Rewritten & sent!", "success");
      onRefresh();
    } catch (err) {
      toast("Resend failed: " + err.message, "error");
    } finally {
      setGlobalLoading(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteApplication(id);
      toast("Deleted", "success");
      setDeleteConfirm(null);
      onRefresh();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  function daysSince(dateStr) {
    if (!dateStr) return 0;
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  }

  return (
    <div>
      <h2 style={{ fontSize: "1.15rem", fontWeight: 600, marginBottom: 20 }}>Application Tracker</h2>

      {/* Metrics */}
      <div className="metrics">
        <div className="metric"><div className="metric-label">Total</div><div className="metric-value">{apps.length}</div></div>
        <div className="metric"><div className="metric-label">Drafts</div><div className="metric-value">{counts.Draft}</div></div>
        <div className="metric"><div className="metric-label">Sent</div><div className="metric-value">{counts.Sent}</div></div>
        <div className="metric"><div className="metric-label">Follow-ups</div><div className="metric-value">{counts["Follow-up Sent"]}</div></div>
        <div className="metric"><div className="metric-label">Interviews</div><div className="metric-value">{counts["Interview Scheduled"]}</div></div>
        <div className="metric"><div className="metric-label">Replied</div><div className="metric-value">{counts.Replied}</div></div>
        <div className="metric"><div className="metric-label">Response Rate</div><div className="metric-value" style={{ color: responseRate > 30 ? "var(--green)" : "var(--amber)" }}>{responseRate}%</div></div>
      </div>

      {/* Search & Filter */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center" }}>
        <input
          className="form-input"
          placeholder="Search by role, company, or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: 2 }}
        />
        <select
          className="form-input"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ flex: 1, maxWidth: 200 }}
        >
          <option value="All">All Statuses</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{s} ({counts[s]})</option>
          ))}
        </select>
      </div>

      {/* Kanban Board */}
      <div className="kanban">
        {activeStatuses.map((status) => (
          <div className="kanban-col" key={status}>
            <div className={`kanban-col-header ${KH_CLASS[status]}`}>
              {STATUS_EMOJI[status]} {status} ({counts[status]})
            </div>
            {[...filteredApps].reverse().filter((a) => a.status === status).map((app) => {
              const daysAgo = daysSince(app.sent_at || app.created_at);
              return (
                <div
                  className="kanban-card"
                  key={app.id}
                  onClick={() => setExpandedId(expandedId === app.id ? null : app.id)}
                >
                  <div className="kc-role">{app.role}</div>
                  <div className="kc-company">{app.company}</div>
                  <div className="kc-meta">
                    <span>{daysAgo === 0 ? "Today" : `${daysAgo}d ago`}</span>
                    <span>{app.email.length > 20 ? app.email.slice(0, 20) + "…" : app.email}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bulk Cleanup */}
      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        {counts.Draft > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => setBulkDeleteConfirm("Draft")}>
            Clear Drafts ({counts.Draft})
          </button>
        )}
        {counts.Replied > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => setBulkDeleteConfirm("Replied")}>
            Clear Replied ({counts.Replied})
          </button>
        )}
        {counts.Ghosted > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => setBulkDeleteConfirm("Ghosted")}>
            Clear Ghosted ({counts.Ghosted})
          </button>
        )}
      </div>

      {/* Application Detail Modal */}
      {expandedId && (() => {
        const app = apps.find((a) => a.id === expandedId);
        if (!app) return null;
        const e = getEdit(app);
        const isLoading = loading[app.id];
        const sent_days = daysSince(app.sent_at);
        const fu_days = daysSince(app.follow_up_sent_at);

        return (
          <div className="modal-overlay" onClick={() => setExpandedId(null)}>
            <div className="modal" onClick={(ev) => ev.stopPropagation()} style={{ maxWidth: 850, width: "95%", padding: 0, overflow: "hidden" }}>
              
              {/* Fancy Modal Header */}
              <div style={{ 
                background: "linear-gradient(135deg, var(--accent) 0%, var(--purple) 100%)", 
                padding: "24px 30px", 
                color: "white",
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "flex-start" 
              }}>
                <div>
                  <h3 style={{ margin: "0 0 8px 0", fontSize: "1.4rem", fontWeight: 700, color: "white" }}>
                    {app.role} <span style={{ opacity: 0.8, fontWeight: 400 }}>at</span> {app.company}
                  </h3>
                  <div style={{ fontSize: "0.85rem", opacity: 0.9, display: "flex", gap: 15, alignItems: "center" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                      {app.email}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                      {(app.created_at || "").slice(0, 10)}
                    </span>
                  </div>
                </div>
                <div style={{ background: "rgba(255,255,255,0.2)", padding: "6px 12px", borderRadius: 20, fontSize: "0.85rem", fontWeight: 600, backdropFilter: "blur(4px)" }}>
                  {app.status}
                </div>
              </div>

              {/* Modal Body */}
              <div style={{ padding: "30px", display: "grid", gridTemplateColumns: "1.8fr 1fr", gap: 30 }}>
                
                {/* Left Column: Editor */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", gap: 15 }}>
                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>To Email</label>
                      <input className="form-input" value={e.email || app.email}
                        onChange={(ev) => setEdit(app.id, "email", ev.target.value)} 
                        style={{ background: "var(--surface-hover)" }} />
                    </div>
                    <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Subject Line</label>
                      <input className="form-input" value={e.subject || app.subject}
                        onChange={(ev) => setEdit(app.id, "subject", ev.target.value)} 
                        style={{ background: "var(--surface-hover)", fontWeight: 600 }} />
                    </div>
                  </div>
                  
                  <div className="form-group" style={{ flex: 1, display: "flex", flexDirection: "column", marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", justifyContent: "space-between" }}>
                      Message Body
                      <span style={{ cursor: "pointer", color: "var(--accent)" }} onClick={(ev) => { ev.stopPropagation(); copyToClipboard(e.body || app.body); }}>
                        Copy Text
                      </span>
                    </label>
                    <textarea className="form-textarea" style={{ flex: 1, minHeight: 280, fontSize: "0.9rem", lineHeight: 1.6, background: "var(--surface-hover)", border: "1px solid var(--border-light)" }}
                      value={e.body || app.body}
                      onChange={(ev) => setEdit(app.id, "body", ev.target.value)} />
                  </div>
                  
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button className="btn btn-secondary" onClick={() => handleSaveEdits(app)} disabled={isLoading}>
                      Save Changes
                    </button>
                  </div>
                </div>

                {/* Right Column: Actions & Meta */}
                <div style={{ display: "flex", flexDirection: "column", gap: 24, borderLeft: "1px solid var(--border)", paddingLeft: 30 }}>
                  
                  {/* Meta Tags */}
                  <div>
                    <h4 style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.05em", marginBottom: 12 }}>Application Info</h4>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      <span style={{ padding: "4px 10px", background: "var(--surface-hover)", borderRadius: 12, fontSize: "0.75rem", border: "1px solid var(--border)" }}>
                        🎯 {app.type}
                      </span>
                      {app.sent_at && (
                        <span style={{ padding: "4px 10px", background: "var(--accent-subtle)", color: "var(--accent)", borderRadius: 12, fontSize: "0.75rem" }}>
                          📤 Sent {sent_days === 0 ? "Today" : `${sent_days}d ago`}
                        </span>
                      )}
                      {app.follow_up_count > 0 && (
                        <span style={{ padding: "4px 10px", background: "var(--purple-bg)", color: "var(--purple)", borderRadius: 12, fontSize: "0.75rem" }}>
                          👋 {app.follow_up_count} Follow-up{app.follow_up_count > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Smart Actions Panel */}
                  <div style={{ background: "var(--surface-hover)", borderRadius: "var(--radius)", padding: 16, border: "1px solid var(--border)" }}>
                    <h4 style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: 12, color: "var(--text-primary)" }}>Next Steps</h4>
                    
                    {app.status === "Draft" && (
                      <button className="btn btn-primary" style={{ width: "100%", padding: "10px", display: "flex", justifyContent: "center", gap: 8 }} onClick={() => triggerSendConfirm(app, "send")}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                        Send Application Now
                      </button>
                    )}

                    {app.status === "Sent" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {sent_days >= (app.follow_up_days || 3) ? (
                          <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => triggerSendConfirm(app, "follow-up")}>
                            Send Follow-up ({sent_days}d ago)
                          </button>
                        ) : (
                          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center", padding: "8px 0" }}>
                            Wait {Math.max(1, (app.follow_up_days || 3) - sent_days)} more days before following up.
                          </div>
                        )}
                        {app.type === "Cold Email" && (
                          <button className="btn btn-secondary" style={{ width: "100%", fontSize: "0.8rem" }} onClick={() => triggerSendConfirm(app, "resend")}>
                            Resend with new angle
                          </button>
                        )}
                      </div>
                    )}

                    {app.status === "Follow-up Sent" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {(app.follow_up_count || 0) < 3 && fu_days >= (CADENCE[app.follow_up_count] || 14) ? (
                          <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => triggerSendConfirm(app, "follow-up")}>
                            Follow-up #{(app.follow_up_count || 0) + 1} ({fu_days}d ago)
                          </button>
                        ) : (app.follow_up_count || 0) < 3 ? (
                          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center", padding: "8px 0" }}>
                            Wait {Math.max(1, (CADENCE[app.follow_up_count] || 14) - fu_days)} days for next follow-up.
                          </div>
                        ) : (
                          <div style={{ fontSize: "0.8rem", color: "var(--red)", textAlign: "center", padding: "8px 0", background: "var(--red-bg)", borderRadius: 6 }}>
                            Max follow-ups reached.
                          </div>
                        )}
                      </div>
                    )}

                    {app.status === "Interview Scheduled" && (
                      <div style={{ background: "var(--green-bg)", color: "var(--green)", padding: "12px", borderRadius: 6, textAlign: "center", fontWeight: 600, fontSize: "0.9rem" }}>
                        🎉 Interview locked in!
                      </div>
                    )}

                    {(app.status === "Ghosted" || app.status === "Rejected") && (
                      <div style={{ background: "var(--border-light)", color: "var(--text-muted)", padding: "12px", borderRadius: 6, textAlign: "center", fontSize: "0.9rem" }}>
                        {app.status === "Ghosted" ? "👻 No response. Moved on." : "🛑 Rejected. On to the next."}
                      </div>
                    )}
                  </div>

                  {/* Manual Status Override */}
                  {["Sent", "Follow-up Sent", "Replied", "Interview Scheduled"].includes(app.status) && (
                    <div>
                      <h4 style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.05em", marginBottom: 10 }}>Update Status</h4>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {app.status !== "Replied" && app.status !== "Interview Scheduled" && (
                          <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => handleStatusChange(app, "Replied")}>Reply</button>
                        )}
                        {app.status !== "Interview Scheduled" && (
                          <button className="btn btn-secondary btn-sm" style={{ flex: 1, borderColor: "var(--green)", color: "var(--green)" }} onClick={() => handleStatusChange(app, "Interview Scheduled")}>Interview</button>
                        )}
                        <button className="btn btn-secondary btn-sm" style={{ flex: 1, borderColor: "var(--red)", color: "var(--red)" }} onClick={() => handleStatusChange(app, "Rejected")}>Reject</button>
                        {app.status === "Follow-up Sent" && (
                          <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => handleStatusChange(app, "Ghosted")}>Ghosted</button>
                        )}
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: "auto", paddingTop: 20 }}>
                    <button className="btn btn-ghost btn-sm" style={{ width: "100%", color: "var(--red)" }} onClick={() => setDeleteConfirm(app)}>
                      Delete Application
                    </button>
                  </div>

                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Application?</h3>
            <p>
              Are you sure you want to delete <strong>{deleteConfirm.role}</strong> at{" "}
              <strong>{deleteConfirm.company}</strong>? This cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm.id)}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Send Modal */}
      {sendConfirm && (
        <div className="modal-overlay" onClick={() => setSendConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{sendConfirm.type === "send" ? "Send Email" : sendConfirm.type === "follow-up" ? "Send Follow-up" : "Resend Email"}</h3>
            <p>
              Are you sure you want to send this email to <strong>{sendConfirm.app.email}</strong>?
            </p>
            {sendConfirm.type === "resend" && (
              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">What is your new angle?</label>
                <textarea 
                  className="form-textarea" 
                  style={{ minHeight: 80 }}
                  placeholder="e.g. Emphasize my React skills, or make it much shorter"
                  value={sendConfirm.newAngle}
                  onChange={(e) => setSendConfirm({...sendConfirm, newAngle: e.target.value})}
                />
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setSendConfirm(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => {
                if (sendConfirm.type === "send") handleSend(sendConfirm.app);
                else if (sendConfirm.type === "follow-up") handleFollowUp(sendConfirm.app);
                else if (sendConfirm.type === "resend") handleResend(sendConfirm.app, sendConfirm.newAngle);
                setSendConfirm(null);
              }}>
                Confirm {sendConfirm.type === "resend" ? "& Generate" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Bulk Delete Modal */}
      {bulkDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setBulkDeleteConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm Bulk Delete</h3>
            <p>
              Are you sure you want to delete all <strong>{counts[bulkDeleteConfirm]}</strong> applications
              with status <strong>{bulkDeleteConfirm}</strong>? This cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setBulkDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => { bulkDelete(bulkDeleteConfirm).then(onRefresh); setBulkDeleteConfirm(null); }}>
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
