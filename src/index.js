import Resolver from '@forge/resolver';
import api, { assumeTrustedRoute, storage } from '@forge/api';

const resolver = new Resolver();

// ─── Helpers ────────────────────────────────────────────────────────────────

async function jiraGet(path) {
  // Forge requires product REST API URLs to be wrapped as safe routes. The
  // callers below build URLs from validated project keys and URLSearchParams,
  // then this helper marks the final Jira-relative path as trusted.
  const res = await api.asUser().requestJira(assumeTrustedRoute(path), {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira API ${res.status}: ${path} — ${text}`);
  }
  return res.json();
}

function validateProjectKey(projectKey) {
  // Keep this strict because the project key is used in REST paths and JQL.
  // Jira project keys are typically uppercase letters, digits, and underscores.
  if (typeof projectKey !== 'string' || !/^[A-Z][A-Z0-9_]{1,9}$/.test(projectKey)) {
    throw new Error('projectKey must be a valid Jira project key, for example ABC');
  }
}

async function loadProjectMetadata(projectKey) {
  validateProjectKey(projectKey);

  const cacheKey = `metadata-${projectKey}`;
  const cached = await storage.get(cacheKey);
  if (cached) {
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.cachedAt < 86400000) {
      return parsed.data;
    }
  }

  // Fetch every workflow status used by this project, then deduplicate because
  // Jira returns statuses grouped by issue type.
  const statusesRaw = await jiraGet(`/rest/api/3/project/${projectKey}/statuses`);
  const statuses = [];
  for (const issueTypeStatuses of statusesRaw) {
    for (const s of issueTypeStatuses.statuses ?? []) {
      if (!statuses.find(x => x.id === s.id)) {
        statuses.push({
          id: s.id,
          name: s.name,
          category: s.statusCategory?.key ?? 'new',
        });
      }
    }
  }

  // Jira's issue-type endpoint needs the numeric project id, so we fetch the
  // project first and then load the issue type list for the UI filters.
  const projectData = await jiraGet(`/rest/api/3/project/${projectKey}`);
  const issueTypesPath = `/rest/api/3/issuetype/project?${new URLSearchParams({
    projectId: projectData.id,
  }).toString()}`;
  const typesRaw = await jiraGet(issueTypesPath);
  const issueTypes = typesRaw.map(t => ({
    id: t.id,
    name: t.name,
    iconUrl: t.iconUrl ?? null,
  }));

  const data = { statuses, issueTypes };
  await storage.set(cacheKey, JSON.stringify({ data, cachedAt: Date.now() }));
  return data;
}

async function jiraGetAllPages(path, params = {}) {
  const results = [];
  let startAt = 0;
  const maxResults = 100;
  while (true) {
    const qs = new URLSearchParams({ ...params, maxResults, startAt }).toString();
    const data = await jiraGet(`${path}?${qs}`);
    const issues = data.issues ?? data.values ?? data;
    results.push(...issues);
    if (issues.length < maxResults) break;
    startAt += maxResults;
  }
  return results;
}

function isoDate(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

function daysBetween(from, to) {
  return Math.round((new Date(to) - new Date(from)) / 86400000);
}

function calculateStats(series) {
  if (!series.length) return { average: 0, p90: 0, cv: 0, stabilityLabel: 'High', trend: 'stable', trendDelta: 0 };

  const values = series.map(s => s.count);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const p90 = sorted[Math.floor(sorted.length * 0.9)];
  const stddev = Math.sqrt(values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length);
  const cv = avg > 0 ? stddev / avg : 0;

  const stabilityLabel = cv < 0.3 ? 'High' : cv < 0.6 ? 'Medium' : 'Low';

  const mid = Math.floor(values.length / 2);
  const firstHalf = values.slice(0, mid);
  const secondHalf = values.slice(mid);
  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / (firstHalf.length || 1);
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / (secondHalf.length || 1);
  const trendDelta = Math.round(avgSecond - avgFirst);
  const trend = trendDelta > 0.5 ? 'up' : trendDelta < -0.5 ? 'down' : 'stable';

  return {
    average: Math.round(avg * 10) / 10,
    p90,
    cv: Math.round(cv * 100) / 100,
    stabilityLabel,
    trend,
    trendDelta,
  };
}

// ─── WIP reconstruction from changelog ──────────────────────────────────────

function getStatusTransitions(issue) {
  const transitions = [];
  const histories = issue.changelog?.histories ?? [];
  for (const history of histories) {
    const created = new Date(history.created).getTime();
    for (const item of history.items ?? []) {
      if (item.field === 'status') {
        transitions.push({
          timestamp: created,
          fromId: item.from,
          fromName: item.fromString,
          toId: item.to,
          toName: item.toString,
        });
      }
    }
  }
  transitions.sort((a, b) => a.timestamp - b.timestamp);
  return transitions;
}

function wasInProgressOnDate(issue, transitions, date, inProgressIds) {
  const midnight = new Date(date + 'T23:59:59Z').getTime();

  // Walk transitions up to midnight of that day to find status at EOD
  let currentStatusId = null;

  // Start: figure out the status before the first transition we know
  // If created after midnight → issue didn't exist yet
  const createdAt = new Date(issue.fields.created).getTime();
  if (createdAt > midnight) return false;

  // Initial status = status at creation (no transition yet means it was the first status)
  // We reconstruct by walking forward
  const relevantTransitions = transitions.filter(t => t.timestamp <= midnight);

  if (relevantTransitions.length === 0) {
    // No transitions by EOD — use current status
    currentStatusId = issue.fields.status.id;
    // But current status might be after our date — we need the initial status
    // If there are ANY transitions at all, initial status was before the first one
    if (transitions.length > 0) {
      // reverse: go back from first transition
      currentStatusId = transitions[0].fromId;
    }
  } else {
    currentStatusId = relevantTransitions[relevantTransitions.length - 1].toId;
  }

  return inProgressIds.includes(currentStatusId);
}

async function buildWipSeries(projectKey, days, inProgressIds) {
  const today = isoDate(Date.now());
  const fromDate = addDays(today, -days + 1);

  // Fetch issues updated in last (days + buffer) to catch issues that transitioned before window
  const issues = await jiraGetAllPages('/rest/api/3/search/jql', {
    jql: `project = ${projectKey} AND updated >= -${days + 14}d ORDER BY updated ASC`,
    fields: 'summary,status,issuetype,created,updated,assignee',
    expand: 'changelog',
  });

  const series = [];
  let d = fromDate;
  while (d <= today) {
    let count = 0;
    for (const issue of issues) {
      const transitions = getStatusTransitions(issue);
      if (wasInProgressOnDate(issue, transitions, d, inProgressIds)) {
        count++;
      }
    }
    series.push({ date: d, count });
    d = addDays(d, 1);
  }

  return { series, issues };
}

// ─── getProjectMetadata ──────────────────────────────────────────────────────

resolver.define('getProjectMetadata', async (req) => {
  try {
    const { projectKey } = req.payload;
    if (!projectKey) return { error: 'projectKey is required' };

    return { data: await loadProjectMetadata(projectKey) };
  } catch (err) {
    return { error: err.message };
  }
});

// ─── getWipData ──────────────────────────────────────────────────────────────

resolver.define('getWipData', async (req) => {
  try {
    const { projectKey, days = 14 } = req.payload;
    if (!projectKey) return { error: 'projectKey is required' };
    validateProjectKey(projectKey);

    // Get in-progress status IDs
    const { statuses } = await loadProjectMetadata(projectKey);
    const inProgressIds = statuses
      .filter(s => s.category === 'indeterminate')
      .map(s => s.id);

    if (inProgressIds.length === 0) {
      return { error: 'No in-progress statuses found for this project' };
    }

    // Check cache
    const today = isoDate(Date.now());
    const cacheKey = `wip-${projectKey}-${today}-${days}`;
    const cached = await storage.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.cachedAt < 3600000) {
        return { data: parsed.data };
      }
    }

    // Build WIP series
    const { series, issues } = await buildWipSeries(projectKey, days, inProgressIds);
    const stats = calculateStats(series);

    // Current WIP per status (live query, no changelog needed)
    const inProgressJql = inProgressIds.map(id => `status = ${id}`).join(' OR ');
    const currentIssues = await jiraGetAllPages('/rest/api/3/search/jql', {
      jql: `project = ${projectKey} AND (${inProgressJql})`,
      fields: 'summary,status,issuetype,created,assignee',
    });

    const statusMap = {};
    for (const s of statuses) statusMap[s.id] = s.name;

    const breakdownMap = {};
    for (const issue of currentIssues) {
      const sid = issue.fields.status.id;
      if (!breakdownMap[sid]) {
        breakdownMap[sid] = { statusId: sid, statusName: statusMap[sid] ?? sid, count: 0 };
      }
      breakdownMap[sid].count++;
    }
    const statusBreakdown = Object.values(breakdownMap).sort((a, b) => b.count - a.count);

    // Longest sitting issues
    const longestSitting = currentIssues
      .map(issue => {
        const transitions = getStatusTransitions(issue);
        // Find last transition INTO in-progress
        const inTransitions = transitions
          .filter(t => inProgressIds.includes(t.toId))
          .sort((a, b) => b.timestamp - a.timestamp);
        const lastEntered = inTransitions[0]?.timestamp ?? new Date(issue.fields.created).getTime();
        const daysInProgress = Math.floor((Date.now() - lastEntered) / 86400000);
        return {
          key: issue.key,
          summary: issue.fields.summary,
          statusName: issue.fields.status.name,
          issueTypeName: issue.fields.issuetype?.name ?? 'Unknown',
          daysInProgress,
        };
      })
      .sort((a, b) => b.daysInProgress - a.daysInProgress)
      .slice(0, 5);

    const data = {
      series,
      stats,
      statusBreakdown,
      longestSitting,
      lastSyncedAt: new Date().toISOString(),
    };

    await storage.set(cacheKey, JSON.stringify({ data, cachedAt: Date.now() }));
    return { data };
  } catch (err) {
    return { error: err.message };
  }
});

// ─── refreshData ─────────────────────────────────────────────────────────────

resolver.define('refreshData', async (req) => {
  try {
    const { projectKey } = req.payload;
    if (!projectKey) return { error: 'projectKey is required' };
    validateProjectKey(projectKey);

    // Clear all cache keys for this project
    const today = isoDate(Date.now());
    await storage.delete(`metadata-${projectKey}`);
    for (const days of [7, 14, 30]) {
      await storage.delete(`wip-${projectKey}-${today}-${days}`);
    }

    const syncedAt = new Date().toISOString();
    return { data: { success: true, syncedAt } };
  } catch (err) {
    return { error: err.message };
  }
});

// ─── Export ───────────────────────────────────────────────────────────────────

export const handler = resolver.getDefinitions();
