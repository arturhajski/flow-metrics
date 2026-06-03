# CLAUDE.md — Haisight WIP Analytics

## What this project does

An Atlassian Forge plugin (Custom UI) for Jira that displays Work in Progress metrics.
Distributed via the Atlassian Marketplace. Runs natively in Jira Cloud.

## Stack

- **Runtime:** Atlassian Forge (Node.js 24, arm64)
- **Frontend:** React (static/hello-world/), Chart.js for charts
- **Backend:** Forge Functions (resolvers/)
- **Storage:** Forge Storage (built-in key-value store)
- **Language:** TypeScript everywhere possible
- **Deploy:** forge deploy → Atlassian infrastructure

## Project structure

flow-metrics/
├── CLAUDE.md ← this file
├── manifest.yml ← Forge app configuration
├── package.json ← backend dependencies
├── resolvers/
│ ├── index.ts ← main Forge Functions (getWipData, getProjectMetadata)
│ └── scheduler.ts ← Scheduled Trigger (daily sync)
├── src/ ← shared TypeScript types
│ └── types.ts
├── static/
│ └── hello-world/ ← React frontend (Custom UI)
│ ├── src/
│ │ ├── App.tsx
│ │ ├── components/
│ │ └── utils/
│ └── package.json
└── docs/
├── ARCHITECTURE.md ← architectural decisions
├── DECISIONS.md ← ADR log
└── API.md ← Forge Functions documentation

## How to run locally

```bash
# Terminal 1 — Forge tunnel
forge tunnel

# Terminal 2 — React dev server
cd static/hello-world
npm start

# Open Jira in Chrome
# https://arturhajski.atlassian.net → project → WIP Analytics
```

## How to deploy

```bash
# Development (for testing)
forge deploy
forge install  # only on first install

# Production (before Marketplace submission)
forge deploy --environment production
```

## Code conventions

- Forge Functions always return `{ data: T } | { error: string }`
- All dates as ISO string (YYYY-MM-DD) or Unix timestamp in ms
- Cache key format: `{metric}-{projectKey}-{YYYY-MM-DD}`
- Never hardcode status names — always use id from Jira API
- Never hardcode issue types — always load dynamically per project

## Jira API — important notes

- Use `/rest/api/3/` (not v2)
- Always paginate: maxResults=100, iterate via startAt
- "In progress" status = statusCategory.key === "indeterminate"
- Changelog in issues: add expand=changelog to search params
- Rate limiting: retry on 429 with exponential backoff

## Forge Storage — conventions

- Keys: kebab-case, format `{type}-{projectKey}-{identifier}`
- Values: always JSON.stringify / JSON.parse
- TTL: no native TTL — check timestamp inside stored data
- Limit: 10MB per app per tenant — do not exceed

## Environment variables

None — Forge automatically provides context (cloudId, accountId, projectKey)
via the `context` object in every Forge Function.

## Documentation maintenance

After every significant change:

- Update ARCHITECTURE.md if the data flow changes
- Add a new ADR to DECISIONS.md for non-obvious architectural choices
- Update API.md when Forge Function signatures change
