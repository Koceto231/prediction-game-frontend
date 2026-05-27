import { useState, useEffect } from 'react';
import { getTeamInitials } from '../utils/liveState';

/**
 * Round team-crest cell with three rendering states:
 *   1. Sportmonks `logoUrl` provided AND loads successfully → <img>
 *   2. `logoUrl` provided but the image fails to load (404, broken,
 *      empty content-type) → falls back to initials
 *   3. No `logoUrl` at all (still null in DB / not synced yet) → initials
 *
 * The `className` you pass becomes the wrapper class — wrap your visual
 * shield style there (size, border, background). The inner <img> /
 * <span> use the same class with a `__img` / `__initials` suffix so you
 * can theme them via CSS.
 *
 * PERF NOTES
 * - `loading="lazy"` defers off-screen crests (most of them on long lists).
 * - `decoding="async"` lets the browser decompress on a worker thread so
 *   the main thread isn't blocked during scrolls.
 * - `fetchpriority="low"` for lists, "high" for the match-detail hero
 *   (caller controls via the `priority` prop).
 * - Explicit width/height attributes prevent layout shift when the image
 *   finally arrives — bigger CLS = lower mobile Lighthouse score.
 */
export default function TeamCrest({
  logoUrl,
  name,
  className = 'team-crest',
  size,
  priority = false,
}) {
  const [broken, setBroken] = useState(false);
  // Reset broken-state when the underlying URL changes (e.g. when a new
  // match is selected or Sportmonks finally populates the logo).
  useEffect(() => { setBroken(false); }, [logoUrl]);

  const showImg = logoUrl && !broken;
  const initials = getTeamInitials(name);

  return (
    <span className={className} style={size ? { width: size, height: size } : undefined}>
      {showImg
        ? <img
            className={`${className}__img`}
            src={logoUrl}
            alt=""
            width={size || 64}
            height={size || 64}
            onError={() => setBroken(true)}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={priority ? 'high' : 'low'}
          />
        : <span className={`${className}__initials`} aria-label={name}>{initials}</span>}
    </span>
  );
}
