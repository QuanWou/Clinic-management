import { useState } from 'react';
import type { ReceptionHistoryResponse } from '../types/domain';
import { formatDate } from '../utils/format';

type HistoryDay = ReceptionHistoryResponse['days'][number];
type Props = { days: HistoryDay[]; from: string; to: string };
type VolumePeriod = { id: string; from: string; to: string; appointments: number; checkIns: number; dayCount: number };
type Granularity = 'five-days' | 'daily';

const left = 47;
const right = 20;
const top = 18;
const bottom = 212;
const height = 256;
const shortDate = (date: string) => `${date.slice(8)}/${date.slice(5, 7)}`;
const labelPeriod = (period: VolumePeriod) => period.from === period.to
  ? shortDate(period.from) : `${shortDate(period.from)}–${shortDate(period.to)}`;

/** Equal-length calendar buckets: never drop zero days or mistake partial weeks for full weeks. */
export function groupHistoryDays(days: HistoryDay[], size = 5): VolumePeriod[] {
  if (!Number.isInteger(size) || size < 1) throw new Error('Invalid period size');
  const periods: VolumePeriod[] = [];
  for (let index = 0; index < days.length; index += size) {
    const slice = days.slice(index, index + size);
    periods.push({
      id: slice[0].date,
      from: slice[0].date,
      to: slice[slice.length - 1].date,
      appointments: slice.reduce((sum, day) => sum + day.appointments, 0),
      checkIns: slice.reduce((sum, day) => sum + day.checkIns, 0),
      dayCount: slice.length
    });
  }
  return periods;
}

/** Daily appointment/check-in counts are discrete volumes, so zero-based columns show their size more faithfully than connecting daily zeros with lines. */
export default function AdminTrendChart({ days, from, to }: Props) {
  const [granularity, setGranularity] = useState<Granularity>('five-days');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const periods = groupHistoryDays(days, granularity === 'five-days' ? 5 : 1);
  const highest = Math.max(1, ...periods.flatMap((period) => [period.appointments, period.checkIns]));
  const ceiling = Math.max(2, Math.ceil(highest / 2) * 2);
  const chartWidth = granularity === 'five-days' ? 900 : Math.max(900, periods.length * 40 + left + right);
  const plotWidth = chartWidth - left - right;
  const slot = plotWidth / Math.max(1, periods.length);
  const barWidth = granularity === 'five-days' ? 28 : 10;
  const selected = periods.find((period) => period.id === selectedId) ?? null;
  const y = (value: number) => bottom - value / ceiling * (bottom - top);

  function changeGranularity(next: Granularity) {
    setGranularity(next);
    setSelectedId(null);
  }

  return <div className="admin-trend-chart">
    <div className="admin-volume-toolbar" aria-label="Chọn mức độ chi tiết của biểu đồ">
      <span>Gộp số lượt theo</span>
      <div className="admin-volume-switch">
        <button type="button" aria-pressed={granularity === 'five-days'} onClick={() => changeGranularity('five-days')}>5 ngày</button>
        <button type="button" aria-pressed={granularity === 'daily'} onClick={() => changeGranularity('daily')}>Từng ngày</button>
      </div>
    </div>
    <div className="admin-volume-scroll" tabIndex={0} aria-label="Biểu đồ số lượt có thể cuộn ngang trên màn hình nhỏ">
      <svg className="admin-volume-svg" style={{ minWidth: granularity === 'daily' ? '1050px' : '550px' }}
        viewBox={`0 0 ${chartWidth} ${height}`} role="group"
        aria-label={`So sánh số lịch hẹn và check-in từ ${formatDate(from)} đến ${formatDate(to)}, ${granularity === 'five-days' ? 'tổng theo từng nhóm 5 ngày' : 'theo từng ngày'}`}>
        <title>Số lịch hẹn và check-in trong 30 ngày</title>
        <desc>Biểu đồ cột ghép, cùng một trục tung bắt đầu từ 0. Chọn mỗi nhóm bằng chuột, cảm ứng hoặc phím Tab để đọc giá trị chính xác; có bảng đầy đủ bên dưới.</desc>
        {[ceiling, ceiling / 2, 0].map((tick) => <g key={tick} className="admin-volume-grid" aria-hidden="true">
          <line x1={left} x2={chartWidth - right} y1={y(tick)} y2={y(tick)} />
          <text x={left - 11} y={y(tick) + 4} textAnchor="end">{tick.toLocaleString('vi-VN')}</text>
        </g>)}
        {periods.map((period, index) => {
          const cx = left + slot * (index + .5);
          const title = `${formatDate(period.from)}${period.from === period.to ? '' : ` – ${formatDate(period.to)}`}: ${period.appointments} lịch hẹn, ${period.checkIns} check-in`;
          const showTick = granularity === 'five-days' || index === 0 || index === periods.length - 1 || index % 5 === 0 || period.from.endsWith('-01');
          return <g key={period.id} className={`admin-volume-group${selectedId === period.id ? ' is-selected' : ''}`}
            role="button" tabIndex={0} aria-label={title} aria-pressed={selectedId === period.id}
            onMouseEnter={() => setSelectedId(period.id)} onFocus={() => setSelectedId(period.id)}
            onClick={() => setSelectedId(period.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setSelectedId(period.id);
              }
            }}>
            <title>{title}</title>
            <rect className="admin-volume-highlight" x={cx - slot / 2 + 2} y={top - 5}
              width={Math.max(1, slot - 4)} height={bottom - top + 11} rx={7} />
            <rect className="admin-volume-bar bookings" x={cx - barWidth - 2} y={y(period.appointments)}
              width={barWidth} height={bottom - y(period.appointments)} rx={3} />
            <rect className="admin-volume-bar checkins" x={cx + 2} y={y(period.checkIns)}
              width={barWidth} height={bottom - y(period.checkIns)} rx={3} />
            <rect className="admin-volume-hit" x={cx - slot / 2 + 2} y={top - 5}
              width={Math.max(1, slot - 4)} height={bottom - top + 11} />
            {showTick && <text className="admin-volume-date" x={cx} y={240} textAnchor="middle">{labelPeriod(period)}</text>}
          </g>;
        })}
      </svg>
    </div>
    <div className="admin-volume-inspector" role="status" aria-live="polite">
      {selected ? <><strong>{formatDate(selected.from)}{selected.from !== selected.to ? ` – ${formatDate(selected.to)}` : ''}</strong>
        <span>Lịch hẹn: <b>{selected.appointments.toLocaleString('vi-VN')}</b></span>
        <span>Check-in: <b>{selected.checkIns.toLocaleString('vi-VN')}</b></span></>
        : <span>Chọn một cột để xem tổng chính xác của khoảng thời gian đó.</span>}
    </div>
    <p className="admin-volume-note">{granularity === 'five-days'
      ? '6 nhóm bằng nhau, mỗi nhóm 5 ngày liên tiếp; số liệu là tổng, bao gồm cả ngày có 0 lượt.'
      : 'Mỗi cặp cột là một ngày; ngày có 0 lượt vẫn giữ vị trí trên trục thời gian.'}</p>
    <details className="admin-trend-details">
      <summary>Xem bảng số liệu 30 ngày</summary>
      <div className="admin-trend-table-scroll"><table>
        <thead><tr><th scope="col">Ngày</th><th scope="col">Lịch hẹn</th><th scope="col">Check-in</th></tr></thead>
        <tbody>{days.map((day) => <tr key={day.date}><th scope="row">{formatDate(day.date)}</th>
          <td>{day.appointments.toLocaleString('vi-VN')}</td><td>{day.checkIns.toLocaleString('vi-VN')}</td></tr>)}</tbody>
      </table></div>
    </details>
  </div>;
}
