// Single-process coursework limits. Multiple API replicas need a shared Redis limiter.
function createAiRateLimit({ limit = 30, windowMs = 60000, now = Date.now } = {}) {
  const windows = new Map();
  return (req, res, next) => {
    const time = now();
    for (const [key, entry] of windows) if (entry.reset <= time) windows.delete(key);
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    let entry = windows.get(key);
    if (!entry) {
      if (windows.size >= 10000) return res.status(429).json({ message: 'AI service is busy. Try again later.' });
      entry = { count: 0, reset: time + windowMs };
      windows.set(key, entry);
    }
    if (++entry.count > limit) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((entry.reset - time) / 1000))));
      return res.status(429).json({ message: 'Too many AI requests. Please wait before trying again.' });
    }
    next();
  };
}
const aiRateLimit = createAiRateLimit();
module.exports = { aiRateLimit, createAiRateLimit };
