---
name: x-mcp
description: >
  Use the X (Twitter) MCP server to interact with X on behalf of the authenticated user.
  Trigger this skill when the user wants to: publish a tweet, post on X or Twitter,
  search tweets, read timelines, like or retweet, bookmark a tweet, follow or unfollow
  someone, send a direct message (DM), manage lists, look up users or accounts,
  check trending topics, upload media to X, or interact with X Spaces.
  Examples: "post this on X", "tweet this", "search recent tweets about AI",
  "like this tweet", "retweet this", "send a DM to @user", "follow this account",
  "create a Twitter list", "what's trending on X", "upload this image and tweet it",
  "reply to this tweet", "get my followers", "block this user", "show my bookmarks",
  "search X for mentions of my brand", "post a poll on X".
---

# X MCP Skill

## Key principle: User IDs

X identifies users and tweets with **numeric string IDs**, not URNs.

| Entity | Example ID |
|--------|-----------|
| User | `"2244994945"` |
| Tweet | `"1460323737035677698"` |
| List | `"84839422"` |
| Space | `"1eaKbrAPkBqJX"` |

**Always call `x_get_me` first** when the user hasn't provided their user_id and the tool requires it (retweet, like, follow, DM, bookmark, etc.). This returns the authenticated user's `id`, `username`, and `name`.

## Authentication modes

- **User tokens (OAuth 2.0 PKCE)** — required for all write operations and private data: posting, liking, retweeting, following, DMs, bookmarks, blocks, mutes
- **Bearer Token (app-only)** — sufficient for reading public data: search, user lookup, tweet lookup, timelines. The server automatically uses user tokens when available, falling back to Bearer Token for public reads.

## Available tools (quick reference)

**Tweets**
- `x_get_tweet` — get a single tweet by ID
- `x_get_tweets` — get up to 100 tweets by comma-separated IDs
- `x_create_tweet` — post a tweet (text, reply, quote, poll, or with media)
- `x_delete_tweet` — delete a tweet you own
- `x_search_recent_tweets` — search tweets from the last 7 days with X operators
- `x_get_user_tweets` — get a user's tweet timeline (up to 3,200 most recent)
- `x_get_user_mentions` — get tweets mentioning a user
- `x_get_home_timeline` — get the auth user's reverse-chronological home feed
- `x_retweet` / `x_unretweet` — retweet or undo a retweet
- `x_get_retweets` — get users who retweeted a tweet
- `x_get_quote_tweets` — get quote tweets for a tweet
- `x_like_tweet` / `x_unlike_tweet` — like or unlike a tweet
- `x_get_liked_tweets` — tweets liked by a user
- `x_get_liking_users` — users who liked a tweet
- `x_bookmark_tweet` / `x_remove_bookmark` / `x_get_bookmarks` — manage bookmarks
- `x_hide_reply` — hide or unhide a reply to one of your tweets

**Users**
- `x_get_me` — get authenticated user's profile and ID
- `x_get_user_by_id` — look up a user by numeric ID
- `x_get_user_by_username` — look up a user by @handle (no @ symbol)
- `x_get_users_by_usernames` — look up multiple users at once
- `x_follow_user` / `x_unfollow_user` — follow or unfollow
- `x_get_followers` / `x_get_following` — follower and following lists
- `x_block_user` / `x_unblock_user` / `x_get_blocked_users` — block management
- `x_mute_user` / `x_unmute_user` / `x_get_muted_users` — mute management

**Direct Messages**
- `x_send_dm` — send a 1:1 DM (creates conversation if needed)
- `x_send_dm_to_conversation` — send to an existing conversation by ID
- `x_create_group_dm` — create a new group DM with multiple users
- `x_get_dm_events` — get all DM events across conversations (last 30 days)
- `x_get_dm_conversation` — get messages in a specific conversation
- `x_get_dm_conversation_with_user` — get 1:1 conversation with a specific user

**Lists**
- `x_create_list` / `x_update_list` / `x_delete_list` — manage lists
- `x_get_list` — get list details
- `x_get_list_tweets` — tweets from a list's timeline
- `x_get_user_lists` / `x_get_followed_lists` — lists owned or followed by a user
- `x_get_list_members` — members of a list
- `x_add_list_member` / `x_remove_list_member` — add or remove list members
- `x_follow_list` / `x_unfollow_list` — follow or unfollow a list

**Media**
- `x_upload_media` — upload image (JPEG/PNG/GIF/WEBP, max 5MB) or video (MP4/MOV, max 512MB). Returns a `media_id` to attach when creating a tweet.

**Spaces**
- `x_search_spaces` — find live or scheduled Spaces by keyword
- `x_get_space` / `x_get_spaces` — get Space details
- `x_get_space_tweets` — tweets shared in a Space
- `x_get_user_spaces` — Spaces hosted by a user

**Trends**
- `x_get_personalized_trends` — trending topics personalized for the auth user
- `x_get_trends_by_location` — trends by WOEID (1 = worldwide)
- `x_get_tweet_counts` — tweet volume for a query over time

## Common workflows

### Post a text tweet
```
x_create_tweet(
  text: "Your tweet here. #hashtag"
)
```

### Reply to a tweet
```
x_create_tweet(
  text: "@username great point!",
  reply_to_tweet_id: "1460323737035677698"
)
```

### Quote tweet
```
x_create_tweet(
  text: "My commentary on this",
  quote_tweet_id: "1460323737035677698"
)
```

### Post a poll
```
x_create_tweet(
  text: "Which do you prefer?",
  poll_options: "Option A,Option B,Option C",
  poll_duration_minutes: 1440   // 24 hours
)
```

### Tweet with an image
First upload the image, then use the returned media_id:
```
// Step 1
x_upload_media(
  file_path: "C:/Users/jorge/Pictures/photo.jpg",
  media_type: "image/jpeg",
  media_category: "tweet_image",
  alt_text: "Description of the image"
)
// Returns: media_id: "1234567890"

// Step 2
x_create_tweet(
  text: "Caption for my photo",
  media_ids: "1234567890"
)
```

### Tweet with a video
```
// Step 1
x_upload_media(
  file_path: "C:/Users/jorge/Videos/clip.mp4",
  media_type: "video/mp4",
  media_category: "tweet_video"
)
// Chunked upload + processing poll — may take up to 90s

// Step 2
x_create_tweet(
  text: "Check out this video",
  media_ids: "<media_id from step 1>"
)
```

### Get your profile and user ID
```
x_get_me()
// Returns id, username, name, description, public_metrics, etc.
```

### Search tweets with operators
```
x_search_recent_tweets(
  query: "artificial intelligence lang:es -is:retweet has:images",
  max_results: 20,
  sort_order: "recency"
)
```
Key operators: `from:user`, `to:user`, `#hashtag`, `"exact phrase"`, `-exclude`,
`is:retweet`, `is:reply`, `is:quote`, `has:media`, `has:images`, `has:video_link`,
`lang:en`, `url:domain`, `conversation_id:ID`

### Like, retweet, follow
Always get your `user_id` first with `x_get_me()`:
```
x_like_tweet(user_id: "your_id", tweet_id: "tweet_id")
x_retweet(user_id: "your_id", tweet_id: "tweet_id")
x_follow_user(user_id: "your_id", target_user_id: "target_id")
```

### Send a DM
```
// Get target user ID first if you only have their username
x_get_user_by_username(username: "johndoe")
// Then send
x_send_dm(
  participant_id: "target_user_id",
  text: "Hey, wanted to connect!"
)
```

### Create and populate a list
```
// 1. Create
x_create_list(name: "AI Researchers", description: "Top AI researchers", private: false)
// Returns list_id

// 2. Add members
x_add_list_member(list_id: "...", user_id: "...")
```

### Get trends
```
x_get_trends_by_location(woeid: 1)         // worldwide
x_get_trends_by_location(woeid: 23424977)  // United States
x_get_trends_by_location(woeid: 44418)     // London
x_get_personalized_trends()                // personalized (needs user token)
```

## Rate limit awareness

X API has strict rate limits. If you get a 429 error, tell the user to wait before retrying. Common limits:
- Creating tweets: 100/user per 15 min
- Liking: 200/user per 24h
- Following: 50/user per 15 min
- Searching: 300–450/app per 15 min

## Reference files

- **[tools-reference.md](references/tools-reference.md)** — complete parameter documentation for every tool. Load when you need exact parameter names, types, or constraints.
- **[tweet-best-practices.md](references/tweet-best-practices.md)** — guidelines for writing effective tweets (hooks, formats, threads, engagement). Load when the user asks to write, improve, or draft a tweet.
