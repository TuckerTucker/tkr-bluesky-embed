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

## License

MIT License