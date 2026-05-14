import type { Plugin } from "@opencode-ai/plugin";

interface HookConfig {
  [event: string]: unknown;
}

interface ScriptResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  script: string;
  scriptPath: string;
}

type EventName =
  | "session.created"
  | "server.connected"
  | "tool.execute.before"
  | "tool.execute.after";

const isAbsolutePath = (value: string) =>
  /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith("/");

const joinProjectPath = (directory: string, script: string) => {
  const normalizedDirectory = directory.replace(/[\\/]+$/, "");
  const normalizedScript = script.replace(/^[\\/]+/, "").replace(/\\/g, "/");
  return `${normalizedDirectory}/${normalizedScript}`;
};

const runScript = async (
  client: any,
  directory: string,
  script: string,
  payload?: unknown,
): Promise<ScriptResult> => {
  const scriptPath = isAbsolutePath(script)
    ? script
    : joinProjectPath(directory, script);
  const stdin = payload ? JSON.stringify(payload) : "";
  const stdinSource = new Response(stdin);

  let command: string[] | null = null;

  // Resolve bash path: Bun's spawned process may not inherit Git Bash in PATH on Windows
  const resolveBash = (): string => {
    const fs = require("fs");
    const candidates = [
      "C:/Program Files/Git/usr/bin/bash.exe",
      "C:/Program Files/Git/bin/bash.exe",
      "C:/Program Files (x86)/Git/usr/bin/bash.exe",
      process.env.BASH_PATH,
      "bash",
    ].filter(Boolean) as string[];
    for (const candidate of candidates) {
      try {
        if (fs.existsSync(candidate)) return candidate;
      } catch {
        /* skip */
      }
    }
    return "bash"; // fallback
  };

  if (scriptPath.endsWith(".ps1")) {
    command = [
      "powershell",
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
    ];
  } else if (scriptPath.endsWith(".sh")) {
    command = [resolveBash(), scriptPath];
  } else if (
    scriptPath.endsWith(".cjs") ||
    scriptPath.endsWith(".js") ||
    scriptPath.endsWith(".mjs")
  ) {
    command = ["node", scriptPath];
  }

  if (!command) {
    await client.app.log({
      body: {
        service: "photo-heart-hooks",
        level: "warn",
        message: "Unsupported hook script extension",
        extra: { script, scriptPath },
      },
    });
    return { exitCode: 0, stdout: "", stderr: "", script, scriptPath };
  }

  try {
    const activeWorktreePath = getPayloadWorktreePath(payload);
    const spawnEnv = buildScriptEnv(scriptPath, activeWorktreePath);

    const proc = (globalThis as any).Bun.spawn(command, {
      stdin: stdinSource,
      stdout: "pipe",
      stderr: "pipe",
      cwd: directory,
      env: spawnEnv,
    });

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    if (exitCode !== 0) {
      await client.app.log({
        body: {
          service: "photo-heart-hooks",
          level: "error",
          message: "Hook script execution failed",
          extra: {
            script,
            scriptPath,
            exitCode,
            stderr: stderr.trim(),
            stdout: stdout.trim(),
          },
        },
      });
    }

    return { exitCode, stdout, stderr, script, scriptPath };
  } catch (error) {
    await client.app.log({
      body: {
        service: "photo-heart-hooks",
        level: "error",
        message: "Hook script execution failed",
        extra: {
          script,
          scriptPath,
          error: error instanceof Error ? error.message : String(error),
        },
      },
    });
    return {
      exitCode: 1,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
      script,
      scriptPath,
    };
  }
};

const extractScriptMessage = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return "";

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed?.additionalContext === "string") {
      return parsed.additionalContext;
    }
    return trimmed;
  } catch {
    return trimmed;
  }
};

const appendToolOutput = (output: any, messages: string[]) => {
  if (messages.length === 0) return;
  const section = messages.join("\n\n");
  // Built-in tools (bash, edit, read, write) use output.output (string)
  // MCP tools (github_*, supabase_*) use output.content (array of content blocks)
  if ("output" in output && typeof output.output === "string") {
    output.output = output.output ? `${output.output}\n\n${section}` : section;
  } else if ("content" in output && Array.isArray(output.content)) {
    // MCP content blocks: [{type: "text", text: "..."}]
    output.content.push({ type: "text", text: `\n\n${section}` });
  } else if ("content" in output && typeof output.content === "string") {
    output.content = output.content
      ? `${output.content}\n\n${section}`
      : section;
  } else {
    // Fallback: set output as string
    output.output = section;
  }
};

const buildHookPayload = (
  directory: string,
  event: EventName,
  input?: any,
  activeWorktreePath?: string,
) => {
  const args = input?.args || {};
  const worktreePath = args.activeWorktreePath || args.worktreePath || activeWorktreePath;

  return {
    event,
    directory,
    activeWorktreePath: worktreePath,
    worktreePath,
    tool: input?.tool,
    args: worktreePath
      ? {
          ...args,
          activeWorktreePath: worktreePath,
          worktreePath,
        }
      : args,
  };
};

const getRuntimeContext = async (
  client: any,
  fallbackDirectory: string,
  fallbackWorktreePath?: string,
) => {
  try {
    const pathInfo = await client.path.get();
    const runtimeWorktreePath =
      typeof pathInfo?.worktree === "string" && pathInfo.worktree
        ? pathInfo.worktree
        : fallbackWorktreePath;
    const runtimeDirectory =
      runtimeWorktreePath ||
      (typeof pathInfo?.directory === "string" && pathInfo.directory
        ? pathInfo.directory
        : fallbackDirectory);

    return {
      directory: runtimeDirectory,
      activeWorktreePath: runtimeWorktreePath,
    };
  } catch {
    return {
      directory: fallbackDirectory,
      activeWorktreePath: fallbackWorktreePath,
    };
  }
};

const getPayloadWorktreePath = (payload: unknown) => {
  if (!isPlainObject(payload)) return undefined;

  const topLevel = payload.activeWorktreePath || payload.worktreePath;
  if (typeof topLevel === "string" && topLevel) return topLevel;

  const args = payload.args;
  if (!isPlainObject(args)) return undefined;

  const argPath = args.activeWorktreePath || args.worktreePath;
  return typeof argPath === "string" && argPath ? argPath : undefined;
};

const buildScriptEnv = (scriptPath: string, activeWorktreePath?: string) => {
  const env = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] =>
      typeof entry[1] === "string",
    ),
  );

  if (activeWorktreePath) {
    env.OPENCODE_WORKTREE_PATH = activeWorktreePath;
  } else {
    delete env.OPENCODE_WORKTREE_PATH;
  }

  // Ensure Git coreutils (cat, grep, head, dirname, etc.) are in PATH for .sh scripts
  if (scriptPath.endsWith(".sh")) {
    const gitUsrBin = "C:/Program Files/Git/usr/bin";
    const gitBin = "C:/Program Files/Git/bin";
    const currentPath = process.env.PATH || "";
    env.PATH = `${gitUsrBin};${gitBin};${currentPath}`;
  }

  return env;
};

const normalizeWorktreePath = (worktree: unknown) => {
  if (typeof worktree === "string" && worktree) return worktree;

  if (!isPlainObject(worktree)) return undefined;

  const candidate = worktree.path || worktree.root || worktree.directory;
  return typeof candidate === "string" && candidate ? candidate : undefined;
};

const valueType = (value: unknown) => {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const logInvalidHookConfig = async (
  client: any,
  details: {
    event: EventName;
    tool?: string;
    trigger?: string;
    value: unknown;
    reason: string;
  },
) => {
  await client.app.log({
    body: {
      service: "photo-heart-hooks",
      level: "warn",
      message: "Invalid hook config ignored",
      extra: {
        event: details.event,
        tool: details.tool,
        trigger: details.trigger,
        reason: details.reason,
        valueType: valueType(details.value),
      },
    },
  });
};

const getEventConfig = async (
  client: any,
  config: HookConfig,
  event: EventName,
): Promise<Record<string, unknown>> => {
  const eventConfig = config[event];
  if (eventConfig === undefined) return {};
  if (isPlainObject(eventConfig)) return eventConfig;

  await logInvalidHookConfig(client, {
    event,
    value: eventConfig,
    reason: "event config must be an object",
  });
  return {};
};

const getToolScripts = async (
  client: any,
  config: HookConfig,
  event: EventName,
  tool: string,
): Promise<string[]> => {
  const eventConfig = await getEventConfig(client, config, event);
  const value = eventConfig[tool];
  if (value === undefined) return [];

  if (isStringArray(value)) return value;

  if (tool === "bash" && isPlainObject(value)) {
    return [];
  }

  await logInvalidHookConfig(client, {
    event,
    tool,
    value,
    reason: "tool entry must be an array of script paths",
  });
  return [];
};

const getBashTriggerScripts = async (
  client: any,
  config: HookConfig,
  event: EventName,
  command: string,
): Promise<string[]> => {
  const eventConfig = await getEventConfig(client, config, event);
  const value = eventConfig["bash"];
  if (value === undefined || isStringArray(value)) return [];

  const normalizedCommand = (command || "").toLowerCase();

  if (!isPlainObject(value)) {
    await logInvalidHookConfig(client, {
      event,
      tool: "bash",
      value,
      reason: "bash entry must be an array or trigger map",
    });
    return [];
  }

  const scripts: string[] = [];
  for (const [trigger, triggerScripts] of Object.entries(value)) {
    if (!isStringArray(triggerScripts)) {
      await logInvalidHookConfig(client, {
        event,
        tool: "bash",
        trigger,
        value: triggerScripts,
        reason: "bash trigger entry must be an array of script paths",
      });
      continue;
    }

    const normalizedTrigger = trigger.toLowerCase();
    if (trigger === "*" || normalizedCommand.includes(normalizedTrigger)) {
      scripts.push(...triggerScripts);
    }
  }

  return scripts;
};

const runScriptsAndCollectMessages = async (
  client: any,
  directory: string,
  scripts: string[],
  payload: unknown,
): Promise<string[]> => {
  const messages: string[] = [];
  for (const script of scripts) {
    const result = await runScript(client, directory, script, payload);
    const stdoutMessage = extractScriptMessage(result.stdout);
    const stderrMessage = extractScriptMessage(result.stderr);
    if (stdoutMessage) messages.push(stdoutMessage);
    if (stderrMessage) messages.push(stderrMessage);
  }
  return messages;
};

const runScripts = async (
  client: any,
  directory: string,
  scripts: string[],
  payload: unknown,
) => {
  for (const script of scripts) {
    await runScript(client, directory, script, payload);
  }
};

export const HooksPlugin: Plugin = async ({ client, directory, worktree }) => {
  const initialWorktreePath = normalizeWorktreePath(worktree);

  const loadConfig = async (configDirectory = directory): Promise<HookConfig> => {
    try {
      const configPath = `${configDirectory}/.opencode/hooks.json`;
      const content = await (globalThis as any).Bun.file(configPath).text();
      return JSON.parse(content);
    } catch (error) {
      if (configDirectory !== directory) {
        return loadConfig(directory);
      }

      if (error instanceof Error && error.name !== "ENOENT") {
        await client.app.log({
          body: {
            service: "photo-heart-hooks",
            level: "warn",
            message: "Failed to load hooks config",
            extra: {
              error: error.message,
            },
          },
        });
      }
      return {};
    }
  };

  return {
    "session.created": async () => {
      const config = await loadConfig();
      const scripts = await getToolScripts(
        client,
        config,
        "session.created",
        "*",
      );
      await runScripts(client, directory, scripts, {
        event: "session.created",
        directory,
        activeWorktreePath: initialWorktreePath,
        worktreePath: initialWorktreePath,
      });
    },

    "server.connected": async () => {
      const config = await loadConfig();
      const scripts = await getToolScripts(
        client,
        config,
        "server.connected",
        "*",
      );
      const fallbackScripts =
        scripts.length === 0
          ? await getToolScripts(client, config, "session.created", "*")
          : [];
      await runScripts(client, directory, scripts, {
        event: "server.connected",
        directory,
        activeWorktreePath: initialWorktreePath,
        worktreePath: initialWorktreePath,
      });
      await runScripts(client, directory, fallbackScripts, {
        event: "server.connected",
        directory,
        activeWorktreePath: initialWorktreePath,
        worktreePath: initialWorktreePath,
      });
    },

    "tool.execute.after": async (input: any, output: any) => {
      const runtime = await getRuntimeContext(client, directory, initialWorktreePath);
      const config = await loadConfig(runtime.directory);
      const tool = (input.tool || "").toLowerCase();
      const args = input.args || {};
      const command = args.command || "";
      const payload = buildHookPayload(
        runtime.directory,
        "tool.execute.after",
        input,
        runtime.activeWorktreePath,
      );
      const messages: string[] = [];

      const toolScripts = await getToolScripts(
        client,
        config,
        "tool.execute.after",
        tool,
      );
      messages.push(
        ...(await runScriptsAndCollectMessages(
          client,
          runtime.directory,
          toolScripts,
          payload,
        )),
      );

      if (tool === "bash") {
        const bashTriggerScripts = await getBashTriggerScripts(
          client,
          config,
          "tool.execute.after",
          command,
        );
        messages.push(
          ...(await runScriptsAndCollectMessages(
            client,
            runtime.directory,
            bashTriggerScripts,
            payload,
          )),
        );
      }

      const wildcardScripts = await getToolScripts(
        client,
        config,
        "tool.execute.after",
        "*",
      );
      messages.push(
        ...(await runScriptsAndCollectMessages(
          client,
          runtime.directory,
          wildcardScripts,
          payload,
        )),
      );

      appendToolOutput(output, messages);
    },

    "tool.execute.before": async (input: any) => {
      const runtime = await getRuntimeContext(client, directory, initialWorktreePath);
      const config = await loadConfig(runtime.directory);
      const tool = (input.tool || "").toLowerCase();
      const args = input.args || {};
      const command = args.command || "";
      const payload = buildHookPayload(
        runtime.directory,
        "tool.execute.before",
        input,
        runtime.activeWorktreePath,
      );

      const toolScripts = await getToolScripts(
        client,
        config,
        "tool.execute.before",
        tool,
      );
      await runScripts(client, runtime.directory, toolScripts, payload);

      if (tool === "bash") {
        const bashTriggerScripts = await getBashTriggerScripts(
          client,
          config,
          "tool.execute.before",
          command,
        );
        await runScripts(client, runtime.directory, bashTriggerScripts, payload);
      }

      const wildcardScripts = await getToolScripts(
        client,
        config,
        "tool.execute.before",
        "*",
      );
      await runScripts(client, runtime.directory, wildcardScripts, payload);
    },
  };
};
