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
        return next();
      }

      const key = req.originalUrl || req.url;
      const cachedResponse = this.get(key);
      
      if (cachedResponse) {
        return res.send(cachedResponse);
      }
      
      // Store original send method
      const originalSend = res.send;
      
      // Override send method to cache response
      res.send = (body) => {
        this.put(key, body, duration);
        originalSend.call(res, body);
      };
      
      next();
    };
  }
}

module.exports = new Cache();