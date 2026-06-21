import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  adoptedWritingSettlementToolMetadata,
  adoptedWritingSettlementTools,
} from "../../server/src/mcp-adopted-writing-settlement-tools.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function main() {
  const activeHash = hash(await readFile(projectPaths.activeEngine));
  const names = [
    "build_adopted_writing_settlement_context",
    "get_adopted_writing_settlement_context",
    "get_foreshadowing_settlement_surface",
    "list_adopted_writing_settlement_contexts",
    "save_chat_output_as_settlement_report",
    "get_settlement_report_detail",
    "list_settlement_reports",
    "build_pending_engine_candidate_from_settlement_report",
  ];
  for (const name of names) {
    assert(typeof adoptedWritingSettlementTools[name] === "function", `${name} is missing.`);
    const metadata = adoptedWritingSettlementToolMetadata[name];
    assert(metadata, `${name} metadata is missing.`);
    assert(metadata.can_modify_active_engine === false, `${name} may modify active engine.`);
    assert(metadata.can_activate_engine === false, `${name} may activate engine.`);
    assert(metadata.can_approve === false, `${name} may approve.`);
    assert(metadata.can_rollback === false, `${name} may rollback.`);
    assert(metadata.can_execute_cleanup === false, `${name} may execute cleanup.`);
    assert(metadata.can_generate_locally === false, `${name} may generate locally.`);
    assert(
      metadata.can_create_activation_request === false,
      `${name} may create activation requests.`,
    );
  }
  assert(
    adoptedWritingSettlementToolMetadata
      .build_pending_engine_candidate_from_settlement_report
      .requires_user_confirmation_for_activation === true,
    "Pending candidate metadata omitted activation confirmation.",
  );
  const blocked = await adoptedWritingSettlementTools
    .build_adopted_writing_settlement_context({});
  assert(!blocked.ok && blocked.blocked, "Invalid MCP input was not blocked.");
  assert(
    hash(await readFile(projectPaths.activeEngine)) === activeHash,
    "MCP settlement tools changed active_engine.md.",
  );
  console.log("MCP adopted writing settlement tools test passed.");
}

main().catch((error) => {
  console.error(`MCP adopted writing settlement tools test failed: ${error.message}`);
  process.exitCode = 1;
});
