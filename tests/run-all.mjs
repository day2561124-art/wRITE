import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { terminateProcessTree } from "../server/src/process-control.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const steps = [
  ["JSON/codeblock validation", ["server/src/tools/validate-json-codeblocks.mjs"]],
  ["Strict JSONL validation", ["server/src/tools/validate-jsonl.mjs", "--all", "--strict"]],
  ["Source trust validation", ["server/src/tools/source-trust-checker.mjs"]],
  ["Source registry contract", ["tests/source-registry.test.mjs"]],
  ["Visual DB contract", ["tests/visual-db.test.mjs"]],
  ["Visual asset reindex", ["tests/visual-reindex.test.mjs"]],
  ["Visual metadata update", ["tests/visual-metadata.test.mjs"]],
  ["Agent run service", ["tests/agent/agent-run-service.test.mjs"]],
  ["Neural trace service", ["tests/agent/neural-trace-service.test.mjs"]],
  ["Launcher contract", ["tests/launcher.test.mjs"]],
  ["Path policy security", ["tests/security/path-policy.test.mjs"]],
  ["File transaction rollback", ["tests/transactions/file-transactions.test.mjs"]],
  ["Engine candidate service", ["tests/canon/engine-candidate-service.test.mjs"]],
  ["Writing workflow service", ["tests/workflow/writing-workflow-service.test.mjs"]],
  ["Settlement workflow service", ["tests/workflow/settlement-workflow-service.test.mjs"]],
  ["Approval queue service", ["tests/approval/approval-queue-service.test.mjs"]],
  ["Cleanup proposal service", ["tests/cleanup/cleanup-proposal-service.test.mjs"]],
  ["Backup export service", ["tests/backup/backup-export-service.test.mjs"]],
  ["Phase 20 contracts", ["tests/phase20/phase20-contract.test.mjs"]],
  ["Phase 21 entity registry contracts", ["tests/phase21/phase21-entity-registry-contract.test.mjs"]],
  ["Phase 22 writing card director", ["tests/phase22/phase22a-writing-card-director-service.test.mjs", "tests/phase22/phase22a-writing-card-director-context.test.mjs"]],
  ["Phase 22 neural trace materialization", ["tests/phase22/phase22g-writing-context-trace.test.mjs", "tests/phase22/phase22h-neural-trace-option-exposure.test.mjs"]],
  ["Phase 22 guard report explainability", ["tests/phase22/phase22o-guard-report-explainability.test.mjs", "tests/phase22/phase22p-guard-report-display-polish.test.mjs"]],
  ["Phase 22 final polisher editorial brain", ["tests/phase22/phase22t-final-polisher-editorial-brain.test.mjs"]],
  ["Phase 22 full neural writing orchestrator", ["tests/phase22/phase22u-full-neural-writing-orchestrator.test.mjs"]],
  ["Phase 22 orchestrator candidate save bridge", ["tests/phase22/phase22v-orchestrator-candidate-save-bridge.test.mjs"]],
  ["Phase 22 bridge orchestrator surface", ["tests/phase22/phase22w-bridge-orchestrator-surface.test.mjs"]],
  ["Phase 22 UI orchestrator status", ["tests/phase22/phase22x-ui-orchestrator-status.test.mjs"]],
  ["Phase 23C character voice registry context", ["tests/phase23/phase23c-character-voice-registry-context.test.mjs"]],
  ["Phase 23F character voice drift guard", ["tests/phase23/phase23f-character-voice-drift-guard.test.mjs"]],
  ["Phase 23G character voice guard surface", ["tests/phase23/phase23g-character-voice-guard-surface.test.mjs"]],
  ["Phase 23H character voice adoption gate", ["tests/phase23/phase23h-character-voice-adoption-gate.test.mjs"]],
  ["Phase 23I character voice live adoption smoke", ["tests/phase23/phase23i-character-voice-live-adoption-smoke.test.mjs"]],
  ["Phase 24A backend full recursive writing pipeline", ["tests/phase24/phase24a-backend-full-recursive-writing-pipeline.test.mjs"]],
  ["Phase 24B backend generation provider bridge", ["tests/phase24/phase24b-backend-generation-provider-bridge.test.mjs"]],
  ["Phase 24C provider live smoke ChatGPT output path", ["tests/phase24/phase24c-provider-live-smoke-chatgpt-output-path.test.mjs"]],
  ["Phase 25A character mind-state ledger", ["tests/phase25/phase25a-character-mind-state-ledger.test.mjs"]],
  ["Phase 26A dramatic conflict manager", ["tests/phase26/phase26a-dramatic-conflict-manager.test.mjs"]],
  ["Phase 27A foreshadowing causal graph", ["tests/phase27/phase27a-foreshadowing-causal-graph.test.mjs"]],
  ["Phase 27B foreshadowing payoff guard", ["tests/phase27/phase27b-foreshadowing-payoff-guard.test.mjs"]],
  ["Phase 27C foreshadowing payoff repair planner", ["tests/phase27/phase27c-foreshadowing-payoff-repair-planner.test.mjs"]],
  ["Phase 27D foreshadowing payoff acceptance gate", ["tests/phase27/phase27d-foreshadowing-payoff-acceptance-gate.test.mjs"]],
  ["Phase 27E foreshadowing settlement diff preview", ["tests/phase27/phase27e-foreshadowing-settlement-diff-preview.test.mjs"]],
  ["Phase 27F foreshadowing settlement proposal bridge", ["tests/phase27/phase27f-foreshadowing-settlement-proposal-bridge.test.mjs"]],
  ["Phase 27G foreshadowing settlement surface", ["tests/phase27/phase27g-foreshadowing-settlement-surface.test.mjs"]],
  ["Phase 27H foreshadowing settlement full workflow smoke", ["tests/phase27/phase27h-foreshadowing-settlement-full-workflow-smoke.test.mjs"]],
  ["Phase 27I foreshadowing settlement live adoption smoke", ["tests/phase27/phase27i-foreshadowing-settlement-live-adoption-smoke.test.mjs"]],
  ["Phase 27J foreshadowing settlement operator review panel", ["tests/phase27/phase27j-foreshadowing-settlement-operator-review-panel.test.mjs"]],
  ["Phase 27K foreshadowing settlement operator review panel UI", ["tests/phase27/phase27k-foreshadowing-settlement-operator-review-panel-ui.test.mjs"]],
  ["Phase 27L foreshadowing settlement operator handoff packet", ["tests/phase27/phase27l-foreshadowing-settlement-operator-handoff-packet.test.mjs"]],
  ["Phase 27M foreshadowing settlement operator handoff audit receipt", ["tests/phase27/phase27m-foreshadowing-settlement-operator-handoff-audit-receipt.test.mjs"]],
  ["Phase 27N foreshadowing settlement operator decision ledger", ["tests/phase27/phase27n-foreshadowing-settlement-operator-decision-ledger.test.mjs"]],
  ["Phase 27O foreshadowing settlement operator ledger UI", ["tests/phase27/phase27o-foreshadowing-settlement-operator-ledger-ui.test.mjs"]],
  ["Phase 27P foreshadowing settlement operator ledger bridge surface", ["tests/phase27/phase27p-foreshadowing-settlement-operator-ledger-bridge-surface.test.mjs"]],
  ["Phase 27Q foreshadowing settlement operator full bridge smoke", ["tests/phase27/phase27q-foreshadowing-settlement-operator-full-bridge-smoke.test.mjs"]],
  ["Phase 27R foreshadowing settlement operator readiness dashboard", ["tests/phase27/phase27r-foreshadowing-settlement-operator-readiness-dashboard.test.mjs"]],
  ["Phase 27S foreshadowing settlement operator dashboard live UI smoke", ["tests/phase27/phase27s-foreshadowing-settlement-operator-dashboard-live-ui-smoke.test.mjs"]],
  ["Phase 27T foreshadowing settlement operator adoption readiness gate", ["tests/phase27/phase27t-foreshadowing-settlement-operator-adoption-readiness-gate.test.mjs"]],
  ["Phase 27U foreshadowing settlement operator adoption gate UI bridge surface", ["tests/phase27/phase27u-foreshadowing-settlement-operator-adoption-gate-ui-bridge-surface.test.mjs"]],
  ["Phase 27V foreshadowing settlement operator adoption gate live UI smoke", ["tests/phase27/phase27v-foreshadowing-settlement-operator-adoption-gate-live-ui-smoke.test.mjs"]],
  ["Phase 27W foreshadowing settlement operator manual adoption review entry packet", ["tests/phase27/phase27w-foreshadowing-settlement-operator-manual-adoption-review-entry-packet.test.mjs"]],
  ["Phase 27X foreshadowing settlement operator manual adoption review entry UI surface", ["tests/phase27/phase27x-foreshadowing-settlement-operator-manual-adoption-review-entry-ui-surface.test.mjs"]],
  ["Phase 27Y foreshadowing settlement operator manual adoption review entry live UI smoke", ["tests/phase27/phase27y-foreshadowing-settlement-operator-manual-adoption-review-entry-live-ui-smoke.test.mjs"]],
  ["Phase 27Z foreshadowing settlement operator manual adoption review entry final bridge smoke", ["tests/phase27/phase27z-foreshadowing-settlement-operator-manual-adoption-review-entry-final-bridge-smoke.test.mjs"]],
  ["Phase 28A foreshadowing settlement operator review chain index", ["tests/phase28/phase28a-foreshadowing-settlement-operator-review-chain-index.test.mjs"]],
  ["Phase 28B foreshadowing settlement operator review chain index UI surface", ["tests/phase28/phase28b-foreshadowing-settlement-operator-review-chain-index-ui-surface.test.mjs"]],
  ["Phase 28C foreshadowing settlement operator review chain index live UI smoke", ["tests/phase28/phase28c-foreshadowing-settlement-operator-review-chain-index-live-ui-smoke.test.mjs"]],
  ["Phase 28D foreshadowing settlement operator review chain index final bridge smoke", ["tests/phase28/phase28d-foreshadowing-settlement-operator-review-chain-index-final-bridge-smoke.test.mjs"]],
  ["Phase 28E foreshadowing settlement operator review chain index navigation hardening", ["tests/phase28/phase28e-foreshadowing-settlement-operator-review-chain-index-navigation-hardening.test.mjs"]],
  ["Phase 28F foreshadowing settlement operator review chain index recovery guide", ["tests/phase28/phase28f-foreshadowing-settlement-operator-review-chain-index-recovery-guide.test.mjs"]],
  ["Phase 28G foreshadowing settlement operator review chain index evidence packet export contract", ["tests/phase28/phase28g-foreshadowing-settlement-operator-review-chain-index-evidence-packet-export-contract.test.mjs"]],
  ["Phase 28H foreshadowing settlement operator review chain index evidence packet UI preview contract", ["tests/phase28/phase28h-foreshadowing-settlement-operator-review-chain-index-evidence-packet-ui-preview-contract.test.mjs"]],
  ["Phase 28I foreshadowing settlement operator review chain index evidence packet bridge preview contract", ["tests/phase28/phase28i-foreshadowing-settlement-operator-review-chain-index-evidence-packet-bridge-preview-contract.test.mjs"]],
  ["Phase 28J foreshadowing settlement operator review chain index evidence packet operator handoff final smoke", ["tests/phase28/phase28j-foreshadowing-settlement-operator-review-chain-index-evidence-packet-operator-handoff-final-smoke.test.mjs"]],
  ["Phase 28K foreshadowing settlement operator review chain index evidence packet archive readiness contract", ["tests/phase28/phase28k-foreshadowing-settlement-operator-review-chain-index-evidence-packet-archive-readiness-contract.test.mjs"]],
  ["Phase 28L foreshadowing settlement operator review chain index evidence packet archive manifest UI preview contract", ["tests/phase28/phase28l-foreshadowing-settlement-operator-review-chain-index-evidence-packet-archive-manifest-ui-preview-contract.test.mjs"]],
  ["Phase 28M foreshadowing settlement operator review chain index evidence packet archive manifest bridge preview contract", ["tests/phase28/phase28m-foreshadowing-settlement-operator-review-chain-index-evidence-packet-archive-manifest-bridge-preview-contract.test.mjs"]],
  ["Phase 28N foreshadowing settlement operator review chain index evidence packet archive manifest operator handoff final smoke", ["tests/phase28/phase28n-foreshadowing-settlement-operator-review-chain-index-evidence-packet-archive-manifest-operator-handoff-final-smoke.test.mjs"]],
  ["Phase 28O foreshadowing settlement operator review chain index evidence packet archive manifest final acceptance readiness contract", ["tests/phase28/phase28o-foreshadowing-settlement-operator-review-chain-index-evidence-packet-archive-manifest-final-acceptance-readiness-contract.test.mjs"]],
  ["Phase 28P foreshadowing settlement operator review chain index evidence packet archive manifest final acceptance operator checklist", ["tests/phase28/phase28p-foreshadowing-settlement-operator-review-chain-index-evidence-packet-archive-manifest-final-acceptance-operator-checklist.test.mjs"]],
  ["Phase 28Q foreshadowing settlement operator review chain index evidence packet archive manifest checklist bridge preview contract", ["tests/phase28/phase28q-foreshadowing-settlement-operator-review-chain-index-evidence-packet-archive-manifest-checklist-bridge-preview-contract.test.mjs"]],
  ["Phase 28R foreshadowing settlement operator review chain index evidence packet archive manifest checklist bridge preview final smoke", ["tests/phase28/phase28r-foreshadowing-settlement-operator-review-chain-index-evidence-packet-archive-manifest-checklist-bridge-preview-final-smoke.test.mjs"]],
  ["Phase 29A reader response simulator contract", ["tests/phase29/phase29a-reader-response-simulator-contract.test.mjs"]],
  ["Phase 29B reader response simulator UI surface", ["tests/phase29/phase29b-reader-response-simulator-ui-surface.test.mjs"]],
  ["Phase 29C reader response simulator bridge preview", ["tests/phase29/phase29c-reader-response-simulator-bridge-preview.test.mjs"]],
  ["Phase 30A aesthetic memory registry contract", ["tests/phase30/phase30a-aesthetic-memory-registry-contract.test.mjs"]],
  ["Phase 30B aesthetic memory registry UI surface", ["tests/phase30/phase30b-aesthetic-memory-registry-ui-surface.test.mjs"]],
  ["Phase 30C aesthetic memory bridge preview", ["tests/phase30/phase30c-aesthetic-memory-bridge-preview.test.mjs"]],
  ["Phase 31A aesthetic memory injection readiness gate", ["tests/phase31/phase31a-aesthetic-memory-injection-readiness-gate.test.mjs"]],
  ["Phase 31B aesthetic memory context adapter preview", ["tests/phase31/phase31b-aesthetic-memory-context-adapter-preview.test.mjs"]],
  ["Phase 31C aesthetic memory context adapter bridge preview", ["tests/phase31/phase31c-aesthetic-memory-context-adapter-bridge-preview.test.mjs"]],
  ["Phase 31D aesthetic memory context adapter final smoke", ["tests/phase31/phase31d-aesthetic-memory-context-adapter-final-smoke.test.mjs"]],
  ["Phase 31E aesthetic memory context builder readiness gate", ["tests/phase31/phase31e-aesthetic-memory-context-builder-readiness-gate.test.mjs"]],
  ["Phase 31F aesthetic memory context builder preview surface", ["tests/phase31/phase31f-aesthetic-memory-context-builder-preview-surface.test.mjs"]],
  ["Phase 31G aesthetic memory context builder bridge preview", ["tests/phase31/phase31g-aesthetic-memory-context-builder-bridge-preview.test.mjs"]],
  ["Phase 31H aesthetic memory context builder bridge final smoke", ["tests/phase31/phase31h-aesthetic-memory-context-builder-bridge-final-smoke.test.mjs"]],
  ["Phase 31I aesthetic memory context builder bridge stability guard", ["tests/phase31/phase31i-aesthetic-memory-context-builder-bridge-stability-guard.test.mjs"]],
  ["Phase 31J aesthetic memory context builder operator review packet", ["tests/phase31/phase31j-aesthetic-memory-context-builder-operator-review-packet.test.mjs"]],
  ["Phase 31K aesthetic memory context builder operator review packet UI surface", ["tests/phase31/phase31k-aesthetic-memory-context-builder-operator-review-packet-ui-surface.test.mjs"]],
  ["Phase 31L aesthetic memory context builder operator review packet bridge preview", ["tests/phase31/phase31l-aesthetic-memory-context-builder-operator-review-packet-bridge-preview.test.mjs"]],
  ["Phase 31M aesthetic memory context builder operator review packet bridge final smoke", ["tests/phase31/phase31m-aesthetic-memory-context-builder-operator-review-packet-bridge-final-smoke.test.mjs"]],
  ["Phase 31N aesthetic memory context builder operator review packet bridge stability guard", ["tests/phase31/phase31n-aesthetic-memory-context-builder-operator-review-packet-bridge-stability-guard.test.mjs"]],
  ["Phase 31O aesthetic memory context builder operator review packet bridge recovery guide", ["tests/phase31/phase31o-aesthetic-memory-context-builder-operator-review-packet-bridge-recovery-guide.test.mjs"]],
  ["Phase 31P aesthetic memory context builder operator review packet bridge evidence packet", ["tests/phase31/phase31p-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet.test.mjs"]],
  ["Phase 31Q aesthetic memory context builder operator review packet bridge evidence packet UI preview", ["tests/phase31/phase31q-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-ui-preview.test.mjs"]],
  ["Phase 31R aesthetic memory context builder operator review packet bridge evidence packet UI live smoke", ["tests/phase31/phase31r-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-ui-live-smoke.test.mjs"]],
  ["Phase 31S aesthetic memory context builder operator review packet bridge evidence packet bridge preview", ["tests/phase31/phase31s-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-bridge-preview.test.mjs"]],
  ["Phase 31T aesthetic memory context builder operator review packet bridge evidence packet final bridge smoke", ["tests/phase31/phase31t-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-bridge-smoke.test.mjs"]],
  ["Phase 31U aesthetic memory context builder operator review packet bridge evidence packet final acceptance readiness", ["tests/phase31/phase31u-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-readiness.test.mjs"]],
  ["Phase 31V aesthetic memory context builder operator review packet bridge evidence packet final acceptance operator checklist", ["tests/phase31/phase31v-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-operator-checklist.test.mjs"]],
  ["Phase 31W aesthetic memory context builder operator review packet bridge evidence packet final acceptance checklist bridge preview", ["tests/phase31/phase31w-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-checklist-bridge-preview.test.mjs"]],
  ["Phase 31X aesthetic memory context builder operator review packet bridge evidence packet final acceptance checklist bridge final smoke", ["tests/phase31/phase31x-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-checklist-bridge-final-smoke.test.mjs"]],
  ["Phase 31Y aesthetic memory context builder operator review packet bridge evidence packet final acceptance settlement handoff readiness", ["tests/phase31/phase31y-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-settlement-handoff-readiness.test.mjs"]],
  ["Phase 31Z aesthetic memory context builder operator review packet bridge evidence packet final acceptance settlement handoff operator checklist", ["tests/phase31/phase31z-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-settlement-handoff-operator-checklist.test.mjs"]],
  ["Phase 32A aesthetic memory context builder operator review packet bridge evidence packet final acceptance settlement handoff checklist bridge preview", ["tests/phase32/phase32a-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-settlement-handoff-checklist-bridge-preview.test.mjs"]],
  ["Phase 32B aesthetic memory context builder operator review packet bridge evidence packet final acceptance settlement handoff checklist bridge final smoke", ["tests/phase32/phase32b-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-settlement-handoff-checklist-bridge-final-smoke.test.mjs"]],
  ["Phase 32C aesthetic memory context builder operator review packet bridge evidence packet final acceptance settlement handoff checklist bridge stability guard", ["tests/phase32/phase32c-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-settlement-handoff-checklist-bridge-stability-guard.test.mjs"]],
  ["Phase 32D aesthetic memory context builder operator review packet bridge evidence packet final acceptance settlement handoff checklist bridge recovery guide", ["tests/phase32/phase32d-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-settlement-handoff-checklist-bridge-recovery-guide.test.mjs"]],
  ["Phase 32E aesthetic memory context builder operator review packet bridge evidence packet final acceptance settlement handoff checklist bridge recovery guide final smoke", ["tests/phase32/phase32e-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-settlement-handoff-checklist-bridge-recovery-guide-final-smoke.test.mjs"]],
  ["Phase 32F aesthetic memory context builder operator review packet bridge evidence packet final acceptance settlement handoff checklist bridge final closure guard", ["tests/phase32/phase32f-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-final-acceptance-settlement-handoff-checklist-bridge-final-closure-guard.test.mjs"]],
  ["Phase 33A aesthetic memory context builder final closure index", ["tests/phase33/phase33a-aesthetic-memory-context-builder-final-closure-index.test.mjs",
  "tests/phase33/phase33b-aesthetic-memory-context-builder-final-closure-index-bridge-preview.test.mjs",
  "tests/phase33/phase33c-aesthetic-memory-context-builder-final-closure-index-bridge-final-smoke.test.mjs",
  "tests/phase33/phase33d-aesthetic-memory-context-builder-final-closure-index-bridge-acceptance-readiness.test.mjs",
  "tests/phase33/phase33e-aesthetic-memory-context-builder-final-closure-index-bridge-acceptance-readiness-final-smoke.test.mjs",
  "tests/phase33/phase33f-aesthetic-memory-context-builder-final-closure-index-bridge-acceptance-readiness-final-closure.test.mjs",
  "tests/phase33/phase33g-aesthetic-memory-context-builder-final-closure-index-bridge-acceptance-readiness-final-closure-operator-checklist.test.mjs",
  "tests/phase33/phase33h-aesthetic-memory-context-builder-final-closure-index-bridge-acceptance-readiness-final-closure-operator-checklist-final-smoke.test.mjs",
  "tests/phase33/phase33i-aesthetic-memory-context-builder-final-closure-index-bridge-acceptance-readiness-final-closure-operator-checklist-final-closure.test.mjs"]],
  ["Phase 34A full neural writing pipeline single entry bridge", ["tests/phase34/phase34a-full-neural-writing-pipeline-single-entry-bridge.test.mjs"]],
  ["Phase 34B recursive revision policy hardening", ["tests/phase34/phase34b-recursive-revision-policy-hardening.test.mjs"]],
  ["Phase 34C reader response revision gate", ["tests/phase34/phase34c-reader-response-revision-gate.test.mjs"]],
  ["Phase 34D full pipeline acceptance evidence packet", ["tests/phase34/phase34d-full-pipeline-acceptance-evidence-packet.test.mjs"]],
  ["Phase 34E full pipeline acceptance evidence packet bridge surface", ["tests/phase34/phase34e-full-pipeline-acceptance-evidence-packet-bridge-surface.test.mjs"]],
  ["Phase 34F full pipeline live writing smoke", ["tests/phase34/phase34f-full-pipeline-live-writing-smoke.test.mjs"]],
  ["Phase 34G recursive revision policy stress matrix", ["tests/phase34/phase34g-recursive-revision-policy-stress-matrix.test.mjs"]],
  ["Phase 34H full pipeline reader acceptance regression matrix", ["tests/phase34/phase34h-full-pipeline-reader-acceptance-regression-matrix.test.mjs"]],
  ["Phase 34I full pipeline revision evidence bridge regression", ["tests/phase34/phase34i-full-pipeline-revision-evidence-bridge-regression.test.mjs"]],
  ["Phase 34J ChatGPT bridge final candidate output contract", ["tests/phase34/phase34j-chatgpt-bridge-final-candidate-output-contract.test.mjs"]],
  ["Phase 34K ChatGPT bridge failure output contract", ["tests/phase34/phase34k-chatgpt-bridge-failure-output-contract.test.mjs"]],
  ["Phase 34L ChatGPT bridge failure readable surface", ["tests/phase34/phase34l-chatgpt-bridge-failure-readable-surface.test.mjs"]],
  ["Phase 34M ChatGPT bridge success readable surface", ["tests/phase34/phase34m-chatgpt-bridge-success-readable-surface.test.mjs"]],
  ["Phase 34N ChatGPT bridge output surface symmetry regression", ["tests/phase34/phase34n-chatgpt-bridge-output-surface-symmetry-regression.test.mjs"]],
  ["Phase 34O ChatGPT bridge final response renderer contract", ["tests/phase34/phase34o-chatgpt-bridge-final-response-renderer-contract.test.mjs"]],
  ["Phase 34P ChatGPT bridge final response handoff contract", ["tests/phase34/phase34p-chatgpt-bridge-final-response-handoff-contract.test.mjs"]],
  ["Phase 34Q ChatGPT bridge final output live extraction contract", ["tests/phase34/phase34q-chatgpt-bridge-final-output-live-extraction-contract.test.mjs"]],
  ["Phase 34R ChatGPT bridge final output tool surface contract", ["tests/phase34/phase34r-chatgpt-bridge-final-output-tool-surface-contract.test.mjs"]],
  ["Phase 34S ChatGPT bridge final output consumer contract", ["tests/phase34/phase34s-chatgpt-bridge-final-output-consumer-contract.test.mjs"]],
  ["Phase 34T ChatGPT final output E2E compliance smoke", ["tests/phase34/phase34t-chatgpt-final-output-e2e-compliance-smoke.test.mjs"]],
  ["Phase 34U ChatGPT final output operator handoff checklist", ["tests/phase34/phase34u-chatgpt-final-output-operator-handoff-checklist.test.mjs"]],
  ["Phase 34V ChatGPT final output contract final closure index", ["tests/phase34/phase34v-chatgpt-final-output-contract-final-closure-index.test.mjs"]],
  ["Phase 34W ChatGPT final output live tool call acceptance smoke", ["tests/phase34/phase34w-chatgpt-final-output-live-tool-call-acceptance-smoke.test.mjs"]],
  ["Phase 34X ChatGPT final output real action surface readiness", ["tests/phase34/phase34x-chatgpt-final-output-real-action-surface-readiness.test.mjs"]],
  ["Phase 34Y ChatGPT final output real action final smoke", ["tests/phase34/phase34y-chatgpt-final-output-real-action-final-smoke.test.mjs"]],
  ["Phase 34Z ChatGPT final output final closure seal", ["tests/phase34/phase34z-chatgpt-final-output-final-closure-seal.test.mjs"]],
  ["Phase 35A ChatGPT real action final output operator runtime contract", ["tests/phase35/phase35a-chatgpt-real-action-final-output-operator-runtime-contract.test.mjs"]],
  ["Phase 35B ChatGPT real action final output negative runtime smoke", ["tests/phase35/phase35b-chatgpt-real-action-final-output-negative-runtime-smoke.test.mjs"]],
  ["Phase 35C ChatGPT real action final output runtime closure index", ["tests/phase35/phase35c-chatgpt-real-action-final-output-runtime-closure-index.test.mjs"]],
  ["Phase 35D ChatGPT real action final output runtime final seal", ["tests/phase35/phase35d-chatgpt-real-action-final-output-runtime-final-seal.test.mjs"]],
  ["Phase 36A neural writing brain required modules contract", ["tests/phase36/phase36a-neural-writing-brain-required-modules-contract.test.mjs"]],
  ["Phase 36B neural writing brain required modules readable diagnostics", ["tests/phase36/phase36b-neural-writing-brain-required-modules-readable-diagnostics.test.mjs"]],
  ["Phase 36C ChatGPT bridge operator compact diagnostics surface", ["tests/phase36/phase36c-chatgpt-bridge-operator-compact-diagnostics-surface.test.mjs"]],
  ["Phase 36D ChatGPT bridge operator compact diagnostics consumer renderer contract", ["tests/phase36/phase36d-chatgpt-bridge-operator-compact-diagnostics-consumer-renderer-contract.test.mjs"]],
  ["Phase 36E ChatGPT bridge operator compact diagnostics final closure index", ["tests/phase36/phase36e-chatgpt-bridge-operator-compact-diagnostics-final-closure-index.test.mjs"]],
  ["Phase 36F ChatGPT bridge operator compact diagnostics live tool-call acceptance smoke", ["tests/phase36/phase36f-chatgpt-bridge-operator-compact-diagnostics-live-tool-call-acceptance-smoke.test.mjs"]],
  ["Phase 36G ChatGPT bridge operator compact diagnostics runtime final seal", ["tests/phase36/phase36g-chatgpt-bridge-operator-compact-diagnostics-runtime-final-seal.test.mjs"]],
  ["Phase 36H ChatGPT bridge operator compact diagnostics operator handoff final checklist", ["tests/phase36/phase36h-chatgpt-bridge-operator-compact-diagnostics-operator-handoff-final-checklist.test.mjs"]],
  ["Phase 36I ChatGPT bridge operator compact diagnostics real ChatGPT writing entry smoke", ["tests/phase36/phase36i-chatgpt-bridge-operator-compact-diagnostics-real-chatgpt-writing-entry-smoke.test.mjs"]],
  ["Phase 36J ChatGPT bridge operator compact diagnostics final operator emission hard seal", ["tests/phase36/phase36j-chatgpt-bridge-operator-compact-diagnostics-final-operator-emission-hard-seal.test.mjs"]],
  ["Phase 36K ChatGPT bridge final response public contract freeze", ["tests/phase36/phase36k-chatgpt-bridge-final-response-public-contract-freeze.test.mjs"]],
  ["Phase 36L ChatGPT bridge public contract final live extraction smoke", ["tests/phase36/phase36l-chatgpt-bridge-public-contract-final-live-extraction-smoke.test.mjs"]],
  ["Phase 36M ChatGPT bridge final emission operator checklist", ["tests/phase36/phase36m-chatgpt-bridge-final-emission-operator-checklist.test.mjs"]],
  ["Phase 37A ChatGPT bridge live MCP final emission contract smoke", ["tests/phase37/phase37a-chatgpt-bridge-live-mcp-final-emission-contract-smoke.test.mjs"]],
  ["Phase 37B ChatGPT bridge real ChatGPT live MCP final emission operator extraction consumer hard seal", ["tests/phase37/phase37b-chatgpt-bridge-real-chatgpt-live-mcp-final-emission-operator-extraction-consumer-hard-seal.test.mjs"]],
  ["Phase 37C ChatGPT bridge real ChatGPT final operator message consumer contract acceptance", ["tests/phase37/phase37c-chatgpt-bridge-real-chatgpt-final-operator-message-consumer-contract-acceptance.test.mjs"]],
  ["Phase 37D ChatGPT bridge final response emission consumer seal", ["tests/phase37/phase37d-chatgpt-bridge-final-response-emission-consumer-seal.test.mjs"]],
  ["Phase 37E ChatGPT bridge final response non-candidate leakage regression seal", ["tests/phase37/phase37e-chatgpt-bridge-final-response-non-candidate-leakage-regression-seal.test.mjs"]],
  ["Phase 37F ChatGPT bridge final response consumer closure index", ["tests/phase37/phase37f-chatgpt-bridge-final-response-consumer-closure-index.test.mjs"]],
  ["Phase 37G ChatGPT bridge final response consumer handoff packet smoke", ["tests/phase37/phase37g-chatgpt-bridge-final-response-consumer-handoff-packet-smoke.test.mjs"]],
  ["Phase 37H ChatGPT bridge final response consumer handoff packet closure seal", ["tests/phase37/phase37h-chatgpt-bridge-final-response-consumer-handoff-packet-closure-seal.test.mjs"]],
  ["Phase 38A ChatGPT bridge personal live writing acceptance smoke", ["tests/phase38/phase38a-chatgpt-bridge-personal-live-writing-acceptance-smoke.test.mjs"]],
  ["Phase 38B settlement pending safety personal acceptance", ["tests/phase38/phase38b-settlement-pending-safety-personal-acceptance.test.mjs"]],
  ["Phase 38C ChatGPT full pipeline usable surface calibration", ["tests/phase38/phase38c-chatgpt-full-pipeline-usable-surface-calibration.test.mjs"]],
  ["Phase 38D ChatGPT full neural provider args readiness", ["tests/phase38/phase38d-chatgpt-full-neural-provider-args-readiness.test.mjs"]],
  ["Phase 38E ChatGPT full neural aesthetic memory context readiness", ["tests/phase38/phase38e-chatgpt-full-neural-aesthetic-memory-context-readiness.test.mjs"]],
  ["Phase 38G local generation provider OpenAI-compatible wrapper", ["tests/phase38/phase38g-local-generation-provider-openai-compatible-wrapper.test.mjs"]],
  ["Phase 38H ChatGPT native full neural writing handoff mode", ["tests/phase38/phase38h-chatgpt-native-full-neural-writing-handoff-mode.test.mjs"]],
  ["Phase 38I ChatGPT native handoff live MCP acceptance smoke", ["tests/phase38/phase38i-chatgpt-native-handoff-live-mcp-acceptance-smoke.test.mjs"]],
  ["Phase 38J ChatGPT native handoff instruction consumer smoke", ["tests/phase38/phase38j-chatgpt-native-handoff-instruction-consumer-smoke.test.mjs"]],
  ["Phase 39A ChatGPT native neural module execution handoff", ["tests/phase39/phase39a-chatgpt-native-neural-module-execution-handoff.test.mjs"]],
  ["Phase 39D visual upload formal baseline parity hardening", ["tests/phase39/phase39d-visual-upload-formal-baseline-parity-hardening.test.mjs"]],
  ["Phase 39E visual uploaded reference metadata enrichment", ["tests/phase39/phase39e-visual-uploaded-reference-metadata-enrichment.test.mjs"]],
  ["Phase 39F visual uploaded reference metadata safe auto application", ["tests/phase39/phase39f-visual-uploaded-reference-metadata-safe-auto-application.test.mjs"]],
  ["Phase 39G visual uploaded references writing context injection", ["tests/phase39/phase39g-visual-uploaded-references-writing-context-injection.test.mjs"]],
  ["Daily scripts and docs", ["tests/scripts/daily-scripts.test.mjs"]],
  ["Feedback learning service", ["tests/feedback/feedback-learning-service.test.mjs"]],
  ["Compressed rule update confirm service", ["tests/feedback/compressed-rule-update-confirm-service.test.mjs"]],
  ["Full workflow smoke test", ["tests/e2e/full-workflow-smoke.test.mjs"]],
  ["MCP read-only tools", ["tests/mcp/mcp-readonly-tools.test.mjs"]],
  ["MCP write-low-risk tools", ["tests/mcp/mcp-write-low-risk-tools.test.mjs"]],
  ["MCP approval request tools", ["tests/mcp/mcp-approval-request-tools.test.mjs"]],
  ["MCP approval request E2E", ["tests/mcp/mcp-approval-request-e2e.test.mjs"]],
  ["Creative task orchestrator service", ["tests/creative/creative-task-orchestrator-service.test.mjs"]],
  ["MCP creative task tools", ["tests/mcp/mcp-creative-task-tools.test.mjs"]],
  ["MCP ChatGPT bridge tools", ["tests/mcp/mcp-chatgpt-bridge-tools.test.mjs"]],
  ["MCP ChatGPT bridge E2E dry run", ["tests/mcp/mcp-chatgpt-bridge-e2e-dry-run.test.mjs"]],
  ["MCP approval queue bridge readiness", ["tests/mcp/mcp-approval-queue-bridge-readiness.test.mjs"]],
  ["GPT writing context service", ["tests/creative/gpt-writing-context-service.test.mjs"]],
  ["MCP GPT writing context tools", ["tests/mcp/mcp-gpt-writing-context-tools.test.mjs"]],
  ["Chat output candidate service", ["tests/creative/chat-output-candidate-service.test.mjs"]],
  ["MCP chat output candidate tools", ["tests/mcp/mcp-chat-output-candidate-tools.test.mjs"]],
  ["Candidate proofing context service", ["tests/creative/candidate-proofing-context-service.test.mjs"]],
  ["Candidate proof report service", ["tests/creative/candidate-proof-report-service.test.mjs"]],
  ["MCP candidate proofing tools", ["tests/mcp/mcp-candidate-proofing-tools.test.mjs"]],
  ["Candidate adoption request service", ["tests/creative/candidate-adoption-request-service.test.mjs"]],
  ["MCP candidate adoption request tools", ["tests/mcp/mcp-candidate-adoption-request-tools.test.mjs"]],
  ["Writing candidate adoption service", ["tests/creative/writing-candidate-adoption-service.test.mjs"]],
  ["Writing candidate adoption E2E", ["tests/creative/writing-candidate-adoption-e2e.test.mjs"]],
  ["MCP adopted writing tools", ["tests/mcp/mcp-adopted-writing-tools.test.mjs"]],
  ["Adopted writing settlement service", ["tests/creative/adopted-writing-settlement-service.test.mjs"]],
  ["Adopted writing settlement E2E", ["tests/creative/adopted-writing-settlement-e2e.test.mjs"]],
  ["MCP adopted writing settlement tools", ["tests/mcp/mcp-adopted-writing-settlement-tools.test.mjs"]],
  ["Pending engine candidate review service", ["tests/engine/pending-engine-candidate-review-service.test.mjs"]],
  ["Pending engine candidate review E2E", ["tests/engine/pending-engine-candidate-review-e2e.test.mjs"]],
  ["Engine activation confirm service", ["tests/engine/engine-activation-confirm-service.test.mjs"]],
  ["Engine activation confirm E2E", ["tests/engine/engine-activation-confirm-e2e.test.mjs"]],
  ["Engine component registry", ["tests/engine/engine-component-registry.test.mjs"]],
  ["Canon zone preview service", ["tests/engine/canon-zone-preview-service.test.mjs"]],
  ["Entity registry preview service", ["tests/engine/entity-registry-preview-service.test.mjs"]],
  ["Visual asset registry preview service", ["tests/engine/visual-asset-registry-preview-service.test.mjs"]],
  ["Visual library rebuild intake service", ["tests/engine/visual-library-rebuild-intake-service.test.mjs"]],
  ["Visual library import simulation service", ["tests/engine/visual-library-import-simulation-service.test.mjs"]],
  ["Visual library pending import readiness service", ["tests/engine/visual-library-pending-import-readiness-service.test.mjs"]],
  ["Visual library Approval Queue import dry-run service", ["tests/engine/visual-library-approval-queue-import-dry-run-service.test.mjs"]],
  ["Visual library final acceptance service", ["tests/engine/visual-library-final-acceptance-service.test.mjs"]],
  ["Visual library controlled import guard service", ["tests/engine/visual-library-controlled-import-guard-service.test.mjs"]],
  ["Visual library confirmed import service", ["tests/engine/visual-library-confirmed-import-service.test.mjs"]],
  ["Visual library rollback/delete/restore service", ["tests/engine/visual-library-rollback-delete-restore-service.test.mjs"]],
  ["Visual library UI import flow service", ["tests/engine/visual-library-ui-import-flow-service.test.mjs"]],
  ["Visual library bridge readiness service", ["tests/engine/visual-library-bridge-readiness-service.test.mjs"]],
  ["Visual library MCP readonly tool service", ["tests/engine/visual-library-mcp-readonly-tool-service.test.mjs"]],
  ["Visual library controlled import trial service", ["tests/engine/visual-library-controlled-import-trial-service.test.mjs"]],
  ["Visual library persistent import operator checklist service", ["tests/engine/visual-library-persistent-import-operator-checklist-service.test.mjs"]],
  ["Visual library persistent baseline transition service", ["tests/engine/visual-library-persistent-baseline-transition-service.test.mjs"]],
  ["Visual library persistent baseline activation service", ["tests/engine/visual-library-persistent-baseline-activation-service.test.mjs"]],
  ["Visual library final E2E acceptance service", ["tests/engine/visual-library-final-e2e-acceptance-service.test.mjs"]],
  ["Visual link approval readiness service", ["tests/engine/visual-link-approval-readiness-service.test.mjs"]],
  ["Visual link approval queue candidate service", ["tests/engine/visual-link-approval-queue-candidate-service.test.mjs"]],
  ["Visual link approval queue import dry-run service", ["tests/engine/visual-link-approval-queue-import-dry-run-service.test.mjs"]],
  ["Visual link approval queue import guard service", ["tests/engine/visual-link-approval-queue-import-guard-service.test.mjs"]],
  ["Visual link final acceptance service", ["tests/engine/visual-link-final-acceptance-service.test.mjs"]],
  ["Entity intake service", ["tests/engine/entity-intake-service.test.mjs"]],
  ["Settlement completion reminders", ["tests/engine/settlement-completion-reminder-service.test.mjs"]],
  ["Full creative workflow final smoke", ["tests/creative/full-creative-workflow-final-smoke.test.mjs"]],
  ["MCP pending engine candidate review tools", ["tests/mcp/mcp-pending-engine-candidate-review-tools.test.mjs"]],
  ["Atomic pipeline failure", ["tests/pipeline/atomic-pipeline.test.mjs"]],
  ["Canon golden tests", ["tests/golden/canon-golden.test.mjs"]],
  ["UI server contract tests", ["tests/ui/ui-server.test.mjs"]],
  ["MCP tool profiles", ["tests/mcp/mcp-tool-profiles.test.mjs"]],
  ["MCP contract tests", ["tests/tools/mcp-contract.test.mjs"]],
];
function getTimeoutMs(label) {
  if (
    label === "Canon golden tests"
    || label === "JSON/codeblock validation"
    || label === "Phase 32C aesthetic memory context builder operator review packet bridge evidence packet final acceptance settlement handoff checklist bridge stability guard"
  ) {
    return 480_000;
  }
  return 360_000;
}

function runStep(label, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n== ${label} ==`);
    const child = spawn(process.execPath, args, {
      cwd: rootDir,
      stdio: "inherit",
      windowsHide: true,
    });
    let settled = false;
    const timeoutMs = getTimeoutMs(label);
    const timeoutSeconds = Math.round(timeoutMs / 1000);
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      terminateProcessTree(child);
      reject(new Error(`${label} timed out after ${timeoutSeconds} seconds.`));
    }, timeoutMs);
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${label} failed with exit code ${code}.`));
    });
  });
}

async function main() {
  for (const [label, args] of steps) {
    await runStep(label, args);
  }
  console.log("\nAll tests passed.");
}

main().catch((error) => {
  console.error(`\nTest suite failed: ${error.message}`);
  process.exitCode = 1;
});
