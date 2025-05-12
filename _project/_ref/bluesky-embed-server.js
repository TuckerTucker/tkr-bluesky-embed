// Express Server for Automatic Bluesky Post Embedding
// This implementation creates a server that can be used to embed Bluesky posts

const express = require('express');
const { BskyAgent } = require('@atproto/api');
const cors = require('cors');
const fetch = require('node-fetch');
const cache = require('memory-cache');

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for client-side requests
app.use(cors());
app.use(express.json());

// Configuration - replace with environment variables in production
const CONFIG = {
  SERVICE_URL: process.env.BSKY_SERVICE_URL || 'https://bsky.social',
  USERNAME: process.env.BSKY_USERNAME || null, // Optional
  APP_PASSWORD: process.env.BSKY_APP_PASSWORD || null, // Optional
  CACHE_DURATION: process.env.CACHE_DURATION || 3600000, // 1 hour in milliseconds
};

// Create Bluesky agent
const agent = new BskyAgent({
  service: CONFIG.SERVICE_URL
});

// Authenticate if credentials are provided
let authenticated = false;
const authenticate = async () => {
  if (CONFIG.USERNAME && CONFIG.APP_PASSWORD && !authenticated) {
    try {
      await agent.login({
        identifier: CONFIG.USERNAME,
        password: CONFIG.APP_PASSWORD
      });
      authenticated = true;
      console.log('Authenticated with Bluesky');
      return true;
    } catch (error) {
      console.error('Bluesky authentication failed:', error);
      return false;
    }
  }
  return authenticated;
};

// Initialize authentication if credentials are available
(async () => {
  if (CONFIG.USERNAME && CONFIG.APP_PASSWORD) {
    await authenticate();
  }
})();

// Middleware to parse Bluesky post URLs/URIs
const parsePostIdentifier = (req, res, next) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'Missing post URL parameter' });
  }
  
  req.postIdentifier = url;
  next();
};

// Cache middleware
const cacheMiddleware = (duration) => {
  return (req, res, next) => {
    const key = req.originalUrl || req.url;
    const cachedResponse = cache.get(key);
    
    if (cachedResponse) {
      res.json(cachedResponse);
      return;
    }
    
    // Override res.json to cache the response
    const originalJson = res.json;
    res.json = function(body) {
      cache.put(key, body, duration);
      originalJson.call(this, body);
    };
    
    next();
  };
};

// Extract post URI from URL
const getPostUriFromUrl = async (url) => {
  if (url.startsWith('at://')) {
    return url; // Already a URI
  }
  
  // Handle URL format (https://bsky.app/profile/username.com/post/postid)
  if (url.startsWith('https://bsky.app/profile/')) {
    try {
      const urlParts = url.split('/');
      if (urlParts.length < 6) {
        throw new Error('Invalid Bluesky URL format');
      }
      
      const username = urlParts[4];
      const postId = urlParts[6];
      
      // Get the DID for the username
      const didResponse = await agent.resolveHandle({ handle: username });
      const did = didResponse.data.did;
      
      // Construct the post URI
      return `at://${did}/app.bsky.feed.post/${postId}`;
    } catch (error) {
      throw new Error(`Failed to parse Bluesky URL: ${error.message}`);
    }
  }
  
  throw new Error('Unsupported URL format');
};

// Fetch a post from Bluesky
const fetchPost = async (postIdentifier) => {
  try {
    const postUri = await getPostUriFromUrl(postIdentifier);
    
    // Authenticate if needed and not already authenticated
    if (CONFIG.USERNAME && CONFIG.APP_PASSWORD && !authenticated) {
      await authenticate();
    }
    
    // Fetch the post
    const response = await agent.getPosts({ uris: [postUri] });
    
    if (!response.data.posts.length) {
      throw new Error('Post not found');
    }
    
    return response.data.posts[0];
  } catch (error) {
    console.error('Error fetching post:', error);
    throw error;
  }
};

// Format post text with links and mentions
const formatPostText = (text) => {
  // Simple URL detection and conversion to links
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const htmlText = text.replace(urlRegex, '<a href="$1" target="_blank" style="color: #1da1f2; text-decoration: none;">$1</a>');
  
  // Format mentions
  const mentionRegex = /@([a-zA-Z0-9_.-]+)/g;
  return htmlText.replace(mentionRegex, '<a href="https://bsky.app/profile/$1" target="_blank" style="color: #1da1f2; text-decoration: none;">@$1</a>');
};

// Generate HTML for media attachments
const generateMediaHTML = (post, theme) => {
  let mediaHTML = '';
  const isDark = theme === 'dark';
  
  // Handle embedded images if present
  if (post.embed && post.embed.images) {
    mediaHTML += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; margin-bottom: 12px;">';
    
    post.embed.images.forEach(image => {
      mediaHTML += `
        <div>
          <img src="${image.fullsize}" alt="${image.alt || ''}" style="width: 100%; border-radius: 8px; margin-bottom: 4px;">
          ${image.alt ? `<div style="color: ${isDark ? '#8899a6' : '#657786'}; font-size: 12px;">${image.alt}</div>` : ''}
        </div>
      `;
    });
    
    mediaHTML += '</div>';
  }
  
  // Handle embedded links/cards if present
  if (post.embed && post.embed.external) {
    const { uri, title, description, thumb } = post.embed.external;
    
    mediaHTML += `
      <div style="border: 1px solid ${isDark ? '#38444d' : '#e1e8ed'}; border-radius: 8px; margin-bottom: 12px; overflow: hidden;">
        ${thumb ? `<img src="${thumb}" alt="${title}" style="width: 100%; max-height: 250px; object-fit: cover;">` : ''}
        <div style="padding: 12px;">
          <div style="font-weight: bold; margin-bottom: 4px;">${title}</div>
          ${description ? `<div style="color: ${isDark ? '#8899a6' : '#657786'}; margin-bottom: 8px; font-size: 14px;">${description}</div>` : ''}
          <a href="${uri}" target="_blank" style="color: ${isDark ? '#8899a6' : '#657786'}; font-size: 14px; text-decoration: none; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${uri}</a>
        </div>
      </div>
    `;
  }
  
  // Handle quote posts if present
  if (post.embed && post.embed.record) {
    const record = post.embed.record;
    const quoteAuthor = record.author;
    
    mediaHTML += `
      <div style="border: 1px solid ${isDark ? '#38444d' : '#e1e8ed'}; border-radius: 8px; margin-bottom: 12px; padding: 12px;">
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          ${quoteAuthor.avatar ? `<img src="${quoteAuthor.avatar}" alt="${quoteAuthor.displayName || quoteAuthor.handle}" style="width: 20px; height: 20px; border-radius: 50%; margin-right: 8px;">` : ''}
          <div>
            <span style="font-weight: bold;">${quoteAuthor.displayName || ''}</span>
            <span style="color: ${isDark ? '#8899a6' : '#657786'}; margin-left: 4px;">@${quoteAuthor.handle}</span>
          </div>
        </div>
        <div style="white-space: pre-wrap;">${formatPostText(record.value.text)}</div>
      </div>
    `;
  }
  
  return mediaHTML;
};

// Generate HTML for embedding a post
const generateEmbedHTML = (post, options = {}) => {
  const { width = '100%', height = 'auto', theme = 'light' } = options;
  const isDark = theme === 'dark';
  
  // Extract essential information from the post
  const authorName = post.author.displayName || post.author.handle;
  const authorHandle = post.author.handle;
  const authorAvatar = post.author.avatar;
  const postText = post.record.text;
  const postDate = new Date(post.indexedAt).toLocaleString();
  const authorUrl = `https://bsky.app/profile/${authorHandle}`;
  const postUrl = `https://bsky.app/profile/${authorHandle}/post/${post.uri.split('/').pop()}`;
  
  // Generate the HTML for embedding
  return `
  <div class="bluesky-embed" style="border: 1px solid ${isDark ? '#38444d' : '#e1e8ed'}; border-radius: 12px; max-width: ${width}; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: ${isDark ? '#15202b' : '#ffffff'}; color: ${isDark ? '#ffffff' : '#000000'};">
    <div style="padding: 16px;">
      <div style="display: flex; align-items: center; margin-bottom: 12px;">
        <a href="${authorUrl}" target="_blank" style="text-decoration: none; margin-right: 10px;">
          <img src="${authorAvatar}" alt="${authorName}" style="width: 48px; height: 48px; border-radius: 50%;">
        </a>
        <div>
          <a href="${authorUrl}" target="_blank" style="text-decoration: none;">
            <div style="font-weight: bold; color: ${isDark ? '#ffffff' : '#000000'};">${authorName}</div>
            <div style="color: ${isDark ? '#8899a6' : '#657786'};">@${authorHandle}</div>
          </a>
        </div>
      </div>
      <div style="margin-bottom: 12px; white-space: pre-wrap;">${formatPostText(postText)}</div>
      <div style="color: ${isDark ? '#8899a6' : '#657786'}; font-size: 14px; margin-bottom: 12px;">${postDate}</div>
      ${generateMediaHTML(post, theme)}
      <a href="${postUrl}" target="_blank" style="text-decoration: none; color: ${isDark ? '#1d9bf0' : '#1da1f2'}; display: block; text-align: right; font-size: 14px;">View on Bluesky</a>
    </div>
  </div>
  `;
};

// Create an oEmbed response for a post
const createOEmbedResponse = (post, options = {}) => {
  const { maxwidth = 550, format = 'json' } = options;
  
  const authorName = post.author.displayName || post.author.handle;
  const authorHandle = post.author.handle;
  const postUrl = `https://bsky.app/profile/${authorHandle}/post/${post.uri.split('/').pop()}`;
  
  // Generate embeddable HTML
  const html = generateEmbedHTML(post, { width: maxwidth + 'px', theme: options.theme });
  
  // Create oEmbed response
  return {
    version: '1.0',
    type: 'rich',
    provider_name: 'Bluesky',
    provider_url: 'https://bsky.app',
    author_name: authorName,
    author_url: `https://bsky.app/profile/${authorHandle}`,
    title: `Post by ${authorName} (@${authorHandle})`,
    html: html,
    width: maxwidth,
    height: null // Dynamic height based on content
  };
};

// Routes

// oEmbed endpoint
app.get('/oembed', parsePostIdentifier, cacheMiddleware(CONFIG.CACHE_DURATION), async (req, res) => {
  try {
    const { maxwidth = 550, maxheight, format = 'json', theme = 'light' } = req.query;
    
    if (format !== 'json') {
      return res.status(400).json({ error: 'Only JSON format is supported' });
    }
    
    const post = await fetchPost(req.postIdentifier);
    const oembedResponse = createOEmbedResponse(post, { 
      maxwidth: parseInt(maxwidth),
      theme
    });
    
    res.json(oembedResponse);
  } catch (error) {
    console.error('oEmbed error:', error);
    res.status(500).json({ error: error.message });
  }
});

// HTML embed endpoint
app.get('/embed', parsePostIdentifier, async (req, res) => {
  try {
    const { theme = 'light', width = '550px' } = req.query;
    const post = await fetchPost(req.postIdentifier);
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Bluesky Post Embed</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          margin: 0;
          padding: 0;
          background-color: ${theme === 'dark' ? '#192734' : '#f7f9fa'};
        }
        .container {
          max-width: ${width};
          margin: 20px auto;
        }
      </style>
    </head>
    <body>
      <div class="container">
        ${generateEmbedHTML(post, { theme, width })}
      </div>
    </body>
    </html>
    `;
    
    res.send(html);
  } catch (error) {
    console.error('Embed error:', error);
    res.status(500).send(`<html><body><div style="color: red; padding: 20px;">Error: ${error.message}</div></body></html>`);
  }
});

// JavaScript widget endpoint
app.get('/widget.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  
  const script = `
  class BlueskyPostEmbed extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      
      // Default properties
      this._postUrl = '';
      this._theme = 'light';
      this._width = '100%';
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
        const response = await fetch(\`${req.protocol}://${req.get('host')}/oembed?url=\${encodeURIComponent(this._postUrl)}&theme=\${this._theme}\`);
        
        if (!response.ok) {
          throw new Error(\`Failed to fetch post: \${response.statusText}\`);
        }
        
        const data = await response.json();
        this._postData = data;
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
        content = this._postData.html;
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
  
  // Helper function to embed posts
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
  
  // Auto-embed all Bluesky links
  window.autoEmbedBlueskyPosts = (selector = 'a[href^="https://bsky.app/profile/"][href*="/post/"]') => {
    const links = document.querySelectorAll(selector);
    
    links.forEach((link, index) => {
      if (link.dataset.processed === 'true') return;
      link.dataset.processed = 'true';
      
      const container = document.createElement('div');
      container.className = 'bluesky-post-container';
      container.style.margin = '10px 0';
      
      const embed = document.createElement('bluesky-post');
      embed.setAttribute('post-url', link.href);
      
      link.parentNode.insertBefore(container, link.nextSibling);
      container.appendChild(embed);
    });
  };
  `;
  
  res.send(script);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', authenticated });
});

// Documentation and example page
app.get('/', (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html>
  <head>
    <title>Bluesky Post Embedding Service</title>
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
      h1 {
        border-bottom: 1px solid #eee;
        padding-bottom: 10px;
      }
      code {
        background-color: #f4f4f4;
        padding: 2px 5px;
        border-radius: 3px;
      }
      pre {
        background-color: #f4f4f4;
        padding: 10px;
        border-radius: 5px;
        overflow-x: auto;
      }
      .container {
        margin: 20px 0;
      }
      .example {
        margin: 30px 0;
      }
    </style>
  </head>
  <body>
    <h1>Bluesky Post Embedding Service</h1>
    <p>This service allows you to embed Bluesky posts on your website.</p>
    
    <div class="example">
      <h2>oEmbed API</h2>
      <p>Use the oEmbed API to get HTML for embedding a post:</p>
      <pre>/oembed?url=https://bsky.app/profile/username.bsky.social/post/postid&maxwidth=550&theme=light</pre>
      
      <h3>Parameters:</h3>
      <ul>
        <li><code>url</code>: The URL of the Bluesky post (required)</li>
        <li><code>maxwidth</code>: Maximum width in pixels (optional, default: 550)</li>
        <li><code>theme</code>: Either "light" or "dark" (optional, default: light)</li>
        <li><code>format</code>: Only "json" is supported (optional)</li>
      </ul>
    </div>
    
    <div class="example">
      <h2>Direct Embed</h2>
      <p>Use the embed endpoint to get a standalone HTML page with the embedded post:</p>
      <pre>/embed?url=https://bsky.app/profile/username.bsky.social/post/postid&theme=light</pre>
    </div>
    
    <div class="example">
      <h2>JavaScript Widget</h2>
      <p>Add the widget script to your webpage:</p>
      <pre>&lt;script src="${req.protocol}://${req.get('host')}/widget.js"&gt;&lt;/script&gt;</pre>
      
      <p>Then use the custom element:</p>
      <pre>&lt;bluesky-post post-url="https://bsky.app/profile/username.bsky.social/post/postid" theme="light" width="100%"&gt;&lt;/bluesky-post&gt;</pre>
      
      <p>Or use the helper function:</p>
      <pre>embedBlueskyPost('https://bsky.app/profile/username.bsky.social/post/postid', '#container', { theme: 'light', width: '100%' });</pre>
      
      <p>Or automatically embed all Bluesky links:</p>
      <pre>autoEmbedBlueskyPosts();</pre>
    </div>
    
    <div class="example">
      <h2>Try it out</h2>
      <p>Enter a Bluesky post URL:</p>
      <input type="text" id="postUrl" style="width: 100%; padding: 8px; margin-bottom: 10px;" placeholder="https://bsky.app/profile/username.bsky.social/post/postid">
      <button id="embedButton" style="padding: 8px 16px;">Embed Post</button>
      
      <div id="container" class="container"></div>
    </div>
    
    <script src="/widget.js"></script>
    <script>
      document.getElementById('embedButton').addEventListener('click', function() {
        const postUrl = document.getElementById('postUrl').value.trim();
        if (!postUrl) return;
        
        const container = document.getElementById('container');
        container.innerHTML = '';
        
        embedBlueskyPost(postUrl, '#container');
      });
    </script>
  </body>
  </html>
  `);
});

// Start the server
app.listen(port, () => {
  console.log(`Bluesky embed server running at http://localhost:${port}`);
});

module.exports = app;
