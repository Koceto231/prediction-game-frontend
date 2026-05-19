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
 */
export default function TeamCrest({ logoUrl, name, className = 'team-crest', size }) {
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
            onError={() => setBroken(true)}
            loading="lazy"
          />
        : <span className={`${className}__initials`} aria-label={name}>{initials}</span>}
    </span>
  );
}
