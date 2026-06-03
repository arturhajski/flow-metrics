# Architecture Decision Records

## ADR-001: Forge Storage instead of external database

**Date:** 2026-06
**Status:** Accepted

**Context:** We need to store historical WIP snapshots per tenant.

**Decision:** Use Forge Storage (Atlassian's built-in key-value store).

**Reasons:**

- Zero infrastructure configuration
- Data never leaves the Atlassian ecosystem (sales argument for enterprise)
- 10MB per tenant is sufficient for 90 days × multiple projects
- Supabase remains an option for V2 when enterprise customers appear

**Consequences:**

- No cross-tenant analytics
- No data export (V2 feature)
- Migration to Supabase possible without changing the frontend API

---

## ADR-002: WIP reconstruction from changelog

**Date:** 2026-06
**Status:** Accepted

**Context:** Jira does not store historical WIP snapshots.

**Decision:** Reconstruct historical WIP from each issue's changelog.

**Reasons:**

- History available immediately (no 30-day ramp-up period)
- JQL `updated >= -30d` fetches only active issues, not all issues
- For large projects: delta sync minimises the number of API calls

**Consequences:**

- First run is slower (fetching 30 days of history)
- Changelog has a 100-entry limit per issue — very old transitions may be truncated

---

## ADR-003: Zero configuration on first use

**Date:** 2026-06
**Status:** Accepted

**Context:** Competing plugins require configuration before first use.

**Decision:** Plugin uses Jira's statusCategory as an automatic filter.

**Reasons:**

- Statuses with category `indeterminate` = "in progress" — Jira standard
- Every project has these categories regardless of custom status names
- Users see value immediately, no barriers

**Consequences:**

- Less flexibility for advanced users (acceptable in MVP)
- Per-project settings as a V2 feature
