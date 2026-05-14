# LinkedIn MCP — Complete Tool Reference

## Profile

### linkedin_get_my_profile
Get the authenticated member's profile.

**Parameters:** none

**Returns:** `id`, `urn`, `firstName`, `lastName`, `headline`, `vanityName`, `profileUrl`

**Example:**
```
linkedin_get_my_profile()
// Returns: { id: "abc123", urn: "urn:li:person:abc123", firstName: "Jorge", ... }
```

---

## Posts

### linkedin_create_text_post
Publish a text post.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | string (1-3000 chars) | Yes | Post content. Supports #hashtags and @mentions |
| `visibility` | PUBLIC / CONNECTIONS / LOGGED_IN | No | Default: PUBLIC |
| `authorUrn` | string | No | Override author. Default: your person URN |

**Returns:** Post URN (e.g. `urn:li:share:XXXXXXXX`)

---

### linkedin_create_image_post
Publish a post with an image. Uploads the file first, then creates the post.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | string (1-3000 chars) | Yes | Post caption |
| `imagePath` | string | Yes | **Absolute** local path to JPG, PNG, or GIF |
| `altText` | string | No | Accessibility description |
| `visibility` | PUBLIC / CONNECTIONS / LOGGED_IN | No | Default: PUBLIC |
| `authorUrn` | string | No | Override author URN |

**Returns:** Post URN + Image URN

**Note:** The file must exist on disk. If the user gives a relative path, resolve it to absolute.

---

### linkedin_create_video_post
Publish a post with a video. Uploads in chunks, waits for processing, then creates the post.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | string (1-3000 chars) | Yes | Post caption |
| `videoPath` | string | Yes | **Absolute** local path to MP4 file |
| `title` | string | No | Video title |
| `visibility` | PUBLIC / CONNECTIONS / LOGGED_IN | No | Default: PUBLIC |
| `authorUrn` | string | No | Override author URN |

**Constraints:** MP4 only. Min 75KB, max 500MB. Duration: 3s to 30min.

**Note:** This tool polls until the video finishes processing (up to 2 min). Warn the user it may take a moment.

---

### linkedin_create_article_post
Share an external URL with metadata.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string (valid URL) | Yes | Article URL to share |
| `title` | string (1-200 chars) | Yes | Article title |
| `text` | string (max 3000) | No | Your commentary. Default: empty |
| `description` | string (max 500) | No | Short article description |
| `thumbnailPath` | string | No | Absolute local path to thumbnail image |
| `visibility` | PUBLIC / CONNECTIONS / LOGGED_IN | No | Default: PUBLIC |
| `authorUrn` | string | No | Override author URN |

**Returns:** Post URN

---

### linkedin_reshare_post
Reshare an existing post with optional commentary.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `parentPostUrn` | string | Yes | URN of the post to reshare |
| `text` | string (max 3000) | No | Your commentary. Default: empty |
| `visibility` | PUBLIC / CONNECTIONS / LOGGED_IN | No | Default: PUBLIC |
| `authorUrn` | string | No | Override author URN |

**Returns:** New post URN

---

### linkedin_get_post
Get the full details of a specific post.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `postUrn` | string | Yes | Post URN (urn:li:share:XXX or urn:li:ugcPost:XXX) |

**Returns:** Raw post object from LinkedIn API

---

### linkedin_get_my_posts
List recent posts from the authenticated user or a specific author.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `count` | integer (1-100) | No | Number of posts to fetch. Default: 10 |
| `start` | integer | No | Pagination offset. Default: 0 |
| `sortBy` | LAST_MODIFIED / CREATED | No | Default: LAST_MODIFIED |
| `authorUrn` | string | No | Fetch posts for a different author. Default: your URN |

**Note:** Due to LinkedIn API restrictions, this only works for your own posts or organizations where you are an admin.

---

### linkedin_delete_post
Permanently delete a post. This action cannot be undone.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `postUrn` | string | Yes | URN of the post to delete |

**Warn the user** before calling this — deletion is irreversible.

---

## Comments

### linkedin_get_comments
Get all comments on a post.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `postUrn` | string | Yes | URN of the post |

**Returns:** List of comment objects

---

### linkedin_add_comment
Add a comment to a post, or reply to an existing comment.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `postUrn` | string | Yes | URN of the post |
| `text` | string (1-1250 chars) | Yes | Comment text |
| `parentCommentUrn` | string | No | URN of comment to reply to (for nested replies) |
| `actorUrn` | string | No | Override actor URN. Default: your person URN |

**Returns:** Comment ID

---

### linkedin_delete_comment
Delete a comment from a post.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `postUrn` | string | Yes | URN of the post |
| `commentId` | string | Yes | ID of the comment to delete |
| `actorUrn` | string | No | Required when deleting as an organization |

---

## Reactions

### linkedin_get_reactions
Get all reactions on a post or comment.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `entityUrn` | string | Yes | URN of the post or comment |

**Returns:** List of reaction objects with actor info and reaction type

---

### linkedin_add_reaction
Add a reaction to a post or comment.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `entityUrn` | string | Yes | URN of the post or comment |
| `reactionType` | enum | No | Default: LIKE |
| `actorUrn` | string | No | Override actor URN. Default: your person URN |

**Reaction types:**
| Value | LinkedIn label |
|-------|---------------|
| LIKE | Like |
| PRAISE | Celebrate |
| EMPATHY | Love |
| INTEREST | Insightful |
| APPRECIATION | Support |
| ENTERTAINMENT | Funny |

---

### linkedin_delete_reaction
Remove a reaction from a post or comment.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `entityUrn` | string | Yes | URN of the post or comment |
| `actorUrn` | string | No | Override actor URN. Default: your person URN |
