# PR Review Toolkit (OpenCode Plugin)

Plugin local para OpenCode que expone una tool:

- `pr_review_toolkit_prompt`

Sirve para recuperar prompts de revision de PR con agentes especializados.

## Que incluye

Seis prompts de agentes en `src/agents/`:

- `comment-analyzer`
- `pr-test-analyzer`
- `silent-failure-hunter`
- `type-design-analyzer`
- `code-reviewer`
- `code-simplifier`

## Contrato de la tool

Tool: `pr_review_toolkit_prompt`

Argumento `prompt` (enum):

- `all`
- `comment-analyzer`
- `pr-test-analyzer`
- `silent-failure-hunter`
- `type-design-analyzer`
- `code-reviewer`
- `code-simplifier`

Comportamiento:

- Si `prompt` es uno de los agentes, devuelve su prompt exacto.
- Si `prompt` es `all`, devuelve una guia para lanzar los 6 en paralelo y consolidar hallazgos.

## Uso recomendado

1. Ejecutar `pr_review_toolkit_prompt` con `prompt: "all"`.
2. Lanzar los 6 subagentes en paralelo usando el contenido devuelto.
3. Consolidar resultados por severidad.

## Requisitos

- OpenCode con soporte de plugins
- Dependencia `@opencode-ai/plugin` (ya declarada en `package.json`)

## Mantenimiento

Si se anade o renombra un agente:

1. Crear/actualizar `src/agents/<nombre>.md`.
2. Actualizar enum y mapa en `src/plugin.ts`.
3. Actualizar este `README.md` en el mismo commit.

El plugin falla en inicializacion si falta o esta vacio algun prompt referenciado.
