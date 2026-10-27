// Passive refreshes pause in hidden tabs and coalesce paired focus/visibility events.
// Explicit mutation/manual refresh handlers do not pass through this policy.
export const shouldAutoRefresh = ({ visibilityState, running, lastStartedAt, now, minGapMs = 1000 }) => {
  if (visibilityState === 'hidden' || running) return false;
  return lastStartedAt === null || now < lastStartedAt || now - lastStartedAt >= minGapMs;
};
