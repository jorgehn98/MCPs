# CLAUDE.md — Instrucciones para Claude Code

## Sobre el proyecto

Colección de servidores MCP (Model Context Protocol) para integrar redes sociales con Claude. Cada servidor es un paquete Node.js independiente con TypeScript, OAuth 2.0 y la estructura:

```
nombre-mcp/
├── src/
│   ├── index.ts        # Punto de entrada MCP
│   ├── client.ts       # Cliente HTTP de la API
│   ├── auth/           # OAuth (server.ts + tokens.ts)
│   ├── tools/          # Herramientas MCP por dominio
│   └── types/          # Tipos TypeScript
├── dist/               # Compilado (no editar)
├── package.json
├── tsconfig.json
├── README.md
└── SETUP.md
```

## Comandos habituales

```bash
npm install       # instalar dependencias
npm run build     # compilar TypeScript → dist/
npm run dev       # ejecutar sin compilar (tsx)
npm run auth      # iniciar flujo OAuth (una sola vez)
```

## Cómo trabajar con los MCPs

### Antes de modificar código
- Leer los archivos relevantes antes de proponer cambios
- Entender cómo funciona el cliente HTTP (`client.ts`) de ese servidor antes de tocar las tools
- No crear herramientas nuevas sin entender primero la API del servicio destino

### Al añadir una herramienta nueva
- Añadirla en el archivo de tools correspondiente, siguiendo el patrón existente
- Usar `zod` para validar parámetros, igual que el resto de herramientas
- Documentar cada parámetro con `.describe()`
- Registrarla en `index.ts` si es un módulo nuevo
- Actualizar el README.md y SETUP.md del servidor con la nueva herramienta

### Al añadir un servidor MCP nuevo
- Crear la carpeta con la misma estructura que los existentes
- Incluir siempre: `README.md`, `SETUP.md`, `.env.example`, `.gitignore`
- Añadir el nuevo servidor a la tabla del `README.md` raíz
- Asegurarse de que `.tokens.json` y `.env` están en `.gitignore`

### Análisis y debugging
- Para depurar errores de API, leer primero `client.ts` para entender cómo se construyen las peticiones
- Los errores 401 casi siempre son de tokens caducados o revocados → indicar al usuario que ejecute `npm run auth`
- Los errores 403 suelen ser de permisos de plan o scopes insuficientes → revisar la documentación de la API
- No reintentar la misma llamada fallida en bucle; diagnosticar la causa primero

## Normas de commits

- **Nunca** incluir `Co-Authored-By` de ninguna IA en los mensajes de commit
- Mensajes en inglés, formato convencional: `tipo(scope): descripción`
- Tipos: `feat`, `fix`, `docs`, `refactor`, `chore`
- Ejemplos:
  ```
  feat(x-mcp): add x_upload_media tool
  fix(linkedin): handle expired token refresh correctly
  docs: update root README with new MCP entry
  ```

## Normas generales

- No crear archivos innecesarios; preferir editar los existentes
- No añadir comentarios obvios ni docstrings a código que no se ha modificado
- No refactorizar código que no está relacionado con la tarea
- No añadir manejo de errores para casos que no pueden ocurrir
- Mantener los READMEs y SETUPs actualizados cuando se cambia funcionalidad
- Las credenciales (`.env`, `.tokens.json`) nunca se commitean
