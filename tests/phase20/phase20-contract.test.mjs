import { createHash, randomBytes } from "node:crypto";
import { readFile, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { createExportBundle } from "../../server/src/backup-export-service.mjs";
import { buildWriterWorkbenchState } from "../../server/src/writer-workbench-state-service.mjs";
import {
  createSettingChangeProposal,
  listSettingChangeProposals,
} from "../../server/src/setting-change-proposal-service.mjs";
import { projectPaths, projectRoot } from "../../server/src/project-paths.mjs";
import { confirmApprovalItem } from "../../server/src/approval-queue-service.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function hashFile(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function hashDirectory(directory) {
  const records = [];
  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(fullPath);
      else if (entry.isFile()) {
        records.push(`${path.relative(directory, fullPath)}:${await hashFile(fullPath)}`);
      }
    }
  }
  await walk(directory);
  return createHash("sha256").update(records.join("\n")).digest("hex");
}

async function main() {
  const token = randomBytes(4).toString("hex");
  const proposalRoot = path.join(projectPaths.settingChangeProposals, `.phase20-${token}`);
  const approvalRoot = path.join(projectPaths.approvalQueue, `.phase20-${token}`);
  let reviewExport = null;
  const before = {
    activeEngine: await hashFile(projectPaths.activeEngine),
    canonDb: await hashDirectory(projectPaths.canonDb),
    compressedRules: await hashFile(projectPaths.compressedRules),
  };
  try {
    const result = await createSettingChangeProposal({
      target_setting_id: "canon_setting_test",
      setting_type: "character",
      title: "主角身份變更測試",
      before: "身份：學生",
      after: "身份：代表",
      reason: "主角身份變更只建立提案，不得直接寫入正史。",
      source: "phase20_contract_test",
      created_by: "test",
    }, {
      settingChangeProposals: proposalRoot,
      approvalQueue: approvalRoot,
    });
    assert(result.proposal.status === "pending_review", "proposal status must be pending_review");
    assert(result.proposal.risk_level === "P0", "high-risk proposal must be P0");
    assert(result.proposal.requires_second_confirm === true, "P0 proposal needs secondConfirm");
    assert(result.proposal.diff.changed === true, "proposal diff is missing");
    assert(
      result.approval_item.action_type === "setting_change_proposal",
      "proposal did not enter Approval Queue",
    );
    assert(
      result.approval_item.details.direct_apply_allowed === false,
      "setting proposal unexpectedly allows direct apply",
    );
    assert((await listSettingChangeProposals({}, {
      settingChangeProposals: proposalRoot,
    })).length === 1, "proposal was not persisted");
    const approvalResult = await confirmApprovalItem(
      result.approval_item.approval_item_id,
      {
        confirm: true,
        secondConfirm: true,
        approvalText: "確認設定修改",
        approvedBy: "test",
      },
      { approvalQueue: approvalRoot },
    );
    assert(
      approvalResult.result.applied_to_canon === false,
      "proposal approval unexpectedly applied canon",
    );

    const afterProposal = {
      activeEngine: await hashFile(projectPaths.activeEngine),
      canonDb: await hashDirectory(projectPaths.canonDb),
      compressedRules: await hashFile(projectPaths.compressedRules),
    };
    assert(afterProposal.activeEngine === before.activeEngine, "proposal modified active_engine");
    assert(afterProposal.canonDb === before.canonDb, "proposal modified Canon DB");
    assert(afterProposal.compressedRules === before.compressedRules, "proposal modified compressed_rules");

    reviewExport = await createExportBundle({
      export_type: "review_package",
      createdBy: "phase20-test",
    });
    const required = [
      ".gitignore",
      "README.md",
      "SKILL.md",
      "package.json",
      "package-lock.json",
      "launcher.cmd",
      "launcher.ps1",
      ".github/workflows/ci.yml",
      "data/memory_store/canon_memory.json",
      "data/memory_store/preference_memory.json",
      "data/memory_store/working_memory.json",
      "data/outputs/current_prompt.md",
      "data/outputs/generation_context.md",
      "data/outputs/retrieval_context.md",
      "data/outputs/task_prompt.md",
      "prompts/generate_chapter.md",
      "prompts/proofread_draft.md",
      "prompts/settle_chapter.md",
      "prompts/compress_errors.md",
      "prompts/rewrite_by_errors.md",
      "data/visual_db/index.jsonl",
      "data/visual_db/assets",
    ];
    for (const relativePath of required) {
      assert(
        await exists(path.join(reviewExport.path, relativePath)),
        `review package missing ${relativePath}`,
      );
    }
    assert(
      (await readFile(path.join(reviewExport.path, ".gitignore"), "utf8"))
        .includes("data/visual_db/assets/"),
      "review package .gitignore does not ignore visual assets",
    );
    assert(
      (await readFile(path.join(reviewExport.path, "README.md"), "utf8")).includes("launcher.cmd"),
      "README.md does not document launcher.cmd",
    );

    const workbench = await buildWriterWorkbenchState();
    const endpoints = new Set(workbench.next_actions.map((item) => item.endpoint));
    assert(
      endpoints.has("/api/writer-workbench/save-chat-output-candidate"),
      "next_actions is missing the real save candidate API",
    );
    assert(endpoints.has("#approval"), "next_actions is missing the valid approval hash route");
    assert(!endpoints.has("/api/writer-workbench/save-candidate"), "stale save API returned");
    assert(!endpoints.has("/ui/approval-queue"), "stale approval route returned");
    assert(workbench.safety.direct_activation_allowed === false, "direct activation was enabled");
    assert(
      workbench.safety.proposal_only_setting_changes === true,
      "setting changes are not proposal-only",
    );

    const html = await readFile(path.join(projectRoot, "server", "ui", "index.html"), "utf8");
    const views = [...html.matchAll(/data-view="([^"]+)"/gu)].map((match) => match[1]);
    const panels = new Set(
      [...html.matchAll(/data-view-panel="([^"]+)"/gu)].map((match) => match[1]),
    );
    assert(views.every((view) => panels.has(view)), "a sidebar data-view has no panel");
    assert(panels.has("settings"), "Settings panel is missing");
    assert(!html.includes("確認啟用新版引擎"), "fake activation label remains");

    console.log("Phase 20 contract tests passed.");
  } finally {
    if (reviewExport) await rm(reviewExport.path, { recursive: true, force: true });
    await rm(proposalRoot, { recursive: true, force: true });
    await rm(approvalRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`Phase 20 contract tests failed: ${error.message}`);
  process.exitCode = 1;
});
