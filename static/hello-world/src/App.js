import React, { useEffect, useState, useCallback, useMemo } from 'react';
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

  // Fetch metadata once
  useEffect(() => {
    if (!projectKey) return;
    invoke('getProjectMetadata', { projectKey }).then(res => {
      if (res && !res.error) setMetadata(res.data);
    }).catch(() => {});
  }, [projectKey]);

  // Fetch WIP data when projectKey or days changes
  const fetchWipData = useCallback(() => {
    if (!projectKey) return;
    setLoading(true);
    setError(null);
    invoke('getWipData', { projectKey, days })
      .then(res => {
        if (res.error) setError(res.error);
        else setWipData(res.data);
      })
      .catch(err => setError(err.message || 'Failed to load data'))
      .finally(() => setLoading(false));
  }, [projectKey, days]);

  useEffect(() => {
    fetchWipData();
  }, [fetchWipData]);

  // Client-side filter by issue type (filters longestSitting)
  const filteredData = useMemo(() => {
    if (!wipData || issueTypeFilter === 'all') return wipData;
    const typeName = metadata?.issueTypes?.find(t => t.id === issueTypeFilter)?.name;
    return {
      ...wipData,
      longestSitting: wipData.longestSitting.filter(i => i.issueTypeName === typeName),
    };
  }, [wipData, issueTypeFilter, metadata]);

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

      {!loading && !error && filteredData && (
        <>
          <KPICards
            stats={filteredData.stats}
            series={filteredData.series}
            days={days}
          />

          <DailyWIPChart
            series={filteredData.series}
            stats={filteredData.stats}
          />

          <InsightsPanel
            stats={filteredData.stats}
            statusBreakdown={filteredData.statusBreakdown}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <StatusBreakdown statusBreakdown={filteredData.statusBreakdown} />
            <LongestSitting longestSitting={filteredData.longestSitting} cloudId={cloudId} />
          </div>
        </>
      )}
    </div>
  );
}
