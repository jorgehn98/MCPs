import axios from 'axios';
import { config } from 'dotenv';
import { loadTokens, isTokenExpired, saveTokens } from './auth/tokens.js';

config();

export const API_BASE = 'https://api.x.com/2';
export const UPLOAD_BASE = 'https://upload.twitter.com/1.1';

const CLIENT_ID = process.env.X_CLIENT_ID;
const CLIENT_SECRET = process.env.X_CLIENT_SECRET;
const BEARER_TOKEN = process.env.X_BEARER_TOKEN;

// Default field sets for rich responses
export const TWEET_FIELDS = 'id,text,author_id,created_at,public_metrics,referenced_tweets,attachments,conversation_id,in_reply_to_user_id,possibly_sensitive,reply_settings,source,lang';
export const USER_FIELDS = 'id,name,username,created_at,description,location,profile_image_url,protected,public_metrics,url,verified,verified_type';
export const TWEET_EXPANSIONS = 'author_id,referenced_tweets.id,referenced_tweets.id.author_id,attachments.media_keys,in_reply_to_user_id';

// ─── Token management ──────────────────────────────────────────────────────────

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID!,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  if (CLIENT_SECRET) {
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    headers['Authorization'] = `Basic ${credentials}`;
  }

  const response = await axios.post(
    `${API_BASE}/oauth2/token`,
    params.toString(),
    { headers }
  );

  const tokens = saveTokens(response.data);
  return tokens.access_token;
}

async function getUserAccessToken(): Promise<string> {
  const tokens = loadTokens();
  if (!tokens) {
    throw new Error('Not authenticated. Run `npm run auth` to set up X OAuth 2.0.');
  }

  if (isTokenExpired(tokens)) {
    if (tokens.refresh_token) {
      return await refreshAccessToken(tokens.refresh_token);
    }
    throw new Error('Access token expired. Run `npm run auth` to re-authenticate.');
  }

  return tokens.access_token;
}

function getBearerToken(): string {
  if (!BEARER_TOKEN) {
    throw new Error('X_BEARER_TOKEN not set. Add it to your .env file for app-only requests.');
  }
  return BEARER_TOKEN;
}

// ─── HTTP helpers ──────────────────────────────────────────────────────────────

/** User context request — requires OAuth 2.0 user tokens */
export async function userRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  data?: unknown,
  params?: Record<string, unknown>
): Promise<T> {
  const token = await getUserAccessToken();
  const res = await axios({
    method,
    url: `${API_BASE}${path}`,
    data,
    params,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });
  return res.data as T;
}

/** App-only request — prefers user token if available, falls back to Bearer Token */
export async function appRequest<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  data?: unknown,
  params?: Record<string, unknown>
): Promise<T> {
  // Try user token first
  const tokens = loadTokens();
  if (tokens && !isTokenExpired(tokens)) {
    return userRequest<T>(method as 'GET' | 'POST' | 'PUT' | 'DELETE', path, data, params);
  }
  if (tokens?.refresh_token) {
    try {
      const newToken = await refreshAccessToken(tokens.refresh_token);
      const res = await axios({
        method,
        url: `${API_BASE}${path}`,
        data,
        params,
        headers: { Authorization: `Bearer ${newToken}`, 'Content-Type': 'application/json' },
        timeout: 30000,
      });
      return res.data as T;
    } catch {
      // Fall through to bearer token
    }
  }

  const token = getBearerToken();
  const res = await axios({
    method,
    url: `${API_BASE}${path}`,
    data,
    params,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });
  return res.data as T;
}

// ─── Error handling ────────────────────────────────────────────────────────────

export function handleApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as Record<string, unknown> | undefined;
      const errors = data?.errors as Array<{ message: string }> | undefined;
      const detail = (data?.detail as string) || errors?.[0]?.message || '';
      switch (status) {
        case 400:
          return `Error: Bad request — ${detail || 'check your parameters.'}`;
        case 401:
          return 'Error: Unauthorized — run `npm run auth` to re-authenticate.';
        case 403:
          return `Error: Forbidden — ${detail || 'insufficient permissions or access tier.'}`;
        case 404:
          return 'Error: Not found — the resource does not exist or is not accessible.';
        case 429:
          return 'Error: Rate limit exceeded — please wait before retrying.';
        case 503:
          return 'Error: X API service unavailable — please try again later.';
        default:
          return `Error: API request failed with status ${status}${detail ? ` — ${detail}` : ''}`;
      }
    } else if (error.code === 'ECONNABORTED') {
      return 'Error: Request timed out — please try again.';
    }
  }
  return `Error: ${error instanceof Error ? error.message : String(error)}`;
}
