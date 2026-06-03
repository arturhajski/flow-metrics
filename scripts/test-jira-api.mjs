#!/usr/bin/env node
/**
 * test-jira-api.mjs
 * Tests Jira API connectivity and WIP reconstruction logic against a real project.
 *
 * Setup:
 *   cp .env.example .env   # fill in your credentials
 *   node scripts/test-jira-api.mjs
 *
 * Optional args:
 *   node scripts/test-jira-api.mjs --days=14 --project=PROJ
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ─── Load .env ───────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env');

try {
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    process.env[key.trim()] = rest.join('=').trim();
  }
} catch {
  console.error('❌  .env file not found. Copy .env.example → .env and fill in credentials.');
  process.exit(1);
}

// ─── Config ──────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, v] = a.slice(2).split('='); return [k, v]; })
);

const JIRA_URL = process.env.JIRA_URL?.replace(/\/$/, '');
const EMAIL    = process.env.JIRA_EMAIL;
const TOKEN    = process.env.JIRA_TOKEN;
const PROJECT  = args.project || process.env.JIRA_PROJECT;
const DAYS     = Number(args.days || 14);

if (!JIRA_URL || !EMAIL || !TOKEN || !PROJECT) {
  console.error('❌  Missing env vars. Check your .env file.');
  process.exit(1);
}

const AUTH = Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64');

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function jiraGet(path) {
  const url = `${JIRA_URL}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${AUTH}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} at ${path}\n${text.slice(0, 300)}`);
  }
  return res.json();
}

async function jiraGetAllPages(path, params = {}) {
  const results = [];
  let startAt = 0;
  while (true) {
    const qs = new URLSearchParams({ ...params, maxResults: '100', startAt: String(startAt) }).toString();
    const data = await jiraGet(`${path}?${qs}`);
    const page = data.issues ?? data.values ?? data;
    results.push(...page);
    process.stdout.write(`  fetched ${results.length} issues...\r`);
    if (page.length < 100) break;
    startAt += 100;
  }
  process.stdout.write('\n');
  return results;
}

function isoDate(ts) { return new Date(ts).toISOString().slice(0, 10); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return isoDate(x); }

function getStatusTransitions(issue) {
  const tr = [];
  for (const h of issue.changelog?.histories ?? []) {
    for (const item of h.items ?? []) {
      if (item.field === 'status') {
        tr.push({ timestamp: new Date(h.created).getTime(), fromId: item.from, toId: item.to, toName: item.toString });
      }
    }
  }
  return tr.sort((a, b) => a.timestamp - b.timestamp);
}

function wasInProgressOnDate(issue, transitions, date, inProgressIds) {
  const midnight = new Date(date + 'T23:59:59Z').getTime();
  if (new Date(issue.fields.created).getTime() > midnight) return false;
  const relevant = transitions.filter(t => t.timestamp <= midnight);
  const statusId = relevant.length === 0
    ? (transitions.length > 0 ? transitions[0].fromId : issue.fields.status.id)
    : relevant[relevant.length - 1].toId;
  return inProgressIds.includes(statusId);
}

function calculateStats(series) {
  const values = series.map(s => s.count);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const p90 = sorted[Math.floor(sorted.length * 0.9)];
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  const cv = avg > 0 ? Math.sqrt(variance) / avg : 0;
  const mid = Math.floor(values.length / 2);
  const a1 = values.slice(0, mid).reduce((a, b) => a + b, 0) / (mid || 1);
  const a2 = values.slice(mid).reduce((a, b) => a + b, 0) / ((values.length - mid) || 1);
  const trendDelta = Math.round(a2 - a1);
  return {
    average: Math.round(avg * 10) / 10,
    p90,
    cv: Math.round(cv * 100) / 100,
    stabilityLabel: cv < 0.3 ? 'High' : cv < 0.6 ? 'Medium' : 'Low',
    trend: trendDelta > 0.5 ? 'up' : trendDelta < -0.5 ? 'down' : 'stable',
    trendDelta,
  };
}

// ─── Steps ───────────────────────────────────────────────────────────────────

function section(title) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

async function testConnectivity() {
  section('1. Connectivity & project info');
  const project = await jiraGet(`/rest/api/3/project/${PROJECT}`);
  console.log(`  ✅  Project: ${project.name} (${project.key})`);
  console.log(`      Type: ${project.projectTypeKey}, Style: ${project.style ?? 'n/a'}`);
  return project;
}

async function testStatuses() {
  section('2. Project statuses');
  const raw = await jiraGet(`/rest/api/3/project/${PROJECT}/statuses`);
  const seen = new Set();
  const statuses = [];
  for (const block of raw) {
    for (const s of block.statuses ?? []) {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        statuses.push({ id: s.id, name: s.name, category: s.statusCategory?.key ?? 'new' });
      }
    }
  }

  const inProgress = statuses.filter(s => s.category === 'indeterminate');
  const done       = statuses.filter(s => s.category === 'done');
  const todo       = statuses.filter(s => s.category === 'new');

  console.log(`  All statuses (${statuses.length}):`);
  for (const s of statuses) {
    const icon = s.category === 'indeterminate' ? '🔵' : s.category === 'done' ? '✅' : '⬜';
    console.log(`    ${icon} [${s.category}] ${s.name} (id: ${s.id})`);
  }

  if (inProgress.length === 0) {
    console.log('\n  ⚠️   NO in-progress (indeterminate) statuses found!');
    console.log('       WIP metrics will be empty. Check your project statuses.');
  } else {
    console.log(`\n  ✅  In-progress statuses: ${inProgress.map(s => s.name).join(', ')}`);
  }

  return statuses;
}

async function testIssueTypes(project) {
  section('3. Issue types');
  const types = await jiraGet(`/rest/api/3/issuetype/project?projectId=${project.id}`);
  console.log(`  Found ${types.length} issue types:`);
  for (const t of types) {
    console.log(`    • ${t.name} (id: ${t.id})`);
  }
  return types;
}

async function testWipReconstruction(statuses) {
  section(`4. WIP reconstruction (last ${DAYS} days)`);

  const inProgressIds = statuses
    .filter(s => s.category === 'indeterminate')
    .map(s => s.id);

  if (inProgressIds.length === 0) {
    console.log('  ⚠️   Skipping — no in-progress statuses.');
    return;
  }

  console.log(`  Fetching issues updated in the last ${DAYS + 14} days (with changelog)...`);
  const issues = await jiraGetAllPages('/rest/api/3/search/jql', {
    jql: `project = ${PROJECT} AND updated >= -${DAYS + 14}d ORDER BY updated ASC`,
    fields: 'summary,status,issuetype,created,updated',
    expand: 'changelog',
  });

  console.log(`  ✅  Fetched ${issues.length} issues`);

  const issuesWithChangelog = issues.filter(i => (i.changelog?.histories?.length ?? 0) > 0);
  console.log(`  📋  Issues with changelog: ${issuesWithChangelog.length} / ${issues.length}`);

  const today = isoDate(Date.now());
  const fromDate = addDays(today, -(DAYS - 1));

  console.log(`\n  Building daily WIP series (${fromDate} → ${today})...`);
  const series = [];
  let d = fromDate;
  while (d <= today) {
    let count = 0;
    for (const issue of issues) {
      if (wasInProgressOnDate(issue, getStatusTransitions(issue), d, inProgressIds)) count++;
    }
    series.push({ date: d, count });
    d = addDays(d, 1);
  }

  const stats = calculateStats(series);

  console.log('\n  Daily WIP series:');
  for (const point of series) {
    const bar = '█'.repeat(Math.min(point.count, 40));
    console.log(`    ${point.date}  ${String(point.count).padStart(3)}  ${bar}`);
  }

  console.log('\n  Stats:');
  console.log(`    Average:     ${stats.average}`);
  console.log(`    P90:         ${stats.p90}`);
  console.log(`    CV:          ${stats.cv}  → Stability: ${stats.stabilityLabel}`);
  console.log(`    Trend:       ${stats.trend} (delta: ${stats.trendDelta})`);

  return series;
}

async function testCurrentWip(statuses) {
  section('5. Current WIP (live snapshot)');

  const inProgressIds = statuses.filter(s => s.category === 'indeterminate').map(s => s.id);
  if (!inProgressIds.length) {
    console.log('  ⚠️   Skipping — no in-progress statuses.');
    return;
  }

  const jql = inProgressIds.map(id => `status = "${id}"`).join(' OR ');
  const issues = await jiraGetAllPages('/rest/api/3/search/jql', {
    jql: `project = ${PROJECT} AND (${jql})`,
    fields: 'summary,status,issuetype,created,assignee',
    expand: 'changelog',
  });

  console.log(`  ✅  Currently in-progress: ${issues.length} issues\n`);

  const statusMap = Object.fromEntries(statuses.map(s => [s.id, s.name]));
  const breakdown = {};
  for (const issue of issues) {
    const sid = issue.fields.status.id;
    if (!breakdown[sid]) breakdown[sid] = { name: statusMap[sid] ?? sid, count: 0 };
    breakdown[sid].count++;
  }

  console.log('  Status breakdown:');
  for (const [, s] of Object.entries(breakdown).sort((a, b) => b[1].count - a[1].count)) {
    console.log(`    ${s.name}: ${s.count}`);
  }

  // Longest sitting
  const withDays = issues.map(issue => {
    const tr = getStatusTransitions(issue);
    const last = tr.filter(t => inProgressIds.includes(t.toId)).sort((a, b) => b.timestamp - a.timestamp)[0];
    const since = last?.timestamp ?? new Date(issue.fields.created).getTime();
    return {
      key: issue.key,
      summary: issue.fields.summary.slice(0, 60),
      status: issue.fields.status.name,
      days: Math.floor((Date.now() - since) / 86400000),
    };
  }).sort((a, b) => b.days - a.days).slice(0, 5);

  if (withDays.length > 0) {
    console.log('\n  Longest sitting (top 5):');
    for (const i of withDays) {
      const color = i.days >= 10 ? '🔴' : i.days >= 6 ? '🟡' : '🟢';
      console.log(`    ${color} ${i.key.padEnd(12)} ${String(i.days).padStart(3)}d  [${i.status}]  ${i.summary}`);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log(`\n🔍  Haisight WIP — API Test`);
console.log(`    URL:     ${JIRA_URL}`);
console.log(`    Project: ${PROJECT}`);
console.log(`    Days:    ${DAYS}`);

try {
  const project  = await testConnectivity();
  const statuses = await testStatuses();
                   await testIssueTypes(project);
                   await testWipReconstruction(statuses);
                   await testCurrentWip(statuses);
  console.log(`\n✅  All tests completed.\n`);
} catch (err) {
  console.error(`\n❌  Error: ${err.message}\n`);
  process.exit(1);
}
