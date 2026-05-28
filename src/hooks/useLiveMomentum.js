import { useEffect, useRef, useState } from 'react';

/**
 * Approximates a live "momentum / pressure" signal from the AGGREGATE stats
 * Sportmonks gives us (no positional feed). Returns:
 *
 *   value      — smoothed momentum, -100 (all away) … +100 (all home)
 *   history    — last N smoothed samples for a sparkline (oldest → newest)
 *   attacking  — 'home' | 'away' | null, who is pressing right now (driven
 *                by the most recent dangerous-attack delta, falling back to
 *                the sign of `value`)
 *   surge      — true for a moment right after a dangerous-attack/shot delta,
 *                so the UI can pulse the pressure glow
 *
 * Instantaneous pressure favouring HOME is a weighted blend of each stat's
 * share-of-total:
 *   possession 30 % · shots 20 % · shots-on-target 25 % · corners 10 %
 *   · dangerous-attacks 15 %
 * Smoothed with an EMA so the bar glides instead of snapping.
 */
const HISTORY = 40;        // samples kept for the sparkline
const EMA_ALPHA = 0.25;    // smoothing factor (higher = snappier)

const share = (h, a) => {
  const t = (h || 0) + (a || 0);
  if (t <= 0) return 0;          // no data → neutral
  return ((h - a) / t) * 100;    // -100 … +100
};

export default function useLiveMomentum(match) {
  const [state, setState] = useState({ value: 0, history: [], attacking: null, surge: false });
  const emaRef     = useRef(0);
  const histRef    = useRef([]);
  const prevRef    = useRef(null);
  const matchIdRef = useRef(null);

  useEffect(() => {
    const s = match?.liveStats;
    if (!match || !s) {
      emaRef.current = 0; histRef.current = []; prevRef.current = null; matchIdRef.current = null;
      setState({ value: 0, history: [], attacking: null, surge: false });
      return;
    }

    // Reset everything when switching matches
    if (matchIdRef.current !== match.id) {
      matchIdRef.current = match.id;
      emaRef.current = 0; histRef.current = []; prevRef.current = null;
    }

    const poss   = share(s.possession?.home,        s.possession?.away);
    const shots  = share(s.shots?.home,             s.shots?.away);
    const sot    = share(s.shotsOnTarget?.home,     s.shotsOnTarget?.away);
    const corn   = share(s.corners?.home,           s.corners?.away);
    const danger = share(s.dangerousAttacks?.home,  s.dangerousAttacks?.away);

    const instant =
      poss * 0.30 + shots * 0.20 + sot * 0.25 + corn * 0.10 + danger * 0.15;

    // EMA smoothing
    emaRef.current = emaRef.current + EMA_ALPHA * (instant - emaRef.current);
    const value = Math.max(-100, Math.min(100, Math.round(emaRef.current)));

    const hist = [...histRef.current, value].slice(-HISTORY);
    histRef.current = hist;

    // Who is pressing right now — most recent dangerous-attack / shot delta
    const prev = prevRef.current;
    let attacking = value > 4 ? 'home' : value < -4 ? 'away' : null;
    let surge = false;
    if (prev) {
      const dH = (s.dangerousAttacks?.home ?? 0) - prev.dH
               + (s.shotsOnTarget?.home ?? 0)   - prev.sH;
      const dA = (s.dangerousAttacks?.away ?? 0) - prev.dA
               + (s.shotsOnTarget?.away ?? 0)   - prev.sA;
      if (dH > 0 && dH >= dA) { attacking = 'home'; surge = true; }
      else if (dA > 0)        { attacking = 'away'; surge = true; }
    }
    prevRef.current = {
      dH: s.dangerousAttacks?.home ?? 0, dA: s.dangerousAttacks?.away ?? 0,
      sH: s.shotsOnTarget?.home ?? 0,    sA: s.shotsOnTarget?.away ?? 0,
    };

    setState({ value, history: hist, attacking, surge });
  }, [match]);

  // Clear the transient surge flag shortly after it fires
  useEffect(() => {
    if (!state.surge) return;
    const t = setTimeout(() => setState(s => ({ ...s, surge: false })), 2200);
    return () => clearTimeout(t);
  }, [state.surge]);

  return state;
}
