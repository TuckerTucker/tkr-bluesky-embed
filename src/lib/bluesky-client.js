const { BskyAgent } = require('@atproto/api');
const config = require('../../config/default');

class BlueskyClient {
  constructor() {
    this.service = config.bluesky.service;
    this.agent = new BskyAgent({ service: this.service });

    // Handle username format (remove @ if present)
    this.username = config.bluesky.username ? config.bluesky.username.replace(/^@/, '') : null;
    this.appPassword = config.bluesky.appPassword;
    this.authenticated = false;
  }

  // Authenticate with the Bluesky service
  async authenticate() {
    if (!this.authenticated && this.username && this.appPassword) {
      try {
        await this.agent.login({
          identifier: this.username,
          password: this.appPassword
        });
        this.authenticated = true;
        console.log('Authenticated with Bluesky service');
        return true;
      } catch (error) {
        console.error('Authentication failed:', error);
        return false;
      }
    }
    return this.authenticated;
  }

  // Resolve a handle to a DID
  async resolveDid(handle) {
    try {
      const response = await this.agent.resolveHandle({ handle });
      return response.data.did;
    } catch (error) {
      console.error('Error resolving handle:', error);
      throw new Error(`Could not resolve handle: ${handle}`);
    }
  }

  // Parse a Bluesky URL into username and post ID
  parseBlueskyUrl(url) {
    if (!url.startsWith('https://bsky.app/profile/')) {
      throw new Error('Invalid Bluesky URL format');
    }

    // Extract parts using regex for more robust parsing
    const profileRegex = /https:\/\/bsky\.app\/profile\/([^\/]+)\/post\/([^\/]+)/;
    const match = url.match(profileRegex);

    if (!match || match.length < 3) {
      throw new Error('Invalid Bluesky URL format. Expected format: https://bsky.app/profile/username/post/postid');
    }

    return {
      username: match[1], // Username part (could be a handle or custom domain)
      postId: match[2]    // Post ID part
    };
  }

  // Convert a Bluesky URL to an AT Protocol URI
  async urlToUri(url) {
    const { username, postId } = this.parseBlueskyUrl(url);
    const did = await this.resolveDid(username);
    return `at://${did}/app.bsky.feed.post/${postId}`;
  }

  // Fetch a post by URL or URI
  async fetchPost(postIdentifier) {
    let postUri;
    
    try {
      if (postIdentifier.startsWith('https://bsky.app/profile/')) {
        postUri = await this.urlToUri(postIdentifier);
      } else if (postIdentifier.startsWith('at://')) {
        postUri = postIdentifier;
      } else {
        throw new Error('Invalid post identifier format');
      }

      // Authenticate if credentials are provided
      if (this.username && this.appPassword) {
        await this.authenticate();
      }

      const response = await this.agent.getPosts({ uris: [postUri] });
      
      if (!response.data.posts.length) {
        throw new Error('Post not found');
      }
      
      return response.data.posts[0];
    } catch (error) {
      console.error('Error fetching post:', error);
      throw error;
    }
  }
}

// Export a singleton instance
module.exports = new BlueskyClient();