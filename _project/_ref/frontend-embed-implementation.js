// Front-End Implementation for Bluesky Post Embedding
// This implementation creates a custom Web Component for embedding Bluesky posts

class BlueskyPostEmbed extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    
    // Default properties
    this._postUrl = '';
    this._theme = 'light';
    this._width = '100%';
    this._height = 'auto';
    this._loading = true;
    this._error = null;
    this._postData = null;
  }
  
  static get observedAttributes() {
    return ['post-url', 'theme', 'width', 'height'];
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
      case 'height':
        this._height = newValue;
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
    
    if (this.hasAttribute('height')) {
      this._height = this.getAttribute('height');
    }
    
    this._render();
  }
  
  async _fetchPost() {
    if (!this._postUrl) return;
    
    this._loading = true;
    this._error = null;
    this._render();
    
    try {
      // Use the oEmbed endpoint from Bluesky
      const response = await fetch(`https://embed.bsky.app/oembed?url=${encodeURIComponent(this._postUrl)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch post: ${response.statusText}`);
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
    const isDarkTheme = this._theme === 'dark';
    const backgroundColor = isDarkTheme ? '#15202b' : '#ffffff';
    const textColor = isDarkTheme ? '#ffffff' : '#000000';
    const secondaryTextColor = isDarkTheme ? '#8899a6' : '#657786';
    const borderColor = isDarkTheme ? '#38444d' : '#e1e8ed';
    const linkColor = isDarkTheme ? '#1d9bf0' : '#1da1f2';
    
    // Basic styles for the component
    const style = `
      :host {
        display: block;
        width: ${this._width};
        height: ${this._height};
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      }
      
      .container {
        border: 1px solid ${borderColor};
        border-radius: 12px;
        overflow: hidden;
        background-color: ${backgroundColor};
        color: ${textColor};
      }
      
      .loading {
        padding: 20px;
        text-align: center;
        color: ${secondaryTextColor};
      }
      
      .error {
        padding: 20px;
        text-align: center;
        color: #e0245e;
      }
      
      a {
        color: ${linkColor};
        text-decoration: none;
      }
      
      a:hover {
        text-decoration: underline;
      }
      
      .post-content {
        white-space: pre-wrap;
        word-wrap: break-word;
      }
      
      .media img {
        max-width: 100%;
        border-radius: 8px;
      }
      
      .card {
        border: 1px solid ${borderColor};
        border-radius: 8px;
        margin-top: 10px;
      }
      
      .card-image img {
        width: 100%;
        border-radius: 8px 8px 0 0;
      }
      
      .card-content {
        padding: 10px;
      }
      
      .secondary-text {
        color: ${secondaryTextColor};
        font-size: 14px;
      }
      
      .footer {
        margin-top: 10px;
        text-align: right;
      }
    `;
    
    let content = '';
    
    if (this._loading) {
      content = `<div class="loading">Loading Bluesky post...</div>`;
    } else if (this._error) {
      content = `<div class="error">Error: ${this._error}</div>`;
    } else if (this._postData) {
      // Use the HTML provided by the oEmbed response
      content = `
        <div class="content">
          ${this._postData.html}
        </div>
      `;
    } else {
      content = `<div class="error">No post URL provided</div>`;
    }
    
    this.shadowRoot.innerHTML = `
      <style>${style}</style>
      <div class="container">
        ${content}
      </div>
    `;
  }
}

// Register the custom element
customElements.define('bluesky-post', BlueskyPostEmbed);

// Example of a helper script to automatically convert Bluesky links to embedded posts
const autoEmbedBlueskyPosts = () => {
  // Find all links to Bluesky posts
  const links = document.querySelectorAll('a[href^="https://bsky.app/profile/"][href*="/post/"]');
  
  links.forEach((link, index) => {
    // Check if the link has already been processed
    if (link.dataset.processed === 'true') return;
    
    // Mark as processed
    link.dataset.processed = 'true';
    
    // Create a container for the embed
    const container = document.createElement('div');
    container.className = 'bluesky-post-container';
    
    // Create the custom element
    const embed = document.createElement('bluesky-post');
    embed.setAttribute('post-url', link.href);
    embed.setAttribute('theme', 'light'); // Default theme
    embed.setAttribute('width', '100%');
    
    // Add an ID to the embed
    const embedId = `bluesky-embed-${index}`;
    embed.id = embedId;
    
    // Insert the embed after the link
    link.parentNode.insertBefore(container, link.nextSibling);
    container.appendChild(embed);
    
    // Optional: Add a "hide embed" button
    const toggleButton = document.createElement('button');
    toggleButton.innerText = 'Hide embed';
    toggleButton.className = 'bluesky-toggle-button';
    toggleButton.addEventListener('click', () => {
      const embedElement = document.getElementById(embedId);
      if (embedElement.style.display === 'none') {
        embedElement.style.display = 'block';
        toggleButton.innerText = 'Hide embed';
      } else {
        embedElement.style.display = 'none';
        toggleButton.innerText = 'Show embed';
      }
    });
    
    container.appendChild(toggleButton);
  });
};

// Simple function to embed a single post by URL
const embedBlueskyPost = (postUrl, targetElement, options = {}) => {
  const { theme = 'light', width = '100%', height = 'auto' } = options;
  
  // Create the custom element
  const embed = document.createElement('bluesky-post');
  embed.setAttribute('post-url', postUrl);
  embed.setAttribute('theme', theme);
  embed.setAttribute('width', width);
  embed.setAttribute('height', height);
  
  // Add to target element
  const target = typeof targetElement === 'string' 
    ? document.querySelector(targetElement) 
    : targetElement;
  
  if (target) {
    target.appendChild(embed);
    return embed;
  } else {
    console.error('Target element not found');
    return null;
  }
};

// WordPress plugin integration example
const initWordPressBlueskyEmbeds = () => {
  // Find all WordPress Bluesky embed blocks
  const embedBlocks = document.querySelectorAll('.wp-block-embed-bluesky');
  
  embedBlocks.forEach((block) => {
    const blockContent = block.querySelector('.wp-block-embed__wrapper');
    if (!blockContent) return;
    
    // Extract URL from the block content
    const url = blockContent.textContent.trim();
    if (!url.startsWith('https://bsky.app/profile/')) return;
    
    // Clear the text content
    blockContent.textContent = '';
    
    // Add the embed
    embedBlueskyPost(url, blockContent, {
      theme: block.dataset.theme || 'light',
      width: block.dataset.width || '100%'
    });
  });
};

// Auto-load when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Uncomment the function you want to use automatically
  // autoEmbedBlueskyPosts();
  // initWordPressBlueskyEmbeds();
});

// Export the functions and components
window.BlueskyEmbed = {
  BlueskyPostEmbed,
  autoEmbedBlueskyPosts,
  embedBlueskyPost,
  initWordPressBlueskyEmbeds
};
