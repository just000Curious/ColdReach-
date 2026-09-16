import { useState, useRef, useEffect, useCallback } from "react";

// ── Storage helpers ──
const STORAGE_KEY = "coldreach_dismissed_notifs";
function loadDismissed() {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")); }
  catch { return new Set(); }
}
function saveDismissed(set) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

// ── Time formatting ──
function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return "just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ── Sound ──
function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const playNote = (freq, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.08, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    const now = ctx.currentTime;
    playNote(880, now, 0.12);
    playNote(1174.66, now + 0.12, 0.15);
  } catch {
    // Web Audio not available — silent fallback
  }
}

// ── SVG icons per category ──
const ICONS = {
  urgent: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  due: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  ghost: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 10h.01M15 10h.01M12 2a8 8 0 00-8 8v12l3-3 2 2 3-3 3 3 2-2 3 3V10a8 8 0 00-8-8z"/>
    </svg>
  ),
  stale: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  ),
  reply: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/>
    </svg>
  ),
};

// ── Category filter config ──
const FILTER_TABS = [
  { id: "all", label: "All" },
  { id: "urgent", label: "Urgent" },
  { id: "due", label: "Due" },
  { id: "ghost", label: "Ghosted" },
  { id: "stale", label: "Drafts" },
  { id: "reply", label: "Replies" },
];

// ── Bulk Follow-Up Confirmation Modal ──
function BulkFollowUpModal({ apps, onConfirm, onCancel }) {
  const [selected, setSelected] = useState(() => new Set(apps.map(a => a.id)));

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const selectedApps = apps.filter(a => selected.has(a.id));

  return (
    <div className="bulk-followup-backdrop" onClick={onCancel}>
      <div className="bulk-followup-modal" onClick={e => e.stopPropagation()}>
        <h3>Confirm Bulk Follow-Up</h3>
        <div className="bulk-followup-summary">
          Send follow-up emails to <strong>{selectedApps.length}</strong> of {apps.length} application{apps.length !== 1 ? "s" : ""}. 
          Uncheck any you want to skip.
        </div>
        <div className="bulk-followup-list">
          {apps.map(app => (
            <label className="bulk-followup-item" key={app.id}>
              <input
                type="checkbox"
                checked={selected.has(app.id)}
                onChange={() => toggle(app.id)}
              />
              <div className="bulk-followup-item-info">
                <div className="bulk-followup-item-role">{app.role}</div>
                <div className="bulk-followup-item-company">{app.company || "Unknown company"}</div>
              </div>
            </label>
          ))}
        </div>
        <div className="bulk-followup-actions">
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={selectedApps.length === 0}
            onClick={() => onConfirm(selectedApps)}
          >
            Confirm &amp; Send ({selectedApps.length})
          </button>
        </div>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════

export default function Notifications({ apps, onNotificationClick, onBulkFollowUp, notifSettings = {} }) {
  const cadence = notifSettings.cadence || [3, 7, 14];
  const soundEnabled = notifSettings.soundEnabled !== false;
  const staleDraftDays = notifSettings.staleDraftDays || 3;

  const [isOpen, setIsOpen] = useState(false);
  const [dismissed, setDismissed] = useState(loadDismissed);
  const [activeFilter, setActiveFilter] = useState("all");
  const [showBulkModal, setShowBulkModal] = useState(false);
  const dropdownRef = useRef(null);
  const prevUnreadRef = useRef(-1); // -1 = initial mount, skip sound on first render
  const isMountedRef = useRef(false);

  // ── Build all notification items ──
  const notifications = [];
  const now = Date.now();

  for (const app of apps) {
    // Follow-up checks for active statuses (Sent, Follow-up Sent)
    const isActiveForFollowUp = app.status === "Sent" || app.status === "Follow-up Sent";

    if (isActiveForFollowUp) {
      const refDate = app.follow_up_sent_at || app.sent_at;
      if (refDate) {
        const daysSince = Math.floor((now - new Date(refDate).getTime()) / 86400000);
        const fuCount = app.follow_up_count || 0;

        if (fuCount >= cadence.length) {
          // Max follow-ups exhausted — suggest marking as Ghosted
          notifications.push({
            id: `ghost-${app.id}`,
            category: "ghost",
            app,
            msg: `${fuCount} follow-ups sent, no reply — consider marking as Ghosted`,
            refDate,
          });
        } else if (daysSince >= cadence[fuCount]) {
          const label = `Follow-up #${fuCount + 1} is due (${daysSince}d since last email)`;
          if (daysSince >= cadence[fuCount] + 3) {
            // Overdue
            notifications.push({
              id: `urgent-${app.id}-${fuCount}`,
              category: "urgent",
              app,
              msg: label + " — OVERDUE",
              refDate,
            });
          } else {
            // Due
            notifications.push({
              id: `due-${app.id}-${fuCount}`,
              category: "due",
              app,
              msg: label,
              refDate,
            });
          }
        }
      }
    }

    // Stale drafts: created N+ days ago, never sent
    if (app.status === "Draft") {
      const created = app.created_at;
      if (created) {
        const daysSince = Math.floor((now - new Date(created).getTime()) / 86400000);
        if (daysSince >= staleDraftDays) {
          notifications.push({
            id: `stale-${app.id}`,
            category: "stale",
            app,
            msg: `Draft created ${daysSince}d ago — review and send, or delete`,
            refDate: created,
          });
        }
      }
    }

    // Reply needed: status is "Replied" but no follow-up action in 2+ days
    if (app.status === "Replied") {
      const refDate = app.follow_up_sent_at || app.sent_at;
      if (refDate) {
        const daysSince = Math.floor((now - new Date(refDate).getTime()) / 86400000);
        if (daysSince >= 2) {
          notifications.push({
            id: `reply-${app.id}`,
            category: "reply",
            app,
            msg: `HR replied ${daysSince}d ago — craft a response`,
            refDate,
          });
        }
      }
    }
  }

  // Sort: urgent first, then due, ghost, reply, stale
  const categoryOrder = { urgent: 0, due: 1, ghost: 2, reply: 3, stale: 4 };
  notifications.sort((a, b) => (categoryOrder[a.category] ?? 5) - (categoryOrder[b.category] ?? 5));

  // ── Prune stale dismissed IDs (keep only IDs that match current notifications) ──
  useEffect(() => {
    if (notifications.length === 0) return;
    const currentIds = new Set(notifications.map(n => n.id));
    setDismissed(prev => {
      let changed = false;
      const next = new Set();
      for (const id of prev) {
        if (currentIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      if (changed) saveDismissed(next);
      return changed ? next : prev;
    });
  }, [apps]); // Re-prune when apps data changes

  // ── Counts ──
  const totalCount = notifications.length;
  const unreadCount = notifications.filter(n => !dismissed.has(n.id)).length;
  const hasUrgent = notifications.some(n => n.category === "urgent" && !dismissed.has(n.id));

  // Category counts for filter pills
  const catCounts = {};
  for (const n of notifications) {
    catCounts[n.category] = (catCounts[n.category] || 0) + 1;
  }

  // Filtered list
  const filtered = activeFilter === "all"
    ? notifications
    : notifications.filter(n => n.category === activeFilter);

  // ── Followup-able apps (for bulk action) ──
  const followUpApps = notifications
    .filter(n => (n.category === "urgent" || n.category === "due") && (n.app.follow_up_count || 0) < cadence.length)
    .map(n => n.app);

  // ── Sound effect on new unread notifications (skip initial mount) ──
  useEffect(() => {
    if (!isMountedRef.current) {
      // First render — record initial count, don't play sound
      isMountedRef.current = true;
      prevUnreadRef.current = unreadCount;
      return;
    }
    if (soundEnabled && unreadCount > prevUnreadRef.current) {
      playNotifSound();
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount, soundEnabled]);

  // ── Click-outside handler ──
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Dismiss helpers ──
  const dismissOne = useCallback((notifId, e) => {
    e.stopPropagation();
    setDismissed(prev => {
      const next = new Set(prev);
      next.add(notifId);
      saveDismissed(next);
      return next;
    });
  }, []);

  const dismissAll = useCallback(() => {
    setDismissed(() => {
      const next = new Set(notifications.map(n => n.id));
      saveDismissed(next);
      return next;
    });
  }, [notifications]);

  // ── Bulk follow-up flow ──
  function handleBulkClick(e) {
    e.stopPropagation();
    setShowBulkModal(true);
  }

  function handleBulkConfirm(selectedApps) {
    setShowBulkModal(false);
    setIsOpen(false);
    if (onBulkFollowUp) onBulkFollowUp(selectedApps);
  }

  return (
    <>
      <div className="notifications-wrapper" ref={dropdownRef}>
        <button
          className="notif-bell-btn"
          onClick={() => setIsOpen(!isOpen)}
          title={`Notifications — ${totalCount} total, ${unreadCount} unread`}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          {totalCount > 0 && (
            <span className={`notif-badge${hasUrgent ? " notif-badge-pulse" : ""}${unreadCount === 0 ? " notif-badge-read" : ""}`}>
              {unreadCount > 0 ? (unreadCount > 99 ? "99+" : unreadCount) : totalCount}
            </span>
          )}
        </button>

        {isOpen && (
          <div className="notif-dropdown">
            {/* Header */}
            <div className="notif-header">
              <h3>Notifications ({totalCount})</h3>
              <div className="notif-header-actions">
                {followUpApps.length > 0 && (
                  <button className="btn btn-primary" style={{ fontSize: "0.7rem", padding: "3px 10px" }} onClick={handleBulkClick}>
                    Auto Follow-up ({followUpApps.length})
                  </button>
                )}
                {unreadCount > 0 && (
                  <button className="notif-header-btn" onClick={dismissAll} title="Mark all as read">
                    ✓ Read all
                  </button>
                )}
              </div>
            </div>

            {/* Category filter tabs */}
            {totalCount > 0 && (
              <div className="notif-category-tabs">
                {FILTER_TABS.map(tab => {
                  const count = tab.id === "all" ? totalCount : (catCounts[tab.id] || 0);
                  if (tab.id !== "all" && count === 0) return null;
                  return (
                    <button
                      key={tab.id}
                      className={`notif-category-pill${activeFilter === tab.id ? " active" : ""}`}
                      onClick={() => setActiveFilter(tab.id)}
                    >
                      {tab.label}
                      <span className="notif-pill-count">{count}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Notification list */}
            <div className="notif-list">
              {totalCount === 0 && (
                <div className="notif-empty">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, marginBottom: 8, display: "block", margin: "0 auto 8px" }}>
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  All caught up! No pending actions.
                </div>
              )}
              {filtered.length === 0 && totalCount > 0 && (
                <div className="notif-empty">No notifications in this category.</div>
              )}
              {filtered.map(item => {
                const isRead = dismissed.has(item.id);
                return (
                  <div
                    className={`notif-item notif-${item.category}${isRead ? " notif-item-read" : ""}`}
                    key={item.id}
                    onClick={() => {
                      setIsOpen(false);
                      if (onNotificationClick) onNotificationClick(item.app.id);
                    }}
                  >
                    {/* Unread dot */}
                    <div className={isRead ? "notif-read-dot" : "notif-unread-dot"} />

                    {/* Category icon */}
                    <div className="notif-item-icon">
                      {ICONS[item.category]}
                    </div>

                    {/* Body */}
                    <div className="notif-item-body">
                      <div className="notif-title-row">
                        <div className="notif-title">{item.app.role} at {item.app.company || "Unknown"}</div>
                        <span className="notif-timestamp" title={formatDate(item.refDate)}>
                          {timeAgo(item.refDate)}
                        </span>
                      </div>
                      <div className="notif-desc">{item.msg}</div>
                    </div>

                    {/* Dismiss button */}
                    {!isRead && (
                      <button
                        className="notif-dismiss-btn"
                        onClick={(e) => dismissOne(item.id, e)}
                        title="Mark as read"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bulk Follow-Up Modal (rendered outside wrapper to avoid clipping) */}
      {showBulkModal && (
        <BulkFollowUpModal
          apps={followUpApps}
          onConfirm={handleBulkConfirm}
          onCancel={() => setShowBulkModal(false)}
        />
      )}
    </>
  );
}
