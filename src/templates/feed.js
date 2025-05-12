function generateFeedPageHtml(feedData, options = {}) {
  const {
    handle,
    theme = 'light',
    title = `Bluesky Feed for @${handle}`,
    cursor,
    suggestedUsers = [],
    profile = null,
    pageType = 'feed' // 'feed' or 'user-posts'
  } = options;
  
  const isDark = theme === 'dark';
  const backgroundColor = isDark ? '#15202b' : '#f7f9fa';
  const textColor = isDark ? '#ffffff' : '#000000';
  const secondaryColor = isDark ? '#8899a6' : '#657786';
  const borderColor = isDark ? '#38444d' : '#e1e8ed';
  const linkColor = isDark ? '#1d9bf0' : '#1da1f2';
  const headerBg = isDark ? '#192734' : '#ffffff';
  
  // Build the list of posts
  let postsHtml = '';

  if (feedData.posts && feedData.posts.length > 0) {
    postsHtml = feedData.posts.join('\n<div class="feed-separator"></div>\n');
  } else {
    postsHtml = `
      <div class="feed-empty" style="text-align: center; padding: 40px 20px;">
        <h3 style="color: ${secondaryColor};">No posts found</h3>
        <p>This feed appears to be empty, the user hasn't posted yet, or the Bluesky API is temporarily having issues.</p>
        <div style="margin-top: 30px;">
          <p>Try using the single post embedding feature instead:</p>
          <a href="/" style="display: inline-block; margin-top: 10px; background-color: ${linkColor}; color: white; text-decoration: none; padding: 8px 16px; border-radius: 20px;">
            ← Back to Home
          </a>
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid ${borderColor};">
          <p>Or try one of these sample Bluesky posts:</p>
          <a href="/embed?url=https://bsky.app/profile/bsky.app/post/3kiisjqsgoh2d" style="display: block; margin: 10px 0; color: ${linkColor}; text-decoration: none;">
            Bluesky Official Announcement
          </a>
          <a href="/embed?url=https://bsky.app/profile/pfrazee.com/post/3keajrs3hgp2c" style="display: block; margin: 10px 0; color: ${linkColor}; text-decoration: none;">
            Paul Frazee Post
          </a>
        </div>
      </div>
    `;
  }
  
  // Build the suggested users section
  let suggestedUsersHtml = '';
  if (suggestedUsers && suggestedUsers.length > 0) {
    const usersList = suggestedUsers.map(user => {
      return `
        <div class="suggested-user" style="display: flex; align-items: center; margin-bottom: 12px; padding: 8px; border-radius: 8px; background-color: ${isDark ? '#192734' : '#ffffff'};">
          <img src="${user.avatar || 'https://bsky.app/static/img/default-avatar.png'}" 
               alt="${user.displayName || user.handle}" 
               style="width: 40px; height: 40px; border-radius: 50%; margin-right: 10px;">
          <div style="flex: 1;">
            <div style="font-weight: bold; color: ${textColor};">${user.displayName || ''}</div>
            <div style="color: ${secondaryColor}; font-size: 14px;">@${user.handle}</div>
          </div>
          <a href="https://bsky.app/profile/${user.handle}" target="_blank" 
             style="text-decoration: none; padding: 6px 12px; background-color: ${linkColor}; color: white; border-radius: 18px; font-size: 14px;">
            View
          </a>
        </div>
      `;
    }).join('\n');
    
    suggestedUsersHtml = `
      <div class="suggested-users-section" style="margin-top: 20px; padding: 15px; background-color: ${isDark ? '#192734' : '#ffffff'}; border-radius: 12px; border: 1px solid ${borderColor};">
        <h3 style="margin-top: 0; color: ${textColor};">Suggested Profiles</h3>
        ${usersList}
      </div>
    `;
  }
  
  // Build the HTML page
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        background-color: ${backgroundColor};
        color: ${textColor};
        line-height: 1.5;
      }
      
      .container {
        max-width: 600px;
        margin: 0 auto;
        padding: 0 15px;
      }
      
      .feed-header {
        position: sticky;
        top: 0;
        z-index: 100;
        padding: 15px 0;
        background-color: ${headerBg};
        border-bottom: 1px solid ${borderColor};
        margin-bottom: 15px;
      }
      
      .feed-user-info {
        display: flex;
        align-items: center;
        margin-bottom: 10px;
      }
      
      .feed-title {
        font-size: 18px;
        font-weight: bold;
      }
      
      .feed-control {
        margin: 15px 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .theme-toggle {
        padding: 5px 10px;
        border-radius: 18px;
        border: 1px solid ${borderColor};
        background-color: ${isDark ? '#192734' : '#ffffff'};
        color: ${textColor};
        cursor: pointer;
      }
      
      .feed-separator {
        height: 10px;
      }
      
      .feed-loader {
        padding: 20px;
        text-align: center;
      }
      
      .load-more-btn {
        display: block;
        width: 100%;
        padding: 10px;
        margin: 20px 0;
        background-color: ${linkColor};
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        cursor: pointer;
        text-align: center;
      }
      
      .load-more-btn:hover {
        background-color: ${isDark ? '#1a8cd8' : '#0d8bd9'};
      }
      
      .sidebar {
        position: sticky;
        top: 80px;
      }
      
      .back-to-top {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background-color: ${linkColor};
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        text-decoration: none;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        font-size: 20px;
        cursor: pointer;
      }
      
      @media (max-width: 768px) {
        .container {
          padding: 0 10px;
        }
        
        .feed-title {
          font-size: 16px;
        }
      }
    </style>
  </head>
  <body>
    <div class="feed-header">
      <div class="container">
        <div class="feed-user-info">
          <h1 class="feed-title">${pageType === 'user-posts' ? `Posts by @${handle}` : `Bluesky Feed: @${handle}`}</h1>
        </div>

        ${profile && pageType === 'user-posts' ? `
        <div class="user-profile" style="display: flex; align-items: center; margin: 15px 0; padding: 12px; background-color: ${isDark ? '#192734' : '#ffffff'}; border-radius: 12px; border: 1px solid ${borderColor};">
          <img src="${profile.avatar || 'https://bsky.app/static/img/default-avatar.png'}"
               alt="${profile.displayName || profile.handle}"
               style="width: 60px; height: 60px; border-radius: 50%; margin-right: 15px;">
          <div style="flex: 1;">
            <div style="font-weight: bold; font-size: 18px; color: ${textColor};">${profile.displayName || handle}</div>
            <div style="color: ${secondaryColor}; font-size: 14px; margin-bottom: 5px;">@${handle}</div>
            ${profile.description ? `<div style="color: ${textColor}; font-size: 14px;">${profile.description}</div>` : ''}
          </div>
        </div>
        ` : ''}

      </div>
    </div>
  
    <div class="container">
      <div style="display: grid; grid-template-columns: 1fr; gap: 20px;">
        <div class="feed">
          ${postsHtml}

          ${cursor ? `
            <a href="/${pageType}?handle=${handle}&theme=${theme}&cursor=${encodeURIComponent(cursor)}" class="load-more-btn">
              Load More Posts
            </a>
          ` : ''}
        </div>
        <div class="sidebar">
          ${suggestedUsersHtml}
        </div>
      </div>
    </div>
    
    <a href="#" class="back-to-top" title="Back to Top">↑</a>
    
    <script>
      // Auto load more posts when scrolling to the bottom
      window.addEventListener('scroll', function() {
        const loadMoreBtn = document.querySelector('.load-more-btn');
        if (loadMoreBtn) {
          const rect = loadMoreBtn.getBoundingClientRect();
          // If the load more button is visible
          if (rect.top < window.innerHeight && rect.bottom >= 0) {
            // Uncomment the line below to enable auto-loading
            // loadMoreBtn.click();
          }
        }
      });
      
      // Show/hide back-to-top button
      window.addEventListener('scroll', function() {
        const backToTop = document.querySelector('.back-to-top');
        if (window.scrollY > 300) {
          backToTop.style.display = 'flex';
        } else {
          backToTop.style.display = 'none';
        }
      });
      
      // Initial hide of back-to-top button
      document.querySelector('.back-to-top').style.display = 'none';
    </script>
  </body>
  </html>
  `;
}

module.exports = { generateFeedPageHtml };