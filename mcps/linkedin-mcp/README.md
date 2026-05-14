# mcp-linkedin-server

A Model Context Protocol (MCP) server that gives Claude the ability to interact with LinkedIn — post content, read posts, comment, and react — all from natural language.

## What it does

Once installed, Claude can:

| Tool | Description |
|------|-------------|
| `linkedin_get_my_profile` | Get your profile info and URN |
| `linkedin_create_text_post` | Publish a text post |
| `linkedin_create_image_post` | Publish a post with an image (JPG/PNG/GIF) |
| `linkedin_create_video_post` | Publish a post with a video (MP4, max 500 MB) |
| `linkedin_create_article_post` | Share an external URL with title and description |
| `linkedin_reshare_post` | Reshare an existing post with optional commentary |
| `linkedin_get_post` | Get details of a post by URN |
| `linkedin_get_my_posts` | List your most recent posts |
| `linkedin_delete_post` | Delete a post |
| `linkedin_get_comments` | Get comments on a post |
| `linkedin_add_comment` | Comment on a post (or reply to a comment) |
| `linkedin_delete_comment` | Delete a comment |
| `linkedin_get_reactions` | Get reactions on a post or comment |
| `linkedin_add_reaction` | React to a post (LIKE, PRAISE, EMPATHY, INTEREST, APPRECIATION, ENTERTAINMENT) |
| `linkedin_delete_reaction` | Remove a reaction |

## Requirements

- [Node.js](https://nodejs.org/) v18 or higher
- [Claude Code](https://claude.ai/code) or Claude Desktop
- A [LinkedIn Developer App](https://developer.linkedin.com/) with the following products enabled:
  - **Share on LinkedIn** — grants `w_member_social`
  - **Sign In with LinkedIn using OpenID Connect** — grants `openid`, `profile`, `email`

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/mcp-linkedin-server.git
cd mcp-linkedin-server
```

### 2. Install dependencies and build

```bash
npm install
npm run build
```

### 3. Create a LinkedIn Developer App

1. Go to [developer.linkedin.com](https://developer.linkedin.com/) and create a new app (requires a LinkedIn Company Page)
2. Under **Products**, request:
   - Share on LinkedIn
   - Sign In with LinkedIn using OpenID Connect
3. Under **Auth → OAuth 2.0 settings**, add the callback URL:
   ```
   http://localhost:3000/callback
   ```
4. Copy your **Client ID** and **Client Secret**

### 4. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your credentials:

```env
LINKEDIN_CLIENT_ID=your_client_id_here
LINKEDIN_CLIENT_SECRET=your_client_secret_here
LINKEDIN_REDIRECT_URI=http://localhost:3000/callback
LINKEDIN_API_VERSION=202601
AUTH_PORT=3000
```

### 5. Authenticate with LinkedIn (one-time setup)

```bash
npm run auth
```

This starts a local server, prints an authorization URL in the terminal, and opens the OAuth flow. After you approve access in the browser, your tokens are saved automatically to `.tokens.json`.

> Tokens are valid for ~60 days. When they expire, just run `npm run auth` again.

### 6. Add the server to Claude

Edit your Claude MCP config file:

- **Claude Code**: `~/.claude/mcp.json`
- **Claude Desktop (Windows)**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Claude Desktop (macOS)**: `~/Library/Application Support/Claude/claude_desktop_config.json`

Add the following entry (update the path to match where you cloned the repo):

```json
{
  "mcpServers": {
    "linkedin": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-linkedin-server/dist/index.js"]
    }
  }
}
```

Restart Claude. The LinkedIn tools will now be available.

## Usage examples

Once installed, just talk to Claude naturally:

- *"Post on LinkedIn: Excited to share our new product launch!"*
- *"Show me my last 5 LinkedIn posts"*
- *"Add a comment to this post: [URN]"*
- *"React with PRAISE to [URN]"*
- *"Delete my last post"*

## Project structure

```
src/
├── index.ts          # MCP server entry point
├── client.ts         # LinkedIn API client
├── auth/
│   ├── server.ts     # OAuth 2.0 authorization flow
│   └── tokens.ts     # Token storage and validation
├── tools/
│   ├── profile.ts    # Profile tools
│   ├── posts.ts      # Post tools (text, image, video, article, reshare)
│   ├── comments.ts   # Comment tools
│   └── reactions.ts  # Reaction tools
└── types/
    └── linkedin.ts   # TypeScript type definitions
```

## Important notes

- `r_member_social` (read other members' posts) is a restricted scope that LinkedIn only grants to partners. `linkedin_get_my_posts` works for your own posts and organizations where you are an admin.
- To post as an organization, pass `authorUrn: "urn:li:organization:YOUR_ORG_ID"` in any creation tool.
- The `.tokens.json` file contains your LinkedIn session and should never be committed. It is already excluded via `.gitignore`.

## License

MIT
