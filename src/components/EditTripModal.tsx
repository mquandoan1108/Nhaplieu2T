import React, { useEffect, useState } from 'react';
import { AlertCircle, Save, X } from 'lucide-react';
import {
  isDiemCuoiCustomer,
  normalizeColdHourInput,
  parseColdHoursToMinutes,
  TripRecord,
  TripType,
  TRIP_TYPE_OPTIONS,
  Vehicle,
} from '../types/fleet';
import { PostOfficeInput } from './PostOfficeInput';

interface EditTripModalProps {
  trip: TripRecord | null;
  vehicles: Vehicle[];
  onClose: () => void;
  onSave: (tripId: string, payload: Record<string, unknown>) => Promise<void>;
}

export function EditTripModal({ trip, vehicles, onClose, onSave }: EditTripModalProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [bks, setBks] = useState('');
  const [tripType, setTripType] = useState<TripType>('ket_noi');
  const [driver1, setDriver1] = useState('');
  const [driver2, setDriver2] = useState('');
  const [mcx, setMcx] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [servicePostOffice, setServicePostOffice] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [kmStart, setKmStart] = useState('');
  const [kmEnd, setKmEnd] = useState('');
  const [coldStart, setColdStart] = useState('');
  const [coldEnd, setColdEnd] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!trip) return;
    setStartDate(trip.startDate);
    setEndDate(trip.endDate);
    setBks(trip.bks);
    setTripType(trip.tripType);
    setDriver1(trip.driver1);
    setDriver2(trip.driver2);
    setMcx(trip.mcx);
    setCustomerName(trip.customerName);
    setServicePostOffice(trip.servicePostOffice);
    setOrigin(trip.origin);
    setDestination(trip.destination);
    setKmStart(String(trip.kmStart));
    setKmEnd(String(trip.kmEnd));
    setColdStart(trip.coldStart);
    setColdEnd(trip.coldEnd);
    setError(null);
  }, [trip]);

  if (!trip) return null;

  const showPostOffice = tripType === 'pvdc' || isDiemCuoiCustomer(customerName);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const kStart = Number(kmStart);
    const kEnd = Number(kmEnd);
    if (!Number.isFinite(kStart) || !Number.isFinite(kEnd) || kEnd < kStart) {
      setError('Km cuối phải lớn hơn hoặc bằng Km đầu.');
      return;
    }
    if (tripType === 'kinh_doanh') {
      const cStart = parseColdHoursToMinutes(coldStart);
      const cEnd = parseColdHoursToMinutes(coldEnd);
      if (cStart === null || cEnd === null || cEnd < cStart) {
        setError('Giờ lạnh không hợp lệ (định dạng giờ:phút và kết thúc ≥ bắt đầu).');
        return;
      }
    }
    if (showPostOffice && !servicePostOffice.trim()) {
      setError('Vui lòng nhập Bưu cục phục vụ (bắt buộc với PVĐC hoặc Điểm cuối).');
      return;
    }

    setSaving(true);
    try {
      await onSave(trip.id, {
        startDate,
        endDate,
        bks: bks.trim().toUpperCase(),
        tripType,
        driver1: driver1.trim(),
        driver2: driver2.trim(),
        mcx: tripType === 'pvdc' ? '' : mcx.trim(),
        customerName: tripType === 'pvdc' ? '' : customerName.trim(),
        servicePostOffice: showPostOffice ? servicePostOffice.trim() : '',
        origin: origin.trim(),
        destination: destination.trim(),
        kmStart: kStart,
        kmEnd: kEnd,
        coldStart: tripType === 'kinh_doanh' ? coldStart.trim() : '',
        coldEnd: tripType === 'kinh_doanh' ? coldEnd.trim() : '',
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể cập nhật chuyến xe.');
    } finally {
      setSaving(false);
    }
  };

  const bksOptions = Array.from(new Set([bks, ...vehicles.map((v) => v.bks)].filter(Boolean)));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-trip-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto"
    >
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl p-6 shadow-xl my-8">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 id="edit-trip-title" className="font-display text-lg font-bold text-slate-900">
              Chỉnh sửa thông tin chuyến xe
            </h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5">{trip.mcx || trip.bks}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-sm">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className={`grid grid-cols-1 ${tripType === 'pvdc' ? 'sm:grid-cols-2' : 'sm:grid-cols-3'} gap-3.5`}>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Biển kiểm soát</label>
              <select
                value={bks}
                onChange={(e) => setBks(e.target.value)}
                className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm"
              >
                {bksOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Loại chuyến</label>
              <select
                value={tripType}
                onChange={(e) => setTripType(e.target.value as TripType)}
                className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 text-sm"
              >
                {TRIP_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {tripType !== 'pvdc' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Mã chuyến xe (MCX)</label>
                <input
                  type="text"
                  value={mcx}
                  onChange={(e) => setMcx(e.target.value)}
                  required
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Ngày bắt đầu</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Ngày kết thúc</label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tên lái xe 1</label>
              <input
                type="text"
                value={driver1}
                onChange={(e) => setDriver1(e.target.value)}
                required
                className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tên lái xe 2 (nếu có)</label>
              <input
                type="text"
                value={driver2}
                onChange={(e) => setDriver2(e.target.value)}
                className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {tripType !== 'pvdc' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Tên khách hàng (MKH)</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
            )}
            {showPostOffice && (
              <div className={tripType === 'pvdc' ? 'sm:col-span-2' : ''}>
                <label htmlFor="edit-post-office-input" className="block text-xs font-medium text-slate-700 mb-1">
                  Bưu cục phục vụ
                </label>
                <PostOfficeInput
                  id="edit-post-office-input"
                  value={servicePostOffice}
                  onChange={setServicePostOffice}
                  required
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Điểm đi</label>
              <input
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                required
                className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Điểm đến</label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                required
                className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
          </div>

          <div className={`grid grid-cols-2 ${tripType === 'kinh_doanh' ? 'sm:grid-cols-4' : 'sm:grid-cols-2'} gap-3.5`}>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Km đầu</label>
              <input
                type="number"
                step="any"
                value={kmStart}
                onChange={(e) => setKmStart(e.target.value)}
                required
                className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Km cuối</label>
              <input
                type="number"
                step="any"
                value={kmEnd}
                onChange={(e) => setKmEnd(e.target.value)}
                required
                className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm tabular-nums"
              />
            </div>
            {tripType === 'kinh_doanh' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Giờ lạnh đầu</label>
                  <input
                    type="text"
                    value={coldStart}
                    onChange={(e) => setColdStart(normalizeColdHourInput(e.target.value))}
                    required
                    className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Giờ lạnh cuối</label>
                  <input
                    type="text"
                    value={coldEnd}
                    onChange={(e) => setColdEnd(normalizeColdHourInput(e.target.value))}
                    required
                    className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm tabular-nums"
                  />
                </div>
              </>
            )}
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[42px] inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 disabled:bg-slate-400 text-white text-sm font-semibold cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
