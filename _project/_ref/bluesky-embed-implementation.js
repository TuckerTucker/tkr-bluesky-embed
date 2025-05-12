// Custom AT Protocol Implementation for Bluesky Post Embedding
// This implementation lets you fetch and embed Bluesky posts on your website

// Step 1: Install required packages
// npm install @atproto/api node-fetch

// Import required modules
const { BskyAgent } = require('@atproto/api');
const fetch = require('node-fetch');

class BlueskyEmbedder {
  constructor(options = {}) {
    this.service = options.service || 'https://bsky.social';
    this.agent = new BskyAgent({ service: this.service });
    this.username = options.username;
    this.password = options.password; // Use an App Password from Bluesky settings
    this.authenticated = false;
  }

  // Authenticate with Bluesky if needed
  async authenticate() {
    if (!this.authenticated && this.username && this.password) {
      try {
        await this.agent.login({
          identifier: this.username,
          password: this.password
        });
        this.authenticated = true;
        return true;
      } catch (error) {
        console.error('Authentication failed:', error);
        return false;
      }
    }
    return this.authenticated;
  }

  // Fetch a post by URI (at://did:plc:xxxx/app.bsky.feed.post/xxxx)
  // or by URL (https://bsky.app/profile/username.com/post/xxxx)
  async fetchPost(postIdentifier) {
    let postUri;
    
    // Handle URL format
    if (postIdentifier.startsWith('https://bsky.app/profile/')) {
      // Extract username and post ID from URL
      const urlParts = postIdentifier.split('/');
      const username = urlParts[urlParts.length - 3];
      const postId = urlParts[urlParts.length - 1];
      
      // Get the DID for the username
      const didResponse = await this.agent.resolveHandle({ handle: username });
      const did = didResponse.data.did;
      
      // Construct the post URI
      postUri = `at://${did}/app.bsky.feed.post/${postId}`;
    } else if (postIdentifier.startsWith('at://')) {
      // Already in URI format
      postUri = postIdentifier;
    } else {
      throw new Error('Invalid post identifier format. Must be a Bluesky URL or AT Protocol URI.');
    }

    // If authentication is required but failed, throw an error
    if (this.username && this.password && !await this.authenticate()) {
      throw new Error('Authentication required but failed');
    }

    // Fetch the post using the AT Protocol
    try {
      const response = await this.agent.getPosts({ uris: [postUri] });
      
      if (response.data.posts.length === 0) {
        throw new Error('Post not found');
      }
      
      return response.data.posts[0];
    } catch (error) {
      console.error('Error fetching post:', error);
      throw error;
    }
  }

  // Generate embeddable HTML for a post
  async generateEmbed(postIdentifier, options = {}) {
    const post = await this.fetchPost(postIdentifier);
    const { width = '100%', height = 'auto', theme = 'light' } = options;
    
    // Extract essential information from the post
    const authorName = post.author.displayName || post.author.handle;
    const authorHandle = post.author.handle;
    const authorAvatar = post.author.avatar;
    const postText = post.record.text;
    const postDate = new Date(post.indexedAt).toLocaleString();
    const authorUrl = `https://bsky.app/profile/${authorHandle}`;
    const postUrl = `https://bsky.app/profile/${authorHandle}/post/${post.uri.split('/').pop()}`;
    
    // Generate the HTML for embedding
    const html = `
    <div class="bluesky-embed" style="border: 1px solid #e1e8ed; border-radius: 12px; max-width: ${width}; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: ${theme === 'dark' ? '#15202b' : '#ffffff'}; color: ${theme === 'dark' ? '#ffffff' : '#000000'};">
      <div style="padding: 16px;">
        <div style="display: flex; align-items: center; margin-bottom: 12px;">
          <img src="${authorAvatar}" alt="${authorName}" style="width: 48px; height: 48px; border-radius: 50%; margin-right: 10px;">
          <div>
            <div style="font-weight: bold; color: ${theme === 'dark' ? '#ffffff' : '#000000'};">${authorName}</div>
            <div style="color: ${theme === 'dark' ? '#8899a6' : '#657786'};">@${authorHandle}</div>
          </div>
        </div>
        <div style="margin-bottom: 12px; white-space: pre-wrap;">${this._formatPostText(postText)}</div>
        <div style="color: ${theme === 'dark' ? '#8899a6' : '#657786'}; font-size: 14px; margin-bottom: 12px;">${postDate}</div>
        ${this._generateMediaHTML(post, theme)}
        <a href="${postUrl}" target="_blank" style="text-decoration: none; color: ${theme === 'dark' ? '#1d9bf0' : '#1da1f2'}; display: block; text-align: right; font-size: 14px;">View on Bluesky</a>
      </div>
    </div>
    `;
    
    return html;
  }

  // Helper method to format post text with links
  _formatPostText(text) {
    // Simple URL detection and conversion to links
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const htmlText = text.replace(urlRegex, '<a href="$1" target="_blank" style="color: #1da1f2; text-decoration: none;">$1</a>');
    
    // Format mentions
    const mentionRegex = /@([a-zA-Z0-9_.-]+)/g;
    return htmlText.replace(mentionRegex, '<a href="https://bsky.app/profile/$1" target="_blank" style="color: #1da1f2; text-decoration: none;">@$1</a>');
  }

  // Helper method to generate HTML for media attachments
  _generateMediaHTML(post, theme) {
    let mediaHTML = '';
    
    // Handle embedded images if present
    if (post.embed && post.embed.images) {
      mediaHTML += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; margin-bottom: 12px;">';
      
      post.embed.images.forEach(image => {
        mediaHTML += `
          <div>
            <img src="${image.fullsize}" alt="${image.alt || ''}" style="width: 100%; border-radius: 8px; margin-bottom: 4px;">
            ${image.alt ? `<div style="color: ${theme === 'dark' ? '#8899a6' : '#657786'}; font-size: 12px;">${image.alt}</div>` : ''}
          </div>
        `;
      });
      
      mediaHTML += '</div>';
    }
    
    // Handle embedded links/cards if present
    if (post.embed && post.embed.external) {
      const { uri, title, description, thumb } = post.embed.external;
      
      mediaHTML += `
        <div style="border: 1px solid ${theme === 'dark' ? '#38444d' : '#e1e8ed'}; border-radius: 8px; margin-bottom: 12px; overflow: hidden;">
          ${thumb ? `<img src="${thumb}" alt="${title}" style="width: 100%; max-height: 250px; object-fit: cover;">` : ''}
          <div style="padding: 12px;">
            <div style="font-weight: bold; margin-bottom: 4px;">${title}</div>
            ${description ? `<div style="color: ${theme === 'dark' ? '#8899a6' : '#657786'}; margin-bottom: 8px; font-size: 14px;">${description}</div>` : ''}
            <a href="${uri}" target="_blank" style="color: ${theme === 'dark' ? '#8899a6' : '#657786'}; font-size: 14px; text-decoration: none; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${uri}</a>
          </div>
        </div>
      `;
    }
    
    return mediaHTML;
  }

  // Create an oEmbed compatible response for a post
  async getOEmbedResponse(postIdentifier, options = {}) {
    const post = await this.fetchPost(postIdentifier);
    const { maxwidth = 550, format = 'json' } = options;
    
    const authorName = post.author.displayName || post.author.handle;
    const authorHandle = post.author.handle;
    const postUrl = `https://bsky.app/profile/${authorHandle}/post/${post.uri.split('/').pop()}`;
    
    // Generate embeddable HTML
    const html = await this.generateEmbed(postIdentifier, { width: maxwidth + 'px' });
    
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
  }

  // Create a JavaScript widget that can be embedded in a webpage
  createEmbedWidget(postIdentifier, targetElementId, options = {}) {
    return `
    <div id="${targetElementId}">Loading Bluesky post...</div>
    <script>
      (async function() {
        try {
          const response = await fetch('/api/bluesky-embed?url=${encodeURIComponent(postIdentifier)}&theme=${options.theme || 'light'}');
          const data = await response.json();
          document.getElementById('${targetElementId}').innerHTML = data.html;
        } catch (error) {
          console.error('Error loading Bluesky post:', error);
          document.getElementById('${targetElementId}').innerHTML = 'Error loading Bluesky post.';
        }
      })();
    </script>
    `;
  }
}

// Example usage in a Node.js server (Express)
/*
const express = require('express');
const app = express();
const port = 3000;

const embedder = new BlueskyEmbedder({
  username: 'your-handle.bsky.social', // Optional, only needed for private posts
  password: 'your-app-password'        // Optional, only needed for private posts
});

app.get('/api/bluesky-embed', async (req, res) => {
  try {
    const postUrl = req.query.url;
    const theme = req.query.theme || 'light';
    
    const embedResponse = await embedder.getOEmbedResponse(postUrl, { 
      maxwidth: parseInt(req.query.maxwidth) || 550,
      theme: theme
    });
    
    res.json(embedResponse);
  } catch (error) {
    console.error('Error generating embed:', error);
    res.status(500).json({ error: 'Failed to generate embed' });
  }
});

app.get('/embed', (req, res) => {
  const postUrl = req.query.url;
  const theme = req.query.theme || 'light';
  
  if (!postUrl) {
    return res.status(400).send('Missing post URL');
  }
  
  // Render a page with the embedded post
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Bluesky Post Embed</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1>Bluesky Post Embed</h1>
      <div id="bluesky-post"></div>
      ${embedder.createEmbedWidget(postUrl, 'bluesky-post', { theme })}
    </body>
    </html>
  `);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
*/

module.exports = BlueskyEmbedder;
