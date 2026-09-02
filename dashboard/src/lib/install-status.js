export function shouldShowInstallCard({
  publicMode,
  screenshotMode,
  forceInstall,
  heatmapLoading,
  activeDays,
} = {}) {
  if (publicMode || screenshotMode) return false;
  if (forceInstall) return true;
  return !heatmapLoading && activeDays === 0;
}
