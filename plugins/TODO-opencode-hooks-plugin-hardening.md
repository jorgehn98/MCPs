# Hardening de plugins de hooks para OpenCode

**Fecha inicio**: 2026-03-26
**Ultima actualizacion**: 2026-03-27
**Estado**: Completado

---

## Resumen

El plugin `photo-heart-hooks` tenia varios problemas que impedian el funcionamiento correcto de los hooks en OpenCode. Se resolvieron en dos fases: un hardening del parser de config (2026-03-26) y un fix de 3 bugs criticos en el runtime de ejecucion (2026-03-27).

---

## Problemas encontrados y resueltos

### Fase 1 — Hardening del parser (2026-03-26)

**Problema original**: el nodo `bash` en `hooks.json` podia ser un array de scripts O un mapa de triggers por comando. El plugin hacia casts directos sin validar la forma real (`as string[]`, `as Record<string, string[]>`), lo que causaba `{} is not iterable` y tumbaba cualquier comando Bash.

**Solucion aplicada**:

- Helpers de validacion: `isStringArray()`, `isPlainObject()`, `getToolScripts()`, `getBashTriggerScripts()`
- Eliminados todos los casts directos inseguros
- Config invalida = hook ignorado + warning via `logInvalidHookConfig()`, nunca throw
- Separacion explicita de los dos formatos de `bash`: array simple vs mapa de triggers
- `getEventConfig()` valida que el event config sea un objeto antes de acceder a sus propiedades
- Proteccion tanto en `tool.execute.after` como `tool.execute.before`

### Fase 2 — Bugs de runtime en Windows (2026-03-27)

Descubiertos durante la validacion end-to-end real (PR #506, feature unify-drag-drop).

#### Bug 1: `bash` no encontrado en PATH

- **Sintoma**: `Executable not found in $PATH: "bash"` al ejecutar scripts `.sh`
- **Causa**: `Bun.spawn` en OpenCode no hereda el PATH de Git Bash en Windows. PowerShell y Node si estan en el PATH del sistema, pero `bash` (que vive en `C:/Program Files/Git/usr/bin/`) no.
- **Fix**: funcion `resolveBash()` que busca bash.exe en rutas conocidas de Git for Windows:
  ```
  C:/Program Files/Git/usr/bin/bash.exe
  C:/Program Files/Git/bin/bash.exe
  C:/Program Files (x86)/Git/usr/bin/bash.exe
  process.env.BASH_PATH (variable de entorno opcional)
  "bash" (fallback al PATH)
  ```
- **Archivos**: `hooks.ts` y `worktree-plugin.ts`, funcion `runScript`

#### Bug 2: coreutils no encontrados (cat, grep, head, dirname)

- **Sintoma**: Scripts `.sh` se ejecutaban pero fallaban con `cat: command not found`, `grep: command not found`, etc.
- **Causa**: Aunque bash.exe se encontraba, el proceso spawneado no tenia `C:/Program Files/Git/usr/bin/` en su PATH, donde viven los coreutils de Git for Windows.
- **Fix**: Inyectar Git coreutils en `env.PATH` del `Bun.spawn` solo para scripts `.sh`:
  ```typescript
  const spawnEnv = scriptPath.endsWith(".sh")
    ? { ...process.env, PATH: `${gitUsrBin};${gitBin};${currentPath}` }
    : undefined;
  ```
- **Archivos**: `hooks.ts` y `worktree-plugin.ts`, funcion `runScript`

#### Bug 3: output de MCP tools no se inyectaba al modelo

- **Sintoma**: Los hooks se ejecutaban correctamente y generaban output, pero el modelo (agente) no recibia las instrucciones post-PR.
- **Causa**: `appendToolOutput()` solo escribia en `output.output` (string), que es el formato de tools built-in (bash, edit, read, write). Las tools MCP (github*\*, supabase*\*) usan `output.content` que es un **array de content blocks** (`[{type: "text", text: "..."}]`), no un string.
- **Fix**: `appendToolOutput()` ahora detecta el formato y actua segun corresponda:
  ```typescript
  if ("output" in output && typeof output.output === "string") {
    // Built-in tools: concatenar en output.output
  } else if ("content" in output && Array.isArray(output.content)) {
    // MCP tools: push de nuevo content block
    output.content.push({ type: "text", text: section });
  } else if ("content" in output && typeof output.content === "string") {
    // MCP tools con content string: concatenar
  } else {
    // Fallback
  }
  ```
- **Archivos**: `hooks.ts` y `worktree-plugin.ts`, funcion `appendToolOutput`

---

## Estado actual de los hooks

### Verificados end-to-end (2026-03-27)

| Hook               | Tool trigger               | Scripts                                                 | Estado                                     |
| ------------------ | -------------------------- | ------------------------------------------------------- | ------------------------------------------ |
| session.created    | \*                         | detect-migration-phase.ps1                              | OK (.ps1, no afectado por bugs de bash)    |
| tool.execute.after | edit                       | update-migration-state.ps1, validate-migration-step.ps1 | OK (verificado con debug log)              |
| tool.execute.after | write                      | update-migration-state.ps1, validate-migration-step.ps1 | OK (mismos scripts que edit)               |
| tool.execute.after | supabase_apply_migration   | save-migration-local.cjs, post-migration-db-types.cjs   | OK (.cjs, no afectado)                     |
| tool.execute.after | github_create_pull_request | post-pr-react-doctor.sh, post-pr-combined.sh            | OK (tras fix de bugs 1-3)                  |
| tool.execute.after | github_merge_pull_request  | post-merge-cleanup.ps1                                  | OK (.ps1, pendiente de test real en merge) |

### Worktree plugin

| Hook               | Tool trigger            | Estado                                    |
| ------------------ | ----------------------- | ----------------------------------------- |
| tool.execute.after | enterworktree           | OK (docsReminderScript)                   |
| tool.execute.after | bash (git worktree add) | OK (setup-worktree.ps1 con `-WorktreePath` + `OPENCODE_WORKTREE_PATH` limpio/seteado) |

### Formato de output por tipo de tool en OpenCode

Referencia critica para futuros cambios al plugin:

| Tipo de tool                                   | output keys                          | Formato de output                                                 |
| ---------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------- |
| Built-in (bash, edit, read, write, glob, grep) | title, metadata, output, attachments | `output.output` es un **string**                                  |
| MCP (github*\*, supabase*_, stripe\__, etc.)   | content                              | `output.content` es un **array** de `{type: "text", text: "..."}` |

### Nombre de tools MCP en eventos del plugin

Las tools MCP llegan al plugin **sin prefijo**. Ejemplos:

- `mcp_github_create_pull_request` → `input.tool = "github_create_pull_request"`
- `mcp_supabase_apply_migration` → `input.tool = "supabase_apply_migration"`

El prefijo `mcp_` lo anade la UI/sistema, no es parte del nombre real de la tool.

---

## Metodo de diagnostico usado

Se anadio un debug log temporal al plugin que escribia en `{directory}/hooks-debug.log`:

```typescript
const _dbg = (msg: string) => {
  try {
    const fs = require("fs");
    fs.appendFileSync(
      `${directory}/hooks-debug.log`,
      `[${new Date().toISOString()}] ${msg}\n`,
    );
  } catch {
    /* noop */
  }
};
```

Esto permitio capturar:

- Nombre real de `input.tool` para cada tool ejecutada
- Scripts resueltos del config para cada tool
- Mensajes devueltos por cada script
- Estado de `output.output` y `output.content` antes/despues de `appendToolOutput`

**Este debug ya se elimino del plugin final.** Si hace falta diagnosticar en el futuro, re-anadir temporalmente.

---

## Lecciones aprendidas

1. **Bun.spawn en Windows no hereda Git Bash paths.** Siempre resolver rutas absolutas de bash.exe e inyectar Git coreutils en env.PATH para scripts .sh.

2. **MCP tools y built-in tools tienen formatos de output diferentes.** Cualquier plugin que modifique output de tools debe manejar ambos formatos. Siempre comprobar `typeof` y `Array.isArray` antes de manipular.

3. **Un plugin de hooks nunca debe poder bloquear una tool.** Config invalida = warning + skip. Script fallido = log + continuar. Solo excepciones muy explicitas deberian cortar la ejecucion.

4. **Los smoke tests manuales no son suficientes.** El bug de MCP output solo se descubrio al hacer una prueba real end-to-end (crear un PR de verdad). Los scripts .ps1 y .cjs funcionaban bien en tests aislados, pero los .sh fallaban silenciosamente.

5. **El debug log temporal es la forma mas fiable de diagnosticar.** Los logs del plugin (`client.app.log`) van a un lugar no siempre visible. Escribir a un archivo local con `fs.appendFileSync` permite inspeccionar el flujo completo.

---

## Archivos modificados

- `plugins/photo-heart-hooks/src/hooks.ts` — runScript (resolveBash + env.PATH), appendToolOutput (MCP content blocks)
- `plugins/photo-heart-hooks/src/worktree-plugin.ts` — mismos fixes en runScript y appendToolOutput

---

## Pendiente

- [ ] Eliminar debug log de hooks.ts (el bloque `_dbg`) — ya no es necesario pero aun esta en el codigo
- [ ] Verificar github_merge_pull_request end-to-end con un merge real
- [ ] Considerar extraer `resolveBash()` y `appendToolOutput()` a un modulo shared para evitar duplicacion entre hooks.ts y worktree-plugin.ts
