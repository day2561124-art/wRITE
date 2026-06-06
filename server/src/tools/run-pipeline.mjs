import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..", "..");

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
      options.retrievalOutput = value;
      index += 1;
      continue;
    }

    if (arg === "--task-output") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--task-output requires a path.");
      }
      options.taskOutput = value;
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

  console.log("Pipeline inputs:");
  console.log(`- Query: ${options.query}`);
  console.log(`- Task: ${options.task}`);
  console.log(`- Mode: ${options.mode}`);
  console.log(`- Top: ${options.top}`);
  console.log(`- Retrieval output: ${options.retrievalOutput}`);
  console.log(`- Task output: ${options.taskOutput}`);

  await runNodeStep("Build current prompt", toolPaths.buildCurrentPrompt, []);
  await runNodeStep("Search retrieval context", toolPaths.searchContext, [
    ...queryTerms,
    "--top",
    String(options.top),
    "--output",
    options.retrievalOutput,
  ]);
  await runNodeStep("Build task prompt", toolPaths.buildTaskPrompt, [
    "--mode",
    options.mode,
    "--task",
    options.task,
    "--retrieval",
    options.retrievalOutput,
    "--output",
    options.taskOutput,
  ]);

  console.log("");
  console.log("Pipeline complete.");
  console.log(`- Generation context: data/outputs/generation_context.md`);
  console.log(`- Retrieval context: ${options.retrievalOutput}`);
  console.log(`- Task prompt: ${options.taskOutput}`);
}

main().catch((error) => {
  console.error("");
  console.error(error.message);
  console.error("");
  console.error(usage());
  process.exitCode = 1;
});
