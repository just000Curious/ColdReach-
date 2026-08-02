const CADENCE = [3, 7, 14];

export default function Notifications({ apps }) {
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

  if (!urgent.length && !due.length) return null;

  return (
    <div className="notifications">
      {urgent.map((item, i) => (
        <div className="notif notif-urgent" key={`u-${i}`}>
          <strong style={{ color: "var(--red)" }}>{item.app.role} at {item.app.company}</strong> — {item.msg}
        </div>
      ))}
      {due.map((item, i) => (
        <div className="notif notif-due" key={`d-${i}`}>
          <strong style={{ color: "var(--amber)" }}>{item.app.role} at {item.app.company}</strong> — {item.msg}
        </div>
      ))}
    </div>
  );
}
