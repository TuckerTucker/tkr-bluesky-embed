const config = require('../../config/default');

class PostRenderer {
  constructor() {
    this.defaultTheme = config.styling.defaultTheme;
    this.defaultWidth = config.styling.defaultWidth;
  }

  // Format post text with links and mentions
  formatPostText(text) {
    // Convert URLs to links
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    let htmlText = text.replace(urlRegex, (url) => {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="bsky-link">
        ${url}
      </a>`;
    });
    
    // Format mentions
    const mentionRegex = /@([a-zA-Z0-9_.-]+)/g;
    htmlText = htmlText.replace(mentionRegex, (match, handle) => {
      return `<a href="https://bsky.app/profile/${handle}" target="_blank" rel="noopener noreferrer" class="bsky-mention">
        @${handle}
      </a>`;
    });
    
    return htmlText;
  }

  // Generate HTML for post media - Updated for new API format
  generateMediaHTML(post, theme) {
    let mediaHTML = '';
    const isDark = theme === 'dark';

    // Check for embedded content based on new API format
    try {
      // Handle images in the new format
      if (post.embed && post.embed.$type === 'app.bsky.embed.images') {
        mediaHTML += '<div class="bsky-images">';

        post.embed.images.forEach(image => {
          mediaHTML += `
            <div class="bsky-image-container">
              <img
                src="${image.fullsize || image.thumb}"
                alt="${image.alt || ''}"
                class="bsky-image"
              >
              ${image.alt ? `<div class="bsky-image-alt">${image.alt}</div>` : ''}
            </div>
          `;
        });

        mediaHTML += '</div>';
      }

      // Handle external links/cards in the new format
      if (post.embed && post.embed.$type === 'app.bsky.embed.external') {
        const external = post.embed.external;

        mediaHTML += `
          <div class="bsky-card">
            ${external.thumb ? `<img src="${external.thumb}" alt="${external.title || ''}" class="bsky-card-image">` : ''}
            <div class="bsky-card-content">
              <div class="bsky-card-title">${external.title || ''}</div>
              ${external.description ? `<div class="bsky-card-description">${external.description}</div>` : ''}
              <a href="${external.uri}" target="_blank" rel="noopener noreferrer" class="bsky-card-link">${external.uri}</a>
            </div>
          </div>
        `;
      }

      // Handle quoted posts in the new format
      if (post.embed && post.embed.$type === 'app.bsky.embed.record') {
        const record = post.embed.record;

        // Safety check for record format
        if (record && record.author) {
          const quoteAuthor = record.author;
          const quoteText = record.value?.text || record.record?.text || '';

          mediaHTML += `
            <div class="bsky-quote">
              <div class="bsky-quote-author">
                ${quoteAuthor.avatar ?
                  `<img src="${quoteAuthor.avatar}" alt="${quoteAuthor.displayName || quoteAuthor.handle}" class="bsky-quote-avatar">` :
                  ''
                }
                <div class="bsky-quote-author-info">
                  <span class="bsky-quote-author-name">${quoteAuthor.displayName || ''}</span>
                  <span class="bsky-quote-author-handle">@${quoteAuthor.handle}</span>
                </div>
              </div>
              <div class="bsky-quote-content">${this.formatPostText(quoteText)}</div>
            </div>
          `;
        }
      }

      // Handle the newer record with media format
      if (post.embed && post.embed.$type === 'app.bsky.embed.recordWithMedia') {
        // First render the record part
        if (post.embed.record && post.embed.record.record) {
          const record = post.embed.record.record;
          const quoteAuthor = record.author;
          const quoteText = record.value?.text || record.text || '';

          mediaHTML += `
            <div class="bsky-quote">
              <div class="bsky-quote-author">
                ${quoteAuthor?.avatar ?
                  `<img src="${quoteAuthor.avatar}" alt="${quoteAuthor.displayName || quoteAuthor.handle}" class="bsky-quote-avatar">` :
                  ''
                }
                <div class="bsky-quote-author-info">
                  <span class="bsky-quote-author-name">${quoteAuthor?.displayName || ''}</span>
                  <span class="bsky-quote-author-handle">@${quoteAuthor?.handle || ''}</span>
                </div>
              </div>
              <div class="bsky-quote-content">${this.formatPostText(quoteText)}</div>
            </div>
          `;
        }

        // Then render the media part
        if (post.embed.media.$type === 'app.bsky.embed.images') {
          mediaHTML += '<div class="bsky-images">';

          post.embed.media.images.forEach(image => {
            mediaHTML += `
              <div class="bsky-image-container">
                <img
                  src="${image.fullsize || image.thumb}"
                  alt="${image.alt || ''}"
                  class="bsky-image"
                >
                ${image.alt ? `<div class="bsky-image-alt">${image.alt}</div>` : ''}
              </div>
            `;
          });

          mediaHTML += '</div>';
        } else if (post.embed.media.$type === 'app.bsky.embed.external') {
          const external = post.embed.media.external;

          mediaHTML += `
            <div class="bsky-card">
              ${external.thumb ? `<img src="${external.thumb}" alt="${external.title || ''}" class="bsky-card-image">` : ''}
              <div class="bsky-card-content">
                <div class="bsky-card-title">${external.title || ''}</div>
                ${external.description ? `<div class="bsky-card-description">${external.description}</div>` : ''}
                <a href="${external.uri}" target="_blank" rel="noopener noreferrer" class="bsky-card-link">${external.uri}</a>
              </div>
            </div>
          `;
        }
      }
    } catch (error) {
      console.error('Error generating media HTML:', error);
      // Return empty string in case of error
    }
    
    return mediaHTML;
  }

  // Generate CSS for the embed
  generateCSS(theme) {
    const isDark = theme === 'dark';
    const backgroundColor = isDark ? '#15202b' : '#ffffff';
    const textColor = isDark ? '#ffffff' : '#000000';
    const secondaryTextColor = isDark ? '#8899a6' : '#657786';
    const borderColor = isDark ? '#38444d' : '#e1e8ed';
    const linkColor = isDark ? '#1d9bf0' : '#1da1f2';
    
    return `
      .bsky-embed {
        border: 1px solid ${borderColor};
        border-radius: 12px;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        background-color: ${backgroundColor};
        color: ${textColor};
      }
      
      .bsky-content {
        padding: 16px;
      }
      
      .bsky-author {
        display: flex;
        align-items: center;
        margin-bottom: 12px;
      }
      
      .bsky-avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        margin-right: 10px;
      }
      
      .bsky-author-info {
        display: flex;
        flex-direction: column;
      }
      
      .bsky-author-name {
        font-weight: bold;
        color: ${textColor};
      }
      
      .bsky-author-handle {
        color: ${secondaryTextColor};
      }
      
      .bsky-post-text {
        margin-bottom: 12px;
        white-space: pre-wrap;
        word-break: break-word;
      }
      
      .bsky-post-date {
        color: ${secondaryTextColor};
        font-size: 14px;
        margin-bottom: 12px;
      }
      
      .bsky-link, .bsky-mention {
        color: ${linkColor};
        text-decoration: none;
      }
      
      .bsky-link:hover, .bsky-mention:hover {
        text-decoration: underline;
      }
      
      .bsky-images {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 8px;
        margin-bottom: 12px;
      }
      
      .bsky-image {
        width: 100%;
        border-radius: 8px;
        margin-bottom: 4px;
      }
      
      .bsky-image-alt {
        color: ${secondaryTextColor};
        font-size: 12px;
      }
      
      .bsky-card {
        border: 1px solid ${borderColor};
        border-radius: 8px;
        margin-bottom: 12px;
        overflow: hidden;
      }
      
      .bsky-card-image {
        width: 100%;
        max-height: 250px;
        object-fit: cover;
      }
      
      .bsky-card-content {
        padding: 12px;
      }
      
      .bsky-card-title {
        font-weight: bold;
        margin-bottom: 4px;
      }
      
      .bsky-card-description {
        color: ${secondaryTextColor};
        margin-bottom: 8px;
        font-size: 14px;
      }
      
      .bsky-card-link {
        color: ${secondaryTextColor};
        font-size: 14px;
        text-decoration: none;
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      .bsky-quote {
        border: 1px solid ${borderColor};
        border-radius: 8px;
        margin-bottom: 12px;
        padding: 12px;
      }
      
      .bsky-quote-author {
        display: flex;
        align-items: center;
        margin-bottom: 8px;
      }
      
      .bsky-quote-avatar {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        margin-right: 8px;
      }
      
      .bsky-quote-author-name {
        font-weight: bold;
      }
      
      .bsky-quote-author-handle {
        color: ${secondaryTextColor};
        margin-left: 4px;
      }
      
      .bsky-quote-content {
        white-space: pre-wrap;
      }
      
      .bsky-footer {
        text-align: right;
      }
      
      .bsky-footer-link {
        color: ${linkColor};
        text-decoration: none;
        font-size: 14px;
      }
    `;
  }

  // Generate HTML for embedding a post - Updated for the new API
  renderPost(post, options = {}) {
    const { width = this.defaultWidth, theme = this.defaultTheme } = options;

    try {
      // Extract post information - adapted for new API structure
      const authorName = post.author.displayName || post.author.handle;
      const authorHandle = post.author.handle;
      const authorAvatar = post.author.avatar || '';  // Add fallback for missing avatar

      // Handle post text - can be in different locations in the API
      let postText = '';
      if (post.record && post.record.text) {
        postText = post.record.text;
      } else if (post.text) {
        postText = post.text;
      } else if (post.value && post.value.text) {
        postText = post.value.text;
      }

      // Handle dates
      let postDate;
      try {
        postDate = new Date(post.indexedAt || post.createdAt || Date.now()).toLocaleString();
      } catch (e) {
        postDate = 'Unknown date';
      }

      // URLs for the post and author
      const authorUrl = `https://bsky.app/profile/${authorHandle}`;

      // For post URL, safely extract the ID
      let postId;
      if (post.uri) {
        const uriParts = post.uri.split('/');
        postId = uriParts[uriParts.length - 1];
      } else if (post.cid) {
        postId = post.cid;
      } else {
        postId = '';
      }

      const postUrl = `https://bsky.app/profile/${authorHandle}/post/${postId}`;

      // Render CSS and HTML
      const css = this.generateCSS(theme);
      const formattedText = this.formatPostText(postText);
      const mediaHTML = this.generateMediaHTML(post, theme);

      return `
        <div class="bsky-embed-container" style="max-width: ${width};">
          <style>${css}</style>
          <div class="bsky-embed">
            <div class="bsky-content">
              <div class="bsky-author">
                <a href="${authorUrl}" target="_blank" rel="noopener noreferrer">
                  <img src="${authorAvatar}" alt="${authorName}" class="bsky-avatar">
                </a>
                <div class="bsky-author-info">
                  <a href="${authorUrl}" target="_blank" rel="noopener noreferrer" class="bsky-author-link">
                    <span class="bsky-author-name">${authorName}</span>
                    <span class="bsky-author-handle">@${authorHandle}</span>
                  </a>
                </div>
              </div>
              <div class="bsky-post-text">${formattedText}</div>
              <div class="bsky-post-date">${postDate}</div>
              ${mediaHTML}
              <div class="bsky-footer">
                <a href="${postUrl}" target="_blank" rel="noopener noreferrer" class="bsky-footer-link">
                  View on Bluesky
                </a>
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (error) {
      console.error('Error rendering post:', error, post);

      // Provide a fallback rendering for posts that can't be properly parsed
      return `
        <div class="bsky-embed-container" style="max-width: ${width};">
          <style>${this.generateCSS(theme)}</style>
          <div class="bsky-embed">
            <div class="bsky-content">
              <div style="padding: 20px; text-align: center;">
                <p>This Bluesky post couldn't be displayed properly.</p>
                ${post.uri ? `<a href="https://bsky.app/profile/handle/post/${post.uri.split('/').pop()}"
                  target="_blank" rel="noopener noreferrer" class="bsky-footer-link">
                  View on Bluesky
                </a>` : ''}
              </div>
            </div>
          </div>
        </div>
      `;
    }
  }

  // Generate standalone HTML page for embedding
  renderStandalonePage(post, options = {}) {
    const { width = this.defaultWidth, theme = this.defaultTheme } = options;

    try {
      const postHTML = this.renderPost(post, options);

      // Get the author handle with a fallback
      let authorHandle = 'bluesky-user';
      if (post.author && post.author.handle) {
        authorHandle = post.author.handle;
      }

      return `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Bluesky Post by @${authorHandle}</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              margin: 0;
              padding: 20px;
              background-color: ${theme === 'dark' ? '#192734' : '#f7f9fa'};
              display: flex;
              justify-content: center;
            }
          </style>
        </head>
        <body>
          ${postHTML}
        </body>
        </html>
      `;
    } catch (error) {
      console.error('Error rendering standalone page:', error);

      // Provide a fallback rendering for posts that can't be properly parsed
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Bluesky Post</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              margin: 0;
              padding: 20px;
              background-color: ${theme === 'dark' ? '#192734' : '#f7f9fa'};
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
            }
            .error-container {
              max-width: 500px;
              padding: 30px;
              background-color: ${theme === 'dark' ? '#15202b' : '#ffffff'};
              border-radius: 12px;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
              text-align: center;
            }
            .error-title {
              color: #e0245e;
              margin-bottom: 20px;
            }
            .back-link {
              display: inline-block;
              color: white;
              background-color: ${theme === 'dark' ? '#1d9bf0' : '#1da1f2'};
              text-decoration: none;
              padding: 10px 20px;
              border-radius: 30px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h2 class="error-title">Could not display this Bluesky post</h2>
            <p>The post could not be rendered properly. It may have been deleted or you may not have permission to view it.</p>
            <a href="/" class="back-link">Back to Home</a>
          </div>
        </body>
        </html>
      `;
    }
  }
}

module.exports = new PostRenderer();