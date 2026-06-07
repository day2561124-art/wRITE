import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeProjectPath,
  projectPaths,
  resolveGeneratedMarkdownPath,
} from "../project-paths.mjs";
import {
  atomicWriteFile,
  commitFileTransaction,
  createTransactionId,
} from "../file-transactions.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..", "..");
const currentPromptPath = path.join(projectPaths.outputs, "current_prompt.md");
const generationContextPath = path.join(projectPaths.outputs, "generation_context.md");
const runsDir = path.join(projectPaths.outputs, "runs");

const toolPaths = {
  buildCurrentPrompt: path.join(rootDir, "server", "src", "tools", "build-current-prompt.mjs"),
  searchContext: path.join(rootDir, "server", "src", "tools", "search-context.mjs"),
  buildTaskPrompt: path.join(rootDir, "server", "src", "tools", "build-task-prompt.mjs"),
};

const defaultTask =
  "下一章正文候選：請先依 generation_context 與 retrieval_context 檢查可承接範圍，列出本次起稿不可越界事項，再生成正文候選。";

function usage() {
  return [
    "Usage:",
    "  node server/src/tools/run-pipeline.mjs --query <keywords> [--task <text>] [--mode next-chapter|proofread|settle|debug] [--top 12]",
    "",
    "Options:",
    "  --query <keywords>              Retrieval keywords, e.g. \"朝日奈千夜 九逃 醫療後座\"",
    "  --task <text>                   User task for task_prompt.md",
    "  --mode <mode>                   Task mode. Default: next-chapter",
    "  --top <number>                  Retrieval result count. Default: 12",
    "  --retrieval-output <path>       Retrieval output path. Default: data/outputs/retrieval_context.md",
    "  --task-output <path>            Task prompt output path. Default: data/outputs/task_prompt.md",
    "",
    "Examples:",
    "  node server/src/tools/run-pipeline.mjs --query \"朝日奈千夜 九逃 醫療後座\" --task \"下一章正文候選：承接第十九章醫療後座\"",
    "  node server/src/tools/run-pipeline.mjs 正式選拔 戰鬥 後座 --top 8",
  ].join("\n");
}

function parseArgs(argv) {
  const options = {
    query: "",
    queryParts: [],
    task: defaultTask,
    mode: "next-chapter",
    top: 12,
    retrievalOutput: "data/outputs/retrieval_context.md",
    taskOutput: "data/outputs/task_prompt.md",
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      return options;
    }

    if (arg === "--query") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--query requires keywords.");
      }
      options.query = value;
      index += 1;
      continue;
    }

    if (arg === "--task") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--task requires text.");
      }
      options.task = value;
      index += 1;
      continue;
    }

    if (arg === "--mode") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--mode requires a value.");
      }
      options.mode = value;
      index += 1;
      continue;
    }

    if (arg === "--top") {
      const value = Number.parseInt(argv[index + 1], 10);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("--top must be a positive integer.");
      }
      options.top = value;
      index += 1;
      continue;
    }

    if (arg === "--retrieval-output") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--retrieval-output requires a path.");
      }
      options.retrievalOutput = normalizeProjectPath(
        resolveGeneratedMarkdownPath(value, "--retrieval-output"),
      );
      index += 1;
      continue;
    }

    if (arg === "--task-output") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--task-output requires a path.");
      }
      options.taskOutput = normalizeProjectPath(
        resolveGeneratedMarkdownPath(value, "--task-output"),
      );
      index += 1;
      continue;
    }

    options.queryParts.push(arg);
  }

  if (!options.query && options.queryParts.length > 0) {
    options.query = options.queryParts.join(" ");
  }

  if (!options.query) {
    throw new Error("Provide retrieval keywords with --query or positional keywords.");
  }

  const retrievalPath = resolveGeneratedMarkdownPath(options.retrievalOutput, "--retrieval-output");
  const taskPath = resolveGeneratedMarkdownPath(options.taskOutput, "--task-output");
  const publishPaths = [currentPromptPath, generationContextPath, retrievalPath, taskPath];
  if (new Set(publishPaths).size !== publishPaths.length) {
    throw new Error("Pipeline output paths must be distinct from each other and from current_prompt.md/generation_context.md.");
  }

  return options;
}

function normalizePath(filePath) {
  return path.relative(rootDir, path.isAbsolute(filePath) ? filePath : path.join(rootDir, filePath)).replaceAll(path.sep, "/");
}

function runNodeStep(label, scriptPath, args) {
  return new Promise((resolve, reject) => {
    console.log("");
    console.log(`== ${label} ==`);
    console.log(`node ${normalizePath(scriptPath)} ${args.join(" ")}`);

    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: rootDir,
      stdio: "inherit",
      shell: false,
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${label} failed with exit code ${code}.`));
    });
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const queryTerms = options.query.split(/[\s,，、]+/).filter(Boolean);
  const startedAt = new Date();
  const runId = `RUN-${startedAt.toISOString().replace(/[-:.]/g, "").replace("T", "-").replace("Z", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const runDir = path.join(runsDir, runId);
  const runCurrentPrompt = path.join(runDir, "current_prompt.md");
  const runGenerationContext = path.join(runDir, "generation_context.md");
  const runRetrievalContext = path.join(runDir, "retrieval_context.md");
  const runTaskPrompt = path.join(runDir, "task_prompt.md");
  const runManifest = path.join(runDir, "manifest.json");
  const baseManifest = {
    run_id: runId,
    started_at: startedAt.toISOString(),
    status: "running",
    inputs: {
      query: options.query,
      task: options.task,
      mode: options.mode,
      top: options.top,
    },
    isolated_outputs: {
      current_prompt: normalizePath(runCurrentPrompt),
      generation_context: normalizePath(runGenerationContext),
      retrieval_context: normalizePath(runRetrievalContext),
      task_prompt: normalizePath(runTaskPrompt),
    },
    publish_targets: {
      current_prompt: normalizePath(currentPromptPath),
      generation_context: normalizePath(generationContextPath),
      retrieval_context: options.retrievalOutput,
      task_prompt: options.taskOutput,
    },
  };
  await atomicWriteFile(runManifest, `${JSON.stringify(baseManifest, null, 2)}\n`, {
    tool: "run-pipeline",
    run_id: runId,
    status: "running",
  });

  console.log("Pipeline inputs:");
  console.log(`- Run ID: ${runId}`);
  console.log(`- Query: ${options.query}`);
  console.log(`- Task: ${options.task}`);
  console.log(`- Mode: ${options.mode}`);
  console.log(`- Top: ${options.top}`);
  console.log(`- Retrieval output: ${options.retrievalOutput}`);
  console.log(`- Task output: ${options.taskOutput}`);

  try {
    await runNodeStep("Build current prompt", toolPaths.buildCurrentPrompt, [
      "--full-output",
      normalizePath(runCurrentPrompt),
      "--compact-output",
      normalizePath(runGenerationContext),
    ]);
    await runNodeStep("Search retrieval context", toolPaths.searchContext, [
      ...queryTerms,
      "--top",
      String(options.top),
      "--output",
      normalizePath(runRetrievalContext),
    ]);
    if (process.env.PIPELINE_TEST_FAIL_AFTER === "search") {
      throw new Error("Injected pipeline failure after search.");
    }
    await runNodeStep("Build task prompt", toolPaths.buildTaskPrompt, [
      "--mode",
      options.mode,
      "--task",
      options.task,
      "--generation",
      normalizePath(runGenerationContext),
      "--retrieval",
      normalizePath(runRetrievalContext),
      "--output",
      normalizePath(runTaskPrompt),
    ]);

    const [currentPrompt, generationContext, retrievalContext, taskPrompt] = await Promise.all([
      readFile(runCurrentPrompt),
      readFile(runGenerationContext),
      readFile(runRetrievalContext),
      readFile(runTaskPrompt),
    ]);
    const transactionId = createTransactionId();
    const completedManifest = {
      ...baseManifest,
      status: "completed",
      completed_at: new Date().toISOString(),
      publish_transaction_id: transactionId,
    };
    await commitFileTransaction("publish-pipeline-run", [
      { type: "write", filePath: currentPromptPath, content: currentPrompt },
      { type: "write", filePath: generationContextPath, content: generationContext },
      {
        type: "write",
        filePath: resolveGeneratedMarkdownPath(options.retrievalOutput, "--retrieval-output"),
        content: retrievalContext,
      },
      {
        type: "write",
        filePath: resolveGeneratedMarkdownPath(options.taskOutput, "--task-output"),
        content: taskPrompt,
      },
      { type: "write", filePath: runManifest, content: `${JSON.stringify(completedManifest, null, 2)}\n` },
    ], { transaction_id: transactionId, run_id: runId });
  } catch (error) {
    await atomicWriteFile(runManifest, `${JSON.stringify({
      ...baseManifest,
      status: "failed",
      completed_at: new Date().toISOString(),
      error: error.message,
    }, null, 2)}\n`, {
      tool: "run-pipeline",
      run_id: runId,
      status: "failed",
    });
    throw error;
  }

  console.log("");
  console.log("Pipeline complete.");
  console.log(`- Generation context: data/outputs/generation_context.md`);
  console.log(`- Retrieval context: ${options.retrievalOutput}`);
  console.log(`- Task prompt: ${options.taskOutput}`);
  console.log(`- Run manifest: ${normalizePath(runManifest)}`);
}

main().catch((error) => {
  console.error("");
  console.error(error.message);
  console.error("");
  console.error(usage());
  process.exitCode = 1;
});
