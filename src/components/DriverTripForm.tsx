import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Plus,
  RotateCcw,
  Save,
  Snowflake,
  Trash2,
  Truck,
} from 'lucide-react';
import {
  formatKm,
  formatMinutesToDuration,
  getTodayIsoDate,
  isDiemCuoiCustomer,
  normalizeBks,
  normalizeColdHourInput,
  parseColdHoursToMinutes,
  TripRecord,
  TripType,
  TRIP_TYPE_LABELS,
  TRIP_TYPE_OPTIONS,
} from '../types/fleet';
import { DEFAULT_PUBLIC_VEHICLES, PublicVehicleOption } from '../catalog/defaultVehicles';
import { fetchPublicVehicles, submitPublicTrip } from '../utils/backendClient';
import { BksInput } from './BksInput';
import { PostOfficeInput } from './PostOfficeInput';

type PublicVehicle = PublicVehicleOption;

interface FormState {
  startDate: string;
  endDate: string;
  bks: string;
  tripType: TripType;
  driver1: string;
  driver2: string;
  mcx: string;
  customerName: string;
  servicePostOffice: string;
  origin: string;
  destination: string;
  kmStart: string;
  kmEnd: string;
  coldStart: string;
  coldEnd: string;
}

function createInitialForm(defaultBks = ''): FormState {
  const today = getTodayIsoDate();
  return {
    startDate: today,
    endDate: today,
    bks: defaultBks,
    tripType: 'ket_noi',
    driver1: '',
    driver2: '',
    mcx: '',
    customerName: '',
    servicePostOffice: '',
    origin: '',
    destination: '',
    kmStart: '',
    kmEnd: '',
    coldStart: '',
    coldEnd: '',
  };
}

export function DriverTripForm() {
  const [vehicles, setVehicles] = useState<PublicVehicle[]>(DEFAULT_PUBLIC_VEHICLES);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [form, setForm] = useState<FormState>(() => createInitialForm());
  const [bksTouched, setBksTouched] = useState(false);
  const [hasSecondDriver, setHasSecondDriver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedTrip, setSavedTrip] = useState<TripRecord | null>(null);

  useEffect(() => {
    let active = true;
    fetchPublicVehicles()
      .then((list) => {
        if (!active) return;
        if (Array.isArray(list) && list.length > 0) {
          setVehicles(list);
        }
      })
      .catch(() => {
        // Fallback fleet list remains available
      })
      .finally(() => {
        if (active) setLoadingVehicles(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const vehicleMap = useMemo(() => {
    const map = new Map<string, PublicVehicle>();
    vehicles.forEach((v) => map.set(normalizeBks(v.bks), v));
    return map;
  }, [vehicles]);

  const normalizedBks = normalizeBks(form.bks);
  const matchedVehicle = normalizedBks ? vehicleMap.get(normalizedBks) : undefined;
  const bksUnknown =
    !loadingVehicles &&
    vehicles.length > 0 &&
    normalizedBks.length > 0 &&
    !matchedVehicle &&
    (bksTouched || normalizedBks.length >= 7);

  const showPostOffice = form.tripType === 'pvdc' || isDiemCuoiCustomer(form.customerName);

  const kmCalculation = useMemo(() => {
    const start = Number(form.kmStart);
    const end = Number(form.kmEnd);
    if (form.kmStart.trim() === '' || form.kmEnd.trim() === '') {
      return { valid: false, total: null as number | null, error: null as string | null };
    }
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < 0) {
      return { valid: false, total: null, error: 'Chỉ số Km không hợp lệ' };
    }
    if (end < start) {
      return { valid: false, total: null, error: 'Km cuối phải ≥ Km đầu' };
    }
    return {
      valid: true,
      total: Math.round((end - start) * 1000) / 1000,
      error: null,
    };
  }, [form.kmStart, form.kmEnd]);

  const coldCalculation = useMemo(() => {
    if (form.coldStart.trim() === '' || form.coldEnd.trim() === '') {
      return { valid: false, minutes: null as number | null, error: null as string | null };
    }
    const startM = parseColdHoursToMinutes(form.coldStart);
    const endM = parseColdHoursToMinutes(form.coldEnd);
    if (startM === null || endM === null) {
      return { valid: false, minutes: null, error: 'Định dạng đúng là giờ:phút (vd 4123:12)' };
    }
    if (endM < startM) {
      return { valid: false, minutes: null, error: 'Giờ lạnh kết thúc phải ≥ bắt đầu' };
    }
    return {
      valid: true,
      minutes: endM - startM,
      error: null,
    };
  }, [form.coldStart, form.coldEnd]);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errorMessage) setErrorMessage(null);
  };

  const handleToggleSecondDriver = () => {
    if (hasSecondDriver) {
      setHasSecondDriver(false);
      updateField('driver2', '');
    } else {
      setHasSecondDriver(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!normalizedBks) {
      setBksTouched(true);
      setErrorMessage('Vui lòng nhập Biển kiểm soát (BKS).');
      return;
    }
    if (!loadingVehicles && vehicles.length > 0 && !matchedVehicle) {
      setBksTouched(true);
      setErrorMessage(
        `Biển kiểm soát "${normalizedBks}" không có trong danh sách đội xe. Vui lòng kiểm tra lại BKS.`
      );
      return;
    }
    if (!form.startDate || !form.endDate || form.endDate < form.startDate) {
      setErrorMessage('Vui lòng kiểm tra Ngày bắt đầu và Ngày kết thúc.');
      return;
    }
    if (!form.driver1.trim()) {
      setErrorMessage('Vui lòng nhập Tên lái xe.');
      return;
    }
    if (form.tripType !== 'pvdc' && !form.mcx.trim()) {
      setErrorMessage('Vui lòng nhập Mã chuyến xe trên VTMan.');
      return;
    }
    if (form.tripType !== 'pvdc' && !form.customerName.trim()) {
      setErrorMessage('Vui lòng nhập Tên khách hàng.');
      return;
    }
    if (showPostOffice && !form.servicePostOffice.trim()) {
      setErrorMessage(
        form.tripType === 'pvdc'
          ? 'Loại chuyến PVĐC yêu cầu nhập Bưu cục phục vụ.'
          : 'Khách hàng là Điểm cuối, vui lòng nhập Bưu cục phục vụ.'
      );
      return;
    }
    if (!form.origin.trim() || !form.destination.trim()) {
      setErrorMessage('Vui lòng nhập đầy đủ Điểm đi và Điểm đến.');
      return;
    }
    if (!kmCalculation.valid) {
      setErrorMessage(kmCalculation.error || 'Vui lòng nhập Km đầu và Km cuối hợp lệ.');
      return;
    }
    if (form.tripType === 'kinh_doanh' && !coldCalculation.valid) {
      setErrorMessage(
        coldCalculation.error || 'Vui lòng nhập Giờ lạnh bắt đầu và kết thúc (định dạng giờ:phút).'
      );
      return;
    }

    setSubmitting(true);
    try {
      const trip = await submitPublicTrip({
        startDate: form.startDate,
        endDate: form.endDate,
        bks: normalizedBks,
        tripType: form.tripType,
        driver1: form.driver1.trim(),
        driver2: hasSecondDriver ? form.driver2.trim() : '',
        mcx: form.tripType === 'pvdc' ? '' : form.mcx.trim(),
        customerName: form.tripType === 'pvdc' ? '' : form.customerName.trim(),
        servicePostOffice: showPostOffice ? form.servicePostOffice.trim() : '',
        origin: form.origin.trim(),
        destination: form.destination.trim(),
        kmStart: Number(form.kmStart),
        kmEnd: Number(form.kmEnd),
        coldStart: form.tripType === 'kinh_doanh' ? form.coldStart.trim() : '',
        coldEnd: form.tripType === 'kinh_doanh' ? form.coldEnd.trim() : '',
      });

      setSavedTrip(trip);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Lỗi kết nối máy chủ. Vui lòng kiểm tra mạng hoặc thử lại.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartNewTrip = () => {
    setSavedTrip(null);
    setHasSecondDriver(false);
    setBksTouched(false);
    setErrorMessage(null);
    setForm(createInitialForm(''));
  };

  if (savedTrip) {
    const isSynced = savedTrip.sheetSyncStatus === 'synced';
    const isError = savedTrip.sheetSyncStatus === 'error';

    return (
      <section className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                isSynced
                  ? 'bg-emerald-50 text-emerald-700'
                  : isError
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-sky-50 text-sky-700'
              }`}
            >
              <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
                Đã lưu thông tin chuyến xe
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                {isSynced
                  ? 'Dữ liệu đã được ghi nhận tức thời vào Google Sheet.'
                  : isError
                  ? `Dữ liệu đã lưu trên hệ thống nhưng chưa đẩy sang Google Sheet: ${savedTrip.sheetSyncError}`
                  : 'Dữ liệu đã lưu trên hệ thống (Google Sheet đang chờ quản lý cấu hình Webhook).'}
              </p>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-6 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-xs text-slate-500">Biển kiểm soát</div>
              <div className="mt-0.5 font-mono font-semibold text-slate-900">{savedTrip.bks}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Loại chuyến</div>
              <div className="mt-0.5 font-medium text-slate-900">
                {TRIP_TYPE_LABELS[savedTrip.tripType]}
              </div>
            </div>
            {savedTrip.mcx && (
              <div>
                <div className="text-xs text-slate-500">Mã chuyến xe</div>
                <div className="mt-0.5 font-mono font-medium text-slate-900">{savedTrip.mcx}</div>
              </div>
            )}
            <div>
              <div className="text-xs text-slate-500">Lái xe</div>
              <div className="mt-0.5 font-medium text-slate-900">
                {savedTrip.driver2 ? `${savedTrip.driver1} / ${savedTrip.driver2}` : savedTrip.driver1}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Lộ trình</div>
              <div className="mt-0.5 font-medium text-slate-900">
                {savedTrip.origin} - {savedTrip.destination}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">
                {savedTrip.tripType === 'pvdc' && !savedTrip.customerName ? 'Bưu cục phục vụ' : 'Khách hàng'}
              </div>
              <div className="mt-0.5 font-medium text-slate-900">
                {savedTrip.tripType === 'pvdc' && !savedTrip.customerName
                  ? savedTrip.servicePostOffice || '—'
                  : `${savedTrip.customerName}${savedTrip.servicePostOffice ? ` (${savedTrip.servicePostOffice})` : ''}`}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Số Km</div>
              <div className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums">
                {formatKm(savedTrip.kmStart)} → {formatKm(savedTrip.kmEnd)} ({formatKm(savedTrip.kmTotal)} km)
              </div>
            </div>
            {savedTrip.tripType === 'kinh_doanh' && (savedTrip.coldStart || savedTrip.coldEnd) && (
              <div>
                <div className="text-xs text-slate-500">Giờ lạnh</div>
                <div className="mt-0.5 font-mono font-semibold text-sky-800 tabular-nums">
                  {savedTrip.coldStart} → {savedTrip.coldEnd} ({formatMinutesToDuration(savedTrip.coldDurationMinutes)})
                </div>
              </div>
            )}
            <div>
              <div className="text-xs text-slate-500">Trạng thái Google Sheet</div>
              <div
                className={`mt-0.5 font-medium ${
                  isSynced ? 'text-emerald-700' : isError ? 'text-amber-700' : 'text-slate-700'
                }`}
              >
                {isSynced ? 'Đã đồng bộ' : isError ? 'Lỗi gửi Sheet' : 'Chờ đồng bộ'}
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleStartNewTrip}
              className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-semibold text-sm transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span>Nhập chuyến xe tiếp theo</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-28 md:pb-12">
      <div className="mb-6">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Khai báo lộ trình &amp; chỉ số xe
        </h1>
        <p className="mt-1.5 text-sm sm:text-base text-slate-600 max-w-2xl">
          Lái xe nhập đầy đủ thông tin chuyến đi, chỉ số Km đầu/cuối và đồng hồ giờ lạnh lũy kế để cập nhật trực tiếp về bảng điều hành.
        </p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-sm"
        >
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} autoComplete="off" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left column: Vehicle, Dates, Drivers, Route */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-6">
          {/* Vehicle & Trip Type */}
          <div className="space-y-4">
            <h2 className="font-display text-base font-semibold text-slate-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-sky-700" aria-hidden="true" />
              <span>Xe &amp; Phân loại chuyến</span>
            </h2>

            <div>
              <label htmlFor="bks-input" className="block text-sm font-medium text-slate-700 mb-1.5">
                Biển kiểm soát (BKS) <span className="text-red-600">*</span>
              </label>
              <BksInput
                id="bks-input"
                value={form.bks}
                vehicles={vehicles}
                onChange={(val) => updateField('bks', val)}
                onBlur={() => setBksTouched(true)}
                invalid={bksUnknown}
                valid={Boolean(matchedVehicle)}
                required
              />
              {bksUnknown && (
                <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">
                  Xe biển số <span className="font-mono font-bold">{normalizedBks}</span> không có trong danh sách đội xe. Vui lòng kiểm tra lại BKS.
                </p>
              )}
              {matchedVehicle && (
                <p className="mt-1.5 text-xs font-medium text-emerald-700">
                  Biển số hợp lệ ({matchedVehicle.label || 'Xe trong đội xe'})
                </p>
              )}
            </div>

            <div>
              <span className="block text-sm font-medium text-slate-700 mb-1.5">
                Loại chuyến <span className="text-red-600">*</span>
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1 bg-slate-100 rounded-xl">
                {TRIP_TYPE_OPTIONS.map((opt) => {
                  const active = form.tripType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateField('tripType', opt.value)}
                      className={`min-h-[44px] px-2.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                        active
                          ? 'bg-white text-sky-800 font-semibold shadow-sm border border-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-slate-700 mb-1.5">
                Ngày bắt đầu <span className="text-red-600">*</span>
              </label>
              <input
                id="startDate"
                type="date"
                value={form.startDate}
                onChange={(e) => updateField('startDate', e.target.value)}
                required
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-sky-600"
              />
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-slate-700 mb-1.5">
                Ngày kết thúc <span className="text-red-600">*</span>
              </label>
              <input
                id="endDate"
                type="date"
                value={form.endDate}
                min={form.startDate}
                onChange={(e) => updateField('endDate', e.target.value)}
                required
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-sky-600"
              />
            </div>
          </div>

          {/* Drivers (No autofill / no suggestions) */}
          <div className="border-t border-slate-200 pt-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="driver-entry-1" className="block text-sm font-medium text-slate-700">
                Tên lái xe <span className="text-red-600">*</span>
              </label>
              <button
                type="button"
                onClick={handleToggleSecondDriver}
                className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                {hasSecondDriver ? (
                  <>
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Bỏ lái xe thứ 2</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Thêm lái xe (xe đi 2 lái)</span>
                  </>
                )}
              </button>
            </div>

            <input
              id="driver-entry-1"
              name="manual_driver_primary"
              type="text"
              value={form.driver1}
              onChange={(e) => updateField('driver1', e.target.value)}
              placeholder="Tự nhập họ tên lái xe (không gợi ý)"
              autoComplete="new-password"
              spellCheck={false}
              required
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-sky-600"
            />

            {hasSecondDriver && (
              <div>
                <label htmlFor="driver-entry-2" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Tên lái xe thứ 2
                </label>
                <input
                  id="driver-entry-2"
                  name="manual_driver_secondary"
                  type="text"
                  value={form.driver2}
                  onChange={(e) => updateField('driver2', e.target.value)}
                  placeholder="Nhập họ tên lái xe thứ 2"
                  autoComplete="new-password"
                  spellCheck={false}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-sky-600"
                />
              </div>
            )}
          </div>

          {/* VTMan Trip ID, Customer, Post Office, Origin & Destination */}
          <div className="border-t border-slate-200 pt-5 space-y-4">
            {form.tripType !== 'pvdc' && (
              <div>
                <label htmlFor="mcx-input" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Mã chuyến xe <span className="text-red-600">*</span>
                </label>
                <input
                  id="mcx-input"
                  type="text"
                  value={form.mcx}
                  onChange={(e) => updateField('mcx', e.target.value)}
                  placeholder="Nhập mã chuyến xe trên VTMan"
                  autoComplete="off"
                  required
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-mono text-sm text-slate-900 placeholder:text-slate-400 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-sky-600"
                />
              </div>
            )}

            {form.tripType !== 'pvdc' && (
              <div>
                <label htmlFor="customer-input" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Tên khách hàng <span className="text-red-600">*</span>
                </label>
                <input
                  id="customer-input"
                  type="text"
                  value={form.customerName}
                  onChange={(e) => updateField('customerName', e.target.value)}
                  placeholder="Nhập tên khách hàng"
                  autoComplete="off"
                  required
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-sky-600"
                />
              </div>
            )}

            {showPostOffice && (
              <div className="p-4 rounded-xl bg-sky-50 border border-sky-200">
                <label htmlFor="post-office-input" className="block text-sm font-semibold text-sky-950 mb-1.5">
                  Bưu cục phục vụ <span className="text-red-600">*</span>
                </label>
                <PostOfficeInput
                  id="post-office-input"
                  value={form.servicePostOffice}
                  onChange={(val) => updateField('servicePostOffice', val)}
                  required
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="origin-input" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Điểm đi <span className="text-red-600">*</span>
                </label>
                <input
                  id="origin-input"
                  type="text"
                  value={form.origin}
                  onChange={(e) => updateField('origin', e.target.value)}
                  placeholder="Ví dụ: KV3, Kho Acecook"
                  autoComplete="off"
                  required
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-sky-600"
                />
              </div>
              <div>
                <label htmlFor="destination-input" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Điểm đến <span className="text-red-600">*</span>
                </label>
                <input
                  id="destination-input"
                  type="text"
                  value={form.destination}
                  onChange={(e) => updateField('destination', e.target.value)}
                  placeholder="Ví dụ: APD, XTT32, Gò Vấp"
                  autoComplete="off"
                  required
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-sky-600"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Odometer Km & Cumulative Cold Hours */}
        <div className="lg:col-span-5 space-y-6">
          {/* Km Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Chỉ số Odo Km
              </h2>
              <span className="text-xs font-medium text-slate-500">
                Ghi vào cột: <strong className="text-slate-800">{TRIP_TYPE_LABELS[form.tripType]}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label htmlFor="km-start" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Km đầu <span className="text-red-600">*</span>
                </label>
                <input
                  id="km-start"
                  type="number"
                  step="any"
                  min="0"
                  inputMode="decimal"
                  value={form.kmStart}
                  onChange={(e) => updateField('kmStart', e.target.value)}
                  placeholder="73866"
                  required
                  className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-mono text-base font-semibold text-slate-900 tabular-nums placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-sky-600"
                />
              </div>
              <div>
                <label htmlFor="km-end" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Km cuối <span className="text-red-600">*</span>
                </label>
                <input
                  id="km-end"
                  type="number"
                  step="any"
                  min="0"
                  inputMode="decimal"
                  value={form.kmEnd}
                  onChange={(e) => updateField('kmEnd', e.target.value)}
                  placeholder="73950"
                  required
                  className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-mono text-base font-semibold text-slate-900 tabular-nums placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-sky-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-sm">
              <span className="text-slate-600">Tổng quãng đường chuyến</span>
              {kmCalculation.error ? (
                <span className="font-medium text-red-600">{kmCalculation.error}</span>
              ) : (
                <span className="font-mono font-bold text-slate-900 tabular-nums text-base">
                  {kmCalculation.total !== null ? `${formatKm(kmCalculation.total)} km` : '—'}
                </span>
              )}
            </div>
          </div>

          {/* Cold Hours Card - Kinh doanh only */}
          {form.tripType === 'kinh_doanh' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Snowflake className="w-4 h-4 text-sky-700" aria-hidden="true" />
                  <span>Đồng hồ giờ lạnh (giờ:phút)</span>
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Nhập thủ công theo đồng hồ lũy kế trên xe. Ví dụ: <span className="font-mono text-slate-700">4123:12</span> và <span className="font-mono text-slate-700">4124:00</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="cold-start" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Giờ lạnh bắt đầu <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="cold-start"
                      type="text"
                      inputMode="text"
                      value={form.coldStart}
                      onChange={(e) => updateField('coldStart', normalizeColdHourInput(e.target.value))}
                      placeholder="4123:12"
                      autoComplete="off"
                      required
                      className="w-full min-h-[46px] pl-3.5 pr-9 py-2.5 rounded-xl border border-slate-300 bg-white font-mono text-base font-semibold text-sky-900 tabular-nums placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-sky-600"
                    />
                    <Clock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                  </div>
                </div>

                <div>
                  <label htmlFor="cold-end" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Giờ lạnh kết thúc <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="cold-end"
                      type="text"
                      inputMode="text"
                      value={form.coldEnd}
                      onChange={(e) => updateField('coldEnd', normalizeColdHourInput(e.target.value))}
                      placeholder="4124:00"
                      autoComplete="off"
                      required
                      className="w-full min-h-[46px] pl-3.5 pr-9 py-2.5 rounded-xl border border-slate-300 bg-white font-mono text-base font-semibold text-sky-900 tabular-nums placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-sky-600"
                    />
                    <Clock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-sm">
                <span className="text-slate-600">Thời gian chạy lạnh</span>
                {coldCalculation.error ? (
                  <span className="font-medium text-red-600 text-right">{coldCalculation.error}</span>
                ) : (
                  <span className="font-mono font-bold text-sky-800 tabular-nums text-base">
                    {coldCalculation.minutes !== null
                      ? `${formatMinutesToDuration(coldCalculation.minutes)} (${coldCalculation.minutes} phút)`
                      : '—'}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Desktop Submit Card */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[48px] inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-sky-700 hover:bg-sky-800 disabled:bg-slate-300 text-white font-semibold text-sm transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" aria-hidden="true" />
              <span>{submitting ? 'Đang lưu & gửi Google Sheet...' : 'Lưu thông tin chuyến xe'}</span>
            </button>
            <p className="mt-2.5 text-xs text-slate-500 text-center">
              Dữ liệu sẽ được đẩy tức thời lên Google Sheet ngay khi bấm lưu.
            </p>
          </div>
        </div>

        {/* Mobile Sticky Submit Bar (< 15% viewport height) */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-20 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200">
          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-sky-700 active:scale-[0.99] hover:bg-sky-800 disabled:bg-slate-300 text-white font-semibold text-sm transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" aria-hidden="true" />
            <span>{submitting ? 'Đang gửi Google Sheet...' : 'Lưu thông tin chuyến xe'}</span>
          </button>
        </div>
      </form>
    </section>
  );
}
