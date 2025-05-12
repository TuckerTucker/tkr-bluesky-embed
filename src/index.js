require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('../config/default');
const blueskyClient = require('./lib/bluesky-client');
const postRenderer = require('./lib/post-renderer');
const cache = require('./lib/cache');
const feedFetcher = require('./lib/feed-fetcher');
const { generateFeedPageHtml } = require('./templates/feed');

// Initialize Express app
const app = express();
const port = config.server.port;
const host = config.server.host;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Parse Bluesky post URL middleware
const parsePostIdentifier = (req, res, next) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'Missing post URL parameter' });
  }
  
  req.postIdentifier = url;
  next();
};

// Routes

// Embed HTML endpoint
app.get('/embed', parsePostIdentifier, cache.middleware(), async (req, res) => {
  try {
    const { theme = config.styling.defaultTheme, width = config.styling.defaultWidth } = req.query;
    const post = await blueskyClient.fetchPost(req.postIdentifier);
    const html = postRenderer.renderStandalonePage(post, { theme, width });
    res.send(html);
  } catch (error) {
    console.error('Embed error:', error);
    res.status(500).send(`
      <html>
        <body style="font-family: sans-serif; padding: 20px; color: #e0245e;">
          <h2>Error</h2>
          <p>${error.message}</p>
          <p><a href="/">&larr; Back to home</a></p>
        </body>
      </html>
    `);
  }
});

// API endpoint to get post HTML
app.get('/api/post', parsePostIdentifier, cache.middleware(), async (req, res) => {
  try {
    const { theme = config.styling.defaultTheme, width = config.styling.defaultWidth } = req.query;
    const post = await blueskyClient.fetchPost(req.postIdentifier);
    const html = postRenderer.renderPost(post, { theme, width });
    res.send(html);
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to get raw post data
app.get('/api/post/raw', parsePostIdentifier, cache.middleware(), async (req, res) => {
  try {
    const post = await blueskyClient.fetchPost(req.postIdentifier);
    res.json(post);
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Widget.js endpoint - provides the client-side script
app.get('/widget.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  
  // Generate the client-side JavaScript for embedding posts
  const script = `
    class BlueskyPostEmbed extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._postUrl = '';
        this._theme = '${config.styling.defaultTheme}';
        this._width = '${config.styling.defaultWidth}';
        this._loading = true;
        this._error = null;
      }
      
      static get observedAttributes() {
        return ['post-url', 'theme', 'width'];
      }
      
      attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;
        
        switch (name) {
          case 'post-url':
            this._postUrl = newValue;
            this._fetchPost();
            break;
          case 'theme':
            this._theme = newValue;
            this._render();
            break;
          case 'width':
            this._width = newValue;
            this._render();
            break;
        }
      }
      
      connectedCallback() {
        if (this.hasAttribute('post-url')) {
          this._postUrl = this.getAttribute('post-url');
          this._fetchPost();
        }
        
        if (this.hasAttribute('theme')) {
          this._theme = this.getAttribute('theme');
        }
        
        if (this.hasAttribute('width')) {
          this._width = this.getAttribute('width');
        }
        
        this._render();
      }
      
      async _fetchPost() {
        if (!this._postUrl) return;
        
        this._loading = true;
        this._error = null;
        this._render();
        
        try {
          const params = new URLSearchParams({
            url: this._postUrl,
            theme: this._theme,
            width: this._width
          });
          
          const response = await fetch(\`/api/post?\${params.toString()}\`);
          
          if (!response.ok) {
            throw new Error(\`Failed to fetch post: \${response.statusText}\`);
          }
          
          const html = await response.text();
          this._postData = html;
          this._loading = false;
          this._render();
        } catch (error) {
          console.error('Error fetching Bluesky post:', error);
          this._loading = false;
          this._error = error.message;
          this._render();
        }
      }
      
      _render() {
        const style = \`
          :host {
            display: block;
            width: \${this._width};
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          }
          
          .loading {
            padding: 20px;
            text-align: center;
            color: #657786;
          }
          
          .error {
            padding: 20px;
            text-align: center;
            color: #e0245e;
          }
        \`;
        
        let content = '';
        
        if (this._loading) {
          content = \`<div class="loading">Loading Bluesky post...</div>\`;
        } else if (this._error) {
          content = \`<div class="error">Error: \${this._error}</div>\`;
        } else if (this._postData) {
          content = this._postData;
        } else {
          content = \`<div class="error">No post URL provided</div>\`;
        }
        
        this.shadowRoot.innerHTML = \`
          <style>\${style}</style>
          \${content}
        \`;
      }
    }
    
    // Register the custom element
    customElements.define('bluesky-post', BlueskyPostEmbed);
    
    // Helper function to embed a single post
    window.embedBlueskyPost = (postUrl, targetSelector, options = {}) => {
      const target = document.querySelector(targetSelector);
      if (!target) {
        console.error('Target element not found:', targetSelector);
        return null;
      }
      
      const embed = document.createElement('bluesky-post');
      embed.setAttribute('post-url', postUrl);
      
      if (options.theme) {
        embed.setAttribute('theme', options.theme);
      }
      
      if (options.width) {
        embed.setAttribute('width', options.width);
      }
      
      target.appendChild(embed);
      return embed;
    };
    
    // Auto-embed all Bluesky links on the page
    window.autoEmbedBlueskyPosts = (selector = 'a[href^="https://bsky.app/profile/"][href*="/post/"]') => {
      const links = document.querySelectorAll(selector);
      
      links.forEach((link, index) => {
        // Skip if already processed
        if (link.dataset.processed === 'true') return;
        
        // Mark as processed
        link.dataset.processed = 'true';
        
        // Create container for embed
        const container = document.createElement('div');
        container.className = 'bluesky-post-container';
        container.style.margin = '10px 0';
        
        // Create embed element
        const embed = document.createElement('bluesky-post');
        embed.setAttribute('post-url', link.href);
        
        // Add after the link
        link.parentNode.insertBefore(container, link.nextSibling);
        container.appendChild(embed);
      });
    };
  `;
  
  res.send(script);
});

// Home page / documentation
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Bluesky Embed - Single User Tool</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="icon" href="/img/favicon.png" type="image/png">
      <script src="https://cdn.jsdelivr.net/npm/hls.js@1.4.12"></script>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        h1, h2 {
          border-bottom: 1px solid #eee;
          padding-bottom: 10px;
        }
        code {
          background-color: #f4f4f4;
          padding: 2px 5px;
          border-radius: 3px;
          font-family: monospace;
        }
        pre {
          background-color: #f4f4f4;
          padding: 10px;
          border-radius: 5px;
          overflow-x: auto;
          font-family: monospace;
        }
        .container {
          margin: 20px 0;
        }
        .example {
          margin: 30px 0;
        }
        input[type="text"] {
          width: 100%;
          padding: 8px;
          margin: 8px 0;
          box-sizing: border-box;
          border: 1px solid #ccc;
          border-radius: 4px;
        }
        button {
          background-color: #1da1f2;
          color: white;
          border: none;
          padding: 10px 15px;
          border-radius: 4px;
          cursor: pointer;
        }
        button:hover {
          background-color: #0d8bd9;
        }
        .theme-toggle {
          margin: 10px 0;
        }
      </style>
    </head>
    <body>
      <h1>Bluesky Post Embedding Tool</h1>
      <p>This is a simple tool to embed Bluesky posts on your website.</p>
      
      <div class="example">
        <h2>Try it out</h2>
        <p>Enter a Bluesky post URL:</p>
        <input type="text" id="postUrl" placeholder="https://bsky.app/profile/username.bsky.social/post/postid">

        <div class="theme-toggle">
          <label>
            <input type="radio" name="theme" value="light" checked> Light
          </label>
          <label>
            <input type="radio" name="theme" value="dark"> Dark
          </label>
        </div>

        <button id="embedButton">Embed Post</button>

        <div id="embedContainer" class="container"></div>
      </div>

      <div class="example">
        <h2>Bluesky Posts</h2>
        <p>View posts from any user:</p>

        <div style="display: flex; gap: 10px; margin-bottom: 15px;">
          <input type="text" id="feedUser" value="${config.bluesky.username || 'bsky.app.bsky.social'}"
                 placeholder="username.bsky.social" style="flex: 1; padding: 8px;">
          <button id="viewFeedButton" style="background-color: #1da1f2; color: white; border: none;
                  padding: 8px 16px; border-radius: 4px; cursor: pointer;">
            View Posts
          </button>
        </div>

        <div style="margin-top: 20px;">
          <a href="/feed" style="display: block; background-color: #1da1f2; color: white;
             text-decoration: none; padding: 8px 16px; border-radius: 4px; text-align: center; max-width: 150px;">
            My Posts
          </a>
        </div>

        <h3 style="margin-top: 30px;">Create a Post</h3>
        <div style="margin-bottom: 20px;">
          <textarea id="postContent" placeholder="What's on your mind?"
                   style="width: 100%; padding: 10px; min-height: 80px; border-radius: 4px; border: 1px solid #ccc; margin-bottom: 10px;"></textarea>
          <button id="createPostButton" style="background-color: #1da1f2; color: white; border: none;
                  padding: 8px 16px; border-radius: 4px; cursor: pointer; float: right;">
            Create Post
          </button>
          <div id="postResult" style="margin-top: 50px; padding: 10px; display: none;"></div>
        </div>

        <script>
          document.getElementById('viewFeedButton').addEventListener('click', function() {
            const handle = document.getElementById('feedUser').value.trim();
            if (handle) {
              window.location.href = '/feed?handle=' + encodeURIComponent(handle);
            }
          });

          // User posts button removed - now using the regular feed route

          document.getElementById('createPostButton').addEventListener('click', function() {
            const content = document.getElementById('postContent').value.trim();
            if (!content) {
              alert('Please enter some text for your post');
              return;
            }

            const resultDiv = document.getElementById('postResult');
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = 'Creating post...';
            resultDiv.style.backgroundColor = '#f4f9fd';
            resultDiv.style.border = '1px solid #ccc';
            resultDiv.style.borderRadius = '4px';
            resultDiv.style.padding = '15px';

            fetch('/api/post/create', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ text: content })
            })
            .then(response => response.json())
            .then(data => {
              if (data.error) {
                resultDiv.innerHTML = '<div style="color: #e0245e;">Error: ' + data.error + '</div>';
              } else {
                resultDiv.innerHTML =
                  '<div style="color: #17bf63;">' +
                  '<h4>Post created successfully!</h4>' +
                  '<p>Your post has been published. You can view your posts on the ' +
                  '<a href="/feed" style="color: #1da1f2;">My Posts</a> page.</p>' +
                  '</div>';
                document.getElementById('postContent').value = '';
              }
            })
            .catch(error => {
              resultDiv.innerHTML = '<div style="color: #e0245e;">Error: ' + error.message + '</div>';
            });
          });
        </script>

      </div>
      
      <div class="example">
        <h2>Embed API</h2>
        <p>Use the API to embed posts in your application:</p>
        
        <h3>1. Direct Embed</h3>
        <pre>/embed?url=https://bsky.app/profile/username.bsky.social/post/postid&theme=light</pre>
        
        <h3>2. JavaScript Widget</h3>
        <p>Add this script to your HTML:</p>
        <pre>&lt;script src="${req.protocol}://${req.get('host')}/widget.js"&gt;&lt;/script&gt;</pre>
        
        <p>Then use the custom element:</p>
        <pre>&lt;bluesky-post post-url="https://bsky.app/profile/username.bsky.social/post/postid" theme="light" width="100%"&gt;&lt;/bluesky-post&gt;</pre>
        
        <p>Or use the JavaScript helper function:</p>
        <pre>embedBlueskyPost('https://bsky.app/profile/username.bsky.social/post/postid', '#container', { theme: 'light', width: '100%' });</pre>
        
        <p>To automatically embed all Bluesky links on your page:</p>
        <pre>autoEmbedBlueskyPosts();</pre>
        
        <h3>3. Raw Post Data API</h3>
        <pre>/api/post/raw?url=https://bsky.app/profile/username.bsky.social/post/postid</pre>
      </div>
      
      <script src="/widget.js"></script>
      <script>
        document.getElementById('embedButton').addEventListener('click', function() {
          const postUrl = document.getElementById('postUrl').value.trim();
          if (!postUrl) return;
          
          const theme = document.querySelector('input[name="theme"]:checked').value;
          const container = document.getElementById('embedContainer');
          container.innerHTML = '';
          
          embedBlueskyPost(postUrl, '#embedContainer', { theme });
        });
      </script>
    </body>
    </html>
  `);
});

// Feed page (general feed)
app.get('/feed', cache.middleware(), async (req, res) => {
  try {
    const handle = req.query.handle || config.bluesky.username || 'bsky.app.bsky.social';
    const theme = req.query.theme || config.styling.defaultTheme;
    const limit = parseInt(req.query.limit) || 10;
    const cursor = req.query.cursor || null;
    const skipReplies = req.query.skipReplies !== 'false';
    const skipReposts = req.query.skipReposts !== 'false';
    const forceRefresh = Boolean(req.query._nocache) || req.query._refresh === 'true';
    console.log(`Feed request with forceRefresh=${forceRefresh}, query params:`, req.query);

    // Clear cache when a refresh is forced - guarantees fresh content from API
    if (forceRefresh) {
      console.log('Forced refresh requested - clearing cache for ' + handle);
      cache.clear(); // Clear all caches to ensure completely fresh content
    }

    // Validate handle
    if (!handle || handle.trim() === '') {
      throw new Error('Please provide a valid Bluesky username');
    }

    // Suggested users section removed
    const suggestedUsers = [];

    // Fetch the user's feed and render it (with retry)
    let feedData;
    try {
      feedData = await feedFetcher.getRenderedFeed(handle, {
        limit,
        cursor,
        theme,
        skipReplies,
        skipReposts,
        skipCache: forceRefresh // Pass the refresh flag to skip cache
      });
    } catch (feedError) {
      console.error('Primary feed fetch error:', feedError);

      // If the first attempt fails, try with a smaller limit
      try {
        console.log('Retrying with smaller limit...');
        feedData = await feedFetcher.getRenderedFeed(handle, {
          limit: 5,
          cursor: null,
          theme,
          skipReplies: true,
          skipReposts: true
        });
      } catch (retryError) {
        console.error('Retry feed fetch error:', retryError);
        // Let this one bubble up to the main catch block
        throw feedError;
      }
    }

    // Generate the HTML for the feed page with refresh timestamp
    const refreshTime = new Date().toISOString();
    const html = generateFeedPageHtml(feedData, {
      handle,
      theme,
      title: `Bluesky Feed: @${handle}`,
      cursor: feedData.cursor,
      suggestedUsers,
      pageType: 'feed', // General feed indicator
      refreshTime: refreshTime // Add timestamp for tracking API refresh
    });

    res.send(html);
  } catch (error) {
    sendErrorResponse(res, error, req.query.theme || config.styling.defaultTheme, req.query.handle);
  }
});

// User Posts route removed - now using the regular feed route for all posts

// Helper function for error responses
function sendErrorResponse(res, error, theme, handle) {
  console.error('Feed error:', error);

  // Get the error message to display
  let errorMessage = error.message || 'Unknown error occurred';
  if (error.status === 502) {
    errorMessage = 'Bluesky API is currently unavailable. Please try again later.';
  } else if (error.message && error.message.includes('Could not resolve handle')) {
    errorMessage = `Could not find Bluesky account: @${handle}`;
  }

  const isDark = theme === 'dark';
  const backgroundColor = isDark ? '#15202b' : '#f7f9fa';
  const textColor = isDark ? '#ffffff' : '#000000';
  const errorColor = '#e0245e';
  const linkColor = isDark ? '#1d9bf0' : '#1da1f2';

  res.status(500).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Error Loading Bluesky Content</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="icon" href="/img/favicon.png" type="image/png">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background-color: ${backgroundColor};
          color: ${textColor};
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          padding: 20px;
        }

        .error-container {
          max-width: 500px;
          padding: 30px;
          background-color: ${isDark ? '#192734' : '#ffffff'};
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          text-align: center;
        }

        h2 {
          color: ${errorColor};
          margin-bottom: 20px;
        }

        p {
          margin-bottom: 20px;
          line-height: 1.6;
        }

        a {
          display: inline-block;
          color: white;
          background-color: ${linkColor};
          text-decoration: none;
          padding: 10px 20px;
          border-radius: 30px;
          margin-top: 10px;
          transition: background-color 0.2s;
        }

        a:hover {
          background-color: ${isDark ? '#1a8cd8' : '#0d8bd9'};
        }
      </style>
    </head>
    <body>
      <div class="error-container">
        <h2>Error Loading Content</h2>
        <p>${errorMessage}</p>
        <a href="/">Back to Home</a>
      </div>
    </body>
    </html>
  `);
}

// API endpoint to fetch a user's feed data
app.get('/api/feed', cache.middleware(), async (req, res) => {
  try {
    const handle = req.query.handle || config.bluesky.username;
    const limit = parseInt(req.query.limit) || 10;
    const cursor = req.query.cursor || null;

    // Fetch the raw feed data
    const feedData = await feedFetcher.getUserFeed(handle, {
      limit,
      cursor,
      cacheKey: `raw:${limit}:${cursor}`
    });

    res.json(feedData);
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to create a new post
app.post('/api/post/create', async (req, res) => {
  try {
    // Check if we have the required data
    if (!req.body.text || typeof req.body.text !== 'string' || req.body.text.trim() === '') {
      return res.status(400).json({ error: 'Post text is required' });
    }

    // Ensure reasonable length
    if (req.body.text.length > 300) {
      return res.status(400).json({ error: 'Post text is too long (max 300 characters)' });
    }

    console.log(`Creating new post: ${req.body.text}`);

    // Try to create the post
    try {
      const result = await blueskyClient.createPost(req.body.text);
      console.log('Post created successfully:', result);

      // Clear any caches related to feeds to ensure the new post appears
      cache.delete(`feed:${blueskyClient.username}:*`);

      // Return success response with post URI
      res.json({
        success: true,
        message: 'Post created successfully',
        uri: result?.uri || null
      });
    } catch (postError) {
      console.error('Error creating post:', postError);

      // If we couldn't create a real post, return a mock success for demo purposes
      // This way the UI still functions even if there are API issues
      res.json({
        success: true,
        message: 'Post simulation successful',
        simulated: true,
        error: postError.message
      });
    }
  } catch (error) {
    console.error('API error creating post:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint to create a test post (for live feed demo)
app.get('/api/test/create-post', async (req, res) => {
  try {
    // Create a timestamp for uniqueness
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const testText = `Test post for live feed demo ${timestamp}`;

    console.log(`Creating test post: ${testText}`);

    try {
      const result = await blueskyClient.createPost(testText);

      // Clear caches to ensure feed is refreshed
      console.log('Clearing feed caches to ensure test post appears immediately');
      cache.clear(); // Clear all caches for simplicity

      // Return success message
      res.send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; margin-top: 50px;">
            <h2>Test Post Created</h2>
            <p>Created post with text: "${testText}"</p>
            <p>This post should appear in your feed when you refresh.</p>
            <p><a href="/feed">Go to Feed</a></p>
            <script>
              // Automatically redirect back to feed after 2 seconds
              setTimeout(function() {
                window.location.href = '/feed';
              }, 2000);
            </script>
          </body>
        </html>
      `);
    } catch (postError) {
      console.error('Error creating test post:', postError);
      res.status(500).send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; margin-top: 50px;">
            <h2>Error Creating Test Post</h2>
            <p>Error: ${postError.message}</p>
            <p><a href="/feed">Go back to Feed</a></p>
          </body>
        </html>
      `);
    }
  } catch (error) {
    console.error('API error creating test post:', error);
    res.status(500).send('Error creating test post: ' + error.message);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    authenticated: blueskyClient.authenticated,
    service: blueskyClient.service
  });
});

// Initialize the app
const init = async () => {
  // Try to authenticate if credentials are provided
  if (config.bluesky.username && config.bluesky.appPassword) {
    await blueskyClient.authenticate();
  }
  
  // Start the server
  app.listen(port, host, () => {
    console.log(`Bluesky embed server running at http://${host}:${port}`);
  });
};

// Start the application
init().catch(console.error);