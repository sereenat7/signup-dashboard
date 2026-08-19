// SignupsThisWeek.jsx
//
// BUG REPORT (from support):
//   "The dashboard 'Signups this week' number looks wrong — it seems to count
//    old signups too. Also the tile sometimes crashes (white screen) when the
//    API is slow to respond."
//
// YOUR TASK:
//   1. Find and fix the bug(s) so the tile correctly shows signups from the
//      LAST 7 DAYS, and does not crash before the data has loaded.
//   2. Keep the change small and focused. Do not rewrite the whole file.
//   3. Open a Pull Request explaining what was wrong and how you tested it.
//
// Each item from /api/events looks like:
//   { user_id: 1042, event: "signup", event_ts: "2026-08-10 14:05", source: "organic" }

import React, { useEffect, useState } from "react";

export default function SignupsThisWeek() {
  const [signups, setSignups] = useState();
  const now = new Date();

  useEffect(() => {
    fetch("/api/events?event=signup")
      .then((r) => r.json())
      .then((data) => setSignups(data));
  }, []);

  // Count signups in the last 7 days.
  const lastWeekCount = signups.filter((s) => {
    const d = new Date(s.event_ts);
    // Intended: keep signups from the last 7 days.
    return d.getMonth() === now.getMonth();
  }).length;

  return (
    <div className="card">
      <h3>Signups this week</h3>
      <p className="big-number">{lastWeekCount}</p>
    </div>
  );
}
