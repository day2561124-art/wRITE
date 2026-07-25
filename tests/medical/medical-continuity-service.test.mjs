import { createHash, randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import {
  detectRiskChanges,
  generateEngineDiff,
} from "../../server/src/engine-candidate-service.mjs";
import {
  buildFormalRelevantCanon,
} from "../../server/src/formal-relevant-canon-service.mjs";
import {
  buildMedicalContinuityEngineCandidate,
  buildMedicalContinuitySnapshot,
  loadMedicalContinuityConfig,
  medicalStateTokens,
  resolveInjuryStatus,
} from "../../server/src/medical-continuity-service.mjs";
import { getChatgptBridgeCurrentInputs } from "../../server/src/chatgpt-bridge-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";
import {
  buildStructuredEntityRegistry,
} from "../../server/src/structured-canon-entity-registry-service.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function main() {
  const activeBefore = await readFile(projectPaths.activeEngine, "utf8");
  const activeHashBefore = hash(activeBefore);
  const registryRoot = path.join(
    projectPaths.entityRegistry,
    `.medical-continuity-test-${process.pid}-${randomUUID()}`,
  );
  try {
    const { config } = await loadMedicalContinuityConfig();
    const policy = config.recovery_policy;
    assert(policy.care_systems.length === 3, "medical collaboration systems are incomplete");
    assert(policy.capabilities.length >= 11, "high-tech medical capabilities are incomplete");
    assert(policy.treatment_costs.includes("靈力"), "treatment costs lost spiritual energy");
    assert(
      policy.preserved_consequences.includes("已成立的敗北或中止"),
      "medical policy erased competition consequences",
    );
    assert(
      policy.recovery_windows.sutured_laceration.high_load_hours_max === 72,
      "sutured laceration did not use the accelerated 1-3 day high-load window",
    );
    assert(
      medicalStateTokens.every((token) => policy.clearance_values.includes(token)),
      "unknown/not_recorded/not_applicable/deferred/cleared are not distinct",
    );

    const ordinary = {
      injury_history: [{ event_id: "test-cut" }],
      injury_class: "sutured_laceration",
      treatment_completed: true,
      current_physical_status: "treated_recovering",
      active_restrictions: [
        {
          restriction_id: "no-water",
          scope: "不能沾水",
          status: "active",
          expiry_kind: "same_day",
        },
      ],
      competition_clearance: "not_recorded",
    };
    const resolved = resolveInjuryStatus(ordinary, {
      timeAnchorAvailable: true,
      elapsedHours: 96,
      asOfChapter: "第二十五章",
    }, policy);
    assert(resolved.current_physical_status === "recovered_stable", "ordinary injury did not recover");
    assert(resolved.active_restrictions.length === 0, "same-day no-water order became permanent");
    assert(resolved.injury_history.length === 1, "injury history was deleted during cleanup");
    assert(
      resolved.competition_clearance === "not_recorded",
      "physical recovery auto-issued competition clearance",
    );

    const missingAnchor = resolveInjuryStatus(ordinary, {
      timeAnchorAvailable: false,
    }, policy);
    assert(
      missingAnchor.exception_reason === "recovery_time_anchor_missing",
      "missing time anchor did not remain explicit",
    );
    assert(
      missingAnchor.current_physical_status === "treated_recovery_status_not_recorded",
      "missing time anchor was guessed as full recovery or severe injury",
    );
    assert(missingAnchor.resolved_at === "not_recorded", "missing time anchor invented a date");

    for (const injuryClass of [
      "soul_damage",
      "source_damage",
      "pollution",
      "nerve_precision_injury",
      "weapon_body_damage",
      "unclassified_spiritual_residue",
    ]) {
      const special = resolveInjuryStatus({
        ...ordinary,
        injury_class: injuryClass,
      }, {
        timeAnchorAvailable: true,
        elapsedHours: 9999,
      }, policy);
      assert(
        special.active_restrictions.length === 1,
        `${injuryClass} was incorrectly cleared as an ordinary injury`,
      );
    }
    const blockedTreatment = resolveInjuryStatus({
      ...ordinary,
      exception_reason: "treatment_completion_blocked",
    }, {
      timeAnchorAvailable: true,
      elapsedHours: 9999,
    }, policy);
    assert(
      blockedTreatment.active_restrictions.length === 1,
      "treatment-completion blocking did not extend the status",
    );
    const overlayPreserved = resolveInjuryStatus(ordinary, {
      timeAnchorAvailable: true,
      elapsedHours: 9999,
      continuityOverlay: {
        explicitly_active: true,
        active_restrictions: ["正式 overlay 仍要求低負荷"],
      },
    }, policy);
    assert(
      overlayPreserved.exception_reason === "active_continuity_overlay",
      "current continuity overlay did not take precedence",
    );
    const expiredOverlay = resolveInjuryStatus(ordinary, {
      timeAnchorAvailable: true,
      elapsedHours: 9999,
      asOfTime: "2026-07-24T00:00:00Z",
      continuityOverlay: {
        explicitly_active: true,
        expires_at: "2026-07-20T00:00:00Z",
        active_restrictions: ["已過期短期限制"],
      },
    }, policy);
    assert(
      expiredOverlay.current_physical_status === "recovered_stable",
      "expired continuity overlay froze a short-term injury",
    );

    const snapshot = await buildMedicalContinuitySnapshot({ activeEngineText: activeBefore });
    const byCharacter = Object.fromEntries(
      snapshot.character_statuses.map((status) => [status.character, status]),
    );
    assert(byCharacter.九逃.active_restrictions.length === 0, "九逃短期醫囑仍為 active");
    assert(
      byCharacter.九逃.injury_history.some((item) => item.event_id === "JIUTAO-OLD-LEFT-SHOULDER"),
      "九逃舊肩傷歷史遺失",
    );
    assert(
      byCharacter.朝日奈千夜.competition_clearance === "not_recorded",
      "千夜物理恢復與競技許可未分離",
    );
    assert(
      byCharacter.貓狼.exception_reason === "recovery_time_anchor_missing",
      "貓狼缺少時間錨點時被猜測狀態",
    );
    assert(
      byCharacter.雪弟.current_physical_status === "treated_recovery_status_not_recorded",
      "雪弟被猜成完全康復或長期失能",
    );
    assert(
      byCharacter.雪弟.injury_history.some((item) => (
        item.event_id === "XUEDI-EARLY-RIGHT-HAND-NUMBNESS"
        && item.history_status === "resolved"
      )),
      "雪弟舊右手麻木未保持 resolved",
    );
    assert(
      byCharacter.伊吹沙耶.active_restrictions.length === 0
      && byCharacter.伊吹沙耶.follow_up_result === "cleared",
      "沙耶舊右腕限制重新進入 active state",
    );
    const misakiHistoryIds = new Set(
      byCharacter.御先.injury_history.map((item) => item.event_id),
    );
    for (const id of [
      "MISAKI-OLD-NECK-SPIRITUAL-BURN",
      "MISAKI-PALM-SCAR",
      "MISAKI-WEAPON-RELEASE-RESIDUE",
      "MISAKI-BOARD-BLACK-MARK",
    ]) {
      assert(misakiHistoryIds.has(id), `御先痕跡未分離：${id}`);
    }
    assert(
      byCharacter.御先.injury_history.find(
        (item) => item.event_id === "MISAKI-BOARD-BLACK-MARK",
      ).history_status === "unresolved_not_attributed_to_character",
      "棋盤黑紋被歸因給御先",
    );
    assert(
      byCharacter.御先.current_physical_status === "normal_on_latest_exam",
      "御先普通物理檢查沒有維持正常",
    );

    const built = await buildMedicalContinuityEngineCandidate({
      activeEngineText: activeBefore,
    });
    assert(
      built.candidate_text.includes("靈力與生體同步掃描"),
      "candidate did not include the formal medical world rule",
    );
    assert(
      built.candidate_text.includes("current physical")
      && built.candidate_text.includes("competition_clearance"),
      "candidate did not expose normalized status and clearance",
    );
    const diff = generateEngineDiff(activeBefore, built.candidate_text);
    assert(diff.summary.modified_count < 100, "multi-hunk diff collapsed into a false massive rewrite");
    assert(
      (diff.raw_unified_diff.match(/^@@/gmu) ?? []).length >= 2,
      "candidate diff did not preserve separate change hunks",
    );
    const risk = detectRiskChanges(built.candidate_text, diff, activeBefore);
    assert(risk.risk_level !== "critical", "legitimate medical state tokens blocked the candidate");
    const contaminated = `${activeBefore}\nunknown rejected candidate`;
    const contaminatedDiff = generateEngineDiff(activeBefore, contaminated);
    assert(
      detectRiskChanges(contaminated, contaminatedDiff, activeBefore).risk_level === "critical",
      "unquoted contamination markers bypassed the candidate guard",
    );

    const registryResult = await buildStructuredEntityRegistry({ registryRoot });
    const normalizedStatuses = registryResult.registry.status_effects.filter(
      (entity) => entity.state_model_version === "medical-continuity-v1",
    );
    assert(normalizedStatuses.length === 6, "entity registry did not hydrate normalized statuses");
    const jiutaoEntity = normalizedStatuses.find(
      (entity) => entity.related_characters.includes("九逃"),
    );
    assert(
      jiutaoEntity.active_restrictions.length === 0
      && jiutaoEntity.injury_history.length >= 2,
      "entity registry mixed injury history with active restrictions",
    );

    const relevant = await buildFormalRelevantCanon({
      taskPrompt: "九逃 朝日奈千夜 傷勢 醫療後座 競技許可",
      generationContext: {},
      retrievalContext: {},
      activeEngineContent: activeBefore,
      activeEngineHash: activeHashBefore,
    }, {
      entityRegistryOptions: { registryRoot },
    });
    assert(
      relevant.relevant_canon.current_status.some((record) => (
        record.structured_status?.state_model_version === "medical-continuity-v1"
        && record.structured_status.competition_clearance === "not_recorded"
      )),
      "writing context retrieval did not expose normalized status fields",
    );

    const currentInputs = await getChatgptBridgeCurrentInputs({
      includeText: false,
      includeActiveEngineMetadata: false,
    });
    assert(
      currentInputs.medical_continuity.character_statuses.some(
        (status) => status.character === "御先",
      ),
      "current inputs did not expose medical continuity state",
    );
    assert(
      hash(await readFile(projectPaths.activeEngine, "utf8")) === activeHashBefore,
      "medical normalization test modified active_engine.md",
    );
    console.log("Medical continuity service test passed.");
  } finally {
    await rm(registryRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`Medical continuity service test failed: ${error.message}`);
  process.exitCode = 1;
});
