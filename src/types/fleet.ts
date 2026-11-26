export type TripType = 'kinh_doanh' | 'ket_noi' | 'pvdc' | 'bdsc';

export type SheetSyncStatus = 'synced' | 'pending' | 'error';

export interface Vehicle {
  id: string;
  bks: string;
  label: string;
  coldHourDailyQuota: number;
  active: boolean;
  createdAt: string;
}

export interface TripRecord {
  id: string;
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
  kmStart: number;
  kmEnd: number;
  kmTotal: number;
  coldStart: string;
  coldEnd: string;
  coldDurationMinutes: number;
  sheetSyncStatus: SheetSyncStatus;
  sheetSyncError: string;
  createdAt: string;
  updatedAt: string;
}

export interface TripPayload {
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
  kmStart: number;
  kmEnd: number;
  coldStart: string;
  coldEnd: string;
}

export const TRIP_TYPE_OPTIONS: Array<{ value: TripType; label: string; shortLabel: string }> = [
  { value: 'kinh_doanh', label: 'Kinh doanh', shortLabel: 'Kinh doanh' },
  { value: 'ket_noi', label: 'Kết nối', shortLabel: 'Kết nối' },
  { value: 'pvdc', label: 'PVĐC', shortLabel: 'PVĐC' },
  { value: 'bdsc', label: 'BDSC', shortLabel: 'BDSC' },
];

export const TRIP_TYPE_LABELS: Record<TripType, string> = {
  kinh_doanh: 'Kinh doanh',
  ket_noi: 'Kết nối',
  pvdc: 'PVĐC',
  bdsc: 'BDSC',
};

export function normalizeBks(value: string): string {
  return value.replace(/[\s.-]+/g, '').toUpperCase();
}

/**
 * Parse cumulative cold-unit hour meter string "HHHH:MM" (e.g., "4123:12")
 * into total minutes. Returns null if invalid.
 */
export function parseColdHoursToMinutes(value: string): number | null {
  const trimmed = value.trim();
  const match = /^(\d{1,7}):([0-5]\d)$/.exec(trimmed);
  if (!match) return null;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

/**
 * Normalize cold hour input like "4123:12" or "4123:5" -> "4123:05" if valid.
 */
export function normalizeColdHourInput(value: string): string {
  const cleaned = value.replace(/[^\d:]/g, '');
  const parts = cleaned.split(':');
  if (parts.length <= 1) return cleaned;
  const hours = parts[0].slice(0, 7);
  const mins = parts[1].slice(0, 2);
  return `${hours}:${mins}`;
}

export function formatMinutesToDuration(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return '0:00';
  const hrs = Math.floor(totalMinutes / 60);
  const mins = Math.round(totalMinutes % 60);
  return `${hrs}:${String(mins).padStart(2, '0')}`;
}

export function formatKm(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '';
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 3,
  }).format(val);
}

export function formatRouteLabel(origin: string, destination: string): string {
  const o = origin.trim();
  const d = destination.trim();
  if (o && d) return `${o} - ${d}`;
  return o || d || '';
}

export function isDiemCuoiCustomer(customerName: string): boolean {
  return customerName.trim().toLowerCase() === 'điểm cuối' || customerName.trim().toLowerCase() === 'diem cuoi';
}

export function getTodayIsoDate(): string {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}
