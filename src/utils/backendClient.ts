import {
  createDefaultVehicles,
  PublicVehicleOption,
} from '../catalog/defaultVehicles';
import {
  formatMinutesToDuration,
  isDiemCuoiCustomer,
  normalizeBks,
  parseColdHoursToMinutes,
  SheetSyncStatus,
  TripRecord,
  TripType,
  Vehicle,
} from '../types/fleet';
import { getApiFailureMessage, safeParseJson } from './safeFetchJson';

const STATIC_DB_KEY = 'nhaplieu2t_static_db_v1';
const STATIC_ADMIN_HASH = '8e0e3f287e07876e49160b01cb5ba0fa3a7c1cd6115e7f17ca35c7c804c3f6c8';
const STATIC_ADMIN_USER = 'pvhkd';
const STATIC_TOKEN_PREFIX = 'static-mem-';

interface StaticDatabase {
  vehicles: Vehicle[];
  trips: TripRecord[];
  appsScriptUrl: string;
  lastTestedAt: string;
}

let isStaticHostMode = false;

export function getIsStaticHostMode(): boolean {
  return isStaticHostMode;
}

function validateAppsScriptUrl(rawUrl: string): { valid: boolean; normalized: string; error?: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: true, normalized: '' };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') {
      return { valid: false, normalized: '', error: 'URL Google Apps Script phải sử dụng HTTPS.' };
    }
    const allowedHosts = new Set(['script.google.com', 'script.googleusercontent.com']);
    if (!allowedHosts.has(parsed.hostname.toLowerCase())) {
      return {
        valid: false,
        normalized: '',
        error: 'Chỉ chấp nhận URL thuộc tên miền script.google.com.',
      };
    }
    return { valid: true, normalized: parsed.toString() };
  } catch {
    return { valid: false, normalized: '', error: 'Định dạng URL Google Apps Script không hợp lệ.' };
  }
}

function absorbSheetParamFromUrl(db: StaticDatabase): StaticDatabase {
  if (typeof window === 'undefined') return db;
  try {
    const params = new URLSearchParams(window.location.search);
    const sheetParam = params.get('sheet');
    if (sheetParam) {
      const check = validateAppsScriptUrl(sheetParam);
      if (check.valid && check.normalized) {
        db.appsScriptUrl = check.normalized;
        saveStaticDb(db);
      }
      params.delete('sheet');
      const cleanedSearch = params.toString();
      const nextUrl = `${window.location.pathname}${cleanedSearch ? `?${cleanedSearch}` : ''}${window.location.hash}`;
      window.history.replaceState({}, '', nextUrl);
    }
  } catch {
    // Ignore URL parsing issues
  }
  return db;
}

function readStaticDb(): StaticDatabase {
  const envSheetUrl =
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    typeof import.meta.env.VITE_APPS_SCRIPT_URL === 'string'
      ? import.meta.env.VITE_APPS_SCRIPT_URL
      : '';

  const fallback: StaticDatabase = {
    vehicles: createDefaultVehicles(),
    trips: [],
    appsScriptUrl: envSheetUrl || '',
    lastTestedAt: '',
  };

  if (typeof window === 'undefined' || !window.localStorage) {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(STATIC_DB_KEY);
    if (!raw) {
      window.localStorage.setItem(STATIC_DB_KEY, JSON.stringify(fallback));
      return absorbSheetParamFromUrl(fallback);
    }
    const parsed = JSON.parse(raw) as Partial<StaticDatabase>;
    const db: StaticDatabase = {
      vehicles:
        Array.isArray(parsed.vehicles) && parsed.vehicles.length > 0
          ? parsed.vehicles
          : fallback.vehicles,
      trips: Array.isArray(parsed.trips) ? parsed.trips : [],
      appsScriptUrl: typeof parsed.appsScriptUrl === 'string' ? parsed.appsScriptUrl : fallback.appsScriptUrl,
      lastTestedAt: typeof parsed.lastTestedAt === 'string' ? parsed.lastTestedAt : '',
    };
    return absorbSheetParamFromUrl(db);
  } catch {
    return fallback;
  }
}

function saveStaticDb(db: StaticDatabase): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STATIC_DB_KEY, JSON.stringify(db));
  } catch {
    // Ignore quota failures cleanly
  }
}

function isUnavailableServerResponse(res: Response): boolean {
  if (res.status === 404 || res.status === 405) return true;
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('text/html')) return true;
  return false;
}

async function computeSha256Hex(input: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const bytes = new TextEncoder().encode(input);
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return '';
}

async function pushToAppsScriptFromBrowser(
  appsScriptUrl: string,
  payload: Record<string, unknown>
): Promise<{ status: SheetSyncStatus; error: string }> {
  const check = validateAppsScriptUrl(appsScriptUrl);
  if (!check.valid || !check.normalized) {
    return {
      status: 'pending',
      error: check.normalized ? check.error || '' : 'Chưa cấu hình URL Google Apps Script.',
    };
  }

  const body = JSON.stringify(payload);
  try {
    // Use text/plain to avoid CORS preflight failures with Google Apps Script Web Apps
    const res = await fetch(check.normalized, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
      redirect: 'follow',
    });
    if (!res.ok) {
      return { status: 'error', error: `Apps Script trả về mã lỗi ${res.status}` };
    }
    const text = await res.text();
    try {
      const parsed = JSON.parse(text) as { ok?: boolean; error?: string };
      if (parsed.ok === false) {
        return { status: 'error', error: parsed.error || 'Apps Script báo lỗi.' };
      }
    } catch {
      if (text.includes('ServiceLogin') || text.includes('accounts.google.com')) {
        return {
          status: 'error',
          error: 'Apps Script yêu cầu đăng nhập. Hãy chọn "Who has access: Anyone" khi Deploy.',
        };
      }
    }
    return { status: 'synced', error: '' };
  } catch {
    // Google Apps Script often executes POST cleanly even when browser omits CORS read headers
    try {
      await fetch(check.normalized, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body,
      });
      return { status: 'synced', error: '' };
    } catch {
      return {
        status: 'error',
        error: 'Không thể gửi dữ liệu tới Google Apps Script từ trình duyệt.',
      };
    }
  }
}

function validateTripPayload(body: Record<string, unknown>): {
  error?: string;
  data?: Omit<TripRecord, 'id' | 'sheetSyncStatus' | 'sheetSyncError' | 'createdAt' | 'updatedAt'>;
} {
  const startDate = String(body.startDate || '').trim();
  const endDate = String(body.endDate || '').trim();
  const bks = normalizeBks(String(body.bks || ''));
  const tripTypeRaw = String(body.tripType || '').trim();
  const tripType = (tripTypeRaw === 'phat_hang' ? 'pvdc' : tripTypeRaw) as TripType;
  const driver1 = String(body.driver1 || '').trim();
  const driver2 = String(body.driver2 || '').trim();
  const mcx = String(body.mcx || '').trim();
  const customerName = String(body.customerName || '').trim();
  const servicePostOffice = String(body.servicePostOffice || '').trim();
  const origin = String(body.origin || '').trim();
  const destination = String(body.destination || '').trim();
  const kmStart = Number(body.kmStart);
  const kmEnd = Number(body.kmEnd);
  const coldStart = String(body.coldStart || '').trim();
  const coldEnd = String(body.coldEnd || '').trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return { error: 'Ngày bắt đầu và ngày kết thúc phải đúng định dạng YYYY-MM-DD.' };
  }
  if (endDate < startDate) {
    return { error: 'Ngày kết thúc không được nhỏ hơn ngày bắt đầu.' };
  }
  if (!bks) {
    return { error: 'Vui lòng nhập Biển kiểm soát (BKS).' };
  }
  if (!['kinh_doanh', 'ket_noi', 'pvdc', 'bdsc'].includes(tripType)) {
    return { error: 'Loại chuyến không hợp lệ.' };
  }
  if (!driver1) {
    return { error: 'Vui lòng nhập tên lái xe.' };
  }
  if (tripType !== 'pvdc' && !mcx) {
    return { error: 'Vui lòng nhập mã chuyến xe trên VTMan.' };
  }
  if (tripType !== 'pvdc' && !customerName) {
    return { error: 'Vui lòng nhập tên khách hàng.' };
  }
  if ((tripType === 'pvdc' || isDiemCuoiCustomer(customerName)) && !servicePostOffice) {
    return { error: 'Vui lòng nhập Bưu cục phục vụ (bắt buộc với loại PVĐC hoặc khách hàng Điểm cuối).' };
  }
  if (!origin || !destination) {
    return { error: 'Vui lòng nhập đầy đủ Điểm đi và Điểm đến.' };
  }
  if (!Number.isFinite(kmStart) || !Number.isFinite(kmEnd) || kmStart < 0 || kmEnd < 0) {
    return { error: 'Chỉ số Km đầu và Km cuối phải là số hợp lệ không âm.' };
  }
  if (kmEnd < kmStart) {
    return { error: 'Km cuối phải lớn hơn hoặc bằng Km đầu.' };
  }

  let coldStartNormalized = '';
  let coldEndNormalized = '';
  let coldDurationMinutes = 0;

  if (tripType === 'kinh_doanh') {
    const startM = parseColdHoursToMinutes(coldStart);
    const endM = parseColdHoursToMinutes(coldEnd);
    if (startM === null || endM === null) {
      return { error: 'Giờ lạnh phải đúng định dạng giờ:phút (ví dụ 4123:12).' };
    }
    if (endM < startM) {
      return { error: 'Giờ lạnh kết thúc phải lớn hơn hoặc bằng giờ lạnh bắt đầu.' };
    }
    coldStartNormalized = coldStart;
    coldEndNormalized = coldEnd;
    coldDurationMinutes = endM - startM;
  }

  const kmTotal = Math.round((kmEnd - kmStart) * 1000) / 1000;

  return {
    data: {
      startDate,
      endDate,
      bks,
      tripType,
      driver1,
      driver2,
      mcx: tripType === 'pvdc' ? '' : mcx,
      customerName: tripType === 'pvdc' ? '' : customerName,
      servicePostOffice,
      origin,
      destination,
      kmStart,
      kmEnd,
      kmTotal,
      coldStart: coldStartNormalized,
      coldEnd: coldEndNormalized,
      coldDurationMinutes,
    },
  };
}

export async function fetchPublicVehicles(): Promise<PublicVehicleOption[]> {
  if (!isStaticHostMode) {
    try {
      const res = await fetch('/api/public/vehicles');
      if (isUnavailableServerResponse(res)) {
        isStaticHostMode = true;
      } else {
        const data = await safeParseJson<{ vehicles?: PublicVehicleOption[] }>(res);
        if (res.ok && data && Array.isArray(data.vehicles)) {
          return data.vehicles;
        }
      }
    } catch {
      isStaticHostMode = true;
    }
  }

  const db = readStaticDb();
  return db.vehicles
    .filter((v) => v.active)
    .map((v) => ({ id: v.id, bks: v.bks, label: v.label }));
}

export async function submitPublicTrip(payload: Record<string, unknown>): Promise<TripRecord> {
  if (!isStaticHostMode) {
    try {
      const res = await fetch('/api/public/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (isUnavailableServerResponse(res)) {
        isStaticHostMode = true;
      } else {
        const data = await safeParseJson<{ trip?: TripRecord; error?: string }>(res);
        if (!res.ok || !data?.trip) {
          throw new Error(getApiFailureMessage(res.status, data?.error, 'Không thể lưu thông tin chuyến xe.'));
        }
        return data.trip;
      }
    } catch (err) {
      if (!isStaticHostMode && err instanceof Error && !err.message.includes('Failed to fetch')) {
        throw err;
      }
      isStaticHostMode = true;
    }
  }

  const check = validateTripPayload(payload);
  if (check.error || !check.data) {
    throw new Error(check.error || 'Dữ liệu không hợp lệ.');
  }

  const db = readStaticDb();
  const matched = db.vehicles.find(
    (v) => v.active && normalizeBks(v.bks) === check.data!.bks
  );
  if (!matched) {
    throw new Error(
      `Biển kiểm soát "${check.data.bks}" không có trong danh sách đội xe đang hoạt động. Vui lòng kiểm tra lại BKS.`
    );
  }

  const now = new Date().toISOString();
  const newTrip: TripRecord = {
    id: `trip-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    ...check.data,
    bks: matched.bks,
    sheetSyncStatus: 'pending',
    sheetSyncError: '',
    createdAt: now,
    updatedAt: now,
  };

  if (db.appsScriptUrl) {
    const syncRes = await pushToAppsScriptFromBrowser(db.appsScriptUrl, {
      action: 'upsertTrip',
      ...newTrip,
      coldDurationFormatted:
        newTrip.tripType === 'kinh_doanh' && (newTrip.coldStart || newTrip.coldEnd)
          ? formatMinutesToDuration(newTrip.coldDurationMinutes)
          : '',
    });
    newTrip.sheetSyncStatus = syncRes.status;
    newTrip.sheetSyncError = syncRes.error;
  } else {
    newTrip.sheetSyncStatus = 'pending';
    newTrip.sheetSyncError = 'Chưa cấu hình URL Google Apps Script.';
  }

  db.trips.unshift(newTrip);
  saveStaticDb(db);
  return newTrip;
}

export async function loginAdmin(
  username: string,
  password: string
): Promise<{ token: string; username: string }> {
  const cleanUser = username.trim();
  if (!cleanUser || !password) {
    throw new Error('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
  }

  if (!isStaticHostMode) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUser, password }),
      });
      if (isUnavailableServerResponse(res)) {
        isStaticHostMode = true;
      } else {
        const data = await safeParseJson<{ token?: string; username?: string; error?: string }>(res);
        if (!res.ok || !data?.token || !data?.username) {
          throw new Error(getApiFailureMessage(res.status, data?.error, 'Đăng nhập không thành công.'));
        }
        return { token: data.token, username: data.username };
      }
    } catch (err) {
      if (!isStaticHostMode && err instanceof Error && !err.message.includes('Failed to fetch')) {
        throw err;
      }
      isStaticHostMode = true;
    }
  }

  const digest = await computeSha256Hex(`nhaplieu2t-salt-v1:${cleanUser.toLowerCase()}:${password}`);
  if (cleanUser.toLowerCase() !== STATIC_ADMIN_USER || digest !== STATIC_ADMIN_HASH) {
    throw new Error('Sai tài khoản hoặc mật khẩu quản lý.');
  }

  return {
    token: `${STATIC_TOKEN_PREFIX}${Date.now()}`,
    username: STATIC_ADMIN_USER,
  };
}

function isStaticToken(token: string): boolean {
  return isStaticHostMode || token.startsWith(STATIC_TOKEN_PREFIX);
}

async function serverAuthFetch(
  token: string,
  url: string,
  options: RequestInit,
  onSessionExpired: () => void
): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    onSessionExpired();
    throw new Error('Phiên đăng nhập đã hết hạn.');
  }
  return res;
}

export async function loadAdminDashboardData(
  token: string,
  onSessionExpired: () => void
): Promise<{
  trips: TripRecord[];
  vehicles: Vehicle[];
  appsScriptUrl: string;
  lastTestedAt: string;
}> {
  if (!isStaticToken(token)) {
    const [tripsRes, vehiclesRes, settingsRes] = await Promise.all([
      serverAuthFetch(token, '/api/admin/trips', {}, onSessionExpired),
      serverAuthFetch(token, '/api/admin/vehicles', {}, onSessionExpired),
      serverAuthFetch(token, '/api/admin/settings/sheet', {}, onSessionExpired),
    ]);

    if (
      isUnavailableServerResponse(tripsRes) ||
      isUnavailableServerResponse(vehiclesRes) ||
      isUnavailableServerResponse(settingsRes)
    ) {
      isStaticHostMode = true;
    } else {
      const firstBad = [tripsRes, vehiclesRes, settingsRes].find((r) => !r.ok);
      if (firstBad) {
        const errData = await safeParseJson<{ error?: string }>(firstBad);
        throw new Error(getApiFailureMessage(firstBad.status, errData?.error, 'Không thể tải dữ liệu quản lý.'));
      }
      const [tripsData, vehiclesData, settingsData] = await Promise.all([
        safeParseJson<{ trips?: TripRecord[] }>(tripsRes),
        safeParseJson<{ vehicles?: Vehicle[] }>(vehiclesRes),
        safeParseJson<{ appsScriptUrl?: string; lastTestedAt?: string }>(settingsRes),
      ]);
      return {
        trips: Array.isArray(tripsData?.trips) ? tripsData.trips : [],
        vehicles: Array.isArray(vehiclesData?.vehicles) ? vehiclesData.vehicles : [],
        appsScriptUrl: settingsData?.appsScriptUrl || '',
        lastTestedAt: settingsData?.lastTestedAt || '',
      };
    }
  }

  const db = readStaticDb();
  return {
    trips: db.trips,
    vehicles: db.vehicles,
    appsScriptUrl: db.appsScriptUrl,
    lastTestedAt: db.lastTestedAt,
  };
}

export async function adminUpdateTrip(
  token: string,
  tripId: string,
  payload: Record<string, unknown>,
  onSessionExpired: () => void
): Promise<TripRecord> {
  if (!isStaticToken(token)) {
    const res = await serverAuthFetch(
      token,
      `/api/admin/trips/${tripId}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      onSessionExpired
    );
    const data = await safeParseJson<{ trip?: TripRecord; error?: string }>(res);
    if (!res.ok || !data?.trip) {
      throw new Error(getApiFailureMessage(res.status, data?.error, 'Không thể cập nhật chuyến xe.'));
    }
    return data.trip;
  }

  const check = validateTripPayload(payload);
  if (check.error || !check.data) {
    throw new Error(check.error || 'Dữ liệu không hợp lệ.');
  }
  const db = readStaticDb();
  const idx = db.trips.findIndex((t) => t.id === tripId);
  if (idx === -1) {
    throw new Error('Không tìm thấy chuyến xe cần sửa.');
  }

  const updated: TripRecord = {
    ...db.trips[idx],
    ...check.data,
    sheetSyncStatus: db.appsScriptUrl ? 'pending' : db.trips[idx].sheetSyncStatus,
    sheetSyncError: '',
    updatedAt: new Date().toISOString(),
  };

  if (db.appsScriptUrl) {
    const syncRes = await pushToAppsScriptFromBrowser(db.appsScriptUrl, {
      action: 'upsertTrip',
      ...updated,
      coldDurationFormatted:
        updated.tripType === 'kinh_doanh' && (updated.coldStart || updated.coldEnd)
          ? formatMinutesToDuration(updated.coldDurationMinutes)
          : '',
    });
    updated.sheetSyncStatus = syncRes.status;
    updated.sheetSyncError = syncRes.error;
  }

  db.trips[idx] = updated;
  saveStaticDb(db);
  return updated;
}

export async function adminDeleteTrip(
  token: string,
  tripId: string,
  onSessionExpired: () => void
): Promise<void> {
  if (!isStaticToken(token)) {
    const res = await serverAuthFetch(token, `/api/admin/trips/${tripId}`, { method: 'DELETE' }, onSessionExpired);
    if (!res.ok) {
      const data = await safeParseJson<{ error?: string }>(res);
      throw new Error(getApiFailureMessage(res.status, data?.error, 'Không thể xóa chuyến xe.'));
    }
    return;
  }

  const db = readStaticDb();
  db.trips = db.trips.filter((t) => t.id !== tripId);
  saveStaticDb(db);
}

export async function adminSyncTrip(
  token: string,
  tripId: string,
  onSessionExpired: () => void
): Promise<TripRecord> {
  if (!isStaticToken(token)) {
    const res = await serverAuthFetch(token, `/api/admin/trips/${tripId}/sync`, { method: 'POST' }, onSessionExpired);
    const data = await safeParseJson<{ trip?: TripRecord; error?: string }>(res);
    if (!res.ok || !data?.trip) {
      throw new Error(getApiFailureMessage(res.status, data?.error, 'Đồng bộ Google Sheet thất bại.'));
    }
    return data.trip;
  }

  const db = readStaticDb();
  if (!db.appsScriptUrl) {
    throw new Error('Chưa cấu hình URL Google Apps Script trong mục Cài đặt Sheet.');
  }
  const idx = db.trips.findIndex((t) => t.id === tripId);
  if (idx === -1) {
    throw new Error('Không tìm thấy chuyến xe.');
  }
  const trip = db.trips[idx];
  const syncRes = await pushToAppsScriptFromBrowser(db.appsScriptUrl, {
    action: 'upsertTrip',
    ...trip,
    coldDurationFormatted:
      trip.tripType === 'kinh_doanh' && (trip.coldStart || trip.coldEnd)
        ? formatMinutesToDuration(trip.coldDurationMinutes)
        : '',
  });
  const updated: TripRecord = {
    ...trip,
    sheetSyncStatus: syncRes.status,
    sheetSyncError: syncRes.error,
    updatedAt: new Date().toISOString(),
  };
  db.trips[idx] = updated;
  saveStaticDb(db);
  return updated;
}

export async function adminSyncPendingTrips(
  token: string,
  onSessionExpired: () => void
): Promise<TripRecord[]> {
  if (!isStaticToken(token)) {
    const res = await serverAuthFetch(token, '/api/admin/trips/sync-pending', { method: 'POST' }, onSessionExpired);
    const data = await safeParseJson<{ trips?: TripRecord[]; error?: string }>(res);
    if (!res.ok) {
      throw new Error(getApiFailureMessage(res.status, data?.error, 'Đồng bộ hàng loạt thất bại.'));
    }
    return Array.isArray(data?.trips) ? data.trips : [];
  }

  const db = readStaticDb();
  if (!db.appsScriptUrl) {
    throw new Error('Chưa cấu hình URL Google Apps Script.');
  }
  for (let i = 0; i < db.trips.length; i += 1) {
    const trip = db.trips[i];
    if (trip.sheetSyncStatus !== 'synced') {
      const syncRes = await pushToAppsScriptFromBrowser(db.appsScriptUrl, {
        action: 'upsertTrip',
        ...trip,
        coldDurationFormatted:
          trip.tripType === 'kinh_doanh' && (trip.coldStart || trip.coldEnd)
            ? formatMinutesToDuration(trip.coldDurationMinutes)
            : '',
      });
      db.trips[i] = {
        ...trip,
        sheetSyncStatus: syncRes.status,
        sheetSyncError: syncRes.error,
        updatedAt: new Date().toISOString(),
      };
    }
  }
  saveStaticDb(db);
  return db.trips;
}

export async function adminAddVehicle(
  token: string,
  payload: { bks: string; label: string; coldHourDailyQuota: number },
  onSessionExpired: () => void
): Promise<Vehicle> {
  if (!isStaticToken(token)) {
    const res = await serverAuthFetch(
      token,
      '/api/admin/vehicles',
      { method: 'POST', body: JSON.stringify(payload) },
      onSessionExpired
    );
    const data = await safeParseJson<{ vehicle?: Vehicle; error?: string }>(res);
    if (!res.ok || !data?.vehicle) {
      throw new Error(getApiFailureMessage(res.status, data?.error, 'Không thể thêm xe.'));
    }
    return data.vehicle;
  }

  const normalizedBks = normalizeBks(payload.bks);
  if (!normalizedBks) throw new Error('Biển kiểm soát không được để trống.');
  const db = readStaticDb();
  if (db.vehicles.some((v) => normalizeBks(v.bks) === normalizedBks)) {
    throw new Error('Biển kiểm soát này đã tồn tại trong danh sách.');
  }
  const newVehicle: Vehicle = {
    id: `veh-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    bks: normalizedBks,
    label: payload.label.trim() || '2T',
    coldHourDailyQuota:
      Number.isFinite(payload.coldHourDailyQuota) && payload.coldHourDailyQuota > 0
        ? payload.coldHourDailyQuota
        : 12,
    active: true,
    createdAt: new Date().toISOString(),
  };
  db.vehicles.push(newVehicle);
  saveStaticDb(db);
  return newVehicle;
}

export async function adminUpdateVehicle(
  token: string,
  id: string,
  payload: { bks?: string; label?: string; coldHourDailyQuota?: number; active?: boolean },
  onSessionExpired: () => void
): Promise<Vehicle> {
  if (!isStaticToken(token)) {
    const res = await serverAuthFetch(
      token,
      `/api/admin/vehicles/${id}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      onSessionExpired
    );
    const data = await safeParseJson<{ vehicle?: Vehicle; error?: string }>(res);
    if (!res.ok || !data?.vehicle) {
      throw new Error(getApiFailureMessage(res.status, data?.error, 'Không thể cập nhật xe.'));
    }
    return data.vehicle;
  }

  const db = readStaticDb();
  const idx = db.vehicles.findIndex((v) => v.id === id);
  if (idx === -1) throw new Error('Không tìm thấy xe cần cập nhật.');

  const current = db.vehicles[idx];
  const nextBks = payload.bks !== undefined ? normalizeBks(payload.bks) : current.bks;
  if (!nextBks) throw new Error('Biển kiểm soát không hợp lệ.');
  if (db.vehicles.some((v, i) => i !== idx && normalizeBks(v.bks) === nextBks)) {
    throw new Error('Biển kiểm soát đã tồn tại.');
  }

  const updated: Vehicle = {
    ...current,
    bks: nextBks,
    label: payload.label !== undefined ? payload.label.trim() : current.label,
    coldHourDailyQuota:
      payload.coldHourDailyQuota !== undefined &&
      Number.isFinite(payload.coldHourDailyQuota) &&
      payload.coldHourDailyQuota > 0
        ? payload.coldHourDailyQuota
        : current.coldHourDailyQuota,
    active: payload.active !== undefined ? payload.active : current.active,
  };
  db.vehicles[idx] = updated;
  saveStaticDb(db);
  return updated;
}

export async function adminDeleteVehicle(
  token: string,
  id: string,
  onSessionExpired: () => void
): Promise<void> {
  if (!isStaticToken(token)) {
    const res = await serverAuthFetch(token, `/api/admin/vehicles/${id}`, { method: 'DELETE' }, onSessionExpired);
    if (!res.ok) {
      const data = await safeParseJson<{ error?: string }>(res);
      throw new Error(getApiFailureMessage(res.status, data?.error, 'Không thể xóa xe.'));
    }
    return;
  }

  const db = readStaticDb();
  db.vehicles = db.vehicles.filter((v) => v.id !== id);
  saveStaticDb(db);
}

export async function adminSaveSheetUrl(
  token: string,
  url: string,
  onSessionExpired: () => void
): Promise<string> {
  if (!isStaticToken(token)) {
    const res = await serverAuthFetch(
      token,
      '/api/admin/settings/sheet',
      { method: 'PUT', body: JSON.stringify({ appsScriptUrl: url }) },
      onSessionExpired
    );
    const data = await safeParseJson<{ appsScriptUrl?: string; error?: string }>(res);
    if (!res.ok) {
      throw new Error(getApiFailureMessage(res.status, data?.error, 'Không thể lưu URL.'));
    }
    return data?.appsScriptUrl || '';
  }

  const check = validateAppsScriptUrl(url);
  if (!check.valid) throw new Error(check.error || 'URL không hợp lệ.');
  const db = readStaticDb();
  db.appsScriptUrl = check.normalized;
  saveStaticDb(db);
  return check.normalized;
}

export async function adminTestSheetUrl(
  token: string,
  url: string,
  onSessionExpired: () => void
): Promise<{ message: string; lastTestedAt: string }> {
  if (!isStaticToken(token)) {
    const res = await serverAuthFetch(
      token,
      '/api/admin/settings/sheet/test',
      { method: 'POST', body: JSON.stringify({ appsScriptUrl: url }) },
      onSessionExpired
    );
    const data = await safeParseJson<{ message?: string; lastTestedAt?: string; error?: string }>(res);
    if (!res.ok) {
      throw new Error(getApiFailureMessage(res.status, data?.error, 'Kiểm tra kết nối thất bại.'));
    }
    return {
      message: data?.message || 'Kết nối thành công!',
      lastTestedAt: data?.lastTestedAt || '',
    };
  }

  const check = validateAppsScriptUrl(url);
  if (!check.valid || !check.normalized) {
    throw new Error(check.error || 'Vui lòng nhập URL Google Apps Script.');
  }

  const syncRes = await pushToAppsScriptFromBrowser(check.normalized, {
    action: 'ping',
    timestamp: new Date().toISOString(),
  });
  if (syncRes.status === 'error') {
    throw new Error(syncRes.error || 'Kiểm tra kết nối thất bại.');
  }

  const testedAt = new Date().toISOString();
  const db = readStaticDb();
  db.appsScriptUrl = check.normalized;
  db.lastTestedAt = testedAt;
  saveStaticDb(db);
  return {
    message: 'Đã lưu và gửi tín hiệu kiểm tra tới Google Apps Script thành công!',
    lastTestedAt: testedAt,
  };
}
