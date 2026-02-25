/**
 * OAuth 2.0 Authorization Code + PKCE Flow — One-time setup server
 * Run with: npm run auth
 * Opens browser URL, captures the callback code, exchanges for tokens, saves to .tokens.json
 */
import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { config } from 'dotenv';
import { saveTokens } from './tokens.js';

config();

const CLIENT_ID = process.env.X_CLIENT_ID!;
const CLIENT_SECRET = process.env.X_CLIENT_SECRET; // optional for public PKCE clients
const REDIRECT_URI = process.env.X_REDIRECT_URI || 'http://localhost:3000/callback';
const PORT = parseInt(process.env.AUTH_PORT || '3000', 10);

const SCOPES = [
  'tweet.read',
  'tweet.write',
  'users.read',
  'follows.read',
  'follows.write',
  'like.read',
  'like.write',
  'bookmark.read',
  'bookmark.write',
  'mute.read',
  'mute.write',
  'block.read',
  'block.write',
  'dm.read',
  'dm.write',
  'list.read',
  'list.write',
  'space.read',
  'offline.access',
].join(' ');

if (!CLIENT_ID) {
  console.error('ERROR: X_CLIENT_ID must be set in .env');
  process.exit(1);
}

// PKCE helpers
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

const state = crypto.randomBytes(16).toString('hex');
const codeVerifier = generateCodeVerifier();
const codeChallenge = generateCodeChallenge(codeVerifier);

const app = express();

app.get('/callback', async (req, res) => {
  const { code, state: returnedState, error, error_description } = req.query;

  if (error) {
    res.send(`<h1>Authorization Failed</h1><p>${error}: ${error_description}</p>`);
    return;
  }

  if (returnedState !== state) {
    res.send('<h1>Error</h1><p>State mismatch — possible CSRF attack.</p>');
    return;
  }

  try {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code as string,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier,
      client_id: CLIENT_ID,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    // Confidential clients (with client_secret) use Basic auth
    if (CLIENT_SECRET) {
      const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }

    const response = await axios.post(
      'https://api.x.com/2/oauth2/token',
      params.toString(),
      { headers }
    );

    const tokens = saveTokens(response.data);
    const expiryDate = new Date(tokens.obtained_at + tokens.expires_in * 1000).toLocaleDateString();

    res.send(`
      <html><body style="font-family:sans-serif;padding:2rem;max-width:600px;margin:0 auto">
        <h1 style="color:#1DA1F2">✅ X Authentication Successful!</h1>
        <p>Tokens saved. You can close this window.</p>
        <ul>
          <li><strong>Scopes:</strong> ${tokens.scope}</li>
          <li><strong>Token expires:</strong> ${expiryDate}</li>
          <li><strong>Refresh token:</strong> ${tokens.refresh_token ? 'Yes (auto-refresh enabled)' : 'No'}</li>
        </ul>
        <p>Your MCP server is ready. Restart Claude Code to load it.</p>
      </body></html>
    `);

    console.log('\n✅ Tokens saved to .tokens.json');
    console.log(`   Scopes: ${tokens.scope}`);
    console.log(`   Expires: ${expiryDate}`);
    if (tokens.refresh_token) {
      console.log('   Auto-refresh: enabled');
    }
    console.log('\nYou can stop this server with Ctrl+C\n');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Token exchange failed:', message);
    res.send(`<h1>Error</h1><p>Token exchange failed: ${message}</p>`);
  }
});

const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('scope', SCOPES);
authUrl.searchParams.set('state', state);
authUrl.searchParams.set('code_challenge', codeChallenge);
authUrl.searchParams.set('code_challenge_method', 'S256');

app.listen(PORT, () => {
  console.log('\n🐦 X OAuth 2.0 PKCE Setup');
  console.log('==========================');
  console.log(`Open this URL in your browser:\n`);
  console.log(authUrl.toString());
  console.log(`\nWaiting for callback on port ${PORT}...`);
  console.log('(Make sure http://localhost:3000/callback is in your X app redirect URIs)');
});
