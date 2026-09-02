// Display metadata for the achievement catalog.
//
// Thresholds do NOT live here; the local API returns per-badge thresholds.
// Array order is the display order.
import {
  FolderGit2,
  Heart,
  MoonStar,
} from "lucide-react";

// `art` files live in dashboard/public/achievements/ (see the README there
// for provenance); the lucide `icon` is the render fallback if the art fails
// to load.
export const BADGE_CATALOG = [
  { id: "project_hopper", scope: "local", icon: FolderGit2, format: "count", art: "/achievements/project-hopper.png" },
  { id: "project_devotion", scope: "local", icon: Heart, format: "tokens", art: "/achievements/project-devotion.png" },
  { id: "night_owl", scope: "local", icon: MoonStar, format: "count", art: "/achievements/night-owl.png" },
];

export const BADGE_BY_ID = new Map(BADGE_CATALOG.map((b) => [b.id, b]));

const CATALOG_INDEX = new Map(BADGE_CATALOG.map((b, i) => [b.id, i]));

export function badgeCopyKey(badgeId, slot) {
  return `achievements.badge.${badgeId}.${slot}`;
}

/** Sort earned badges by tier desc, then catalog order. */
export function sortBadges(badges) {
  return [...(badges || [])].sort((a, b) => {
    const tierDiff = (b?.tier || 0) - (a?.tier || 0);
    if (tierDiff !== 0) return tierDiff;
    return (CATALOG_INDEX.get(a?.id) ?? 99) - (CATALOG_INDEX.get(b?.id) ?? 99);
  });
}

/** Highest-priority earned badge (tier desc, catalog order tie-break). */
export function highestBadge(badges) {
  const earned = (badges || []).filter((b) => b && (b.tier || 0) >= 1 && BADGE_BY_ID.has(b.id));
  if (earned.length === 0) return null;
  return sortBadges(earned)[0];
}
