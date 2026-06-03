# PRD — Haisight: WIP Analytics for Jira

## Meta

- **Product:** Haisight WIP Analytics
- **Platform:** Atlassian Forge (Custom UI)
- **Marketplace:** Atlassian Marketplace
- **Version:** 1.0 MVP
- **Stack:** React + TypeScript + Chart.js + Forge Functions + Forge Storage

---

## Product Goal

Haisight WIP Analytics is a Jira plugin that displays Work in Progress metrics in a beautiful, readable form — directly inside the project, with zero configuration. After installation the plugin works immediately using Jira's native status categories.

---

## Problem Statement

Engineering Managers and Team Leaders want to know:

- How much work is currently "in progress" and is that normal?
- Is WIP growing, shrinking, or stable over time?
- Where are bottlenecks forming (which status has too many issues)?
- Which issues have been sitting the longest without progress?

Jira does not provide these answers in a readable form. Existing plugins are either too complex or focus on board management rather than analytics.

---

## ICP (Ideal Customer Profile)

- Engineering Manager, Tech Lead, or Scrum Master
- Uses Jira Cloud — Kanban or Scrum projects (company-managed)
- Team of 3–20 people
- Wants a quick overview of work status without configuring tools

---

## Core Principle: Zero Configuration

The plugin must work immediately after installation:

- "In progress" statuses detected automatically via Jira's `IN_PROGRESS` status category
- Issue types loaded dynamically from the project
- No configuration screen blocks first use
- Sensible defaults for all settings

---

## Data Architecture

### Data Source

Jira REST API v3 — the plugin fetches data directly from the user's project via Forge Functions. No external database in MVP.

### Caching Strategy (Forge Storage)

```
Key:   wip-snapshot-{projectKey}-{YYYY-MM-DD}
Value: JSON with aggregated WIP data for that day
TTL:   1 hour for current day, permanent for past days
Size:  ~45KB per project / 90 days (safe within 10MB per tenant limit)
```

### First Run

Fetch issues updated in the last 30 days with changelog, reconstruct daily WIP, save snapshots to Forge Storage.

### Subsequent Opens

Fetch only delta (issues updated since last sync), update snapshots, display data from cache.

### Forge Scheduled Trigger

Daily at 02:00 — delta sync for every tenant that has the plugin installed.

---

## Data Fetched Dynamically from Jira API

### Project Statuses

```
GET /rest/api/3/project/{projectKey}/statuses

For each status extract:
- id (string)                 — unique status identifier
- name (string)               — display name
- statusCategory.key          — "new" | "indeterminate" | "done"

"In progress" statuses = statusCategory.key === "indeterminate"
Use these statuses as the default WIP filter.
Store id → name map in Forge Storage per project.
```

### Issue Types

```
GET /rest/api/3/issuetype/project?projectId={projectId}

For each type extract:
- id (string)      — unique identifier
- name (string)    — display name (Story, Bug, Task, Epic, etc.)
- iconUrl (string) — optional, for display in UI

Store type list in Forge Storage per project.
Default: include all types (filter = "All types").
```

### Issues with Changelog

```
GET /rest/api/3/search
Parameters:
  jql:        project = {projectKey} AND updated >= -{days}d ORDER BY updated ASC
  fields:     summary, status, issuetype, created, updated, assignee
  expand:     changelog
  maxResults: 100
  startAt:    0 (paginate!)

Iterate all pages (startAt += 100) until issues.length < maxResults.
```

---

## Metric Calculations

### Reconstructing Historical WIP from Changelog

```typescript
interface StatusTransition {
  timestamp: Date;
  fromStatus: string;
  fromCategory: string;
  toStatus: string;
  toCategory: string;
}

function getTransitions(changelog: JiraChangelog): StatusTransition[];

function wasInProgressOnDate(
  issue: JiraIssue,
  transitions: StatusTransition[],
  date: Date,
  inProgressCategories: string[],
): boolean;

// For each day in the range:
// count = issues.filter(i => wasInProgressOnDate(i, transitions, day, cats)).length
```

### Aggregated Statistics

```typescript
function calculateStats(wipSeries: number[]): {
  average: number;
  // arithmetic mean

  p90: number;
  // 90th percentile

  coefficientOfVariation: number;
  // CV = stddev / mean
  // High stability: CV < 0.3
  // Medium:         CV 0.3–0.6
  // Low:            CV > 0.6

  stabilityLabel: "High" | "Medium" | "Low";
  trend: "up" | "down" | "stable";
  // compare average of first vs second half of period

  trendDelta: number;
  // difference in issues count
};
```

### Current WIP per Status

```typescript
// Fetch issues with current status (no changelog — fast query)
// Group by status.id → { name, count, issueTypeBreakdown }
```

### Longest Sitting Issues

```typescript
// For issues currently IN_PROGRESS:
// days = (now - lastTransitionToInProgress) / 86400000
// Sort descending, return top 5
// Each: { key, summary, status, issueType, daysInProgress }
```

---

## Forge Functions API

### `getProjectMetadata`

```typescript
// Input:  { projectKey: string }
// Output: {
//   statuses:   { id: string, name: string, category: string }[]
//   issueTypes: { id: string, name: string, iconUrl: string }[]
// }
// Cache: Forge Storage, TTL 24h
// On error: { error: string }
```

### `getWipData`

```typescript
// Input: {
//   projectKey:   string
//   days:         7 | 14 | 30
//   issueTypeIds: string[] | 'all'
// }
// Output: {
//   series:          { date: string, count: number }[]
//   stats:           { average, p90, cv, stabilityLabel, trend, trendDelta }
//   statusBreakdown: { statusId, statusName, count }[]
//   longestSitting:  { key, summary, statusName, issueTypeName, daysInProgress }[]
//   lastSyncedAt:    string
// }
// Strategy: check cache → fetch delta → recalculate → save cache → return
```

### `refreshData`

```typescript
// Input:  { projectKey: string }
// Forced refresh — ignores cache, fetches last 30 days
// Output: { success: boolean, syncedAt: string }
```

---

## Frontend Component Structure

### `src/App.tsx`

Main component. Fetches project metadata via `invoke('getProjectMetadata')`, then WIP data via `invoke('getWipData')`. Renders loading state, error state, or dashboard.

### `src/components/Header.tsx`

Displays title "WIP analytics", project name, last sync time. Contains SegmentedControl for date ranges (7d / 14d / 30d) and a dropdown for issue types.

Issue type dropdown behaviour:

- Options loaded dynamically from `projectMetadata.issueTypes`
- First option always: "All types" (value `"all"`)
- Filtering is client-side on already-fetched data

### `src/components/KPICards.tsx`

Grid of 4 cards (2×2 on mobile, 4×1 on desktop):

1. **WIP today** — current count + delta vs previous period (red ↑, green ↓)
2. **Average WIP** — mean over selected period
3. **P90 WIP** — 90th percentile, label: "10% of days exceeded this"
4. **Process stability** — "High" / "Medium" / "Low" + CV value

### `src/components/DailyWIPChart.tsx`

Line chart (Chart.js `type: 'line'`):

- Main series: daily WIP — color `#378ADD`, fill true, tension 0.35
- Helper series: average line — color `#639922`, borderDash `[5,4]`
- Helper series: WIP limit (when set) — color `rgba(226,75,74,0.5)`, borderDash `[3,3]`
- Points: radius 4px, white border
- X axis: DD/MM format, autoSkip when > 14 days
- Legend: custom HTML above chart (disable Chart.js default legend)
- Wrapper height: 200px, `maintainAspectRatio: false`

### `src/components/StatusBreakdown.tsx`

Horizontal progress bars per IN_PROGRESS status. Status names loaded dynamically — never hardcoded. Colors assigned from rotating palette. Issue count shown right of each bar.

### `src/components/LongestSitting.tsx`

Top 5 issues by time in an in-progress status. Each row: issue key (link to Jira), title (truncated), status badge, days count. Days color: green < 6d, orange 6–9d, red ≥ 10d. Link format: `https://{cloudId}.atlassian.net/browse/{issueKey}`

### `src/components/InsightsPanel.tsx`

3 dynamically generated insights via `generateInsights(stats, statusBreakdown)` — simple conditional logic, no AI in MVP:

1. Average WIP comment + Little's Law reference
2. Process stability assessment with CV interpretation
3. Status with highest issue accumulation identified

### `src/components/LoadingState.tsx`

Skeleton loading with CSS pulse animation for each dashboard section.

### `src/components/ErrorState.tsx`

Error message with "Retry" button. Distinct messages for: no permissions, empty project, API error.

---

## Design System

### Colors (hardcoded — canvas does not support CSS variables)

```typescript
const colors = {
  blue: "#378ADD",
  blueMuted: "rgba(55,138,221,0.08)",
  green: "#639922",
  red: "#E24B4A",
  redMuted: "rgba(226,75,74,0.5)",
  amber: "#EF9F27",
  purple: "#7F77DD",
  teal: "#1D9E75",
  gridLine: "rgba(128,128,128,0.12)",
  textPrimary: "#1a1a1a",
  textSecondary: "#6b7280",
};
```

### Typography

```
KPI value:      26px / weight 500
Section label:  13px / weight 500
Description:    12px / textSecondary
Issue key:      12px / blue / weight 500
Font stack:     -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
```

### Spacing

```
Section margin-bottom:  1.5rem
KPI grid gap:           10px
Status bars gap:        8px
Issue list row gap:     1px
```

### Days color coding

```typescript
const daysColor = (days: number) =>
  days >= 10 ? "#A32D2D" : days >= 6 ? "#854F0B" : "#3B6D11";
```

### Status bar color palette (rotating)

```typescript
const statusColors = [
  "#378ADD",
  "#7F77DD",
  "#1D9E75",
  "#EF9F27",
  "#E24B4A",
  "#D4537E",
];
// Assign in order to statuses sorted alphabetically
```

---

## Pricing Plans

| Plan       | Price               | Date Range         | Features                  |
| ---------- | ------------------- | ------------------ | ------------------------- |
| Free trial | $0 / 7 days         | 7d, 14d            | Full functionality        |
| Starter    | $5/mo per 10 users  | 7d, 14d, 30d       | All metrics               |
| Pro        | $10/mo per 10 users | Up to 90d + custom | Metrics + CSV export (V2) |

Pricing model follows Atlassian Marketplace billing (per-user tiers).

---

## Edge Cases

| Situation               | Behaviour                                                                |
| ----------------------- | ------------------------------------------------------------------------ |
| No IN_PROGRESS issues   | Empty state: "No in-progress issues found. Start working on some tasks!" |
| < 7 days of history     | Show available data, grey out unavailable date range buttons             |
| Issue without changelog | Skip in historical reconstruction, count in current WIP                  |
| Jira API 429            | Retry with exponential backoff: 1s → 2s → 4s, max 3 attempts             |
| Forge Storage full      | Delete snapshots older than 90 days, log warning                         |
| Forge Function timeout  | Return partial data with incompleteness notice                           |
| Unknown issue types     | Group under "Other"                                                      |

---

## Definition of Done — MVP

- [ ] Plugin installs in Jira Cloud via Forge without errors
- [ ] Statuses and issue types loaded dynamically from Jira API (never hardcoded)
- [ ] Daily WIP chart renders correctly for 7 / 14 / 30 day ranges
- [ ] Issue type filtering works in real time (client-side)
- [ ] KPI cards show correct values (average, P90, CV, stability)
- [ ] Status breakdown shows dynamic status names from Jira
- [ ] Longest sitting issues shows 5 issues with links to Jira
- [ ] Insights generated dynamically based on data
- [ ] Loading state shown while fetching
- [ ] Error state with retry button for API errors
- [ ] Forge Storage cache works (second open is faster)
- [ ] Scheduled Trigger fires daily (verified in Forge logs)
- [ ] Works in Chrome and Firefox
- [ ] Atlassian Security Review checklist met

---

## Out of Scope — MVP (V2+)

- Cycle Time, Lead Time, Throughput
- DORA Metrics
- User-configurable WIP limits
- AI / LLM insights
- CSV export
- Confluence macro
- Multi-project view
- Custom date range picker
- Slack / email digest
- Dark mode toggle
