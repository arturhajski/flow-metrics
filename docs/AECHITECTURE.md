# Architecture — Haisight WIP Analytics

## Overview

[Jira UI] ←→ [Forge Custom UI (React)]
↓ invoke()
[Forge Functions (Node.js)]
↓
[Jira REST API v3]
↓
[Forge Storage (cache)]

## Data Flow

### First run

1. Frontend calls `getProjectMetadata` — fetches statuses and issue types from Jira
2. Frontend calls `getWipData(days=14)` — no cache exists yet
3. Forge Function fetches issues from last 30 days + changelog (with pagination)
4. Reconstructs daily WIP from status transition history
5. Saves snapshots to Forge Storage
6. Returns data to frontend

### Subsequent opens

1. Frontend calls `getWipData(days=14)`
2. Forge Function checks cache — today's data exists and is fresh (< 1h)
3. Fetches only delta (issues updated since last sync)
4. Updates snapshots
5. Returns data — significantly faster than first run

### Daily Sync (Scheduled Trigger, 02:00)

1. Forge fires `scheduler.handler` for every tenant
2. Fetches delta since last sync
3. Updates snapshots
4. Deletes data older than 90 days

## Key Decisions

See `docs/DECISIONS.md` for full context.

- **Forge Storage instead of Supabase** — zero external dependencies in MVP
- **Changelog reconstruction instead of daily polling** — historical data available immediately
- **Chart.js instead of Nivo** — smaller bundle, verified in Forge sandbox
- **Zero configuration** — IN_PROGRESS statuses detected automatically
