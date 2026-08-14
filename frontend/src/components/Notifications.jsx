import { useState, useRef, useEffect } from "react";

const CADENCE = [3, 7, 14];

export default function Notifications({ apps, onNotificationClick, onBulkFollowUp }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  const urgent = [];
  const due = [];
  const now = Date.now();

  for (const app of apps) {
    if (["Replied", "Interview Scheduled", "Rejected", "Ghosted", "Draft"].includes(app.status)) continue;

    const refDate = app.follow_up_sent_at || app.sent_at;
    if (!refDate) continue;

    const daysSince = Math.floor((now - new Date(refDate).getTime()) / 86400000);
    const fuCount = app.follow_up_count || 0;

    if (fuCount >= CADENCE.length) {
      urgent.push({ app, msg: `${fuCount} follow-ups sent, no reply — consider marking as Ghosted` });
    } else if (daysSince >= CADENCE[fuCount]) {
      const label = `Follow-up #${fuCount + 1} is due (${daysSince}d since last email)`;
      if (daysSince >= CADENCE[fuCount] + 3) {
        urgent.push({ app, msg: label + " — OVERDUE" });
      } else {
        due.push({ app, msg: label });
      }
    }
  }

  const totalCount = urgent.length + due.length;

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="notifications-wrapper" ref={dropdownRef}>
      <button 
        className="notif-bell-btn" 
        onClick={() => setIsOpen(!isOpen)}
        title="Notifications"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        {totalCount > 0 && <span className="notif-badge">{totalCount}</span>}
      </button>

      {isOpen && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <h3>Notifications</h3>
            {totalCount === 0 && <span className="notif-empty">All caught up!</span>}
            {totalCount > 0 && (
              <button 
                className="btn btn-primary" 
                style={{ fontSize: "0.75rem", padding: "4px 8px" }}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  const dueApps = [...urgent, ...due]
                    .filter(x => (x.app.follow_up_count || 0) < CADENCE.length)
                    .map(x => x.app);
                  if (onBulkFollowUp) onBulkFollowUp(dueApps);
                }}
              >
                Auto-Followup All ({totalCount})
              </button>
            )}
          </div>
          
          <div className="notif-list">
            {urgent.map((item, i) => (
              <div 
                className="notif-item notif-urgent" 
                key={`u-${i}`}
                style={{ cursor: "pointer" }}
                onClick={() => {
                  setIsOpen(false);
                  if (onNotificationClick) onNotificationClick(item.app.id);
                }}
              >
                <div className="notif-title">{item.app.role} at {item.app.company}</div>
                <div className="notif-desc">{item.msg}</div>
              </div>
            ))}
            {due.map((item, i) => (
              <div 
                className="notif-item notif-due" 
                key={`d-${i}`}
                style={{ cursor: "pointer" }}
                onClick={() => {
                  setIsOpen(false);
                  if (onNotificationClick) onNotificationClick(item.app.id);
                }}
              >
                <div className="notif-title">{item.app.role} at {item.app.company}</div>
                <div className="notif-desc">{item.msg}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
