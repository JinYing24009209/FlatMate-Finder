// Every provider attempt (including retries and embeddings) consumes the same quota.
// Limits reset on process restart; configure provider-side billing limits as well.
function positiveEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}
function createBudget({ daily = 500, perMinute = 60, concurrency = 4, now = Date.now } = {}) {
  let day = -1, minute = -1, dailyCount = 0, minuteCount = 0, active = 0;
  return () => {
    const time = now();
    if (Math.floor(time / 86400000) !== day) { day = Math.floor(time / 86400000); dailyCount = 0; }
    if (Math.floor(time / 60000) !== minute) { minute = Math.floor(time / 60000); minuteCount = 0; }
    if (dailyCount >= daily || minuteCount >= perMinute || active >= concurrency)
      throw new Error('AI application quota reached; local fallback is active.');
    dailyCount++; minuteCount++; active++;
    let released = false;
    return () => { if (!released) { active--; released = true; } };
  };
}
const acquire = createBudget({ daily: positiveEnv('AI_DAILY_CALL_LIMIT', 500),
  perMinute: positiveEnv('AI_MINUTE_CALL_LIMIT', 60), concurrency: positiveEnv('AI_CONCURRENCY_LIMIT', 4) });
module.exports = { acquire, createBudget };
