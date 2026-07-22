import { cleanupApprovalQueue } from "../server/src/approval-queue-cleanup-service.mjs";

const apply = process.argv.includes("--apply");

const preview = await cleanupApprovalQueue({ dryRun: true });
console.log(JSON.stringify({ phase: "preview", ...preview }, null, 2));

if (apply) {
  const result = await cleanupApprovalQueue({ dryRun: false, confirm: true });
  console.log(JSON.stringify({ phase: "apply", ...result }, null, 2));
}
