# Bluesky Post Embed

A simplified, single-user application for embedding Bluesky posts on your website.

## Features

- Embed Bluesky posts with a simple URL
- Custom Web Component for client-side embedding
- Dark and light theme support
- Responsive design
- Caching to reduce API calls
- No WordPress or oEmbed dependencies

## Installation

1. Clone this repository
2. Install dependencies

```bash
npm install
```

3. Copy `.env.example` to `.env` and configure your settings:

```bash
cp .env.example .env
```

4. Edit the `.env` file with your Bluesky credentials (optional)

## Starting the Server

Start the development server:

```bash
npm run dev
```

Or for production:

```bash
npm start
```

## Usage

### Direct Embed

To embed a post, use:

```
http://localhost:3000/embed?url=https://bsky.app/profile/username.bsky.social/post/postid
```

### JavaScript Integration

Add this script to your HTML:

```html
<script src="http://localhost:3000/widget.js"></script>
```

Then use the custom element:

```html
<bluesky-post 
  post-url="https://bsky.app/profile/username.bsky.social/post/postid" 
  theme="light" 
  width="100%">
</bluesky-post>
```

Or use the helper function:

```javascript
embedBlueskyPost(
  'https://bsky.app/profile/username.bsky.social/post/postid',
  '#container',
  { theme: 'light', width: '100%' }
);
```

To automatically embed all Bluesky links on your page:

```javascript
autoEmbedBlueskyPosts();
```

## API Endpoints

- `/embed` - Returns a standalone HTML page with the embedded post
- `/api/post` - Returns only the HTML for the post embed
- `/api/post/raw` - Returns the raw post data as JSON
- `/widget.js` - Client-side JavaScript for embedding
- `/health` - Server health check

## Configuration

The application can be configured through environment variables or by editing `config/default.js`. Available configuration options:

- Server port and host
- Bluesky API service URL
- Bluesky username and app password (for authentication)
- Cache settings
- Default styling options

## Authentication

For higher rate limits or accessing private posts, you can configure authentication with a Bluesky App Password:

1. Create an App Password in your Bluesky account settings
2. Add your username and password to the `.env` file:

```
# For standard Bluesky handles
BSKY_USERNAME=your-handle.bsky.social
BSKY_APP_PASSWORD=your-app-password

# For custom domain handles (like @tucker.sh)
# Just use the domain without the @ symbol
BSKY_USERNAME=tucker.sh
BSKY_APP_PASSWORD=your-app-password
```

## API Version

This application uses the Bluesky/AT Protocol API version 0.15.6. It includes special handling for:
- Required `actor` parameter in API requests
- Updated response formats
- Proper error handling for API responses

## Troubleshooting

If you encounter issues:

### 1. Authentication Problems

- Check that your username doesn't include the `@` symbol in the .env file
- Verify that your app password is correct
- Make sure your Bluesky account is in good standing

### 2. API Errors (502, 429)

- The Bluesky API may be experiencing issues or rate limiting
- Try again later or reduce the number of requests
- Check the console logs for detailed error information

### 3. Post Display Issues

- If posts aren't rendering correctly, check if the post has been deleted or is private
- For feed issues, try viewing a single post to confirm basic connectivity
- Enable authentication for better performance and access to more posts

### 4. Custom Domain Handles

Custom domain handles (like @tucker.sh) are fully supported:
- In the .env file, enter only the domain without the @ symbol
- In API requests, you can use either format (@tucker.sh or tucker.sh)

## License

MIT License