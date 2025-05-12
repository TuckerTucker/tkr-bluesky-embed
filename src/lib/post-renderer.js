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
      // Debug log to check what content is available
      console.log('Processing post for media, embed type:', post.embed?.$type);

      // Log the record structure for debugging
      if (post.record && post.record.embed) {
        console.log('Record embed structure:', {
          type: post.record.embed.$type,
          hasImages: post.record.embed.images ? post.record.embed.images.length : 0
        });

        // Inspect image URLs for debugging
        if (post.record.embed.images && Array.isArray(post.record.embed.images)) {
          post.record.embed.images.forEach((img, i) => {
            console.log(`Image ${i} URLs:`, {
              fullsize: img.fullsize,
              thumb: img.thumb,
              alt: img.alt,
              imageUrl: img.image?.url,
              blob: img.blob,
              ref: img.ref,
              type: typeof img
            });

            // Deep inspection if needed
            console.log(`Image ${i} full object:`, JSON.stringify(img));
          });
        }
      }

      // Inspect the main post object to find image references
      console.log('Post embed type:', post.embed?.$type);
      if (post.embed?.$type === 'app.bsky.embed.images#view') {
        console.log('Images view data:', JSON.stringify(post.embed.images));
      }

      // Look for blob data in the post
      if (post.blobs && Array.isArray(post.blobs)) {
        console.log('Post has blobs:', post.blobs.length);
        post.blobs.forEach((blob, i) => {
          console.log(`Blob ${i}:`, {
            type: blob.$type,
            ref: blob.ref,
            mimeType: blob.mimeType
          });
        });
      }

      // Direct dump of relevant keys for debugging
      console.log('Post keys at top level:', Object.keys(post));
      if (post.record) {
        console.log('Record keys:', Object.keys(post.record));
        if (post.record.embed) {
          console.log('Record embed type:', post.record.embed.$type);
        }
      }

      // Handle images in the newer #view format (API v0.15.6+)
      if (post.embed && post.embed.$type === 'app.bsky.embed.images#view') {
        mediaHTML += '<div class="bsky-images">';

        post.embed.images.forEach(image => {
          // In the #view format, image URLs are in .thumb and .fullsize directly
          let imageUrl = image.fullsize || image.thumb || '';
          console.log('Using #view format image URL:', imageUrl);

          if (imageUrl) {
            // Get aspect ratio if available
            const aspectRatio = image.aspectRatio || null;
            let style = '';

            if (aspectRatio) {
              console.log(`Image has aspect ratio: ${aspectRatio.width}x${aspectRatio.height}`);
              const aspectRatioValue = aspectRatio.width / aspectRatio.height;
              style = `style="max-width: min(100%, ${aspectRatio.width}px);"`;
            }

            mediaHTML += `
              <div class="bsky-image-container">
                <img
                  src="${imageUrl}"
                  alt="${image.alt || ''}"
                  class="bsky-image"
                  loading="lazy"
                  onerror="console.error('Failed to load image:', this.src)"
                  ${style}
                >
                ${image.alt ? `<div class="bsky-image-alt">${image.alt}</div>` : ''}
              </div>
            `;
          }
        });

        mediaHTML += '</div>';
      }

      // Handle images in the older format
      else if (post.embed && post.embed.$type === 'app.bsky.embed.images') {
        mediaHTML += '<div class="bsky-images">';

        post.embed.images.forEach(image => {
          // Ensure we have the right image URL by checking all possible locations
          let imageUrl = '';

          // Latest API puts image URL in image.image.url
          if (image.image && image.image.url) {
            imageUrl = image.image.url;
          } else if (image.fullsize) {
            imageUrl = image.fullsize;
          } else if (image.thumb) {
            imageUrl = image.thumb;
          } else if (typeof image === 'string') {
            // Sometimes the API just returns the URL as a string
            imageUrl = image;
          }

          console.log('Found embed image URL:', imageUrl);

          if (imageUrl) {
            mediaHTML += `
              <div class="bsky-image-container">
                <img
                  src="${imageUrl}"
                  alt="${image.alt || ''}"
                  class="bsky-image"
                  loading="lazy"
                  onerror="console.error('Failed to load image:', this.src)"
                >
                ${image.alt ? `<div class="bsky-image-alt">${image.alt}</div>` : ''}
              </div>
            `;
          }
        });

        mediaHTML += '</div>';
      }

      // Handle external links/cards in the new format
      if (post.embed && post.embed.$type === 'app.bsky.embed.external') {
        const external = post.embed.external;

        mediaHTML += `
          <div class="bsky-card">
            ${external.thumb ? `<img src="${external.thumb}" alt="${external.title || ''}" class="bsky-card-image" loading="lazy">` : ''}
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
                  `<img src="${quoteAuthor.avatar}" alt="${quoteAuthor.displayName || quoteAuthor.handle}" class="bsky-quote-avatar" loading="lazy">` :
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
                  `<img src="${quoteAuthor.avatar}" alt="${quoteAuthor.displayName || quoteAuthor.handle}" class="bsky-quote-avatar" loading="lazy">` :
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
            // Ensure we have the right image URL by checking all possible locations
            let imageUrl = '';

            // Latest API puts image URL in image.image.url
            if (image.image && image.image.url) {
              imageUrl = image.image.url;
            } else if (image.fullsize) {
              imageUrl = image.fullsize;
            } else if (image.thumb) {
              imageUrl = image.thumb;
            } else if (typeof image === 'string') {
              // Sometimes the API just returns the URL as a string
              imageUrl = image;
            }

            console.log('Found media image URL:', imageUrl);

            if (imageUrl) {
              mediaHTML += `
                <div class="bsky-image-container">
                  <img
                    src="${imageUrl}"
                    alt="${image.alt || ''}"
                    class="bsky-image"
                    loading="lazy"
                    onerror="console.error('Failed to load image:', this.src)"
                  >
                  ${image.alt ? `<div class="bsky-image-alt">${image.alt}</div>` : ''}
                </div>
              `;
            }
          });

          mediaHTML += '</div>';
        } else if (post.embed.media.$type === 'app.bsky.embed.external') {
          const external = post.embed.media.external;

          mediaHTML += `
            <div class="bsky-card">
              ${external.thumb ? `<img src="${external.thumb}" alt="${external.title || ''}" class="bsky-card-image" loading="lazy">` : ''}
              <div class="bsky-card-content">
                <div class="bsky-card-title">${external.title || ''}</div>
                ${external.description ? `<div class="bsky-card-description">${external.description}</div>` : ''}
                <a href="${external.uri}" target="_blank" rel="noopener noreferrer" class="bsky-card-link">${external.uri}</a>
              </div>
            </div>
          `;
        }
      }

      // Check for media in nested record structure
      if (post.record && post.record.embed) {
        console.log('Found media in post.record.embed with type:', post.record.embed.$type);

        // Handle images in record.embed for the newest API format
        if (post.record.embed.$type === 'app.bsky.embed.images#main') {
          mediaHTML += '<div class="bsky-images">';

          // In the #main format, need to look for blob references
          if (post.record.embed.images && Array.isArray(post.record.embed.images)) {
            // Find all blobs in the post
            const blobs = {};

            // Extract blob references from the post
            if (post.blobs && Array.isArray(post.blobs)) {
              post.blobs.forEach(blob => {
                if (blob.$type === 'blob' && blob.ref) {
                  blobs[blob.ref] = blob.mimeType ? `data:${blob.mimeType};base64,${blob.data}` : blob.data;
                }
              });
            }

            // Now render each image
            post.record.embed.images.forEach((img, i) => {
              let imageUrl = '';

              // Try to find the image data in blobs if it has a reference
              if (img.image && img.image.ref && blobs[img.image.ref]) {
                imageUrl = blobs[img.image.ref];
              } else if (img.image && img.image.url) {
                imageUrl = img.image.url;
              }

              console.log(`Found blob image URL for image ${i}:`, imageUrl);

              if (imageUrl) {
                mediaHTML += `
                  <div class="bsky-image-container">
                    <img
                      src="${imageUrl}"
                      alt="${img.alt || ''}"
                      class="bsky-image"
                      loading="lazy"
                      onerror="console.error('Failed to load image:', this.src)"
                    >
                    ${img.alt ? `<div class="bsky-image-alt">${img.alt}</div>` : ''}
                  </div>
                `;
              }
            });
          }

          mediaHTML += '</div>';
        }
        // Handle images in the standard record.embed format
        else if (post.record.embed.$type === 'app.bsky.embed.images') {
          mediaHTML += '<div class="bsky-images">';

          post.record.embed.images.forEach(image => {
            // Ensure we have the right image URL by checking all possible locations
            let imageUrl = '';

            // Latest API puts image URL in image.image.url
            if (image.image && image.image.url) {
              imageUrl = image.image.url;
            } else if (image.fullsize) {
              imageUrl = image.fullsize;
            } else if (image.thumb) {
              imageUrl = image.thumb;
            } else if (typeof image === 'string') {
              // Sometimes the API just returns the URL as a string
              imageUrl = image;
            }

            console.log('Found image URL:', imageUrl);

            if (imageUrl) {
              mediaHTML += `
                <div class="bsky-image-container">
                  <img
                    src="${imageUrl}"
                    alt="${image.alt || ''}"
                    class="bsky-image"
                    loading="lazy"
                    onerror="console.error('Failed to load image:', this.src)"
                  >
                  ${image.alt ? `<div class="bsky-image-alt">${image.alt}</div>` : ''}
                </div>
              `;
            }
          });

          mediaHTML += '</div>';
        }

        // Handle other record.embed types as needed
        // ...similar code for other embed types...
      }

      // Also check for images in slightly different API structures
      if (!mediaHTML && post.embed && post.embed.images && Array.isArray(post.embed.images)) {
        mediaHTML += '<div class="bsky-images">';

        post.embed.images.forEach(image => {
          // Ensure we have the right image URL by checking all possible locations
          let imageUrl = '';

          // Latest API puts image URL in image.image.url
          if (image.image && image.image.url) {
            imageUrl = image.image.url;
          } else if (image.fullsize) {
            imageUrl = image.fullsize;
          } else if (image.thumb) {
            imageUrl = image.thumb;
          } else if (image.url) {
            imageUrl = image.url;
          } else if (typeof image === 'string') {
            // Sometimes the API just returns the URL as a string
            imageUrl = image;
          }

          console.log('Found general image URL:', imageUrl);

          if (imageUrl) {
            mediaHTML += `
              <div class="bsky-image-container">
                <img
                  src="${imageUrl}"
                  alt="${image.alt || ''}"
                  class="bsky-image"
                  loading="lazy"
                  onerror="console.error('Failed to load image:', this.src)"
                >
                ${image.alt ? `<div class="bsky-image-alt">${image.alt}</div>` : ''}
              </div>
            `;
          }
        });

        mediaHTML += '</div>';
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
        object-fit: cover;
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

      /* Media display - updated for better image rendering */
      .bsky-images {
        display: grid;
        gap: 8px;
        margin-bottom: 12px;
        width: 100%;
      }

      /* Single image layout */
      .bsky-images:has(.bsky-image-container:only-child) {
        grid-template-columns: 1fr;
      }

      /* 2 images layout */
      .bsky-images:has(.bsky-image-container:first-child:nth-last-child(2)) {
        grid-template-columns: 1fr 1fr;
      }

      /* 3 images layout */
      .bsky-images:has(.bsky-image-container:first-child:nth-last-child(3)) {
        grid-template-columns: repeat(3, 1fr);
      }

      /* 4 images layout */
      .bsky-images:has(.bsky-image-container:first-child:nth-last-child(4)) {
        grid-template-columns: repeat(2, 1fr);
        grid-template-rows: repeat(2, 1fr);
      }

      /* Fallback for browsers that don't support :has() */
      @supports not (selector(:has(*))) {
        .bsky-images {
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        }
      }

      .bsky-image-container {
        border-radius: 8px;
        overflow: hidden;
        position: relative;
        margin-bottom: 8px;
        max-height: 600px;
      }

      .bsky-image {
        width: 100%;
        max-width: 100%;
        height: auto;
        object-fit: contain;
        border-radius: 8px;
        display: block;
      }

      .bsky-image-alt {
        color: ${secondaryTextColor};
        font-size: 12px;
        margin-top: 6px;
        margin-bottom: 12px;
        line-height: 1.4;
        max-height: 80px;
        overflow-y: auto;
        padding-right: 10px;
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
        object-fit: cover;
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
        word-break: break-word;
      }

      .bsky-footer {
        text-align: right;
        margin-top: 12px;
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
      // Debug the post structure to understand what we're working with
      console.log('Rendering post with structure keys:', Object.keys(post).join(', '));

      // Extract post information - adapted for new API structure
      const authorName = post.author?.displayName || post.author?.handle || 'Unknown User';
      const authorHandle = post.author?.handle || 'unknown.user';
      const authorAvatar = post.author?.avatar || '';  // Add fallback for missing avatar

      // Handle post text - can be in different locations in the API
      let postText = '';
      if (post.record && post.record.text) {
        postText = post.record.text;
      } else if (post.text) {
        postText = post.text;
      } else if (post.value && post.value.text) {
        postText = post.value.text;
      } else if (post.record && post.record.value && post.record.value.text) {
        postText = post.record.value.text;
      }

      // Handle dates with multiple fallbacks
      let postDate;
      try {
        const dateString = post.indexedAt || post.createdAt ||
                          post.record?.createdAt || post.record?.indexedAt ||
                          Date.now().toString();
        postDate = new Date(dateString).toLocaleString();
      } catch (e) {
        console.error('Error parsing date:', e);
        postDate = 'Unknown date';
      }

      // URLs for the post and author
      const authorUrl = `https://bsky.app/profile/${authorHandle}`;

      // For post URL, safely extract the ID with multiple fallbacks
      let postId = '';
      if (post.uri) {
        const uriParts = post.uri.split('/');
        postId = uriParts[uriParts.length - 1];
      } else if (post.cid) {
        postId = post.cid;
      } else if (post.id) {
        postId = post.id;
      } else if (post.record && post.record.uri) {
        const uriParts = post.record.uri.split('/');
        postId = uriParts[uriParts.length - 1];
      }

      const postUrl = `https://bsky.app/profile/${authorHandle}/post/${postId}`;

      // Render CSS and HTML
      const css = this.generateCSS(theme);
      const formattedText = this.formatPostText(postText);

      // Generate media HTML and log if none was found
      const mediaHTML = this.generateMediaHTML(post, theme);
      if (!mediaHTML && (post.embed || post.record?.embed)) {
        console.log('No media HTML was generated despite embed data being present');
        console.log('Embed type:', post.embed?.$type || post.record?.embed?.$type);
      }

      return `
        <div class="bsky-embed-container" style="max-width: ${width};">
          <style>${css}</style>
          <div class="bsky-embed">
            <div class="bsky-content">
              <div class="bsky-author">
                <a href="${authorUrl}" target="_blank" rel="noopener noreferrer">
                  <img src="${authorAvatar}" alt="${authorName}" class="bsky-avatar" loading="lazy"
                       onerror="this.src='/img/default-avatar.svg'">
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
      console.error('Error rendering post:', error);
      console.error('Post object structure:', post ? JSON.stringify(Object.keys(post)) : 'null post');

      // Provide a fallback rendering for posts that can't be properly parsed
      return `
        <div class="bsky-embed-container" style="max-width: ${width};">
          <style>${this.generateCSS(theme)}</style>
          <div class="bsky-embed">
            <div class="bsky-content">
              <div style="padding: 20px; text-align: center;">
                <p>This Bluesky post couldn't be displayed properly.</p>
                ${post?.uri ?
                  `<a href="https://bsky.app/profile/${post.author?.handle || 'handle'}/post/${post.uri.split('/').pop()}"
                    target="_blank" rel="noopener noreferrer" class="bsky-footer-link">
                    View on Bluesky
                  </a>`
                :
                  '<p>The post information was incomplete or could not be parsed.</p>'
                }
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
      let authorName = 'Bluesky User';
      if (post.author) {
        if (post.author.handle) {
          authorHandle = post.author.handle;
        }
        if (post.author.displayName) {
          authorName = post.author.displayName;
        }
      }

      return `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Bluesky Post by @${authorHandle}</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <link rel="icon" href="/img/favicon.png" type="image/png">
          <meta property="og:title" content="Post by ${authorName} (@${authorHandle})">
          <meta property="og:site_name" content="Bluesky">
          <meta property="og:type" content="article">
          <meta property="og:description" content="${
            post.record?.text || post.text || 'Bluesky post'
          }">
          ${post.author?.avatar ?
            `<meta property="og:image" content="${post.author.avatar}">` :
            ''
          }
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              margin: 0;
              padding: 20px;
              background-color: ${theme === 'dark' ? '#192734' : '#f7f9fa'};
              display: flex;
              justify-content: center;
            }

            .container {
              max-width: ${width === '100%' ? '600px' : width};
              width: 100%;
            }

            @media (max-width: 600px) {
              body {
                padding: 10px;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            ${postHTML}
          </div>
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
          <link rel="icon" href="/img/favicon.png" type="image/png">
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
              width: 100%;
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