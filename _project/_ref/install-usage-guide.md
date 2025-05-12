# Bluesky Post Embedding System

This guide explains how to set up and use the custom AT Protocol implementation for embedding Bluesky posts on your website. You can choose from several approaches depending on your technical needs.

## Table of Contents

1. [Simple Embedding](#simple-embedding)
2. [Client-Side Implementation](#client-side-implementation)
3. [Server-Side Implementation](#server-side-implementation)
4. [WordPress Integration](#wordpress-integration)
5. [Automation Options](#automation-options)

## Simple Embedding

The simplest way to embed a Bluesky post is to use Bluesky's official oEmbed support:

1. Go to the Bluesky post you want to embed
2. Click the "..." menu in the top-right corner of the post
3. Select "Embed Post"
4. Copy the provided HTML code
5. Paste it into your website's HTML

This method uses the official Bluesky embed service at `https://embed.bsky.app` and requires no additional setup.

## Client-Side Implementation

For client-side embedding that gives you more control over styling and behavior:

### Installation

```bash
# Using npm
npm install @atproto/api

# Using yarn
yarn add @atproto/api

# Using pnpm
pnpm add @atproto/api
```

### Usage

Include the custom Web Component in your HTML:

```html
<script src="path/to/frontend-embed-implementation.js"></script>

<!-- Then use the component -->
<bluesky-post 
  post-url="https://bsky.app/profile/username.bsky.social/post/postid" 
  theme="light" 
  width="100%">
</bluesky-post>
```

Or embed programmatically:

```javascript
// Import the embedding helper
import { embedBlueskyPost } from './path/to/frontend-embed-implementation.js';

// Embed a single post
embedBlueskyPost(
  'https://bsky.app/profile/username.bsky.social/post/postid',
  '#container',
  { theme: 'light', width: '100%' }
);

// Or automatically embed all Bluesky links on your page
autoEmbedBlueskyPosts();
```

## Server-Side Implementation

For a server-side solution that gives you complete control:

### Installation

```bash
# Install dependencies
npm install express @atproto/api node-fetch cors memory-cache

# Clone the repository
git clone https://your-repo/bluesky-embed-server.git
cd bluesky-embed-server

# Install dependencies
npm install

# Set up environment variables (optional)
export BSKY_SERVICE_URL=https://bsky.social
export BSKY_USERNAME=your-handle.bsky.social
export BSKY_APP_PASSWORD=your-app-password
export CACHE_DURATION=3600000
export PORT=3000

# Start the server
node server.js
```

### Usage

Once your server is running, you can use any of these endpoints:

1. **oEmbed API**: `http://localhost:3000/oembed?url=https://bsky.app/profile/username.bsky.social/post/postid`
2. **Direct Embed**: `http://localhost:3000/embed?url=https://bsky.app/profile/username.bsky.social/post/postid`
3. **JavaScript Widget**: Include `<script src="http://localhost:3000/widget.js"></script>` in your HTML

The server provides caching to reduce API requests to Bluesky and support for both light and dark themes.

## WordPress Integration

There are multiple ways to integrate Bluesky post embedding with WordPress:

### Method 1: Using Bluesky's oEmbed Support

WordPress supports oEmbed out of the box. Just paste a Bluesky post URL on its own line in the editor, and WordPress should automatically embed it.

### Method 2: Custom Plugin Integration

For more control, you can use our custom code with WordPress:

1. Create a new plugin file in your WordPress plugins directory
2. Add the following code to register the custom embed handler:

```php
<?php
/**
 * Plugin Name: Bluesky Post Embedder
 * Description: Embed Bluesky posts in WordPress
 * Version: 1.0.0
 * Author: Your Name
 */

// Register scripts
function bluesky_embed_register_scripts() {
    wp_register_script(
        'bluesky-embed',
        plugin_dir_url(__FILE__) . 'assets/frontend-embed-implementation.js',
        [],
        '1.0.0',
        true
    );
}
add_action('wp_enqueue_scripts', 'bluesky_embed_register_scripts');

// Add oEmbed provider
function bluesky_embed_oembed_provider() {
    wp_oembed_add_provider('https://bsky.app/profile/*/post/*', 'https://embed.bsky.app/oembed');
}
add_action('init', 'bluesky_embed_oembed_provider');

// Add shortcode
function bluesky_embed_shortcode($atts) {
    $atts = shortcode_atts(array(
        'url' => '',
        'theme' => 'light',
        'width' => '100%',
    ), $atts);
    
    if (empty($atts['url'])) {
        return '<p>Error: No Bluesky post URL provided</p>';
    }
    
    wp_enqueue_script('bluesky-embed');
    
    $id = 'bluesky-post-' . mt_rand(1000, 9999);
    
    return '<div id="' . $id . '"></div>
    <script>
        document.addEventListener("DOMContentLoaded", function() {
            embedBlueskyPost("' . esc_url($atts['url']) . '", "#' . $id . '", {
                theme: "' . esc_attr($atts['theme']) . '",
                width: "' . esc_attr($atts['width']) . '"
            });
        });
    </script>';
}
add_shortcode('bluesky', 'bluesky_embed_shortcode');

// Add Gutenberg block (optional)
function bluesky_embed_register_block() {
    if (function_exists('register_block_type')) {
        register_block_type('bluesky-embed/post', array(
            'editor_script' => 'bluesky-embed-editor',
            'editor_style' => 'bluesky-embed-editor-style',
            'render_callback' => 'bluesky_embed_render_block',
            'attributes' => array(
                'url' => array(
                    'type' => 'string',
                    'default' => '',
                ),
                'theme' => array(
                    'type' => 'string',
                    'default' => 'light',
                ),
                'width' => array(
                    'type' => 'string',
                    'default' => '100%',
                ),
            ),
        ));
    }
}
add_action('init', 'bluesky_embed_register_block');

function bluesky_embed_render_block($attributes) {
    return bluesky_embed_shortcode($attributes);
}
```

3. Copy your `frontend-embed-implementation.js` to the plugin's assets folder
4. Activate the plugin in WordPress admin

Then you can use the shortcode in your posts:

```
[bluesky url="https://bsky.app/profile/username.bsky.social/post/postid" theme="light" width="100%"]
```

## Automation Options

To automatically embed Bluesky posts on your website:

### Auto-Converting Links

Add this JavaScript to automatically convert all Bluesky post links to embeds:

```javascript
document.addEventListener('DOMContentLoaded', function() {
  // Find all links to Bluesky posts
  const blueskyLinks = document.querySelectorAll('a[href^="https://bsky.app/profile/"][href*="/post/"]');
  
  blueskyLinks.forEach(function(link) {
    // Create container
    const container = document.createElement('div');
    container.className = 'bluesky-embed-container';
    
    // Create embed element
    const embed = document.createElement('bluesky-post');
    embed.setAttribute('post-url', link.href);
    
    // Optional: Add a link to the original
    const sourceLink = document.createElement('a');
    sourceLink.href = link.href;
    sourceLink.textContent = 'View on Bluesky';
    sourceLink.className = 'bluesky-source-link';
    sourceLink.target = '_blank';
    
    // Insert after the link
    link.parentNode.insertBefore(container, link.nextSibling);
    container.appendChild(embed);
    container.appendChild(sourceLink);
  });
});
```

### Regular Content Updates

For websites that need to regularly import and embed Bluesky posts (like a blog aggregating content from Bluesky), set up a scheduled task:

1. Create a script that uses the AT Protocol API to fetch recent posts from specific users
2. Save the posts to your database or content management system
3. Use the embedding techniques above to display them on your site
4. Schedule this script to run at your desired frequency

Example Node.js cron job:

```javascript
const cron = require('node-cron');
const { BskyAgent } = require('@atproto/api');
const fs = require('fs');

// Run every hour
cron.schedule('0 * * * *', async () => {
  const agent = new BskyAgent({ service: 'https://bsky.social' });
  
  // Login with your credentials
  await agent.login({
    identifier: 'your-handle.bsky.social',
    password: 'your-app-password'
  });
  
  // Get posts from a specific user
  const feed = await agent.getAuthorFeed({
    actor: 'target-user.bsky.social',
    limit: 10
  });
  
  // Process and save the posts
  const posts = feed.data.feed.map(item => ({
    uri: item.post.uri,
    text: item.post.record.text,
    createdAt: item.post.record.createdAt,
    url: `https://bsky.app/profile/${item.post.author.handle}/post/${item.post.uri.split('/').pop()}`
  }));
  
  // Save to file (or your database)
  fs.writeFileSync('latest-posts.json', JSON.stringify(posts, null, 2));
  
  console.log('Updated latest posts');
});
```

## Advanced Configuration

### Authentication

For private posts or higher rate limits, use authentication with the Bluesky API:

1. Create an App Password from your Bluesky account settings
2. Use this password instead of your main account password in API calls

### Custom Styling

To customize the appearance of embedded posts:

1. For the Web Component implementation, modify the CSS in the shadow DOM
2. For the server implementation, edit the HTML template in the `generateEmbedHTML` function
3. For oEmbed, you'll need to apply custom CSS to style the iframe or use an alternative method

### Caching

To reduce API calls to Bluesky:

1. The server implementation includes built-in caching
2. For client-side implementations, consider implementing local storage caching
3. If embedding many posts, consider a caching proxy

## Troubleshooting

### Common Issues

1. **Authentication Errors**: Ensure you're using an App Password, not your main password
2. **Rate Limiting**: Bluesky has rate limits; use caching to reduce API calls
3. **CSS Conflicts**: The Web Component uses shadow DOM to isolate styles, but may still have issues; test thoroughly
4. **CORS Errors**: When using the API directly from the browser, you may encounter CORS issues; use a proxy or server-side implementation

### Support

For support with this implementation:

- Check the [Bluesky AT Protocol documentation](https://docs.bsky.app/)
- Review the [AT Protocol GitHub repository](https://github.com/bluesky-social/atproto)
- Join the [Bluesky developer community](https://bsky.app/profile/bsky.app)
