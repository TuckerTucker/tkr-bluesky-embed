function generateFeedPageHtml(feedData, options = {}) {
  const {
    handle,
    theme = 'light',
    title = `Bluesky Feed for @${handle}`,
    cursor,
    suggestedUsers = [],
    profile = null,
    pageType = 'feed', // 'feed' or 'user-posts'
    refreshTime = new Date().toISOString() // When the feed was refreshed from API
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
  
  // Suggested users section removed
  let suggestedUsersHtml = '';
  
  // Build the HTML page
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" href="/img/favicon.png" type="image/png">
    <script src="https://cdn.jsdelivr.net/npm/hls.js@1.4.12"></script>
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
          <div style="margin-left: auto; display: flex; align-items: center; gap: 10px;">
            <button id="refresh-button" onclick="refreshFeed()" style="background-color: ${linkColor}; color: white; border: none; border-radius: 15px; padding: 5px 10px; cursor: pointer; font-size: 12px;">
              Refresh Now
            </button>
            <button id="auto-refresh-toggle" onclick="toggleAutoRefresh()" style="background-color: transparent; color: ${linkColor}; border: 1px solid ${linkColor}; border-radius: 15px; padding: 5px 10px; cursor: pointer; font-size: 12px;">
              Pause Auto-Refresh
            </button>
            <a href="/api/test/create-post" target="_blank" style="background-color: #17bf63; color: white; border: none; border-radius: 15px; padding: 5px 10px; cursor: pointer; font-size: 12px; text-decoration: none;">
              Create Test Post
            </a>
          </div>
        </div>

        ${profile && pageType === 'user-posts' ? `
        <div class="user-profile" style="display: flex; align-items: center; margin: 15px 0; padding: 12px; background-color: ${isDark ? '#192734' : '#ffffff'}; border-radius: 12px; border: 1px solid ${borderColor};">
          <img src="${profile.avatar || '/img/default-avatar.svg'}"
               alt="${profile.displayName || profile.handle}"
               style="width: 60px; height: 60px; border-radius: 50%; margin-right: 15px; object-fit: cover;">
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
      <!-- Feed refresh timestamp hidden attribute for tracking -->
      <div class="feed" style="width: 100%;" data-refresh-time="${refreshTime}">
        ${postsHtml}

        ${cursor ? `
          <a href="/${pageType}?handle=${handle}&theme=${theme}&cursor=${encodeURIComponent(cursor)}" class="load-more-btn">
            Load More Posts
          </a>
        ` : ''}
      </div>
    </div>
    
    <a href="#" class="back-to-top" title="Back to Top">↑</a>

    <div id="refresh-status" style="position: fixed; bottom: 20px; left: 20px; background-color: ${linkColor}; color: white; padding: 8px 12px; border-radius: 20px; font-size: 14px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); display: none;">
      Refreshing feed...
    </div>

    <script>
      // Auto-refresh feed functionality
      let autoRefreshInterval = 60; // seconds between refreshes
      let autoRefreshEnabled = true;
      let lastRefreshTime = new Date();
      let refreshTimer;
      let isRefreshing = false;

      function updateRefreshStatus() {
        const statusElement = document.getElementById('refresh-status');
        if (!statusElement) return;

        const timeSinceRefresh = Math.floor((new Date() - lastRefreshTime) / 1000);
        const timeToNextRefresh = Math.max(0, autoRefreshInterval - timeSinceRefresh);

        if (isRefreshing) {
          statusElement.textContent = "Refreshing feed...";
          statusElement.style.display = 'block';
        } else if (autoRefreshEnabled) {
          statusElement.textContent = "Auto-refresh in " + timeToNextRefresh + "s";
          statusElement.style.display = timeToNextRefresh < 10 ? 'block' : 'none';
        } else {
          statusElement.style.display = 'none';
        }
      }

      function refreshFeed() {
        if (isRefreshing) return;

        isRefreshing = true;
        updateRefreshStatus();

        // Build URL with proper cache busting
        // Remove hash fragment as it prevents query params from being sent to server
        let refreshUrl = window.location.href.split('#')[0];

        // Add cache busting parameter
        if (refreshUrl.indexOf('?') === -1) {
          refreshUrl += '?_nocache=' + new Date().getTime();
        } else {
          refreshUrl += '&_nocache=' + new Date().getTime();
        }
        console.log("Refreshing from URL: " + refreshUrl);

        // Fetch the fresh content without the browser cache
        fetch(refreshUrl, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        })
          .then(function(response) { return response.text(); })
          .then(function(html) {
            // Extract just the feed content
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const newFeedContent = doc.querySelector('.feed').innerHTML;

            // Check if there's actually new content
            const currentContent = document.querySelector('.feed').innerHTML;

            // Look for refresh timestamp in HTML to verify server actually queried Bluesky API
            const refreshTimestampMatch = html.match(/data-refresh-time="([^"]+)"/);
            const refreshTimestamp = refreshTimestampMatch ? refreshTimestampMatch[1] : 'unknown';

            if (newFeedContent === currentContent) {
              console.log("No new content received - feed is unchanged (API refresh time: " + refreshTimestamp + ")");
            } else {
              console.log("New content received - updating feed (API refresh time: " + refreshTimestamp + ")");
            }

            // Update just the feed content
            document.querySelector('.feed').innerHTML = newFeedContent;

            // Update last refresh time
            lastRefreshTime = new Date();
            isRefreshing = false;
            updateRefreshStatus();
            console.log("Feed refreshed at " + lastRefreshTime.toLocaleTimeString());
          })
          .catch(function(error) {
            console.error('Error refreshing feed:', error);
            isRefreshing = false;
            updateRefreshStatus();
          });
      }

      function startAutoRefresh() {
        if (refreshTimer) clearInterval(refreshTimer);

        refreshTimer = setInterval(function() {
          if (!autoRefreshEnabled) return;

          const timeSinceRefresh = Math.floor((new Date() - lastRefreshTime) / 1000);
          if (timeSinceRefresh >= autoRefreshInterval) {
            refreshFeed();
          } else {
            updateRefreshStatus();
          }
        }, 1000);
      }

      function toggleAutoRefresh() {
        autoRefreshEnabled = !autoRefreshEnabled;
        const toggleButton = document.getElementById('auto-refresh-toggle');
        if (toggleButton) {
          toggleButton.textContent = autoRefreshEnabled ? 'Pause Auto-Refresh' : 'Resume Auto-Refresh';
        }
        updateRefreshStatus();
      }

      // Initialize auto-refresh
      startAutoRefresh();
      updateRefreshStatus();

      // Allow manual refresh
      document.addEventListener('keydown', function(e) {
        // Refresh on F5 or Ctrl+R without full page reload
        if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
          e.preventDefault();
          refreshFeed();
        }
      });

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