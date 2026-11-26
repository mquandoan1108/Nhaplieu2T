import { useMemo, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import {
  formatKm,
  formatMinutesToDuration,
  formatRouteLabel,
  TripRecord,
  TripType,
  TRIP_TYPE_OPTIONS,
  Vehicle,
} from '../types/fleet';
import { exportTripsToCsv, exportTripsToExcel } from '../utils/exportSpreadsheets';
import { EditTripModal } from './EditTripModal';

interface TripSheetTableProps {
  trips: TripRecord[];
  vehicles: Vehicle[];
  loading: boolean;
  onUpdateTrip: (tripId: string, payload: Record<string, unknown>) => Promise<void>;
  onDeleteTrip: (tripId: string) => Promise<void>;
  onSyncTrip: (tripId: string) => Promise<void>;
  onSyncPending: () => Promise<void>;
  onOpenSettings: () => void;
}

export function TripSheetTable({
  trips,
  vehicles,
  loading,
  onUpdateTrip,
  onDeleteTrip,
  onSyncTrip,
  onSyncPending,
  onOpenSettings,
}: TripSheetTableProps) {
  const [search, setSearch] = useState('');
  const [bksFilter, setBksFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | TripType>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [editingTrip, setEditingTrip] = useState<TripRecord | null>(null);
  const [confirmDeleteTrip, setConfirmDeleteTrip] = useState<TripRecord | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [batchSyncing, setBatchSyncing] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const uniqueBks = useMemo(() => {
    const set = new Set<string>(vehicles.map((v) => v.bks));
    trips.forEach((t) => set.add(t.bks));
    return Array.from(set).sort();
  }, [vehicles, trips]);

  const filteredTrips = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trips.filter((t) => {
      if (bksFilter !== 'all' && t.bks !== bksFilter) return false;
      if (typeFilter !== 'all' && t.tripType !== typeFilter) return false;
      if (dateFrom && t.startDate < dateFrom) return false;
      if (dateTo && t.endDate > dateTo) return false;
      if (q) {
        const haystack = [
          t.bks,
          t.driver1,
          t.driver2,
          t.mcx,
          t.customerName,
          t.servicePostOffice,
          t.origin,
          t.destination,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [trips, search, bksFilter, typeFilter, dateFrom, dateTo]);

  const pendingCount = useMemo(
    () => trips.filter((t) => t.sheetSyncStatus !== 'synced').length,
    [trips]
  );

  const totals = useMemo(() => {
    return filteredTrips.reduce(
      (acc, t) => {
        acc.km += t.kmTotal;
        acc.coldMins += t.coldDurationMinutes;
        if (t.tripType === 'kinh_doanh') acc.kd += t.kmTotal;
        if (t.tripType === 'ket_noi') acc.kn += t.kmTotal;
        if (t.tripType === 'pvdc') acc.pv += t.kmTotal;
        if (t.tripType === 'bdsc') acc.bd += t.kmTotal;
        return acc;
      },
      { km: 0, coldMins: 0, kd: 0, kn: 0, pv: 0, bd: 0 }
    );
  }, [filteredTrips]);

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      await exportTripsToExcel(filteredTrips, `lo-trinh-xe-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportCsv = () => {
    exportTripsToCsv(filteredTrips, `lo-trinh-xe-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleSingleSync = async (id: string) => {
    setSyncingId(id);
    try {
      await onSyncTrip(id);
    } finally {
      setSyncingId(null);
    }
  };

  const handleBatchSync = async () => {
    setBatchSyncing(true);
    try {
      await onSyncPending();
    } finally {
      setBatchSyncing(false);
    }
  };

  const renderGroupCells = (trip: TripRecord, group: TripType) => {
    if (trip.tripType !== group) {
      return (
        <>
          <td className="px-2 py-2 border-r border-slate-200 text-right font-mono text-xs text-slate-300 tabular-nums" />
          <td className="px-2 py-2 border-r border-slate-200 text-right font-mono text-xs text-slate-300 tabular-nums" />
          <td className="px-2 py-2 border-r border-slate-300 text-right font-mono text-xs text-slate-400 tabular-nums">
            0
          </td>
        </>
      );
    }
    return (
      <>
        <td className="px-2 py-2 border-r border-slate-200 text-right font-mono text-xs text-slate-800 tabular-nums">
          {formatKm(trip.kmStart)}
        </td>
        <td className="px-2 py-2 border-r border-slate-200 text-right font-mono text-xs text-slate-800 tabular-nums">
          {formatKm(trip.kmEnd)}
        </td>
        <td className="px-2 py-2 border-r border-slate-300 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums">
          {formatKm(trip.kmTotal)}
        </td>
      </>
    );
  };

  return (
    <div className="space-y-4">
      {/* Toolbar & Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Bảng tổng hợp lộ trình &amp; Đồng bộ Google Sheet
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Hiển thị {filteredTrips.length} chuyến · Tổng quãng đường{' '}
              <span className="font-mono font-semibold text-slate-800 tabular-nums">
                {formatKm(totals.km)} km
              </span>{' '}
              · Tổng giờ lạnh{' '}
              <span className="font-mono font-semibold text-sky-800 tabular-nums">
                {formatMinutesToDuration(totals.coldMins)}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {pendingCount > 0 && (
              <button
                type="button"
                onClick={handleBatchSync}
                disabled={batchSyncing}
                className="inline-flex items-center gap-2 min-h-[40px] px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${batchSyncing ? 'animate-spin' : ''}`} />
                <span>Đồng bộ {pendingCount} dòng chưa gửi</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exportingExcel || filteredTrips.length === 0}
              className="inline-flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs sm:text-sm font-semibold cursor-pointer whitespace-nowrap"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{exportingExcel ? 'Đang tạo Excel...' : 'Xuất Excel (.xlsx)'}</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredTrips.length === 0}
              className="inline-flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-800 text-xs sm:text-sm font-medium cursor-pointer whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>Xuất CSV</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-slate-100">
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm BKS, lái xe, MCX, khách hàng, tuyến..."
              className="w-full min-h-[40px] pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
          </div>

          <select
            value={bksFilter}
            onChange={(e) => setBksFilter(e.target.value)}
            aria-label="Lọc theo BKS"
            className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono bg-white"
          >
            <option value="all">Tất cả BKS</option>
            {uniqueBks.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'all' | TripType)}
            aria-label="Lọc theo loại chuyến"
            className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
          >
            <option value="all">Tất cả loại chuyến</option>
            {TRIP_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="Từ ngày"
              className="w-1/2 min-h-[40px] px-2.5 py-2 rounded-xl border border-slate-300 text-xs font-mono"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="Đến ngày"
              className="w-1/2 min-h-[40px] px-2.5 py-2 rounded-xl border border-slate-300 text-xs font-mono"
            />
          </div>
        </div>
      </div>

      {/* Wide Spreadsheet Grid matching the uploaded image */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-10 rounded-lg bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : filteredTrips.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-base font-semibold text-slate-800">
              {trips.length === 0 ? 'Chưa có chuyến xe nào được ghi nhận' : 'Không tìm thấy chuyến xe phù hợp bộ lọc'}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {trips.length === 0
                ? 'Khi lái xe nhập lộ trình và bấm Lưu, dữ liệu sẽ hiển thị tại đây và tự động gửi sang Google Sheet.'
                : 'Hãy thử xóa bớt bộ lọc ngày, BKS hoặc từ khóa tìm kiếm.'}
            </p>
            {trips.length === 0 && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="mt-4 inline-flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-sm font-medium cursor-pointer"
              >
                Cấu hình Google Sheet ngay
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left whitespace-nowrap">
              <thead>
                {/* Row 1: Grouped Headers */}
                <tr className="text-[11px] font-bold text-slate-900 border-b border-slate-300">
                  <th rowSpan={2} className="px-3 py-2 bg-amber-300/80 border-r border-slate-300 text-center">
                    Ngày
                  </th>
                  <th rowSpan={2} className="px-3 py-2 bg-amber-300/80 border-r border-slate-300 text-center sticky left-0 z-10">
                    BKS
                  </th>
                  <th rowSpan={2} className="px-3 py-2 bg-amber-300/80 border-r border-slate-300 text-center">
                    Tên lái xe
                  </th>
                  <th rowSpan={2} className="px-3 py-2 bg-amber-300/80 border-r border-slate-300 text-center">
                    MCX
                  </th>
                  <th rowSpan={2} className="px-3 py-2 bg-amber-300/80 border-r border-slate-300 text-center">
                    LỘ TRÌNH GIẤY
                  </th>
                  <th rowSpan={2} className="px-3 py-2 bg-amber-300/80 border-r border-slate-300 text-center">
                    BC sử dụng
                  </th>
                  <th rowSpan={2} className="px-3 py-2 bg-blue-300/80 border-r border-slate-300 text-center">
                    MKH
                  </th>

                  <th colSpan={3} className="px-2 py-1.5 bg-yellow-200 border-r border-slate-300 text-center">
                    Kinh doanh
                  </th>
                  <th colSpan={3} className="px-2 py-1.5 bg-emerald-200 border-r border-slate-300 text-center">
                    Kết nối
                  </th>
                  <th colSpan={3} className="px-2 py-1.5 bg-sky-200 border-r border-slate-300 text-center">
                    PVĐC
                  </th>
                  <th colSpan={3} className="px-2 py-1.5 bg-rose-200 border-r border-slate-300 text-center">
                    BDSC
                  </th>
                  <th colSpan={3} className="px-2 py-1.5 bg-slate-200 border-r border-slate-300 text-center">
                    Tổng
                  </th>
                  <th colSpan={3} className="px-2 py-1.5 bg-sky-100 border-r border-slate-300 text-center">
                    Giờ lạnh
                  </th>

                  <th rowSpan={2} className="px-3 py-2 bg-slate-100 border-r border-slate-300 text-center">
                    Sheet
                  </th>
                  <th rowSpan={2} className="px-3 py-2 bg-slate-100 text-center">
                    Thao tác
                  </th>
                </tr>

                {/* Row 2: Sub-headers */}
                <tr className="text-[11px] font-semibold text-slate-700 border-b border-slate-300 bg-slate-50">
                  {/* Kinh doanh */}
                  <th className="px-2 py-1.5 border-r border-slate-200 text-right bg-yellow-100/70">đầu</th>
                  <th className="px-2 py-1.5 border-r border-slate-200 text-right bg-yellow-100/70">cuối</th>
                  <th className="px-2 py-1.5 border-r border-slate-300 text-right bg-yellow-100/70">km</th>
                  {/* Kết nối */}
                  <th className="px-2 py-1.5 border-r border-slate-200 text-right bg-emerald-100/70">đầu</th>
                  <th className="px-2 py-1.5 border-r border-slate-200 text-right bg-emerald-100/70">cuối</th>
                  <th className="px-2 py-1.5 border-r border-slate-300 text-right bg-emerald-100/70">km</th>
                  {/* PVĐC */}
                  <th className="px-2 py-1.5 border-r border-slate-200 text-right bg-sky-100/70">đầu</th>
                  <th className="px-2 py-1.5 border-r border-slate-200 text-right bg-sky-100/70">cuối</th>
                  <th className="px-2 py-1.5 border-r border-slate-300 text-right bg-sky-100/70">km</th>
                  {/* BDSC */}
                  <th className="px-2 py-1.5 border-r border-slate-200 text-right bg-rose-100/70">đầu</th>
                  <th className="px-2 py-1.5 border-r border-slate-200 text-right bg-rose-100/70">cuối</th>
                  <th className="px-2 py-1.5 border-r border-slate-300 text-right bg-rose-100/70">km</th>
                  {/* Tổng */}
                  <th className="px-2 py-1.5 border-r border-slate-200 text-right bg-slate-100">km đầu</th>
                  <th className="px-2 py-1.5 border-r border-slate-200 text-right bg-slate-100">km cuối</th>
                  <th className="px-2 py-1.5 border-r border-slate-300 text-right bg-slate-100">số km</th>
                  {/* Giờ lạnh */}
                  <th className="px-2 py-1.5 border-r border-slate-200 text-center bg-sky-50">bắt đầu</th>
                  <th className="px-2 py-1.5 border-r border-slate-200 text-center bg-sky-50">kết thúc</th>
                  <th className="px-2 py-1.5 border-r border-slate-300 text-center bg-sky-50">tổng</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredTrips.map((trip) => {
                  const driverText = trip.driver2
                    ? `${trip.driver1} / ${trip.driver2}`
                    : trip.driver1;
                  return (
                    <tr key={trip.id} className="hover:bg-slate-50/90 transition-colors">
                      <td className="px-3 py-2 border-r border-slate-200 font-mono text-slate-600 tabular-nums">
                        {trip.startDate === trip.endDate
                          ? trip.startDate
                          : `${trip.startDate} → ${trip.endDate}`}
                      </td>
                      <td className="px-3 py-2 border-r border-slate-200 font-mono font-semibold text-slate-900 bg-white sticky left-0">
                        {trip.bks}
                      </td>
                      <td className="px-3 py-2 border-r border-slate-200 text-slate-900 font-medium">
                        {driverText}
                      </td>
                      <td className="px-3 py-2 border-r border-slate-200 font-mono text-slate-800">
                        {trip.mcx}
                      </td>
                      <td className="px-3 py-2 border-r border-slate-200 text-slate-800 max-w-[220px] truncate" title={formatRouteLabel(trip.origin, trip.destination)}>
                        {formatRouteLabel(trip.origin, trip.destination)}
                      </td>
                      <td className="px-3 py-2 border-r border-slate-200 font-mono text-slate-800 text-center">
                        {trip.servicePostOffice || ''}
                      </td>
                      <td className="px-3 py-2 border-r border-slate-300 bg-blue-50/40 text-slate-900 max-w-[200px] truncate" title={trip.customerName}>
                        {trip.customerName}
                      </td>

                      {renderGroupCells(trip, 'kinh_doanh')}
                      {renderGroupCells(trip, 'ket_noi')}
                      {renderGroupCells(trip, 'pvdc')}
                      {renderGroupCells(trip, 'bdsc')}

                      <td className="px-2 py-2 border-r border-slate-200 text-right font-mono text-slate-800 tabular-nums">
                        {formatKm(trip.kmStart)}
                      </td>
                      <td className="px-2 py-2 border-r border-slate-200 text-right font-mono text-slate-800 tabular-nums">
                        {formatKm(trip.kmEnd)}
                      </td>
                      <td className="px-2 py-2 border-r border-slate-300 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {formatKm(trip.kmTotal)}
                      </td>

                      <td className="px-2 py-2 border-r border-slate-200 text-center font-mono text-sky-900 tabular-nums">
                        {trip.coldStart || ''}
                      </td>
                      <td className="px-2 py-2 border-r border-slate-200 text-center font-mono text-sky-900 tabular-nums">
                        {trip.coldEnd || ''}
                      </td>
                      <td className="px-2 py-2 border-r border-slate-300 text-center font-mono font-semibold text-sky-800 tabular-nums">
                        {trip.tripType === 'kinh_doanh' && (trip.coldStart || trip.coldEnd)
                          ? formatMinutesToDuration(trip.coldDurationMinutes)
                          : ''}
                      </td>

                      <td className="px-3 py-2 border-r border-slate-200">
                        {trip.sheetSyncStatus === 'synced' ? (
                          <span className="text-emerald-700 font-medium">Đã gửi</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSingleSync(trip.id)}
                            disabled={syncingId === trip.id}
                            title={trip.sheetSyncError || 'Bấm để đồng bộ lên Google Sheet'}
                            className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-900 font-medium underline underline-offset-2 cursor-pointer"
                          >
                            <RefreshCw className={`w-3 h-3 ${syncingId === trip.id ? 'animate-spin' : ''}`} />
                            <span>{trip.sheetSyncStatus === 'error' ? 'Lỗi — Thử lại' : 'Gửi Sheet'}</span>
                          </button>
                        )}
                      </td>

                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingTrip(trip)}
                            aria-label={`Sửa chuyến ${trip.mcx || trip.bks}`}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-sky-700 hover:bg-sky-50 cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteTrip(trip)}
                            aria-label={`Xóa chuyến ${trip.mcx || trip.bks}`}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <EditTripModal
        trip={editingTrip}
        vehicles={vehicles}
        onClose={() => setEditingTrip(null)}
        onSave={onUpdateTrip}
      />

      {/* Delete Confirmation Dialog */}
      {confirmDeleteTrip && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-xl">
            <h3 className="font-display text-lg font-bold text-slate-900">
              Xác nhận xóa chuyến xe?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Bạn chắc chắn muốn xóa chuyến{' '}
              <span className="font-mono font-semibold">
                {confirmDeleteTrip.mcx ||
                  (confirmDeleteTrip.servicePostOffice
                    ? `PVĐC (${confirmDeleteTrip.servicePostOffice})`
                    : 'PVĐC')}
              </span>{' '}
              của xe{' '}
              <span className="font-mono font-semibold">{confirmDeleteTrip.bks}</span>? Hành động này không thể hoàn tác.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteTrip(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = confirmDeleteTrip;
                  setConfirmDeleteTrip(null);
                  await onDeleteTrip(target.id);
                }}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold cursor-pointer"
              >
                Xóa chuyến xe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
