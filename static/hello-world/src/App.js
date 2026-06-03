import React, { useEffect, useState, useCallback } from 'react';
import { invoke, view } from '@forge/bridge';

import LoadingState from './components/LoadingState';
import ErrorState from './components/ErrorState';
import Header from './components/Header';
import KPICards from './components/KPICards';
import DailyWIPChart from './components/DailyWIPChart';
import StatusBreakdown from './components/StatusBreakdown';
import LongestSitting from './components/LongestSitting';
import InsightsPanel from './components/InsightsPanel';

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export default function App() {
  const [projectKey, setProjectKey] = useState(null);
  const [cloudId, setCloudId] = useState(null);
  const [metadata, setMetadata] = useState(null);

  const [days, setDays] = useState(14);
  const [issueTypeFilter, setIssueTypeFilter] = useState('all');

  const [wipData, setWipData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Get project context from Jira
  useEffect(() => {
    view.getContext().then(ctx => {
      const key = ctx?.extension?.project?.key;
      const cid = ctx?.cloudId;
      setProjectKey(key || 'HAI');
      setCloudId(cid || null);
    }).catch(() => {
      setProjectKey('HAI');
    });
  }, []);

  // Fetch metadata once per project
  useEffect(() => {
    if (!projectKey) return;
    invoke('getProjectMetadata', { projectKey }).then(res => {
      if (res && !res.error) setMetadata(res.data);
    }).catch(() => {});
  }, [projectKey]);

  // Fetch WIP data — re-runs when projectKey, days, or issueTypeFilter changes
  const fetchWipData = useCallback(() => {
    if (!projectKey) return;
    setLoading(true);
    setError(null);
    invoke('getWipData', { projectKey, days, issueTypeIds: issueTypeFilter })
      .then(res => {
        if (res.error) setError(res.error);
        else setWipData(res.data);
      })
      .catch(err => setError(err.message || 'Failed to load data'))
      .finally(() => setLoading(false));
  }, [projectKey, days, issueTypeFilter]);

  useEffect(() => {
    fetchWipData();
  }, [fetchWipData]);

  const handleDaysChange = (newDays) => {
    setIssueTypeFilter('all');
    setDays(newDays);
  };

  const handleRefresh = useCallback(() => {
    if (!projectKey || refreshing) return;
    setRefreshing(true);
    invoke('refreshData', { projectKey })
      .finally(() => {
        setRefreshing(false);
        fetchWipData();
      });
  }, [projectKey, refreshing, fetchWipData]);

  return (
    <div style={{ fontFamily: FONT, padding: '16px 20px', maxWidth: 900, margin: '0 auto' }}>
      <Header
        projectKey={projectKey}
        lastSyncedAt={wipData?.lastSyncedAt}
        days={days}
        onDaysChange={handleDaysChange}
        issueTypes={metadata?.issueTypes}
        issueTypeFilter={issueTypeFilter}
        onIssueTypeFilterChange={setIssueTypeFilter}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      {loading && <LoadingState />}

      {!loading && error && (
        <ErrorState message={error} onRetry={fetchWipData} />
      )}

      {!loading && !error && wipData && (
        <>
          <KPICards
            stats={wipData.stats}
            series={wipData.series}
            days={days}
          />

          <DailyWIPChart
            series={wipData.series}
            stats={wipData.stats}
          />

          <InsightsPanel
            stats={wipData.stats}
            statusBreakdown={wipData.statusBreakdown}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <StatusBreakdown statusBreakdown={wipData.statusBreakdown} />
            <LongestSitting longestSitting={wipData.longestSitting} cloudId={cloudId} />
          </div>
        </>
      )}
    </div>
  );
}
