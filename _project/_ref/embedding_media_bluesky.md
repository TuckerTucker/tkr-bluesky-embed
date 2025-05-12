# What you can and can't embed with Bluesky posts

Bluesky offers robust but constrained embedding functionality, with full support for images and videos but notable technical limitations that affect how content displays across platforms. The platform uses a combination of HTML snippets and JavaScript to render embedded posts with their media components.

## Official embedding is iframe-based with comprehensive media support

Bluesky provides two primary methods for embedding posts: an HTML snippet available via in-app dropdown menu or through embed.bsky.app. This embedding system works through a two-step process where a basic blockquote is replaced by a JavaScript-generated iframe that loads the post via API, complete with all supported media types. The platform is also a registered oEmbed provider with the endpoint https://embed.bsky.app/oembed, supporting parameters for URL, format, and width configuration.

The official embedding solution supports a wide range of media formats. Images in various aspect ratios render properly, and videos in MP4, MPEG, WebM, and MOV formats display with autoplay enabled by default. Quote-posts and external links with previews also appear correctly in embedded posts.

## Video limitations create the biggest constraints

While videos are supported in embedded Bluesky posts, they come with significant limitations. Videos must be under **1 minute in duration** and have a **maximum file size of 50MB**. Users are restricted to uploading 25 videos daily or 10GB total, whichever comes first.

More problematically, aspect ratio handling varies by device. Only 16:9 (horizontal) videos display properly on desktop without black bars. Other common aspect ratios (9:16 vertical, 1:1 square, 4:5) appear with black bars on desktop but display normally on mobile. This inconsistency can cause unexpected display issues when embedding posts containing non-standard video formats.

Unlike some competitors, Bluesky doesn't support embedding videos directly from other users' posts – you must download and re-upload videos to share them, which consumes your own storage allocation.

## Format support varies across media types

For images, Bluesky automatically resizes and optimizes uploads without strict format restrictions. Common formats like JPG, PNG, and GIF work as expected, though animated GIFs aren't explicitly supported according to some documentation.

Video format support is more explicitly defined, with MP4, MPEG, WebM, and MOV formats officially supported. The platform accepts various video codecs including AV1, VP9, and Vorbis, and can handle resolutions up to 8K, though there's no official recommendation for optimal resolution.

No direct support for audio-only formats was mentioned in any official documentation or third-party analysis, suggesting embedded posts likely don't support audio clips without video.

## Platform compatibility creates additional challenges

Embedded Bluesky posts follow the same content policies as the logged-out public web interface – adult-only content is redacted, deleted posts or accounts are redacted, and user privacy preferences are honored. This creates a consistent experience but means embedded content may appear differently than expected if content warnings are applied.

For developers implementing Bluesky embeds, compatibility issues can arise on platforms without proper HTML support or that block JavaScript execution. Some newsletter platforms like Substack don't support custom HTML in their editors, while AMP doesn't properly support Bluesky embeds due to JavaScript requirements.

## Conclusion

Bluesky's embedding system provides comprehensive media support for images and videos with some limitations. While the platform handles most common media formats, the constraints on video length, file size, and aspect ratio handling represent the most significant limitations. As Bluesky continues to evolve, these limitations may be addressed in future updates, but currently, developers should be aware of these constraints when embedding Bluesky posts with media content.