require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('../config/default');
const blueskyClient = require('./lib/bluesky-client');
const postRenderer = require('./lib/post-renderer');
const cache = require('./lib/cache');

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