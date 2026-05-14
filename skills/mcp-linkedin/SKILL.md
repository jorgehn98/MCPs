---
name: linkedin-mcp
description: >
  Use the LinkedIn MCP server to interact with LinkedIn on behalf of the authenticated user.
  Trigger this skill when the user wants to: publish a post on LinkedIn (text, image, video,
  article or reshare), read or delete their posts, add or delete comments, add or remove
  reactions, or get their profile information. Examples: "post this on LinkedIn",
  "publish a LinkedIn post with this image", "comment on this LinkedIn post",
  "show me my latest LinkedIn posts", "react with LIKE to this post",
  "share this article on LinkedIn", "delete my last post", "reply to this comment".
---

# LinkedIn MCP Skill

## Key principle: URNs

LinkedIn identifies everything with URNs. You will need them constantly.

| Entity | URN format |
|--------|-----------|
| Person | `urn:li:person:XXXXXXXX` |
| Organization | `urn:li:organization:XXXXXXXX` |
| Post (share) | `urn:li:share:XXXXXXXX` |
| Post (ugc) | `urn:li:ugcPost:XXXXXXXX` |
| Activity | `urn:li:activity:XXXXXXXX` |

**Always call `linkedin_get_my_profile` first** if the user has not provided their URN and the tool requires an author/actor URN.

## Available tools (quick reference)

**Profile**
- `linkedin_get_my_profile` — get authenticated user's name, URN, headline, profile URL

**Posts**
- `linkedin_create_text_post` — publish a text post
- `linkedin_create_image_post` — publish a post with an image (JPG/PNG/GIF) from a local file path
- `linkedin_create_video_post` — publish a post with a video (MP4, 75KB-500MB) from a local file path
- `linkedin_create_article_post` — share an external URL with title and description
- `linkedin_reshare_post` — reshare an existing post by URN
- `linkedin_get_post` — get details of a post by URN
- `linkedin_get_my_posts` — list recent posts (supports pagination via `start`)
- `linkedin_delete_post` — permanently delete a post by URN

**Comments**
- `linkedin_get_comments` — get all comments on a post
- `linkedin_add_comment` — add a comment (or reply to a comment with `parentCommentUrn`)
- `linkedin_delete_comment` — delete a comment by ID

**Reactions**
- `linkedin_get_reactions` — get reactions on a post or comment
- `linkedin_add_reaction` — react to a post or comment
- `linkedin_delete_reaction` — remove a reaction

## Common workflows

### Publish a text post
```
linkedin_create_text_post(
  text: "Your post content here. #hashtag",
  visibility: "PUBLIC"  // PUBLIC | CONNECTIONS | LOGGED_IN
)
```

### Publish a post with an image
Ask the user for the absolute file path if not provided. The file must exist locally.
```
linkedin_create_image_post(
  text: "Caption for the image",
  imagePath: "C:/Users/jorge/Pictures/photo.jpg",
  altText: "Description of the image",
  visibility: "PUBLIC"
)
```

### Publish a post with a video
Video must be MP4, between 75KB and 500MB. Ask for the absolute path.
```
linkedin_create_video_post(
  text: "Caption for the video",
  videoPath: "C:/Users/jorge/Videos/demo.mp4",
  title: "Video title",
  visibility: "PUBLIC"
)
```

### Share an article/URL
```
linkedin_create_article_post(
  url: "https://example.com/article",
  title: "Article title",
  description: "Short description",
  text: "My commentary on this article",
  visibility: "PUBLIC"
)
```

### Add a comment
```
linkedin_add_comment(
  postUrn: "urn:li:share:XXXXXXXX",
  text: "Great post!",
  parentCommentUrn: "urn:li:comment:(urn:li:share:XXX,YYY)"  // optional, for replies
)
```

### React to a post
Reaction types: LIKE, PRAISE (Celebrate), EMPATHY (Love), INTEREST (Insightful), APPRECIATION (Support), ENTERTAINMENT (Funny)
```
linkedin_add_reaction(
  entityUrn: "urn:li:share:XXXXXXXX",
  reactionType: "LIKE"
)
```

### Post as an organization
Pass `authorUrn: "urn:li:organization:XXXXXXXX"` to any creation tool. The user must be admin of the org.

## Reference files

- **[tools-reference.md](references/tools-reference.md)** - complete parameter documentation for every tool. Load when you need exact parameter names, types, or constraints.
- **[post-best-practices.md](references/post-best-practices.md)** - guidelines for writing effective LinkedIn posts (hooks, structure, hashtags, length). Load when the user asks to write or improve a post.
