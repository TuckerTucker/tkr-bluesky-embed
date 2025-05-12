const memoryCache = require('memory-cache');
const config = require('../../config/default');

class Cache {
  constructor() {
    this.enabled = config.cache.enabled;
    this.defaultDuration = config.cache.duration;
  }

  // Get an item from the cache
  get(key) {
    if (!this.enabled) return null;
    return memoryCache.get(key);
  }

  // Store an item in the cache
  put(key, value, duration = this.defaultDuration) {
    if (!this.enabled) return;
    memoryCache.put(key, value, duration);
  }

  // Remove an item from the cache
  delete(key) {
    memoryCache.del(key);
  }

  // Clear the entire cache
  clear() {
    memoryCache.clear();
  }

  // Create a middleware function for Express
  middleware(duration = this.defaultDuration) {
    return (req, res, next) => {
      if (!this.enabled) {
        console.log('Cache disabled globally, skipping cache');
        return next();
      }

      // Skip cache if _nocache parameter is present
      if (req.query._nocache) {
        console.log('Cache bypass requested via _nocache param, skipping cache for URL: ' + req.originalUrl);
        // Clear any existing cache for this endpoint
        this.delete(req.originalUrl || req.url);
        return next();
      }

      // For feeds, use a shorter cache duration (5 minutes)
      let actualDuration = duration;
      if (req.path === '/feed' || req.path === '/user-posts') {
        actualDuration = Math.min(duration, 5 * 60 * 1000); // 5 minutes in milliseconds
        console.log(`Using shorter cache duration for feed: ${actualDuration}ms`);
      }

      const key = req.originalUrl || req.url;
      const cachedResponse = this.get(key);

      if (cachedResponse) {
        console.log(`Cache hit for: ${key}`);
        // Add a cache timestamp header for debugging
        res.setHeader('X-Cache-Timestamp', new Date(Date.now() - (actualDuration - cachedResponse.ttl)).toISOString());
        return res.send(cachedResponse.data);
      }

      console.log(`Cache miss for: ${key}`);

      // Store original send method
      const originalSend = res.send;

      // Override send method to cache response
      res.send = (body) => {
        const ttl = actualDuration;
        this.put(key, { data: body, ttl }, actualDuration);
        originalSend.call(res, body);
      };

      next();
    };
  }
}

module.exports = new Cache();