const blueskyClient = require('./bluesky-client');
const postRenderer = require('./post-renderer');
const cache = require('./cache');

class FeedFetcher {
  constructor() {
    this.client = blueskyClient;
  }

  // Fetch a user's feed (with caching)
  async getUserFeed(handle, options = {}) {
    const { limit = 10, cursor = null, cacheKey = null } = options;

    // Check cache first if cacheKey is provided
    if (cacheKey && cache.enabled) {
      const cachedFeed = cache.get(`feed:${handle}:${cacheKey}`);
      if (cachedFeed) {
        console.log(`Using cached feed for ${handle}`);
        return cachedFeed;
      }
    }

    try {
      // Ensure we're authenticated for better rate limits
      await this.client.authenticate();

      // Clean up handle (remove @ if present)
      const cleanHandle = handle.replace(/^@/, '');

      // Get profile and feed with the new client methods
      try {
        console.log(`Fetching feed for ${cleanHandle} with limit ${limit}`);

        // Get the author's feed with the new API
        const feedResponse = await this.client.getUserFeed(cleanHandle, limit, cursor);

        // Extra validation of the response format
        if (!feedResponse) {
          throw new Error(`Empty response from API for handle: ${cleanHandle}`);
        }

        // In the new API, feed might be under feed or under a different property
        // Let's handle various possible formats
        let feed = [];
        if (feedResponse.feed) {
          console.log(`Found feed data with ${feedResponse.feed.length} posts`);
          feed = feedResponse.feed;
        } else if (feedResponse.data && feedResponse.data.feed) {
          console.log(`Found feed data in data.feed with ${feedResponse.data.feed.length} posts`);
          feed = feedResponse.data.feed;
        } else {
          console.warn(`Unexpected feed format, trying to extract feed data:`,
              Object.keys(feedResponse).join(', '));

          // Try to find any array property that might be the feed
          for (const key in feedResponse) {
            if (Array.isArray(feedResponse[key]) && feedResponse[key].length > 0) {
              console.log(`Using ${key} array as feed data with ${feedResponse[key].length} items`);
              feed = feedResponse[key];
              break;
            }
          }
        }

        // Get cursor from various possible locations
        let nextCursor = null;
        if (feedResponse.cursor) {
          nextCursor = feedResponse.cursor;
        } else if (feedResponse.data && feedResponse.data.cursor) {
          nextCursor = feedResponse.data.cursor;
        }

        // Process the feed data
        const feedData = {
          feed: feed,
          cursor: nextCursor
        };

        // Cache the results if cacheKey is provided
        if (cacheKey && cache.enabled) {
          cache.put(`feed:${handle}:${cacheKey}`, feedData);
        }

        console.log(`Successfully processed feed data with ${feed.length} posts`);
        return feedData;
      } catch (feedError) {
        console.error(`Error fetching author feed for ${handle}, trying timeline:`, feedError);

        // Fallback to timeline (if it's the authenticated user)
        if (cleanHandle === this.client.username) {
          console.log(`Falling back to timeline for authenticated user: ${cleanHandle}`);
          const timelineResponse = await this.client.getTimeline(limit, cursor);

          // Extra validation for timeline response
          if (!timelineResponse) {
            throw new Error('Empty timeline response from API');
          }

          // Extract feed data
          let feed = [];
          if (timelineResponse.feed) {
            feed = timelineResponse.feed;
          } else if (timelineResponse.data && timelineResponse.data.feed) {
            feed = timelineResponse.data.feed;
          }

          const feedData = {
            feed: feed,
            cursor: timelineResponse.cursor || null
          };

          // Cache the results
          if (cacheKey && cache.enabled) {
            cache.put(`feed:${handle}:${cacheKey}`, feedData);
          }

          console.log(`Using timeline data with ${feed.length} posts as fallback`);
          return feedData;
        } else {
          // If it's not the authenticated user, we can't get their timeline
          throw feedError;
        }
      }
    } catch (error) {
      console.error(`Error fetching feed for ${handle}:`, error);

      // Return empty feed in case of error
      return {
        feed: [],
        cursor: null
      };
    }
  }
  
  // Get a rendered HTML feed
  async getRenderedFeed(handle, options = {}) {
    const {
      limit = 10,
      cursor = null,
      theme = 'light',
      userPostsOnly = false // Option to show only posts from the user
    } = options;

    try {
      console.log(`Rendering feed for ${handle} with limit ${limit}, cursor ${cursor || 'null'}, userPostsOnly: ${userPostsOnly}`);

      // Use different API methods based on the view type
      let feedData;

      if (userPostsOnly) {
        // For user posts only view, use the dedicated method that gets only authored posts
        console.log(`Using getUserPosts method for user-only posts view`);

        // Check cache with a unique key for user posts
        const cacheKey = `user-posts:${handle}:${limit}:${cursor}:${theme}`;
        if (cache.enabled) {
          const cachedData = cache.get(cacheKey);
          if (cachedData) {
            console.log(`Using cached user posts for ${handle}`);
            feedData = cachedData;
          } else {
            // Fetch and cache
            try {
              feedData = await this.client.getUserPosts(handle, limit, cursor);
              if (feedData) {
                cache.put(cacheKey, feedData);
              }
            } catch (error) {
              console.error(`Error fetching user posts: ${error.message}`);
              throw error;
            }
          }
        } else {
          feedData = await this.client.getUserPosts(handle, limit, cursor);
        }
      } else {
        // For regular feed view, use the standard method
        console.log(`Using regular getUserFeed method for feed view`);
        feedData = await this.getUserFeed(handle, {
          limit,
          cursor,
          cacheKey: `feed:${limit}:${cursor}:${theme}`
        });
      }

      if (!feedData || !feedData.feed || !Array.isArray(feedData.feed)) {
        console.warn(`Invalid feed data returned for ${handle}:`, feedData);
        throw new Error('Invalid feed data structure from API');
      }

      console.log(`Got ${feedData.feed.length} items in ${userPostsOnly ? 'user posts' : 'feed'}, processing...`);

      // We don't need to get DID for filtering user posts since we're using a different API method

      // Render each post
      let renderedPosts = feedData.feed.map((item, index) => {
        try {
          // Skip replies and reposts if needed
          if (options.skipReplies && item.reply) {
            console.log(`Skipping reply at index ${index}`);
            return null;
          }

          if (options.skipReposts && item.reason === 'repost') {
            console.log(`Skipping repost at index ${index}`);
            return null;
          }

          // Check if the post object exists
          if (!item.post) {
            console.warn(`Missing post data in feed item at index ${index}:`, item);
            return null;
          }

          // For userPostsOnly, we're already using a dedicated API method that only returns posts by the user
          // So we don't need additional filtering by author DID

          // But we may still want to skip reposts if they're somehow included in user posts view
          if (userPostsOnly && item.reason && item.reason === 'repost') {
            console.log('Skipping repost in user posts view');
            return null;
          }

          // Render the post
          const renderedPost = postRenderer.renderPost(item.post, { theme });
          return renderedPost;
        } catch (error) {
          console.error(`Error processing feed item at index ${index}:`, error);
          // Return a placeholder for failed posts instead of null
          return `
            <div class="bsky-embed-container" style="max-width: ${options.width || '100%'};">
              <div class="bsky-embed" style="border: 1px solid #e1e8ed; border-radius: 12px; padding: 15px; margin-bottom: 15px; background-color: ${theme === 'dark' ? '#15202b' : '#ffffff'}; color: ${theme === 'dark' ? '#ffffff' : '#000000'};">
                <div style="text-align: center; padding: 20px;">
                  <p>This post couldn't be displayed</p>
                  <p style="font-size: 12px; color: ${theme === 'dark' ? '#8899a6' : '#657786'};">
                    Error: ${error.message || 'Unknown error'}
                  </p>
                </div>
              </div>
            </div>
          `;
        }
      }).filter(Boolean); // Remove nulls

      console.log(`Successfully rendered ${renderedPosts.length} posts`);

      // Check if we have user posts when filtering for user posts only
      if (userPostsOnly && renderedPosts.length === 0) {
        renderedPosts.push(`
          <div class="bsky-embed-container" style="max-width: 100%;">
            <div class="bsky-embed" style="border: 1px solid #e1e8ed; border-radius: 12px; padding: 20px; margin-bottom: 15px; background-color: ${theme === 'dark' ? '#15202b' : '#ffffff'}; color: ${theme === 'dark' ? '#ffffff' : '#000000'};">
              <div style="text-align: center;">
                <h3>No Posts Found</h3>
                <p>No posts from @${handle} were found.</p>
                <p style="font-size: 14px; color: ${theme === 'dark' ? '#8899a6' : '#657786'};">
                  This user may not have posted anything yet.
                </p>
              </div>
            </div>
          </div>
        `);
      }

      return {
        posts: renderedPosts,
        cursor: feedData.cursor
      };
    } catch (error) {
      console.error(`Error rendering feed for ${handle}:`, error);

      // Create a more helpful error message for the user
      const errorHtml = `
        <div class="bsky-embed-container" style="max-width: 100%;">
          <div class="bsky-embed" style="border: 1px solid #e1e8ed; border-radius: 12px; padding: 20px; margin-bottom: 15px; background-color: ${theme === 'dark' ? '#15202b' : '#ffffff'}; color: ${theme === 'dark' ? '#ffffff' : '#000000'};">
            <div style="text-align: center;">
              <h3 style="color: #e0245e;">Error Loading ${userPostsOnly ? 'Posts' : 'Feed'}</h3>
              <p>${error.message || `Could not load ${userPostsOnly ? 'posts' : 'feed'} at this time.`}</p>
              <p style="font-size: 14px; color: ${theme === 'dark' ? '#8899a6' : '#657786'};">
                Please try again later or check if the username is correct.
              </p>
            </div>
          </div>
        </div>
      `;

      return {
        posts: [errorHtml],  // Include an error message as a post
        cursor: null
      };
    }
  }
  
  // Get popular profiles to follow
  async getPopularProfiles(limit = 5) {
    try {
      await this.client.authenticate();

      // Use a fixed list of VALID Bluesky accounts for reliability
      // These are actual user handles that exist on Bluesky
      const recommendedHandles = [
        'bsky.app.bsky.social',     // Official Bluesky app account
        'skyline.bsky.social',      // Bluesky's Skyline feature
        'bluesky.bsky.social',      // Official Bluesky account
        'whyp.bsky.social',         // Popular Bluesky account
        'elonmusk.bsky.social',     // High-profile account
        'protocol.bsky.social',     // AT Protocol account
        'tucker.sh'                 // Example custom domain (if available)
      ];

      console.log('Fetching popular profiles from recommended handles');

      // Fetch profiles from the recommended handles list
      const profiles = [];

      for (const handle of recommendedHandles.slice(0, limit)) {
        try {
          console.log(`Trying to fetch profile for: ${handle}`);
          // Use the client's getProfile method which already handles the proper API format
          const profile = await this.client.getProfile(handle);

          profiles.push(profile);
          console.log(`Successfully fetched profile for ${handle}`);

          // Avoid hitting rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (profileError) {
          console.warn(`Couldn't fetch profile for ${handle}:`, profileError.message);
          // Continue with next handle
        }
      }

      console.log(`Retrieved ${profiles.length} popular profiles`);
      return profiles;
    } catch (error) {
      console.error('Error fetching popular profiles:', error);
      return [];
    }
  }
}

module.exports = new FeedFetcher();