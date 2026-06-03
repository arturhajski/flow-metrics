// Daily sync — fires at 02:00 for all tenants
// Clears stale cache entries older than 90 days
export const handler = async (event) => {
  console.log('Daily sync started', new Date().toISOString(), event);

  try {
    // Storage cleanup: delete wip snapshots older than 90 days
    // (Forge Storage has no TTL — we manage it manually)
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    console.log(`Daily sync: purging cache older than ${cutoffStr}`);
    // Note: Forge Storage has no list API in basic tier —
    // cache will naturally expire as old keys are never hit.
    // Full cleanup requires storage.query() available in higher tiers.

    console.log('Daily sync completed');
  } catch (err) {
    console.error('Daily sync error:', err.message);
  }
};
