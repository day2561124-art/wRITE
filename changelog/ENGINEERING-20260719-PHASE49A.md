# Phase 49A: Chapter Settlement Summary Contract

## Purpose

Chapter settlement is a concise continuity handoff for the next writing turn.

It records:

- events that actually occurred;
- current character injuries, locations, restrictions, and emotional states;
- relationship and position changes;
- unresolved promises, conflicts, and threads;
- whether the next chapter should continue directly, jump in time, switch viewpoint, or open a new scene.

## Primary Route

The primary ChatGPT bridge route uses:

`[[DIRECT_CHAPTER_SETTLEMENT_SUMMARY]]`

ChatGPT reads the completed chapter in the conversation and submits only the concise continuity summary.

## Explicit Non-Goals

The summary-only route does not:

- persist the complete chapter prose;
- create a writing candidate;
- create a proof report;
- create an adopted writing;
- request adoption;
- create a pending engine candidate;
- create an approval item;
- modify or activate `active_engine.md`;
- modify `compressed_rules.md`.

The legacy adopted-writing settlement route remains available only for separately confirmed full adoption workflows.

## Storage

The continuity handoff is saved as a settlement report under the existing settlement report store so Writer Workbench can retrieve it as the latest chapter handoff.

## Safety

`active_engine.md` and `compressed_rules.md` remain unchanged.