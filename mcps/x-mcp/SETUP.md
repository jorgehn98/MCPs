# X MCP — Guía de configuración

## 1. Crear la X Developer App

1. Ve a [developer.x.com](https://developer.x.com/) e inicia sesión
2. Crea un nuevo proyecto y una app dentro de él
3. En la configuración de la app, activa **OAuth 2.0**:
   - **Type of App**: Web App, Automated App or Bot
   - **Callback URI**: `http://localhost:3000/callback`
   - **Website URL**: cualquier URL válida
4. En el apartado **Keys and Tokens**, genera o copia:
   - **Client ID**
   - **Client Secret**

> El plan **Free** de la X API permite lecturas básicas. Para escritura (tweets, DMs, listas) necesitas el plan **Basic** ($100/mes) o superior.

## 2. Instalar dependencias y compilar

```bash
cd x-mcp
npm install
npm run build
```

## 3. Configurar el .env

Crea el archivo `.env` en la raíz de `x-mcp/`:

```bash
cp .env.example .env
```

Si no existe `.env.example`, crea `.env` manualmente con este contenido:

```env
X_CLIENT_ID=tu_client_id_aqui
X_CLIENT_SECRET=tu_client_secret_aqui
X_REDIRECT_URI=http://localhost:3000/callback
AUTH_PORT=3000
```

## 4. Autenticarse (una sola vez)

```bash
npm run auth
```

El servidor arrancará en el puerto 3000, imprimirá una URL en la terminal y abrirá el flujo OAuth 2.0 PKCE. Abre esa URL en tu navegador, autoriza la app con tu cuenta de X y los tokens se guardarán automáticamente en `.tokens.json`.

Una vez completado verás en la terminal:
```
✅ Tokens saved to .tokens.json
```

> **Sobre la duración de los tokens:**
> - El **access token** dura ~2 horas. El servidor lo refresca automáticamente, no necesitas hacer nada.
> - El **refresh token** dura indefinidamente mientras no se revoque. Solo tendrás que repetir `npm run auth` si revocas el acceso desde tu cuenta de X.

## 5. Configurar Claude

Edita tu archivo de configuración MCP:

- **Claude Code**: `~/.claude/mcp.json`
- **Claude Desktop (Windows)**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Claude Desktop (macOS)**: `~/Library/Application Support/Claude/claude_desktop_config.json`

Añade la entrada del servidor (ajusta la ruta al lugar donde clonaste el repositorio):

```json
{
  "mcpServers": {
    "x": {
      "command": "node",
      "args": ["C:/ruta/absoluta/a/MCPs/x-mcp/dist/index.js"]
    }
  }
}
```

Reinicia Claude. El servidor X estará disponible y Claude podrá usarlo inmediatamente.

## Herramientas disponibles

### Tweets
| Herramienta | Descripción |
|-------------|-------------|
| `x_create_tweet` | Publicar tweet (texto, reply, quote, encuesta, media) |
| `x_delete_tweet` | Eliminar un tweet propio |
| `x_get_tweet` | Obtener un tweet por ID |
| `x_get_tweets` | Obtener hasta 100 tweets por ID |
| `x_get_home_timeline` | Timeline de cuentas seguidas |
| `x_search_recent_tweets` | Buscar tweets (últimos 7 días) |
| `x_get_user_tweets` | Tweets de un usuario |
| `x_get_user_mentions` | Menciones de un usuario |
| `x_get_tweet_counts` | Contar tweets por búsqueda |
| `x_hide_reply` | Ocultar/mostrar una respuesta |
| `x_retweet` / `x_unretweet` | Retweetear / deshacer retweet |
| `x_get_retweets` | Ver quién retweeteó |
| `x_get_quote_tweets` | Ver tweets que citan un tweet |
| `x_like_tweet` / `x_unlike_tweet` | Dar/quitar like |
| `x_get_liked_tweets` | Tweets que le gustan a un usuario |
| `x_get_liking_users` | Quién dio like a un tweet |
| `x_bookmark_tweet` / `x_remove_bookmark` | Guardar/eliminar marcador |
| `x_get_bookmarks` | Ver marcadores |

### Usuarios
| Herramienta | Descripción |
|-------------|-------------|
| `x_get_me` | Tu perfil y user ID |
| `x_get_user_by_username` / `x_get_user_by_id` | Buscar usuario |
| `x_get_users_by_usernames` | Buscar varios usuarios |
| `x_get_followers` / `x_get_following` | Seguidores / seguidos |
| `x_follow_user` / `x_unfollow_user` | Seguir / dejar de seguir |
| `x_mute_user` / `x_unmute_user` | Silenciar / desilenciar |
| `x_get_muted_users` | Ver silenciados |
| `x_block_user` / `x_unblock_user` | Bloquear / desbloquear |
| `x_get_blocked_users` | Ver bloqueados |

### DMs, Listas, Spaces, Tendencias, Media
| Herramienta | Descripción |
|-------------|-------------|
| `x_send_dm` | Enviar DM a un usuario |
| `x_create_group_dm` | Crear grupo de DMs |
| `x_get_dm_events` / `x_get_dm_conversation` | Ver DMs |
| `x_create_list` / `x_update_list` / `x_delete_list` | Gestionar listas |
| `x_get_list_tweets` / `x_get_list_members` | Ver contenido de lista |
| `x_add_list_member` / `x_remove_list_member` | Gestionar miembros |
| `x_follow_list` / `x_unfollow_list` | Seguir/dejar lista |
| `x_get_space` / `x_search_spaces` | Ver y buscar Spaces |
| `x_get_personalized_trends` / `x_get_trends_by_location` | Tendencias |
| `x_upload_media` | Subir imagen o GIF |

## Solución de problemas

**El servidor no arranca:**
- Comprueba que `.env` existe y tiene `X_CLIENT_ID` y `X_CLIENT_SECRET` correctos
- Asegúrate de haber ejecutado `npm run build` antes

**Error 401 al usar las herramientas:**
- El refresh token puede haber sido revocado. Ejecuta `npm run auth` de nuevo.

**Error 403 en escritura:**
- Tu app de X puede estar en el plan Free. Los endpoints de escritura requieren plan Basic o superior.

**El puerto 3000 está en uso:**
- Cambia `AUTH_PORT=3001` en `.env` y actualiza la Callback URI en la X Developer App.
