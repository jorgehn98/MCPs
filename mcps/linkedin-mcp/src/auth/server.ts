/**
 * OAuth 2.0 Authorization Code Flow — One-time setup server
 * Run with: npm run auth
 * Opens browser, captures the code, exchanges for tokens, saves to .tokens.json
 */
import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { config } from 'dotenv';
import { saveTokens } from './tokens.js';

config();

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID!;
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET!;
const REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:3000/callback';
const PORT = parseInt(process.env.AUTH_PORT || '3000', 10);

const SCOPES = [
  'openid',
  'profile',
  'email',
  'w_member_social',
].join(' ');

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('ERROR: LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET must be set in .env');
  process.exit(1);
}

const state = crypto.randomBytes(16).toString('hex');

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
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
    });

    const response = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const tokens = saveTokens(response.data);

    const expiryDate = new Date(tokens.obtained_at + tokens.expires_in * 1000).toLocaleDateString();

    res.send(`
      <html><body style="font-family:sans-serif;padding:2rem;max-width:600px;margin:0 auto">
        <h1 style="color:#0077b5">✅ LinkedIn Authentication Successful!</h1>
        <p>Tokens saved. You can close this window.</p>
        <ul>
          <li><strong>Scopes:</strong> ${tokens.scope}</li>
          <li><strong>Token expires:</strong> ${expiryDate}</li>
          <li><strong>Auto-refresh:</strong> ${tokens.refresh_token ? '✅ Enabled' : '❌ Not available — LinkedIn does not provide refresh tokens on the basic tier. Re-run <code>npm run auth</code> before this date.'}</li>
        </ul>
        <p>Your MCP server is ready. Restart Claude Code to load it.</p>
      </body></html>
    `);

    console.log('\n✅ Tokens saved to .tokens.json');
    console.log(`   Scopes: ${tokens.scope}`);
    console.log(`   Expires: ${expiryDate}`);
    if (!tokens.refresh_token) {
      console.log('   ⚠️  No refresh token — re-run `npm run auth` before expiry date');
    }
    console.log('\nYou can stop this server with Ctrl+C\n');

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Token exchange failed:', message);
    res.send(`<h1>Error</h1><p>Token exchange failed: ${message}</p>`);
  }
});

const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('state', state);
authUrl.searchParams.set('scope', SCOPES);

app.listen(PORT, () => {
  console.log('\n🔗 LinkedIn OAuth Setup');
  console.log('========================');
  console.log(`Open this URL in your browser:\n`);
  console.log(authUrl.toString());
  console.log(`\nWaiting for callback on port ${PORT}...`);
});
