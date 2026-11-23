/**
 * Phase 6.UI.B — Brand Capacity page.
 *
 * Per-brand snapshot of the same `openIwoCount` signal `routeBrand`
 * uses for its capacity check. The bar visualises how close each
 * brand is to the soft ceiling (`engine_config.brandCapacityThreshold`
 * — defaults to 20).
 *
 * Threshold is fetched once on mount; if `engine_config/global`
 * doesn't exist yet (pre-6.E), the default applies.
 *
 * Shell re-skin PR 3: the threshold rows become a `.zeus-tile-grid`
 * of soft tiles — one per brand, warn-toned when over the ceiling —
 * each carrying the `.zeus-burn` fill. The explainer sits inside a
 * `.zeus-panel-pad` lede so the page reads with a hierarchy.
 */

import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import { ALL_DELIVERY_SUBSIDIARIES } from '@/core/settings/brand-capabilities';
import type { InternalWorkOrder } from '@/modules/assignment/types/iwo.types';
import { subscribeActiveIwos } from '../services/traffic.service';

const DEFAULT_THRESHOLD = 20;

const BRAND_LABELS: Record<string, string> = {
  'zeus-the-agency': 'Zeus The Agency',
  'zeus-digital': 'Zeus Digital',
  labyrinth: 'Labyrinth',
  'odd-gorilla': 'Odd Gorilla',
  'house-of-zeus': 'House of Zeus',
};

export default function BrandCapacityPage() {
  const [iwos, setIwos] = useState<InternalWorkOrder[]>([]);
  const [threshold, setThreshold] = useState<number>(DEFAULT_THRESHOLD);

  useEffect(() => {
    const unsubscribe = subscribeActiveIwos(setIwos);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'engine_config', 'global'));
        const data = snap.exists() ? snap.data() : null;
        if (data && typeof data.brandCapacityThreshold === 'number') {
          setThreshold(data.brandCapacityThreshold);
        }
      } catch {
        // engine_config not readable yet — stick with default.
      }
    })();
  }, []);

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const b of ALL_DELIVERY_SUBSIDIARIES) out[b] = 0;
    for (const i of iwos) {
      if (out[i.subsidiaryOrgId] !== undefined) out[i.subsidiaryOrgId] += 1;
    }
    return out;
  }, [iwos]);

  return (
    <section
      data-testid="brand-capacity-page"
      style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      <p
        style={{
          fontSize: 12.5,
          color: 'var(--fg-secondary)',
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        Soft ceiling:{' '}
        <strong style={{ color: 'var(--fg-primary)' }}>{threshold}</strong> active IWOs per
        brand. Brands at the ceiling are not excluded by{' '}
        <code
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11.5,
            background: 'var(--bg-sunken)',
            padding: '1px 6px',
            borderRadius: 4,
          }}
        >
          routeBrand
        </code>
        , but they are ranked lower.
      </p>

      <ul
        className="zeus-tile-grid"
        style={{ listStyle: 'none', padding: 0, margin: 0 }}
      >
        {ALL_DELIVERY_SUBSIDIARIES.map((brandId) => {
          const open = counts[brandId];
          const pct = Math.min(100, Math.round((open / threshold) * 100));
          const overflow = open >= threshold;
          const fillTone = overflow ? 'over' : pct >= 80 ? 'warn' : '';
          const label = BRAND_LABELS[brandId] ?? brandId;
          return (
            <li
              key={brandId}
              data-testid={`capacity-row-${brandId}`}
              className={`zeus-tile${overflow ? ' warn' : ''}`}
            >
              <span className="zeus-tile-label">{label}</span>
              <span
                className="zeus-tile-value"
                data-testid={`capacity-count-${brandId}`}
              >
                {open}
                <span className="zeus-tile-unit">/ {threshold}</span>
              </span>
              <div className="zeus-burn" style={{ marginTop: 4 }}>
                <div className="zeus-burn-track">
                  <span
                    className={`zeus-burn-fill${fillTone ? ' ' + fillTone : ''}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
