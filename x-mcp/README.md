# x-mcp

Un servidor MCP (Model Context Protocol) que da a Claude la capacidad de interactuar con X (Twitter) — publicar tweets, buscar, gestionar listas, enviar DMs, y mucho más — todo desde lenguaje natural.

## Qué puede hacer

Una vez instalado, Claude puede:

### Tweets
| Herramienta | Descripción |
|-------------|-------------|
| `x_create_tweet` | Publicar un tweet (texto, reply, quote, encuesta, con media) |
| `x_delete_tweet` | Eliminar un tweet propio |
| `x_get_tweet` | Obtener un tweet por ID |
| `x_get_tweets` | Obtener hasta 100 tweets por ID |
| `x_get_home_timeline` | Ver el timeline cronológico de cuentas seguidas |
| `x_search_recent_tweets` | Buscar tweets de los últimos 7 días |
| `x_get_user_tweets` | Ver los tweets de un usuario |
| `x_get_user_mentions` | Ver menciones de un usuario |
| `x_get_tweet_counts` | Contar tweets que coinciden con una búsqueda |
| `x_hide_reply` | Ocultar o mostrar una respuesta en tu tweet |

### Retweets y Citas
| Herramienta | Descripción |
|-------------|-------------|
| `x_retweet` | Retweetear un tweet |
| `x_unretweet` | Deshacer un retweet |
| `x_get_retweets` | Ver quién ha retweeteado un tweet |
| `x_get_quote_tweets` | Ver tweets que citan un tweet |

### Likes
| Herramienta | Descripción |
|-------------|-------------|
| `x_like_tweet` | Dar like a un tweet |
| `x_unlike_tweet` | Quitar el like de un tweet |
| `x_get_liked_tweets` | Ver tweets que le gustan a un usuario |
| `x_get_liking_users` | Ver quién ha dado like a un tweet |

### Bookmarks
| Herramienta | Descripción |
|-------------|-------------|
| `x_bookmark_tweet` | Guardar un tweet en marcadores |
| `x_remove_bookmark` | Eliminar un marcador |
| `x_get_bookmarks` | Ver tus marcadores |

### Usuarios
| Herramienta | Descripción |
|-------------|-------------|
| `x_get_me` | Ver tu perfil y obtener tu user ID |
| `x_get_user_by_username` | Buscar usuario por nombre de usuario |
| `x_get_user_by_id` | Buscar usuario por ID |
| `x_get_users_by_usernames` | Buscar varios usuarios a la vez |
| `x_get_followers` | Ver seguidores de un usuario |
| `x_get_following` | Ver a quién sigue un usuario |
| `x_follow_user` | Seguir a un usuario |
| `x_unfollow_user` | Dejar de seguir a un usuario |

### Mute y Bloqueo
| Herramienta | Descripción |
|-------------|-------------|
| `x_mute_user` | Silenciar a un usuario |
| `x_unmute_user` | Dejar de silenciar |
| `x_get_muted_users` | Ver usuarios silenciados |
| `x_block_user` | Bloquear a un usuario |
| `x_unblock_user` | Desbloquear a un usuario |
| `x_get_blocked_users` | Ver usuarios bloqueados |

### Mensajes Directos (DMs)
| Herramienta | Descripción |
|-------------|-------------|
| `x_send_dm` | Enviar un DM a un usuario |
| `x_create_group_dm` | Crear un grupo de DMs |
| `x_send_dm_to_conversation` | Enviar mensaje a una conversación existente |
| `x_get_dm_events` | Ver eventos de DMs del usuario autenticado |
| `x_get_dm_conversation` | Ver una conversación por ID |
| `x_get_dm_conversation_with_user` | Ver la conversación con un usuario concreto |

### Listas
| Herramienta | Descripción |
|-------------|-------------|
| `x_create_list` | Crear una lista |
| `x_update_list` | Actualizar nombre/descripción de una lista |
| `x_delete_list` | Eliminar una lista |
| `x_get_list` | Ver detalles de una lista |
| `x_get_list_tweets` | Ver tweets de una lista |
| `x_get_list_members` | Ver miembros de una lista |
| `x_add_list_member` | Añadir un usuario a una lista |
| `x_remove_list_member` | Eliminar un usuario de una lista |
| `x_follow_list` | Seguir una lista |
| `x_unfollow_list` | Dejar de seguir una lista |
| `x_get_user_lists` | Ver las listas de un usuario |
| `x_get_followed_lists` | Ver las listas que sigue un usuario |

### Spaces
| Herramienta | Descripción |
|-------------|-------------|
| `x_get_space` | Ver detalles de un Space |
| `x_get_spaces` | Ver varios Spaces por ID |
| `x_search_spaces` | Buscar Spaces por título |
| `x_get_space_tweets` | Ver tweets compartidos en un Space |
| `x_get_user_spaces` | Ver Spaces de un usuario |

### Tendencias
| Herramienta | Descripción |
|-------------|-------------|
| `x_get_personalized_trends` | Ver tendencias personalizadas del usuario autenticado |
| `x_get_trends_by_location` | Ver tendencias por ubicación (WOEID) |

### Media
| Herramienta | Descripción |
|-------------|-------------|
| `x_upload_media` | Subir una imagen o GIF para adjuntar a un tweet |

## Requisitos

- [Node.js](https://nodejs.org/) v18 o superior
- [Claude Code](https://claude.ai/code) o Claude Desktop
- Una [X Developer App](https://developer.x.com/) con OAuth 2.0 habilitado y plan **Basic** o superior

## Instalación

Ver [`SETUP.md`](./SETUP.md) para instrucciones paso a paso.

## Ejemplos de uso

Una vez instalado, habla con Claude de forma natural:

- *"Publica este tweet: Acabo de lanzar mi nuevo proyecto"*
- *"Busca tweets recientes sobre inteligencia artificial en español"*
- *"Muéstrame mis últimas menciones"*
- *"Manda un DM a @usuario: Hola, ¿cómo estás?"*
- *"Crea una lista llamada 'Startups' y añade a @usuario"*
- *"¿Qué está en tendencia ahora mismo?"*
- *"Sube esta imagen y publícala con el texto: 'Nueva foto'"*

## Estructura del proyecto

```
src/
├── index.ts          # Punto de entrada del servidor MCP
├── client.ts         # Cliente X API v2
├── auth/
│   ├── server.ts     # Flujo OAuth 2.0 PKCE
│   └── tokens.ts     # Almacenamiento y refresco de tokens
├── tools/
│   ├── tweets.ts     # Tweets, likes, bookmarks, retweets
│   ├── users.ts      # Usuarios, follows, mutes, blocks
│   ├── dms.ts        # Mensajes directos
│   ├── lists.ts      # Listas
│   ├── media.ts      # Subida de media
│   ├── spaces.ts     # Spaces
│   └── trends.ts     # Tendencias
└── types/
    └── x.ts          # Tipos TypeScript de la API
```

## Notas importantes

- Los **access tokens de X duran 2 horas** por diseño. El servidor los refresca automáticamente usando el refresh token (que dura indefinidamente mientras no se revoque).
- Si el refresh token expira (por revocación o inactividad prolongada), ejecuta `npm run auth` de nuevo.
- Algunos endpoints requieren el **plan Basic** de la X API ($100/mes). Los endpoints públicos de lectura funcionan con el plan Free.
- `x_upload_media` soporta imágenes (JPG, PNG, GIF) de hasta 5 MB. Para vídeo, la X API v2 tiene limitaciones según el plan.

## Licencia

MIT
