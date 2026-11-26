import { useMemo, useState } from 'react';
import { formatKm, formatMinutesToDuration, TripRecord, Vehicle } from '../types/fleet';

interface FleetAnalyticsPanelProps {
  trips: TripRecord[];
  vehicles: Vehicle[];
}

export function FleetAnalyticsPanel({ trips, vehicles }: FleetAnalyticsPanelProps) {
  const [groupMode, setGroupMode] = useState<'vehicle' | 'date'>('vehicle');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filteredTrips = useMemo(() => {
    return trips.filter((t) => {
      if (dateFrom && t.startDate < dateFrom) return false;
      if (dateTo && t.endDate > dateTo) return false;
      return true;
    });
  }, [trips, dateFrom, dateTo]);

  const summary = useMemo(() => {
    return filteredTrips.reduce(
      (acc, t) => {
        acc.trips += 1;
        acc.km += t.kmTotal;
        acc.coldMinutes += t.coldDurationMinutes;
        if (t.sheetSyncStatus === 'synced') acc.synced += 1;
        return acc;
      },
      { trips: 0, km: 0, coldMinutes: 0, synced: 0 }
    );
  }, [filteredTrips]);

  const vehicleStats = useMemo(() => {
    const quotaByBks = new Map<string, { label: string; quotaHours: number }>();
    vehicles.forEach((v) =>
      quotaByBks.set(v.bks, { label: v.label, quotaHours: v.coldHourDailyQuota })
    );

    const map = new Map<
      string,
      {
        bks: string;
        tripCount: number;
        kdKm: number;
        knKm: number;
        pvKm: number;
        bdKm: number;
        totalKm: number;
        coldMinutes: number;
        latestOdo: number;
        latestCold: string;
        activeDays: Set<string>;
      }
    >();

    for (const t of filteredTrips) {
      let row = map.get(t.bks);
      if (!row) {
        row = {
          bks: t.bks,
          tripCount: 0,
          kdKm: 0,
          knKm: 0,
          pvKm: 0,
          bdKm: 0,
          totalKm: 0,
          coldMinutes: 0,
          latestOdo: t.kmEnd,
          latestCold: '',
          activeDays: new Set(),
        };
        map.set(t.bks, row);
      }
      row.tripCount += 1;
      row.totalKm += t.kmTotal;
      row.coldMinutes += t.coldDurationMinutes;
      row.activeDays.add(t.startDate);
      if (t.kmEnd > row.latestOdo) row.latestOdo = t.kmEnd;
      if (t.tripType === 'kinh_doanh' && t.coldEnd && !row.latestCold) {
        row.latestCold = t.coldEnd;
      }
      if (t.tripType === 'kinh_doanh') row.kdKm += t.kmTotal;
      if (t.tripType === 'ket_noi') row.knKm += t.kmTotal;
      if (t.tripType === 'pvdc') row.pvKm += t.kmTotal;
      if (t.tripType === 'bdsc') row.bdKm += t.kmTotal;
    }

    return Array.from(map.values())
      .map((item) => {
        const meta = quotaByBks.get(item.bks);
        const daysCount = Math.max(1, item.activeDays.size);
        const avgColdHoursPerDay = item.coldMinutes / 60 / daysCount;
        const quotaHours = meta?.quotaHours ?? 12;
        const ratio = quotaHours > 0 ? avgColdHoursPerDay / quotaHours : 0;
        return {
          ...item,
          label: meta?.label || '',
          daysCount: item.activeDays.size,
          avgColdHoursPerDay,
          quotaHours,
          ratio,
        };
      })
      .sort((a, b) => b.totalKm - a.totalKm);
  }, [filteredTrips, vehicles]);

  const dateStats = useMemo(() => {
    const map = new Map<
      string,
      {
        date: string;
        vehicles: Set<string>;
        tripCount: number;
        totalKm: number;
        coldMinutes: number;
      }
    >();

    for (const t of filteredTrips) {
      let row = map.get(t.startDate);
      if (!row) {
        row = {
          date: t.startDate,
          vehicles: new Set(),
          tripCount: 0,
          totalKm: 0,
          coldMinutes: 0,
        };
        map.set(t.startDate, row);
      }
      row.vehicles.add(t.bks);
      row.tripCount += 1;
      row.totalKm += t.kmTotal;
      row.coldMinutes += t.coldDurationMinutes;
    }

    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredTrips]);

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-xs font-medium text-slate-500">Tổng số chuyến</div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {summary.trips}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-xs font-medium text-slate-500">Tổng quãng đường</div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {formatKm(summary.km)} <span className="text-sm font-normal text-slate-500">km</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-xs font-medium text-slate-500">Tổng giờ lạnh chạy</div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-sky-800 tabular-nums">
            {formatMinutesToDuration(summary.coldMinutes)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-xs font-medium text-slate-500">Đã đồng bộ Google Sheet</div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-emerald-700 tabular-nums">
            {summary.synced} / {summary.trips}
          </div>
        </div>
      </div>

      {/* Filter & Group Mode Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="inline-flex p-1 bg-slate-100 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setGroupMode('vehicle')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
              groupMode === 'vehicle'
                ? 'bg-white text-slate-900 font-semibold shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Thống kê theo xe (BKS)
          </button>
          <button
            type="button"
            onClick={() => setGroupMode('date')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
              groupMode === 'date'
                ? 'bg-white text-slate-900 font-semibold shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Thống kê theo ngày
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">Khoảng ngày:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="min-h-[38px] px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono"
          />
          <span className="text-slate-400">–</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="min-h-[38px] px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {filteredTrips.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Chưa có dữ liệu thống kê trong khoảng thời gian đã chọn.
          </div>
        ) : groupMode === 'vehicle' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
                  <th className="px-4 py-3">BKS</th>
                  <th className="px-4 py-3 text-right">Số chuyến</th>
                  <th className="px-4 py-3 text-right">Kinh doanh</th>
                  <th className="px-4 py-3 text-right">Kết nối</th>
                  <th className="px-4 py-3 text-right">PVĐC</th>
                  <th className="px-4 py-3 text-right">BDSC</th>
                  <th className="px-4 py-3 text-right">Tổng Km</th>
                  <th className="px-4 py-3 text-right">Odo mới nhất</th>
                  <th className="px-4 py-3 text-right">Tổng giờ lạnh</th>
                  <th className="px-4 py-3">So với định mức/ngày</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {vehicleStats.map((row) => {
                  const isOver = row.ratio > 1;
                  const isWarn = !isOver && row.ratio >= 0.85;
                  return (
                    <tr key={row.bks} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-mono font-bold text-slate-900">{row.bks}</div>
                        {row.label && <div className="text-xs text-slate-500">{row.label}</div>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">{row.tripCount}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                        {formatKm(row.kdKm)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                        {formatKm(row.knKm)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                        {formatKm(row.pvKm)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                        {formatKm(row.bdKm)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {formatKm(row.totalKm)} km
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700 tabular-nums">
                        {formatKm(row.latestOdo)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-sky-800 tabular-nums">
                        {formatMinutesToDuration(row.coldMinutes)}
                      </td>
                      <td className="px-4 py-3 min-w-[200px]">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-mono tabular-nums text-slate-700">
                            {row.avgColdHoursPerDay.toFixed(1)}h / {row.quotaHours}h/ngày
                          </span>
                          <span
                            className={`font-semibold ${
                              isOver
                                ? 'text-red-700'
                                : isWarn
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                            }`}
                          >
                            {isOver ? 'Vượt định mức' : isWarn ? 'Gần ngưỡng' : 'Trong định mức'}
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isOver ? 'bg-red-600' : isWarn ? 'bg-amber-500' : 'bg-emerald-600'
                            }`}
                            style={{ width: `${Math.min(100, Math.round(row.ratio * 100))}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
                  <th className="px-4 py-3">Ngày</th>
                  <th className="px-4 py-3 text-right">Số xe hoạt động</th>
                  <th className="px-4 py-3 text-right">Tổng chuyến</th>
                  <th className="px-4 py-3 text-right">Tổng Km trong ngày</th>
                  <th className="px-4 py-3 text-right">Tổng giờ lạnh trong ngày</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {dateStats.map((row) => (
                  <tr key={row.date} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900">{row.date}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {row.vehicles.size} xe
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{row.tripCount}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                      {formatKm(row.totalKm)} km
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-sky-800 tabular-nums">
                      {formatMinutesToDuration(row.coldMinutes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
