module.exports = {
  // Server configuration
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost',
  },
  
  // Bluesky API configuration
  bluesky: {
    service: process.env.BSKY_SERVICE_URL || 'https://bsky.social',
    username: process.env.BSKY_USERNAME || null,
    did: process.env.BSKY_DID || null, // DID for the configured username
    appPassword: process.env.BSKY_APP_PASSWORD || null,
  },
  
  // Caching configuration
  cache: {
    enabled: true,
    duration: parseInt(process.env.CACHE_DURATION) || 3600000, // 1 hour in milliseconds
  },
  
  // Embed styling defaults
  styling: {
    defaultTheme: 'light', // 'light' or 'dark'
    defaultWidth: '100%',
    maxWidth: 550,
  }
};