import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { userRequest, appRequest, handleApiError, TWEET_FIELDS, USER_FIELDS, TWEET_EXPANSIONS } from '../client.js';
import type { XApiResponse, XTweet, XUser } from '../types/x.js';

export function registerTweetTools(server: McpServer) {

  // ── Get Tweet ───────────────────────────────────────────────────────────────
  server.tool(
    'x_get_tweet',
    'Get a single tweet by its ID with full metrics and author info.',
    {
      tweet_id: z.string().describe('The tweet ID to retrieve'),
      include_author: z.boolean().default(true).describe('Include author user information in response'),
    },
    async ({ tweet_id, include_author }) => {
      try {
        const params: Record<string, unknown> = {
          'tweet.fields': TWEET_FIELDS,
        };
        if (include_author) {
          params['expansions'] = 'author_id';
          params['user.fields'] = USER_FIELDS;
        }
        const data = await appRequest<XApiResponse<XTweet>>('GET', `/tweets/${tweet_id}`, undefined, params);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Get Multiple Tweets ─────────────────────────────────────────────────────
  server.tool(
    'x_get_tweets',
    'Get multiple tweets by their IDs (up to 100 at once).',
    {
      tweet_ids: z.string().describe('Comma-separated tweet IDs (up to 100)'),
    },
    async ({ tweet_ids }) => {
      try {
        const data = await appRequest<XApiResponse<XTweet[]>>('GET', '/tweets', undefined, {
          ids: tweet_ids,
          'tweet.fields': TWEET_FIELDS,
          'expansions': TWEET_EXPANSIONS,
          'user.fields': USER_FIELDS,
        });
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Create Tweet ────────────────────────────────────────────────────────────
  server.tool(
    'x_create_tweet',
    'Create a new tweet. Supports text, replies, quote tweets, polls, and media attachments. Returns the new tweet ID.',
    {
      text: z.string().max(280).optional().describe('Tweet text (max 280 chars). Required unless attaching media.'),
      reply_to_tweet_id: z.string().optional().describe('Tweet ID to reply to'),
      quote_tweet_id: z.string().optional().describe('Tweet ID to quote'),
      media_ids: z.string().optional().describe('Comma-separated media IDs to attach (1-4 images or 1 video/GIF). Upload with x_upload_media first.'),
      poll_options: z.string().optional().describe('Comma-separated poll choices (2-4, max 25 chars each). Example: "Yes,No,Maybe"'),
      poll_duration_minutes: z.number().int().min(5).max(10080).optional().describe('Poll duration in minutes (5 to 10080 = 7 days)'),
      reply_settings: z.enum(['everyone', 'mentionedUsers', 'subscribers']).optional().describe('Who can reply: everyone (default), mentionedUsers, or subscribers'),
      for_super_followers_only: z.boolean().optional().describe('Restrict to Super Followers only'),
    },
    async ({ text, reply_to_tweet_id, quote_tweet_id, media_ids, poll_options, poll_duration_minutes, reply_settings, for_super_followers_only }) => {
      try {
        const body: Record<string, unknown> = {};

        if (text) body['text'] = text;
        if (reply_to_tweet_id) body['reply'] = { in_reply_to_tweet_id: reply_to_tweet_id };
        if (quote_tweet_id) body['quote_tweet_id'] = quote_tweet_id;
        if (reply_settings) body['reply_settings'] = reply_settings;
        if (for_super_followers_only) body['for_super_followers_only'] = for_super_followers_only;

        if (media_ids) {
          body['media'] = { media_ids: media_ids.split(',').map(id => id.trim()) };
        }

        if (poll_options) {
          const options = poll_options.split(',').map(o => o.trim());
          if (options.length < 2 || options.length > 4) {
            return { content: [{ type: 'text', text: 'Error: poll_options must have 2-4 choices.' }], isError: true };
          }
          body['poll'] = {
            options: options.map(label => ({ label })),
            duration_minutes: poll_duration_minutes ?? 1440,
          };
        }

        const data = await userRequest<{ data: { id: string; text: string } }>('POST', '/tweets', body);
        return {
          content: [{
            type: 'text',
            text: `✅ Tweet posted!\nID: ${data.data.id}\nText: ${data.data.text}`,
          }],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Delete Tweet ────────────────────────────────────────────────────────────
  server.tool(
    'x_delete_tweet',
    'Delete a tweet by its ID. Only works for tweets owned by the authenticated user.',
    {
      tweet_id: z.string().describe('The tweet ID to delete'),
    },
    async ({ tweet_id }) => {
      try {
        const data = await userRequest<{ data: { deleted: boolean } }>('DELETE', `/tweets/${tweet_id}`);
        if (data.data.deleted) {
          return { content: [{ type: 'text', text: `✅ Tweet ${tweet_id} deleted successfully.` }] };
        }
        return { content: [{ type: 'text', text: `Tweet ${tweet_id} could not be deleted.` }], isError: true };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Search Recent Tweets ────────────────────────────────────────────────────
  server.tool(
    'x_search_recent_tweets',
    'Search tweets from the last 7 days using X search operators. Supports operators: from:user, to:user, #hashtag, "exact phrase", -exclude, is:retweet, is:reply, has:media, has:images, has:video_link, lang:en, url:domain.',
    {
      query: z.string().min(1).max(4096).describe('Search query with X operators. Example: "from:elonmusk lang:en -is:retweet"'),
      max_results: z.number().int().min(10).max(100).default(10).describe('Results per page (10-100)'),
      sort_order: z.enum(['recency', 'relevancy']).default('recency').describe('Sort by recency or relevancy'),
      next_token: z.string().optional().describe('Pagination token from previous response for next page'),
      start_time: z.string().optional().describe('ISO 8601 start time. Example: 2024-01-01T00:00:00Z'),
      end_time: z.string().optional().describe('ISO 8601 end time'),
    },
    async ({ query, max_results, sort_order, next_token, start_time, end_time }) => {
      try {
        const params: Record<string, unknown> = {
          query,
          max_results,
          sort_order,
          'tweet.fields': TWEET_FIELDS,
          'expansions': TWEET_EXPANSIONS,
          'user.fields': USER_FIELDS,
        };
        if (next_token) params['next_token'] = next_token;
        if (start_time) params['start_time'] = start_time;
        if (end_time) params['end_time'] = end_time;

        const data = await appRequest<XApiResponse<XTweet[]>>('GET', '/tweets/search/recent', undefined, params);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Get User Tweets ─────────────────────────────────────────────────────────
  server.tool(
    'x_get_user_tweets',
    'Get tweets posted by a user (up to 3,200 most recent). Returns paginated timeline.',
    {
      user_id: z.string().describe('The user ID whose tweets to fetch'),
      max_results: z.number().int().min(5).max(100).default(10).describe('Tweets per page (5-100)'),
      exclude: z.string().optional().describe('Comma-separated exclusions: "retweets,replies"'),
      pagination_token: z.string().optional().describe('Token from previous response for next page'),
      start_time: z.string().optional().describe('ISO 8601 start time'),
      end_time: z.string().optional().describe('ISO 8601 end time'),
    },
    async ({ user_id, max_results, exclude, pagination_token, start_time, end_time }) => {
      try {
        const params: Record<string, unknown> = {
          max_results,
          'tweet.fields': TWEET_FIELDS,
          'expansions': 'referenced_tweets.id,attachments.media_keys',
          'user.fields': USER_FIELDS,
        };
        if (exclude) params['exclude'] = exclude;
        if (pagination_token) params['pagination_token'] = pagination_token;
        if (start_time) params['start_time'] = start_time;
        if (end_time) params['end_time'] = end_time;

        const data = await appRequest<XApiResponse<XTweet[]>>('GET', `/users/${user_id}/tweets`, undefined, params);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Get User Mentions ───────────────────────────────────────────────────────
  server.tool(
    'x_get_user_mentions',
    'Get tweets mentioning a specific user (up to 800 most recent).',
    {
      user_id: z.string().describe('The user ID whose mentions to fetch'),
      max_results: z.number().int().min(5).max(100).default(10).describe('Results per page (5-100)'),
      pagination_token: z.string().optional().describe('Token from previous response for next page'),
      start_time: z.string().optional().describe('ISO 8601 start time'),
      end_time: z.string().optional().describe('ISO 8601 end time'),
    },
    async ({ user_id, max_results, pagination_token, start_time, end_time }) => {
      try {
        const params: Record<string, unknown> = {
          max_results,
          'tweet.fields': TWEET_FIELDS,
          'expansions': TWEET_EXPANSIONS,
          'user.fields': USER_FIELDS,
        };
        if (pagination_token) params['pagination_token'] = pagination_token;
        if (start_time) params['start_time'] = start_time;
        if (end_time) params['end_time'] = end_time;

        const data = await appRequest<XApiResponse<XTweet[]>>('GET', `/users/${user_id}/mentions`, undefined, params);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Get Home Timeline ───────────────────────────────────────────────────────
  server.tool(
    'x_get_home_timeline',
    'Get the reverse-chronological home timeline for the authenticated user (tweets from accounts they follow).',
    {
      user_id: z.string().describe('The authenticated user ID (get it with x_get_me)'),
      max_results: z.number().int().min(1).max(100).default(20).describe('Results per page (1-100)'),
      exclude: z.string().optional().describe('Comma-separated exclusions: "retweets,replies"'),
      pagination_token: z.string().optional().describe('Token from previous response for next page'),
    },
    async ({ user_id, max_results, exclude, pagination_token }) => {
      try {
        const params: Record<string, unknown> = {
          max_results,
          'tweet.fields': TWEET_FIELDS,
          'expansions': TWEET_EXPANSIONS,
          'user.fields': USER_FIELDS,
        };
        if (exclude) params['exclude'] = exclude;
        if (pagination_token) params['pagination_token'] = pagination_token;

        const data = await userRequest<XApiResponse<XTweet[]>>('GET', `/users/${user_id}/timelines/reverse_chronological`, undefined, params);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Retweet ─────────────────────────────────────────────────────────────────
  server.tool(
    'x_retweet',
    'Retweet a tweet on behalf of the authenticated user.',
    {
      user_id: z.string().describe('Your user ID (get it with x_get_me)'),
      tweet_id: z.string().describe('The tweet ID to retweet'),
    },
    async ({ user_id, tweet_id }) => {
      try {
        const data = await userRequest<{ data: { retweeted: boolean } }>('POST', `/users/${user_id}/retweets`, { tweet_id });
        if (data.data.retweeted) {
          return { content: [{ type: 'text', text: `✅ Tweet ${tweet_id} retweeted successfully.` }] };
        }
        return { content: [{ type: 'text', text: 'Could not retweet — already retweeted or not found.' }], isError: true };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Unretweet ───────────────────────────────────────────────────────────────
  server.tool(
    'x_unretweet',
    'Undo a retweet on behalf of the authenticated user.',
    {
      user_id: z.string().describe('Your user ID (get it with x_get_me)'),
      tweet_id: z.string().describe('The tweet ID to unretweet'),
    },
    async ({ user_id, tweet_id }) => {
      try {
        const data = await userRequest<{ data: { retweeted: boolean } }>('DELETE', `/users/${user_id}/retweets/${tweet_id}`);
        if (!data.data.retweeted) {
          return { content: [{ type: 'text', text: `✅ Retweet of tweet ${tweet_id} undone.` }] };
        }
        return { content: [{ type: 'text', text: 'Could not unretweet.' }], isError: true };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Get Retweets ────────────────────────────────────────────────────────────
  server.tool(
    'x_get_retweets',
    'Get users who retweeted a tweet (up to 100).',
    {
      tweet_id: z.string().describe('The tweet ID to get retweets for'),
      max_results: z.number().int().min(1).max(100).default(100).describe('Max users to return'),
      pagination_token: z.string().optional().describe('Pagination token'),
    },
    async ({ tweet_id, max_results, pagination_token }) => {
      try {
        const params: Record<string, unknown> = {
          max_results,
          'user.fields': USER_FIELDS,
          'expansions': 'pinned_tweet_id',
          'tweet.fields': TWEET_FIELDS,
        };
        if (pagination_token) params['pagination_token'] = pagination_token;

        const data = await appRequest<XApiResponse<XUser[]>>('GET', `/tweets/${tweet_id}/retweeted_by`, undefined, params);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Get Quote Tweets ────────────────────────────────────────────────────────
  server.tool(
    'x_get_quote_tweets',
    'Get tweets that quote a specific tweet.',
    {
      tweet_id: z.string().describe('The tweet ID to get quote tweets for'),
      max_results: z.number().int().min(1).max(100).default(10).describe('Max results per page'),
      pagination_token: z.string().optional().describe('Pagination token'),
      exclude: z.string().optional().describe('Exclusions: "retweets,replies"'),
    },
    async ({ tweet_id, max_results, pagination_token, exclude }) => {
      try {
        const params: Record<string, unknown> = {
          max_results,
          'tweet.fields': TWEET_FIELDS,
          'expansions': TWEET_EXPANSIONS,
          'user.fields': USER_FIELDS,
        };
        if (pagination_token) params['pagination_token'] = pagination_token;
        if (exclude) params['exclude'] = exclude;

        const data = await appRequest<XApiResponse<XTweet[]>>('GET', `/tweets/${tweet_id}/quote_tweets`, undefined, params);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Like Tweet ──────────────────────────────────────────────────────────────
  server.tool(
    'x_like_tweet',
    'Like a tweet on behalf of the authenticated user.',
    {
      user_id: z.string().describe('Your user ID (get it with x_get_me)'),
      tweet_id: z.string().describe('The tweet ID to like'),
    },
    async ({ user_id, tweet_id }) => {
      try {
        const data = await userRequest<{ data: { liked: boolean } }>('POST', `/users/${user_id}/likes`, { tweet_id });
        if (data.data.liked) {
          return { content: [{ type: 'text', text: `✅ Tweet ${tweet_id} liked.` }] };
        }
        return { content: [{ type: 'text', text: 'Tweet was not liked — possibly already liked.' }], isError: true };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Unlike Tweet ────────────────────────────────────────────────────────────
  server.tool(
    'x_unlike_tweet',
    'Remove a like from a tweet on behalf of the authenticated user.',
    {
      user_id: z.string().describe('Your user ID (get it with x_get_me)'),
      tweet_id: z.string().describe('The tweet ID to unlike'),
    },
    async ({ user_id, tweet_id }) => {
      try {
        const data = await userRequest<{ data: { liked: boolean } }>('DELETE', `/users/${user_id}/likes/${tweet_id}`);
        if (!data.data.liked) {
          return { content: [{ type: 'text', text: `✅ Like removed from tweet ${tweet_id}.` }] };
        }
        return { content: [{ type: 'text', text: 'Could not remove like.' }], isError: true };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Get Liked Tweets ────────────────────────────────────────────────────────
  server.tool(
    'x_get_liked_tweets',
    'Get tweets liked by a user.',
    {
      user_id: z.string().describe('The user ID whose liked tweets to fetch'),
      max_results: z.number().int().min(1).max(100).default(10).describe('Results per page (1-100)'),
      pagination_token: z.string().optional().describe('Pagination token'),
    },
    async ({ user_id, max_results, pagination_token }) => {
      try {
        const params: Record<string, unknown> = {
          max_results,
          'tweet.fields': TWEET_FIELDS,
          'expansions': TWEET_EXPANSIONS,
          'user.fields': USER_FIELDS,
        };
        if (pagination_token) params['pagination_token'] = pagination_token;

        const data = await appRequest<XApiResponse<XTweet[]>>('GET', `/users/${user_id}/liked_tweets`, undefined, params);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Get Liking Users ────────────────────────────────────────────────────────
  server.tool(
    'x_get_liking_users',
    'Get users who liked a specific tweet.',
    {
      tweet_id: z.string().describe('The tweet ID to get liking users for'),
      max_results: z.number().int().min(1).max(100).default(100).describe('Max users to return'),
      pagination_token: z.string().optional().describe('Pagination token'),
    },
    async ({ tweet_id, max_results, pagination_token }) => {
      try {
        const params: Record<string, unknown> = {
          max_results,
          'user.fields': USER_FIELDS,
        };
        if (pagination_token) params['pagination_token'] = pagination_token;

        const data = await appRequest<XApiResponse<XUser[]>>('GET', `/tweets/${tweet_id}/liking_users`, undefined, params);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Bookmark Tweet ──────────────────────────────────────────────────────────
  server.tool(
    'x_bookmark_tweet',
    'Bookmark a tweet for the authenticated user. Requires OAuth 2.0 PKCE with bookmark.write scope.',
    {
      user_id: z.string().describe('Your user ID (get it with x_get_me)'),
      tweet_id: z.string().describe('The tweet ID to bookmark'),
    },
    async ({ user_id, tweet_id }) => {
      try {
        const data = await userRequest<{ data: { bookmarked: boolean } }>('POST', `/users/${user_id}/bookmarks`, { tweet_id });
        if (data.data.bookmarked) {
          return { content: [{ type: 'text', text: `✅ Tweet ${tweet_id} bookmarked.` }] };
        }
        return { content: [{ type: 'text', text: 'Could not bookmark tweet.' }], isError: true };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Remove Bookmark ─────────────────────────────────────────────────────────
  server.tool(
    'x_remove_bookmark',
    'Remove a bookmarked tweet for the authenticated user.',
    {
      user_id: z.string().describe('Your user ID (get it with x_get_me)'),
      tweet_id: z.string().describe('The tweet ID to remove from bookmarks'),
    },
    async ({ user_id, tweet_id }) => {
      try {
        const data = await userRequest<{ data: { bookmarked: boolean } }>('DELETE', `/users/${user_id}/bookmarks/${tweet_id}`);
        if (!data.data.bookmarked) {
          return { content: [{ type: 'text', text: `✅ Bookmark removed for tweet ${tweet_id}.` }] };
        }
        return { content: [{ type: 'text', text: 'Could not remove bookmark.' }], isError: true };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Get Bookmarks ───────────────────────────────────────────────────────────
  server.tool(
    'x_get_bookmarks',
    'Get bookmarked tweets for the authenticated user. Requires OAuth 2.0 PKCE with bookmark.read scope.',
    {
      user_id: z.string().describe('Your user ID (get it with x_get_me)'),
      max_results: z.number().int().min(1).max(100).default(10).describe('Results per page (1-100)'),
      pagination_token: z.string().optional().describe('Pagination token'),
    },
    async ({ user_id, max_results, pagination_token }) => {
      try {
        const params: Record<string, unknown> = {
          max_results,
          'tweet.fields': TWEET_FIELDS,
          'expansions': TWEET_EXPANSIONS,
          'user.fields': USER_FIELDS,
        };
        if (pagination_token) params['pagination_token'] = pagination_token;

        const data = await userRequest<XApiResponse<XTweet[]>>('GET', `/users/${user_id}/bookmarks`, undefined, params);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );

  // ── Hide / Unhide Reply ─────────────────────────────────────────────────────
  server.tool(
    'x_hide_reply',
    'Hide or unhide a reply to one of your tweets. Only the tweet author can hide replies.',
    {
      tweet_id: z.string().describe('The reply tweet ID to hide or unhide'),
      hidden: z.boolean().describe('true to hide the reply, false to unhide it'),
    },
    async ({ tweet_id, hidden }) => {
      try {
        await userRequest('PUT', `/tweets/${tweet_id}/hidden`, { hidden });
        const action = hidden ? 'hidden' : 'unhidden';
        return { content: [{ type: 'text', text: `✅ Reply ${tweet_id} ${action}.` }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );
}
