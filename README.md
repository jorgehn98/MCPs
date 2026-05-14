# MCP Servers

Colección de servidores MCP (Model Context Protocol) que permiten a Claude interactuar con servicios externos desde lenguaje natural.

El proyecto está pensado para crecer: se irán añadiendo nuevos MCPs de todo tipo según vayan siendo útiles.

---

## Servidores disponibles

| Servidor | Plataforma | Estado |
|----------|-----------|--------|
| [`linkedin-mcp`](./linkedin-mcp/) | LinkedIn | Estable |
| [`x-mcp`](./x-mcp/) | X (Twitter) | Estable |

---

## linkedin-mcp

Integración con la API de LinkedIn mediante OAuth 2.0. Permite publicar posts (texto, imagen, vídeo, artículo), comentar, reaccionar y gestionar tu perfil.

**Documentación:** [`linkedin-mcp/README.md`](./linkedin-mcp/README.md)
**Configuración:** [`linkedin-mcp/SETUP.md`](./linkedin-mcp/SETUP.md)

---

## x-mcp

Integración con la X API v2 mediante OAuth 2.0 + PKCE. Cubre tweets, búsqueda, DMs, listas, Spaces, tendencias, subida de media y gestión completa de la cuenta.

**Documentación:** [`x-mcp/README.md`](./x-mcp/README.md)
**Configuración:** [`x-mcp/SETUP.md`](./x-mcp/SETUP.md)

---

## Instalación rápida

No es necesario clonar el repositorio. Usa `npx` directamente.

**1. Autenticación OAuth (una sola vez por servidor):**

```bash
# X (Twitter)
X_CLIENT_ID=tu_id X_CLIENT_SECRET=tu_secret npx x-mcp --auth

# LinkedIn
LINKEDIN_CLIENT_ID=tu_id LINKEDIN_CLIENT_SECRET=tu_secret npx linkedin-mcp --auth
```

**2. Añade los servidores a tu configuración de Claude:**

```json
{
  "mcpServers": {
    "linkedin": {
      "command": "npx",
      "args": ["-y", "linkedin-mcp"],
      "env": {
        "LINKEDIN_CLIENT_ID": "tu_client_id",
        "LINKEDIN_CLIENT_SECRET": "tu_client_secret"
      }
    },
    "x": {
      "command": "npx",
      "args": ["-y", "x-mcp"],
      "env": {
        "X_CLIENT_ID": "tu_client_id",
        "X_CLIENT_SECRET": "tu_client_secret"
      }
    }
  }
}
```

Archivos de configuración de Claude:
- **Claude Code**: `~/.claude/mcp.json`
- **Claude Desktop (Windows)**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Claude Desktop (macOS)**: `~/Library/Application Support/Claude/claude_desktop_config.json`

---

## Requisitos generales

- Node.js v18+
- Claude Code o Claude Desktop
- Cuenta de desarrollador en la plataforma correspondiente

---

## Licencia

MIT
