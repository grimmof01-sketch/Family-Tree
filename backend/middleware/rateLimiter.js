const ipRequests = new Map();

// Periodic cleanup of requests older than the window to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, requests] of ipRequests.entries()) {
    // Keep only requests from the last 1 hour (longest window we might use)
    const activeRequests = requests.filter(timestamp => now - timestamp < 3600000);
    if (activeRequests.length === 0) {
      ipRequests.delete(ip);
    } else {
      ipRequests.set(ip, activeRequests);
    }
  }
}, 5 * 60 * 1000); // Run cleanup every 5 minutes

const rateLimiter = (options = {}) => {
  const windowMs = options.windowMs || 15 * 60 * 1000; // default 15 minutes
  const max = options.max || 100; // default 100 requests per windowMs
  const message = options.message || 'Too many requests from this IP, please try again later.';

  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
    const now = Date.now();

    if (!ipRequests.has(ip)) {
      ipRequests.set(ip, []);
    }

    const timestamps = ipRequests.get(ip);
    // Filter out timestamps outside the current window
    const windowTimestamps = timestamps.filter(timestamp => now - timestamp < windowMs);

    if (windowTimestamps.length >= max) {
      return res.status(429).json({ message });
    }

    windowTimestamps.push(now);
    ipRequests.set(ip, windowTimestamps);
    next();
  };
};

module.exports = { rateLimiter };
