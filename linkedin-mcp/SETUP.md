# LinkedIn MCP — Setup Guide

## 1. Crear la LinkedIn Developer App

1. Ve a https://developer.linkedin.com/
2. Crea una nueva app (necesitas una LinkedIn Company Page)
3. En la app, en **Products**, solicita:
   - **Share on LinkedIn** (da `w_member_social`)
   - **Sign In with LinkedIn using OpenID Connect** (da `openid`, `profile`, `email`)
4. En **Auth** → **OAuth 2.0 settings**, añade la callback URL:
   ```
   http://localhost:3000/callback
   ```
5. Anota el **Client ID** y **Client Secret**

## 2. Configurar el .env

```bash
cp .env.example .env
```

Edita `.env` y rellena:
```
LINKEDIN_CLIENT_ID=tu_client_id
LINKEDIN_CLIENT_SECRET=tu_client_secret
LINKEDIN_REDIRECT_URI=http://localhost:3000/callback
```

## 3. Autenticarse (una sola vez)

```bash
npm run auth
```

Abre la URL que aparece en la terminal en tu navegador, autoriza la app, y los tokens se guardarán en `.tokens.json` automáticamente.

Los tokens duran ~60 días. Cuando expiren, repite este paso.

## 4. Configurar Claude Code

Edita `~/.claude/mcp.json` (o `%APPDATA%\Claude\claude_desktop_config.json` para Claude Desktop) y añade:

```json
{
  "mcpServers": {
    "linkedin": {
      "command": "node",
      "args": ["C:/Users/jorge/Desktop/linkedin-mcp/dist/index.js"]
    }
  }
}
```

Reinicia Claude Code. El servidor estará disponible.

## Herramientas disponibles

| Herramienta | Descripción |
|-------------|-------------|
| `linkedin_get_my_profile` | Ver tu perfil y URN |
| `linkedin_create_text_post` | Publicar texto |
| `linkedin_create_image_post` | Publicar con imagen (JPG/PNG/GIF) |
| `linkedin_create_video_post` | Publicar con vídeo (MP4, máx 500MB) |
| `linkedin_create_article_post` | Compartir una URL externa con título |
| `linkedin_reshare_post` | Recompartir un post existente |
| `linkedin_get_post` | Ver detalles de un post por URN |
| `linkedin_get_my_posts` | Ver tus últimos posts |
| `linkedin_delete_post` | Eliminar un post |
| `linkedin_get_comments` | Ver comentarios de un post |
| `linkedin_add_comment` | Comentar en un post (o responder a un comentario) |
| `linkedin_delete_comment` | Eliminar un comentario |
| `linkedin_get_reactions` | Ver reacciones de un post/comentario |
| `linkedin_add_reaction` | Reaccionar (LIKE, PRAISE, EMPATHY, INTEREST, APPRECIATION, ENTERTAINMENT) |
| `linkedin_delete_reaction` | Quitar una reacción |

## Notas importantes

- **`r_member_social`** (leer posts de otros miembros) es un scope restringido que LinkedIn solo da a partners. Por eso `linkedin_get_my_posts` solo funciona para tus propios posts o para organizaciones donde eres admin.
- Para posts de empresa/organización, pasa `authorUrn: "urn:li:organization:TU_ORG_ID"` en cualquier herramienta de creación.
- El token se renueva automáticamente si configuras `offline.access` en los scopes.
