# TODO

## Pendiente de commitear

Migración completa de ambos MCPs para funcionar via `npx` sin necesidad de clonar el repo ni hacer build.

### Archivos modificados (13)

**x-mcp:**
- `src/auth/tokens.ts` — ruta de tokens migrada de `.tokens.json` local a `~/.config/x-mcp/tokens.json`
- `src/auth/server.ts` — lógica OAuth envuelta en `runAuth()` exportable
- `src/index.ts` — shebang `#!/usr/bin/env node` + detección de flag `--auth`
- `src/client.ts` — mensajes de error actualizados a `npx x-mcp --auth`
- `package.json` — añadidos `bin` y `files`
- `SETUP.md` — documentación actualizada con flujo npx

**linkedin-mcp:**
- `src/auth/tokens.ts` — ruta de tokens migrada a `~/.config/linkedin-mcp/tokens.json`
- `src/auth/server.ts` — lógica OAuth envuelta en `runAuth()` exportable
- `src/index.ts` — shebang + detección de flag `--auth`
- `src/client.ts` — mensajes de error actualizados a `npx linkedin-mcp --auth`
- `package.json` — añadidos `bin` y `files`
- `SETUP.md` — documentación actualizada con flujo npx

**Raíz:**
- `README.md` — instalación rápida actualizada con flujo npx

---

## Próximos pasos

### 1. Commitear los cambios actuales
```bash
git add .
git commit -m "feat: add npx support for x-mcp and linkedin-mcp"
```

### 2. Crear cuenta en npmjs.com y hacer login
```bash
npm login
```

### 3. Publicar los paquetes
```bash
cd x-mcp && npm run build && npm publish
cd ../linkedin-mcp && npm run build && npm publish
```

> Si los nombres `x-mcp` o `linkedin-mcp` ya están ocupados en npm, habrá que usar un scope:
> `@jorgeass/x-mcp` — y ajustar el nombre en `package.json` y los SETUP.md antes de publicar.

### 4. Probar que funciona desde npx (sin el repo)
```bash
# Auth
X_CLIENT_ID=xxx X_CLIENT_SECRET=yyy npx x-mcp --auth

# Verificar que los tokens se guardaron
cat ~/.config/x-mcp/tokens.json
```

### 5. Actualizar la configuración de Claude
Cambiar en `~/.claude/mcp.json` de `node dist/index.js` a:
```json
{
  "mcpServers": {
    "x": {
      "command": "npx",
      "args": ["-y", "x-mcp"],
      "env": {
        "X_CLIENT_ID": "...",
        "X_CLIENT_SECRET": "..."
      }
    }
  }
}
```

### 6. Futuro: automatizar publicación
Configurar un workflow de GitHub Actions que publique a npm automáticamente al hacer push de un tag de versión (`v1.0.1`, etc.).
