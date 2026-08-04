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

      {/* Detail Cards */}
      <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 12 }}>Application Details</h3>
      <div className="app-cards">
        {[...filteredApps].reverse().map((app) => {
          const isOpen = expandedId === app.id;
          const e = getEdit(app);
          const isLoading = loading[app.id];
          const sent_days = daysSince(app.sent_at);
          const fu_days = daysSince(app.follow_up_sent_at);

          return (
            <div className="app-card" key={app.id}>
              <div className="app-card-header" onClick={() => setExpandedId(isOpen ? null : app.id)}>
                <div className="app-card-header-left">
                  <span className="app-card-emoji">{STATUS_EMOJI[app.status]}</span>
                  <div className="app-card-info">
                    <div className="role">{app.role} at {app.company}</div>
                    <div className="company">{app.email} · {(app.created_at || "").slice(0, 10)}</div>
                  </div>
                </div>
                <span className={`status-badge ${BADGE_CLASS[app.status]}`}>{app.status}</span>
                <span className={`app-card-chevron ${isOpen ? "open" : ""}`}>▸</span>
              </div>

              {isOpen && (
                <div className="app-card-body">
                  <div className="app-card-editor">
                    <div className="form-group">
                      <label className="form-label">To</label>
                      <input className="form-input" value={e.email || app.email}
                        onChange={(ev) => setEdit(app.id, "email", ev.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Subject</label>
                      <input className="form-input" value={e.subject || app.subject}
                        onChange={(ev) => setEdit(app.id, "subject", ev.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Body</label>
                      <textarea className="form-textarea" style={{ minHeight: 160 }}
                        value={e.body || app.body}
                        onChange={(ev) => setEdit(app.id, "body", ev.target.value)} />
                    </div>
                    <div className="btn-group">
                      <button className="btn btn-secondary btn-sm" onClick={() => handleSaveEdits(app)}
                        disabled={isLoading}>Save Edits</button>
                      <button className="btn btn-ghost btn-sm" onClick={(ev) => { ev.stopPropagation(); copyToClipboard(e.body || app.body); }}>
                        Copy Body
                      </button>
                    </div>
                  </div>

                  <div className="app-card-actions">
                    <div className="meta">
                      <div><strong>Type:</strong> {app.type}</div>
                      <div><strong>Status:</strong> {app.status}</div>
                      {app.sent_at && <div><strong>Sent:</strong> {app.sent_at.slice(0, 10)}</div>}
                      {app.follow_up_count > 0 && <div><strong>Follow-ups:</strong> {app.follow_up_count}</div>}
                    </div>

                    {/* ── DRAFT ── */}
                    {app.status === "Draft" && (
                      <button className="btn btn-primary" onClick={() => triggerSendConfirm(app, "send")}>
                        Send Now
                      </button>
                    )}

                    {/* ── SENT ── */}
                    {app.status === "Sent" && (
                      <div className="btn-group" style={{ flexDirection: "column" }}>
                        <div className="btn-group">
                          <button className="btn btn-secondary btn-sm" onClick={() => handleStatusChange(app, "Replied")}>Replied</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleStatusChange(app, "Interview Scheduled")}>Interview</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleStatusChange(app, "Rejected")}>Rejected</button>
                        </div>
                        {app.type === "Cold Email" && (
                          <button className="btn btn-secondary btn-sm" onClick={() => triggerSendConfirm(app, "resend")}>
                            Resend with new angle ({sent_days}d ago)
                          </button>
                        )}
                        {sent_days >= (app.follow_up_days || 3) && (
                          <button className="btn btn-primary btn-sm" onClick={() => triggerSendConfirm(app, "follow-up")}>
                            Send Follow-up ({sent_days}d ago)
                          </button>
                        )}
                      </div>
                    )}

                    {/* ── FOLLOW-UP SENT ── */}
                    {app.status === "Follow-up Sent" && (
                      <div className="btn-group" style={{ flexDirection: "column" }}>
                        <div className="btn-group">
                          <button className="btn btn-secondary btn-sm" onClick={() => handleStatusChange(app, "Replied")}>Replied</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleStatusChange(app, "Interview Scheduled")}>Interview</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleStatusChange(app, "Ghosted")}>Ghosted</button>
                        </div>
                        {(app.follow_up_count || 0) < 3 && fu_days >= (CADENCE[app.follow_up_count] || 14) && (
                          <button className="btn btn-primary btn-sm" onClick={() => triggerSendConfirm(app, "follow-up")}>
                            Follow-up #{(app.follow_up_count || 0) + 1} ({fu_days}d ago)
                          </button>
                        )}
                        {(app.follow_up_count || 0) >= 3 && (
                          <p style={{ color: "var(--red)", fontSize: "0.82rem" }}>3 follow-ups sent. Consider marking as Ghosted.</p>
                        )}
                      </div>
                    )}

                    {/* ── REPLIED ── */}
                    {app.status === "Replied" && (
                      <div className="btn-group">
                        <button className="btn btn-secondary btn-sm" onClick={() => handleStatusChange(app, "Interview Scheduled")}>Interview</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleStatusChange(app, "Rejected")}>Rejected</button>
                      </div>
                    )}

                    {/* ── INTERVIEW ── */}
                    {app.status === "Interview Scheduled" && (
                      <div>
                        <p style={{ color: "var(--green)", fontSize: "0.84rem", marginBottom: 8 }}>Interview locked in!</p>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleStatusChange(app, "Rejected")}>Rejected</button>
                      </div>
                    )}

                    {app.status === "Ghosted" && <p style={{ color: "var(--text-faint)", fontSize: "0.82rem" }}>No response. Move on.</p>}
                    {app.status === "Rejected" && <p style={{ color: "var(--text-faint)", fontSize: "0.82rem" }}>On to the next one.</p>}

                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 8 }}>
                      <button className="btn btn-danger btn-sm" onClick={() => setDeleteConfirm(app)}>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
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
