/**
 * MediaBuyGrid — tabular view of all buys within a plan.
 *
 * Columns: Vehicle (freeze left) | Type | Flight | Planned | Booked | Actual | Variance %
 */

import type { MediaBuy } from '../types/media-buy.types';
import { VehicleTypeBadge } from './VehicleTypeBadge';
import { computeVariancePct } from '../services/media-plan.service';

interface Props {
  buys: MediaBuy[];
  currency: string;
  onEditBuy?: (buy: MediaBuy) => void;
}

function fmtMinor(minor: number, currency: string): string {
  return `${currency} ${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
}

function varianceStyle(planned: number, actual: number) {
  const pct = computeVariancePct(planned, actual);
  if (planned === 0) {
    return { text: '—', style: undefined as React.CSSProperties | undefined };
  }
  const style: React.CSSProperties =
    pct > 10
      ? { color: 'var(--rag-red-deep, var(--rag-red))' }
      : pct < -10
        ? { color: 'var(--rag-green-deep, var(--rag-green))' }
        : {};
  return { text: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`, style };
}

export function MediaBuyGrid({ buys, currency, onEditBuy }: Props) {
  const totalPlanned = buys.reduce((s, b) => s + b.plannedMinor, 0);
  const totalBooked  = buys.reduce((s, b) => s + b.bookedMinor,  0);
  const totalActual  = buys.reduce((s, b) => s + b.actualMinor,  0);

  if (buys.length === 0) {
    return (
      <div className="zeus-panel zeus-panel-empty">
        No buys added yet. Use the Add Buy button to insert a channel/vehicle row.
      </div>
    );
  }

  const totalVariance = varianceStyle(totalPlanned, totalActual);

  return (
    <div className="zeus-panel" style={{ overflowX: 'auto' }}>
      <table className="zeus-ledger">
        <thead>
          <tr>
            <th>Vehicle</th>
            <th>Type</th>
            <th>Flight</th>
            <th className="num">Planned</th>
            <th className="num">Booked</th>
            <th className="num">Actual</th>
            <th className="num">Variance</th>
          </tr>
        </thead>
        <tbody>
          {buys.map((buy) => {
            const variance = varianceStyle(buy.plannedMinor, buy.actualMinor);
            return (
              <tr
                key={buy.id}
                style={{ cursor: onEditBuy ? 'pointer' : 'default' }}
                onClick={() => onEditBuy?.(buy)}
              >
                <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {buy.vehicleName}
                </td>
                <td>
                  <VehicleTypeBadge type={buy.vehicleType} />
                </td>
                <td className="dim" style={{ whiteSpace: 'nowrap' }}>
                  {buy.startDate} – {buy.endDate}
                </td>
                <td className="num">{fmtMinor(buy.plannedMinor, currency)}</td>
                <td className="num">{fmtMinor(buy.bookedMinor,  currency)}</td>
                <td className="num">{fmtMinor(buy.actualMinor,  currency)}</td>
                <td className="num" style={variance.style}>
                  {variance.text}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>Total</td>
            <td className="num">{fmtMinor(totalPlanned, currency)}</td>
            <td className="num">{fmtMinor(totalBooked,  currency)}</td>
            <td className="num">{fmtMinor(totalActual,  currency)}</td>
            <td className="num" style={totalVariance.style}>
              {totalVariance.text}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
