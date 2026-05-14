import { type Plugin, tool } from "@opencode-ai/plugin";
import { readFileSync } from "fs";

const agentsDir = new URL("./agents/", import.meta.url);

function loadAgent(name: string): string {
  const path = new URL(`${name}.md`, agentsDir);
  try {
    const content = readFileSync(path, "utf-8").trim();
    if (!content) {
      throw new Error(`Agent prompt is empty: ${name}.md`);
    }
    return content;
  } catch {
    throw new Error(`Missing or unreadable agent prompt: ${name}.md`);
  }
}

export const PRReviewToolkitPlugin: Plugin = async () => {
  const prompts = {
    "comment-analyzer": loadAgent("comment-analyzer"),
    "pr-test-analyzer": loadAgent("pr-test-analyzer"),
    "silent-failure-hunter": loadAgent("silent-failure-hunter"),
    "type-design-analyzer": loadAgent("type-design-analyzer"),
    "code-reviewer": loadAgent("code-reviewer"),
    "code-simplifier": loadAgent("code-simplifier"),
  } as const;

  return {
    tool: {
      pr_review_toolkit_prompt: tool({
        description:
          "Returns PR review prompts for the specialized review agents",
        args: {
          prompt: tool.schema.enum([
            "all",
            "comment-analyzer",
            "pr-test-analyzer",
            "silent-failure-hunter",
            "type-design-analyzer",
            "code-reviewer",
            "code-simplifier",
          ]).describe("Which prompt to retrieve"),
        },
        async execute(args) {
          if (args.prompt !== "all") {
            return prompts[args.prompt];
          }

          return `You are running a comprehensive PR review. Launch the following 6 agents in parallel using the Task tool:\n\n1. **comment-analyzer** - Analyze code comments for accuracy and maintainability\n2. **pr-test-analyzer** - Review test coverage quality and completeness\n3. **silent-failure-hunter** - Detect hidden error handling issues\n4. **type-design-analyzer** - Evaluate type invariants and encapsulation\n5. **code-reviewer** - General code quality and project guidelines\n6. **code-simplifier** - Suggest clarity improvements\n\nFor each agent, provide the relevant context (PR diff, changed files, etc.) and collect their findings.\n\nAfter all agents complete, synthesize their findings into a unified report with:\n- Critical Issues (must fix)\n- Important Improvements (should fix)\n- Suggestions (nice to have)\n- Positive Findings\n\n---\n\nAGENT PROMPTS:\n\n${prompts["comment-analyzer"]}\n\n---\n\n${prompts["pr-test-analyzer"]}\n\n---\n\n${prompts["silent-failure-hunter"]}\n\n---\n\n${prompts["type-design-analyzer"]}\n\n---\n\n${prompts["code-reviewer"]}\n\n---\n\n${prompts["code-simplifier"]}`;
        },
      }),
    },
  };
};
