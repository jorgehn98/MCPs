# X MCP — Complete Tool Reference

## Tweets

### x_get_tweet
Get a single tweet by ID with metrics and author info.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tweet_id` | string | Yes | The tweet ID to retrieve |
| `include_author` | boolean | No | Include author user info. Default: true |

**Returns:** Tweet object with `id`, `text`, `author_id`, `created_at`, `public_metrics`, `referenced_tweets`, `attachments`, `lang`, `reply_settings`, and optionally expanded author user object.

---

### x_get_tweets
Get multiple tweets by their IDs in a single request.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tweet_ids` | string | Yes | Comma-separated tweet IDs (up to 100) |

**Returns:** Array of tweet objects with full metrics and author expansions.

---

### x_create_tweet
Create a new tweet. Returns the new tweet's ID and text.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | string (max 280 chars) | No* | Tweet text. *Required unless attaching media |
| `reply_to_tweet_id` | string | No | Tweet ID to reply to |
| `quote_tweet_id` | string | No | Tweet ID to quote |
| `media_ids` | string | No | Comma-separated media IDs (1-4 images or 1 video/GIF). Upload with `x_upload_media` first |
| `poll_options` | string | No | Comma-separated choices (2-4, max 25 chars each). Example: `"Yes,No,Maybe"` |
| `poll_duration_minutes` | integer (5-10080) | No | Poll duration. Default: 1440 (24h). Max: 10080 (7 days) |
| `reply_settings` | enum | No | Who can reply: `everyone` (default), `mentionedUsers`, `subscribers` |
| `for_super_followers_only` | boolean | No | Restrict to Super Followers. Default: false |

**Note:** `media_ids` and `poll_options` are mutually exclusive — you can't attach media and a poll to the same tweet.

---

### x_delete_tweet
Delete a tweet you own. Irreversible — warn the user first.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tweet_id` | string | Yes | The tweet ID to delete |

**Returns:** `{ deleted: true }` on success.

---

### x_search_recent_tweets
Search tweets from the last 7 days.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string (1-4096 chars) | Yes | Search query with X operators |
| `max_results` | integer (10-100) | No | Results per page. Default: 10 |
| `sort_order` | `recency` / `relevancy` | No | Default: `recency` |
| `next_token` | string | No | Pagination token from previous response |
| `start_time` | string (ISO 8601) | No | Earliest tweet time |
| `end_time` | string (ISO 8601) | No | Latest tweet time |

**Key search operators:**
| Operator | Example | Meaning |
|----------|---------|---------|
| `from:` | `from:elonmusk` | Tweets by this user |
| `to:` | `to:NASA` | Replies to this user |
| `#` | `#AI` | Hashtag |
| `"..."` | `"machine learning"` | Exact phrase |
| `-` | `-is:retweet` | Exclude |
| `is:retweet` | | Only retweets |
| `is:reply` | | Only replies |
| `is:quote` | | Only quote tweets |
| `has:media` | | Has any media |
| `has:images` | | Has images |
| `has:video_link` | | Has video |
| `lang:` | `lang:es` | Language code |
| `url:` | `url:github.com` | Contains URL |
| `conversation_id:` | | Part of thread |

---

### x_get_user_tweets
Get a user's tweet timeline (up to 3,200 most recent).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | The user ID whose tweets to fetch |
| `max_results` | integer (5-100) | No | Per page. Default: 10 |
| `exclude` | string | No | `"retweets"`, `"replies"`, or `"retweets,replies"` |
| `pagination_token` | string | No | Next page token |
| `start_time` | string (ISO 8601) | No | Earliest tweet time |
| `end_time` | string (ISO 8601) | No | Latest tweet time |

---

### x_get_user_mentions
Get tweets that mention a user (up to 800 most recent).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | The user ID whose mentions to fetch |
| `max_results` | integer (5-100) | No | Per page. Default: 10 |
| `pagination_token` | string | No | Next page token |
| `start_time` | string (ISO 8601) | No | |
| `end_time` | string (ISO 8601) | No | |

---

### x_get_home_timeline
Get the authenticated user's reverse-chronological home timeline (tweets from followed accounts).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | Your user ID (from `x_get_me`) |
| `max_results` | integer (1-100) | No | Per page. Default: 20 |
| `exclude` | string | No | `"retweets"`, `"replies"`, or both |
| `pagination_token` | string | No | Next page token |

**Note:** Requires user token (OAuth 2.0 PKCE) — Bearer Token is not supported.

---

### x_retweet
Retweet a tweet.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | Your user ID |
| `tweet_id` | string | Yes | The tweet to retweet |

---

### x_unretweet
Undo a retweet.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | Your user ID |
| `tweet_id` | string | Yes | The tweet to unretweet |

---

### x_get_retweets
Get users who retweeted a tweet (up to 100).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tweet_id` | string | Yes | The tweet ID |
| `max_results` | integer (1-100) | No | Default: 100 |
| `pagination_token` | string | No | |

---

### x_get_quote_tweets
Get tweets that quote a specific tweet.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tweet_id` | string | Yes | The tweet being quoted |
| `max_results` | integer (1-100) | No | Default: 10 |
| `pagination_token` | string | No | |
| `exclude` | string | No | `"retweets,replies"` |

---

### x_like_tweet
Like a tweet.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | Your user ID |
| `tweet_id` | string | Yes | The tweet to like |

**Note:** Limited to 200 likes per 24h per user.

---

### x_unlike_tweet
Remove a like from a tweet.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | Your user ID |
| `tweet_id` | string | Yes | The tweet to unlike |

---

### x_get_liked_tweets
Get tweets liked by a user.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | The user ID |
| `max_results` | integer (1-100) | No | Default: 10 |
| `pagination_token` | string | No | |

---

### x_get_liking_users
Get users who liked a tweet.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tweet_id` | string | Yes | The tweet ID |
| `max_results` | integer (1-100) | No | Default: 100 |
| `pagination_token` | string | No | |

---

### x_bookmark_tweet
Bookmark a tweet. Requires `bookmark.write` scope.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | Your user ID |
| `tweet_id` | string | Yes | The tweet to bookmark |

---

### x_remove_bookmark
Remove a bookmarked tweet.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | Your user ID |
| `tweet_id` | string | Yes | The tweet to unbookmark |

---

### x_get_bookmarks
Get the authenticated user's bookmarks. Requires `bookmark.read` scope.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | Your user ID |
| `max_results` | integer (1-100) | No | Default: 10 |
| `pagination_token` | string | No | |

---

### x_hide_reply
Hide or unhide a reply to one of your tweets.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tweet_id` | string | Yes | The reply tweet ID |
| `hidden` | boolean | Yes | `true` to hide, `false` to unhide |

**Note:** Only the original tweet's author can hide replies.

---

## Users

### x_get_me
Get the authenticated user's full profile. Use this to get your `user_id`.

**Parameters:** none

**Returns:** `id`, `name`, `username`, `description`, `location`, `profile_image_url`, `public_metrics` (followers_count, following_count, tweet_count, listed_count), `created_at`, `verified`

---

### x_get_user_by_id
Look up a user by their numeric ID.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | The X user ID |

---

### x_get_user_by_username
Look up a user by their @handle. Do not include the `@` symbol.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `username` | string | Yes | Handle without `@`. Example: `"elonmusk"` |

---

### x_get_users_by_usernames
Look up multiple users by usernames in one request (up to 100).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `usernames` | string | Yes | Comma-separated handles without `@`. Example: `"elonmusk,jack"` |

---

### x_follow_user
Follow a user.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | Your user ID |
| `target_user_id` | string | Yes | The user to follow |

**Returns:** `{ following: true }` or `{ pending_follow: true }` if account is protected.

---

### x_unfollow_user
Unfollow a user.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | Your user ID |
| `target_user_id` | string | Yes | The user to unfollow |

---

### x_get_followers
Get a user's followers list.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | The user ID |
| `max_results` | integer (1-1000) | No | Per page. Default: 100 |
| `pagination_token` | string | No | |

---

### x_get_following
Get users that a user is following.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | The user ID |
| `max_results` | integer (1-1000) | No | Per page. Default: 100 |
| `pagination_token` | string | No | |

---

### x_block_user / x_unblock_user
Block or unblock a user.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | Your user ID |
| `target_user_id` | string | Yes | The user to block/unblock |

---

### x_get_blocked_users
Get users blocked by the authenticated user.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | Your user ID |
| `max_results` | integer (1-1000) | No | Default: 100 |
| `pagination_token` | string | No | |

---

### x_mute_user / x_unmute_user
Mute or unmute a user.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | Your user ID |
| `target_user_id` | string | Yes | The user to mute/unmute |

---

### x_get_muted_users
Get users muted by the authenticated user.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | Your user ID |
| `max_results` | integer (1-1000) | No | Default: 100 |
| `pagination_token` | string | No | |

---

## Direct Messages

> All DM tools require user tokens (OAuth 2.0 PKCE) — Bearer Token not supported.

### x_send_dm
Send a 1:1 DM. Creates a conversation automatically if one doesn't exist yet.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `participant_id` | string | Yes | The recipient's user ID |
| `text` | string (1-10000 chars) | Yes | Message text |
| `media_id` | string | No | Media ID to attach (1 attachment max) |

**Returns:** `dm_conversation_id` and `dm_event_id`

---

### x_send_dm_to_conversation
Send a message to an existing DM conversation.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `conversation_id` | string | Yes | The DM conversation ID |
| `text` | string (1-10000 chars) | Yes | Message text |
| `media_id` | string | No | Media ID to attach |

---

### x_create_group_dm
Create a new group DM with multiple participants.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `participant_ids` | string | Yes | Comma-separated user IDs (min 2) |
| `text` | string (1-10000 chars) | Yes | Initial message |

---

### x_get_dm_events
Get DM events across all conversations (last 30 days).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `max_results` | integer (1-100) | No | Default: 25 |
| `pagination_token` | string | No | |
| `event_types` | string | No | Filter: `"MessageCreate"`, `"ParticipantsJoin"`, `"ParticipantsLeave"` (comma-separated) |

---

### x_get_dm_conversation
Get messages in a specific conversation by its ID.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `conversation_id` | string | Yes | The DM conversation ID |
| `max_results` | integer (1-100) | No | Default: 25 |
| `pagination_token` | string | No | |

---

### x_get_dm_conversation_with_user
Get the 1:1 conversation with a specific user, identified by their user ID.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `participant_id` | string | Yes | The other user's ID |
| `max_results` | integer (1-100) | No | Default: 25 |
| `pagination_token` | string | No | |

---

## Lists

### x_create_list
Create a new X List.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string (1-25 chars) | Yes | List name |
| `description` | string (max 100) | No | List description |
| `private` | boolean | No | Default: false (public) |

**Returns:** `{ id: "list_id", name: "List name" }`

---

### x_get_list
Get details about a specific list.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `list_id` | string | Yes | The list ID |

**Returns:** `id`, `name`, `owner_id`, `description`, `private`, `created_at`, `follower_count`, `member_count`

---

### x_update_list
Update a list's metadata.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `list_id` | string | Yes | The list ID |
| `name` | string (1-25 chars) | No | New name |
| `description` | string (max 100) | No | New description |
| `private` | boolean | No | Change privacy |

At least one optional field required.

---

### x_delete_list
Delete a list. Irreversible — warn the user first.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `list_id` | string | Yes | The list ID to delete |

---

### x_get_list_tweets
Get tweets from a list's timeline.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `list_id` | string | Yes | The list ID |
| `max_results` | integer (1-100) | No | Default: 20 |
| `pagination_token` | string | No | |

---

### x_get_user_lists
Get lists owned by a user.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | The user ID |
| `max_results` | integer (1-100) | No | Default: 10 |
| `pagination_token` | string | No | |

---

### x_get_followed_lists
Get lists followed by a user.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | The user ID |
| `max_results` | integer (1-100) | No | Default: 10 |
| `pagination_token` | string | No | |

---

### x_get_list_members
Get members of a list.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `list_id` | string | Yes | The list ID |
| `max_results` | integer (1-100) | No | Default: 50 |
| `pagination_token` | string | No | |

---

### x_add_list_member / x_remove_list_member
Add or remove a member from a list you own.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `list_id` | string | Yes | Your list ID |
| `user_id` | string | Yes | The user to add/remove |

---

### x_follow_list / x_unfollow_list
Follow or unfollow a list.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | Your user ID |
| `list_id` | string | Yes | The list to follow/unfollow |

---

## Media

### x_upload_media
Upload a media file. Returns a `media_id` to attach to tweets via `x_create_tweet`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file_path` | string | Yes | **Absolute** local path to the media file |
| `media_type` | string | Yes | MIME type: `"image/jpeg"`, `"image/png"`, `"image/gif"`, `"image/webp"`, `"video/mp4"`, `"video/quicktime"` |
| `media_category` | enum | No | `tweet_image` (default), `tweet_gif`, `tweet_video` |
| `alt_text` | string (max 1000) | No | Accessibility alt text (images only, recommended) |

**Size limits:**
| Category | Max size |
|----------|---------|
| tweet_image | 5 MB |
| tweet_gif | 15 MB |
| tweet_video | 512 MB |

**Note:** Videos are uploaded in chunks and polled until processing completes (up to 90s). Warn the user this may take a moment.

**Returns:** `media_id` string — pass this to `x_create_tweet` as `media_ids`

---

## Spaces

### x_search_spaces
Search for live or scheduled Spaces.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search keyword |
| `state` | `live` / `scheduled` / `all` | No | Default: `live` |
| `max_results` | integer (1-100) | No | Default: 10 |

---

### x_get_space
Get details about a specific Space.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `space_id` | string | Yes | The Space ID |

**Returns:** `id`, `title`, `state`, `host_ids`, `creator_id`, `participant_count`, `is_ticketed`, `started_at`, `scheduled_start`, `lang`

---

### x_get_spaces
Get multiple Spaces by IDs.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `space_ids` | string | Yes | Comma-separated Space IDs (up to 100) |

---

### x_get_space_tweets
Get tweets shared in a Space.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `space_id` | string | Yes | The Space ID |
| `max_results` | integer (1-100) | No | Default: 10 |

---

### x_get_user_spaces
Get Spaces created or hosted by a user.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | The user ID |

---

## Trends

### x_get_personalized_trends
Get trending topics personalized for the authenticated user.

**Parameters:** none

**Returns:** Array of trend objects with `name` and `tweet_volume`. Requires user token.

---

### x_get_trends_by_location
Get trending topics for a location.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `woeid` | integer | Yes | Where On Earth ID. `1` = worldwide. `23424977` = US. `44418` = London. `615702` = Paris. `2911298` = Berlin. `1105779` = Madrid. `20070458` = Barcelona |

**Returns:** Up to 50 trending topics for the location.

---

### x_get_tweet_counts
Get volume counts for tweets matching a query over time.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query with X operators |
| `granularity` | `minute` / `hour` / `day` | No | Default: `day` |
| `start_time` | string (ISO 8601) | No | Max 7 days ago for recent |
| `end_time` | string (ISO 8601) | No | |
| `archive` | boolean | No | `true` for full-archive (requires higher API tier). Default: false |

**Returns:** Array of `{ start, end, tweet_count }` buckets.
