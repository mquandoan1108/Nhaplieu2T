import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';

type TripType = 'kinh_doanh' | 'ket_noi' | 'pvdc' | 'bdsc';
type SheetSyncStatus = 'synced' | 'pending' | 'error';

interface Vehicle {
  id: string;
  bks: string;
  label: string;
  coldHourDailyQuota: number;
  active: boolean;
  createdAt: string;
}

interface TripRecord {
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

interface FleetDatabase {
  fleetSeedVersion?: number;
  vehicles: Vehicle[];
  trips: TripRecord[];
  settings: {
    appsScriptUrl: string;
    lastTestedAt: string;
  };
}

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.resolve(DATA_DIR, 'fleet-db.json');

const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || '').trim() || 'pvhkd';
const ADMIN_SALT = '917b4aa3e9a75ec0a1bb06c61bbac4a1';
const ADMIN_SCRYPT_HASH =
  '184627fd8bb5c213a1941f902d0e1c860fcbc325ac68a959ed2481ea3b972663cbe4cc073b29a379e3dde374c268bb61b9673fc518d2ca03889659d83b57193d';

const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? process.env.SESSION_SECRET
    : crypto.randomBytes(32).toString('hex');

const VALID_TRIP_TYPES = new Set<TripType>([
  'kinh_doanh',
  'ket_noi',
  'pvdc',
  'bdsc',
]);

const FLEET_2T_PLATES: string[] = [
  '29KT01759',
  '29KT01765',
  '29KT01758',
  '29KT01730',
  '29KT01732',
  '29KT11096',
  '50H82360',
  '50H09223',
  '50H36098',
  '50H36358',
  '50H36369',
  '50H36478',
  '50H36676',
  '50H39071',
  '50H39127',
  '50H39346',
  '50H39369',
  '50H39374',
  '50H39620',
  '50H39687',
  '50H39820',
  '29KT20025',
  '50H22604',
  '51D19325',
  '29KT11028',
  '29KT11040',
  '29KT11041',
  '29KT11044',
  '29KT11075',
  '29KT11091',
  '29KT11142',
  '29KT11143',
  '29KT11153',
  '29KT11253',
  '29KT11061',
  '29KT11206',
  '50H48889',
  '29H96398',
  '29H96399',
  '29E15425',
  '29E15416',
  '29E15405',
  '29H96685',
  '29H96624',
  '50H19874',
  '50H26698',
  '50H81424',
  '29KT01703',
  '29KT01705',
  '50H19772',
];

let writeQueue: Promise<void> = Promise.resolve();

function buildSeeded2TVehicles(now: string): Vehicle[] {
  return FLEET_2T_PLATES.map((bks) => ({
    id: `veh-${bks}`,
    bks,
    label: '2T',
    coldHourDailyQuota: 12,
    active: true,
    createdAt: now,
  }));
}

function createInitialDatabase(): FleetDatabase {
  const now = new Date().toISOString();
  return {
    fleetSeedVersion: 2,
    vehicles: buildSeeded2TVehicles(now),
    trips: [],
    settings: {
      appsScriptUrl: '',
      lastTestedAt: '',
    },
  };
}

async function readDatabase(): Promise<FleetDatabase> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<FleetDatabase>;
    const trips = (Array.isArray(parsed.trips) ? parsed.trips : []).map((t) => ({
      ...t,
      tripType: (String(t.tripType) === 'phat_hang' ? 'pvdc' : t.tripType) as TripType,
    }));

    let vehicles = Array.isArray(parsed.vehicles) ? parsed.vehicles : [];
    let fleetSeedVersion = parsed.fleetSeedVersion ?? 1;

    if (fleetSeedVersion < 2) {
      const now = new Date().toISOString();
      const seeded2T = buildSeeded2TVehicles(now);
      const seededSet = new Set(FLEET_2T_PLATES);
      const legacyDemoIds = new Set(['veh-29KT01812', 'veh-51D12345']);
      const keptCustom = vehicles.filter(
        (v) => !legacyDemoIds.has(v.id) && !seededSet.has(v.bks.toUpperCase())
      );
      vehicles = [...seeded2T, ...keptCustom];
      fleetSeedVersion = 2;
      const migrated: FleetDatabase = {
        fleetSeedVersion,
        vehicles,
        trips,
        settings: {
          appsScriptUrl: parsed.settings?.appsScriptUrl || '',
          lastTestedAt: parsed.settings?.lastTestedAt || '',
        },
      };
      await writeDatabase(migrated);
      return migrated;
    }

    return {
      fleetSeedVersion,
      vehicles,
      trips,
      settings: {
        appsScriptUrl: parsed.settings?.appsScriptUrl || '',
        lastTestedAt: parsed.settings?.lastTestedAt || '',
      },
    };
  } catch {
    const initial = createInitialDatabase();
    await writeDatabase(initial);
    return initial;
  }
}

async function writeDatabase(db: FleetDatabase): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tempPath = path.resolve(DATA_DIR, `fleet-db.${crypto.randomUUID()}.tmp`);
  await fs.writeFile(tempPath, JSON.stringify(db, null, 2), 'utf8');
  await fs.rename(tempPath, DB_PATH);
}

async function withDbLock<T>(fn: (db: FleetDatabase) => Promise<{ db?: FleetDatabase; result: T }>): Promise<T> {
  let output!: T;
  writeQueue = writeQueue.then(async () => {
    const db = await readDatabase();
    const res = await fn(db);
    if (res.db) {
      await writeDatabase(res.db);
    }
    output = res.result;
  });
  await writeQueue;
  return output;
}

function verifyAdminPassword(password: string): boolean {
  const envPass = process.env.ADMIN_PASSWORD;
  if (envPass && envPass.length > 0) {
    const a = crypto.createHash('sha256').update(password).digest();
    const b = crypto.createHash('sha256').update(envPass).digest();
    return crypto.timingSafeEqual(a, b);
  }
  const derived = crypto.scryptSync(password, ADMIN_SALT, 64);
  const expected = Buffer.from(ADMIN_SCRYPT_HASH, 'hex');
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}

function signSessionToken(username: string): string {
  const payload = {
    sub: username,
    exp: Date.now() + 12 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySessionToken(token: string): { sub: string; exp: number } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
      sub?: string;
      exp?: number;
    };
    if (!decoded.sub || typeof decoded.exp !== 'number' || decoded.exp < Date.now()) {
      return null;
    }
    return { sub: decoded.sub, exp: decoded.exp };
  } catch {
    return null;
  }
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Vui lòng đăng nhập tài khoản quản lý để tiếp tục.' });
    return;
  }
  const token = header.slice(7).trim();
  const verified = verifySessionToken(token);
  if (!verified) {
    res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ.' });
    return;
  }
  next();
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

function parseColdHoursToMinutes(value: string): number | null {
  const trimmed = value.trim();
  const match = /^(\d{1,7}):([0-5]\d)$/.exec(trimmed);
  if (!match) return null;
  const hrs = Number.parseInt(match[1], 10);
  const mins = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hrs) || !Number.isFinite(mins)) return null;
  return hrs * 60 + mins;
}

function formatMinutesToDuration(totalMinutes: number): string {
  const hrs = Math.floor(totalMinutes / 60);
  const mins = Math.round(totalMinutes % 60);
  return `${hrs}:${String(mins).padStart(2, '0')}`;
}

function isDiemCuoi(customerName: string): boolean {
  const lower = customerName.trim().toLowerCase();
  return lower === 'điểm cuối' || lower === 'diem cuoi';
}

function sanitizeTripInput(body: Record<string, unknown>): {
  error?: string;
  data?: Omit<TripRecord, 'id' | 'sheetSyncStatus' | 'sheetSyncError' | 'createdAt' | 'updatedAt'>;
} {
  const startDate = String(body.startDate || '').trim();
  const endDate = String(body.endDate || '').trim();
  const bks = String(body.bks || '')
    .replace(/[\s.-]+/g, '')
    .toUpperCase();
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
  if (!VALID_TRIP_TYPES.has(tripType)) {
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
  if ((tripType === 'pvdc' || isDiemCuoi(customerName)) && !servicePostOffice) {
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
    const coldStartMins = parseColdHoursToMinutes(coldStart);
    const coldEndMins = parseColdHoursToMinutes(coldEnd);
    if (coldStartMins === null || coldEndMins === null) {
      return { error: 'Giờ lạnh phải đúng định dạng giờ:phút (ví dụ 4123:12).' };
    }
    if (coldEndMins < coldStartMins) {
      return { error: 'Giờ lạnh kết thúc phải lớn hơn hoặc bằng giờ lạnh bắt đầu.' };
    }
    coldStartNormalized = coldStart;
    coldEndNormalized = coldEnd;
    coldDurationMinutes = coldEndMins - coldStartMins;
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

async function pushTripToGoogleSheet(
  appsScriptUrl: string,
  trip: TripRecord
): Promise<{ status: SheetSyncStatus; error: string }> {
  const urlCheck = validateAppsScriptUrl(appsScriptUrl);
  if (!urlCheck.valid || !urlCheck.normalized) {
    return {
      status: 'pending',
      error: urlCheck.normalized ? urlCheck.error || '' : 'Chưa cấu hình URL Google Apps Script.',
    };
  }

  try {
    const response = await fetch(urlCheck.normalized, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'upsertTrip',
        ...trip,
        coldDurationFormatted:
          trip.tripType === 'kinh_doanh' && (trip.coldStart || trip.coldEnd)
            ? formatMinutesToDuration(trip.coldDurationMinutes)
            : '',
      }),
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });

    const text = await response.text();
    if (!response.ok) {
      return {
        status: 'error',
        error: `Google Sheet phản hồi mã lỗi ${response.status}`,
      };
    }

    try {
      const json = JSON.parse(text) as { ok?: boolean; error?: string };
      if (json.ok === false) {
        return {
          status: 'error',
          error: json.error || 'Apps Script trả về lỗi.',
        };
      }
    } catch {
      // Apps Script redirects sometimes return HTML if not deployed as "Anyone"
      if (text.includes('ServiceLogin') || text.includes('accounts.google.com')) {
        return {
          status: 'error',
          error: 'Apps Script yêu cầu đăng nhập. Vui lòng đặt quyền truy cập Web App là "Anyone".',
        };
      }
    }

    return { status: 'synced', error: '' };
  } catch (err) {
    return {
      status: 'error',
      error: err instanceof Error ? err.message : 'Không thể kết nối tới Google Apps Script.',
    };
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Auth routes
  app.post('/api/auth/login', (req, res) => {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');

    if (!username || !password) {
      res.status(400).json({ error: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.' });
      return;
    }

    const userMatch = username.toLowerCase() === ADMIN_USERNAME.toLowerCase();
    const passMatch = verifyAdminPassword(password);

    if (!userMatch || !passMatch) {
      res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu quản lý.' });
      return;
    }

    const token = signSessionToken(ADMIN_USERNAME);
    res.json({
      token,
      username: ADMIN_USERNAME,
      expiresInSeconds: 12 * 60 * 60,
    });
  });

  app.get('/api/auth/session', requireAdmin, (req, res) => {
    res.json({ authenticated: true, username: ADMIN_USERNAME });
  });

  // Public driver routes (ONLY active BKS list + trip submission)
  app.get('/api/public/vehicles', async (_req, res) => {
    const db = await readDatabase();
    const activeVehicles = db.vehicles
      .filter((v) => v.active)
      .map((v) => ({ id: v.id, bks: v.bks, label: v.label }));
    res.json({ vehicles: activeVehicles });
  });

  app.post('/api/public/trips', async (req, res) => {
    const validated = sanitizeTripInput((req.body || {}) as Record<string, unknown>);
    if (validated.error || !validated.data) {
      res.status(400).json({ error: validated.error || 'Dữ liệu không hợp lệ.' });
      return;
    }

    const now = new Date().toISOString();
    const newTrip: TripRecord = {
      id: `trip-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      ...validated.data,
      sheetSyncStatus: 'pending',
      sheetSyncError: '',
      createdAt: now,
      updatedAt: now,
    };

    type CreateTripLockResult =
      | { unknownBks: true }
      | { unknownBks: false; sheetUrl: string };

    const lockResult = await withDbLock<CreateTripLockResult>(async (db) => {
      const matchedVehicle = db.vehicles.find(
        (v) => v.active && v.bks.replace(/[\s.-]+/g, '').toUpperCase() === newTrip.bks
      );
      if (!matchedVehicle) {
        return { result: { unknownBks: true } };
      }
      newTrip.bks = matchedVehicle.bks;
      db.trips.unshift(newTrip);
      return { db, result: { unknownBks: false, sheetUrl: db.settings.appsScriptUrl } };
    });

    if (lockResult.unknownBks) {
      res.status(400).json({
        error: `Biển kiểm soát "${newTrip.bks}" không có trong danh sách đội xe đang hoạt động. Vui lòng kiểm tra lại BKS.`,
      });
      return;
    }

    // Real-time push to Google Sheet immediately
    const syncOutcome = await pushTripToGoogleSheet(lockResult.sheetUrl, newTrip);

    const savedTrip = await withDbLock(async (db) => {
      const idx = db.trips.findIndex((t) => t.id === newTrip.id);
      if (idx !== -1) {
        db.trips[idx].sheetSyncStatus = syncOutcome.status;
        db.trips[idx].sheetSyncError = syncOutcome.error;
        db.trips[idx].updatedAt = new Date().toISOString();
        return { db, result: db.trips[idx] };
      }
      return { result: newTrip };
    });

    res.status(201).json({ trip: savedTrip });
  });

  // Admin protected routes
  app.get('/api/admin/trips', requireAdmin, async (_req, res) => {
    const db = await readDatabase();
    res.json({ trips: db.trips });
  });

  app.patch('/api/admin/trips/:id', requireAdmin, async (req, res) => {
    const tripId = req.params.id;
    const validated = sanitizeTripInput((req.body || {}) as Record<string, unknown>);
    if (validated.error || !validated.data) {
      res.status(400).json({ error: validated.error || 'Dữ liệu không hợp lệ.' });
      return;
    }

    const updateRes = await withDbLock(async (db) => {
      const idx = db.trips.findIndex((t) => t.id === tripId);
      if (idx === -1) {
        return { result: null };
      }
      const updated: TripRecord = {
        ...db.trips[idx],
        ...validated.data,
        sheetSyncStatus: db.settings.appsScriptUrl ? 'pending' : db.trips[idx].sheetSyncStatus,
        sheetSyncError: '',
        updatedAt: new Date().toISOString(),
      };
      db.trips[idx] = updated;
      return { db, result: { trip: updated, sheetUrl: db.settings.appsScriptUrl } };
    });

    if (!updateRes) {
      res.status(404).json({ error: 'Không tìm thấy chuyến xe cần sửa.' });
      return;
    }

    let finalTrip = updateRes.trip;
    if (updateRes.sheetUrl) {
      const syncOutcome = await pushTripToGoogleSheet(updateRes.sheetUrl, updateRes.trip);
      finalTrip = await withDbLock(async (db) => {
        const idx = db.trips.findIndex((t) => t.id === tripId);
        if (idx !== -1) {
          db.trips[idx].sheetSyncStatus = syncOutcome.status;
          db.trips[idx].sheetSyncError = syncOutcome.error;
          return { db, result: db.trips[idx] };
        }
        return { result: updateRes.trip };
      });
    }

    res.json({ trip: finalTrip });
  });

  app.delete('/api/admin/trips/:id', requireAdmin, async (req, res) => {
    const tripId = req.params.id;
    const removed = await withDbLock(async (db) => {
      const before = db.trips.length;
      db.trips = db.trips.filter((t) => t.id !== tripId);
      if (db.trips.length === before) return { result: false };
      return { db, result: true };
    });

    if (!removed) {
      res.status(404).json({ error: 'Không tìm thấy chuyến xe.' });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/admin/trips/:id/sync', requireAdmin, async (req, res) => {
    const tripId = req.params.id;
    const db = await readDatabase();
    const trip = db.trips.find((t) => t.id === tripId);
    if (!trip) {
      res.status(404).json({ error: 'Không tìm thấy chuyến xe.' });
      return;
    }
    if (!db.settings.appsScriptUrl) {
      res.status(400).json({ error: 'Chưa cấu hình URL Google Apps Script.' });
      return;
    }

    const syncOutcome = await pushTripToGoogleSheet(db.settings.appsScriptUrl, trip);
    const updatedTrip = await withDbLock(async (latestDb) => {
      const idx = latestDb.trips.findIndex((t) => t.id === tripId);
      if (idx !== -1) {
        latestDb.trips[idx].sheetSyncStatus = syncOutcome.status;
        latestDb.trips[idx].sheetSyncError = syncOutcome.error;
        latestDb.trips[idx].updatedAt = new Date().toISOString();
        return { db: latestDb, result: latestDb.trips[idx] };
      }
      return { result: trip };
    });

    res.json({ trip: updatedTrip });
  });

  app.post('/api/admin/trips/sync-pending', requireAdmin, async (_req, res) => {
    const db = await readDatabase();
    if (!db.settings.appsScriptUrl) {
      res.status(400).json({ error: 'Chưa cấu hình URL Google Apps Script.' });
      return;
    }

    const pendingTrips = db.trips.filter((t) => t.sheetSyncStatus !== 'synced');
    let syncedCount = 0;
    let errorCount = 0;

    for (const trip of pendingTrips) {
      const outcome = await pushTripToGoogleSheet(db.settings.appsScriptUrl, trip);
      if (outcome.status === 'synced') syncedCount++;
      else errorCount++;

      await withDbLock(async (latestDb) => {
        const idx = latestDb.trips.findIndex((t) => t.id === trip.id);
        if (idx !== -1) {
          latestDb.trips[idx].sheetSyncStatus = outcome.status;
          latestDb.trips[idx].sheetSyncError = outcome.error;
          latestDb.trips[idx].updatedAt = new Date().toISOString();
          return { db: latestDb, result: true };
        }
        return { result: false };
      });
    }

    const latest = await readDatabase();
    res.json({ syncedCount, errorCount, trips: latest.trips });
  });

  // Vehicle management routes
  app.get('/api/admin/vehicles', requireAdmin, async (_req, res) => {
    const db = await readDatabase();
    res.json({ vehicles: db.vehicles });
  });

  app.post('/api/admin/vehicles', requireAdmin, async (req, res) => {
    const bks = String(req.body?.bks || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '');
    const label = String(req.body?.label || '').trim();
    const quota = Number(req.body?.coldHourDailyQuota ?? 10);

    if (!bks) {
      res.status(400).json({ error: 'Vui lòng nhập Biển kiểm soát (BKS).' });
      return;
    }
    if (!Number.isFinite(quota) || quota < 0 || quota > 240) {
      res.status(400).json({ error: 'Định mức giờ lạnh phải là số hợp lệ (0 - 240 giờ).' });
      return;
    }

    type AddVehicleResult = { error: string } | { vehicle: Vehicle };
    const result = await withDbLock<AddVehicleResult>(async (db) => {
      if (db.vehicles.some((v) => v.bks.toUpperCase() === bks)) {
        return { result: { error: `Biển kiểm soát ${bks} đã tồn tại.` } };
      }
      const vehicle: Vehicle = {
        id: `veh-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        bks,
        label: label || 'Xe tải đông lạnh',
        coldHourDailyQuota: quota,
        active: true,
        createdAt: new Date().toISOString(),
      };
      db.vehicles.push(vehicle);
      return { db, result: { vehicle } };
    });

    if ('error' in result) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.status(201).json(result);
  });

  app.patch('/api/admin/vehicles/:id', requireAdmin, async (req, res) => {
    const vehicleId = req.params.id;
    const bksRaw = req.body?.bks !== undefined ? String(req.body.bks).trim().toUpperCase().replace(/\s+/g, '') : undefined;
    const labelRaw = req.body?.label !== undefined ? String(req.body.label).trim() : undefined;
    const quotaRaw = req.body?.coldHourDailyQuota !== undefined ? Number(req.body.coldHourDailyQuota) : undefined;
    const activeRaw = req.body?.active !== undefined ? Boolean(req.body.active) : undefined;

    if (bksRaw !== undefined && !bksRaw) {
      res.status(400).json({ error: 'Biển kiểm soát không được để trống.' });
      return;
    }
    if (quotaRaw !== undefined && (!Number.isFinite(quotaRaw) || quotaRaw < 0 || quotaRaw > 240)) {
      res.status(400).json({ error: 'Định mức giờ lạnh không hợp lệ.' });
      return;
    }

    type UpdateVehicleResult = { notFound: true } | { conflict: string } | { vehicle: Vehicle };
    const result = await withDbLock<UpdateVehicleResult>(async (db) => {
      const idx = db.vehicles.findIndex((v) => v.id === vehicleId);
      if (idx === -1) return { result: { notFound: true } };
      if (bksRaw && db.vehicles.some((v) => v.id !== vehicleId && v.bks === bksRaw)) {
        return { result: { conflict: `BKS ${bksRaw} đã tồn tại.` } };
      }
      db.vehicles[idx] = {
        ...db.vehicles[idx],
        bks: bksRaw ?? db.vehicles[idx].bks,
        label: labelRaw ?? db.vehicles[idx].label,
        coldHourDailyQuota: quotaRaw ?? db.vehicles[idx].coldHourDailyQuota,
        active: activeRaw ?? db.vehicles[idx].active,
      };
      return { db, result: { vehicle: db.vehicles[idx] } };
    });

    if ('notFound' in result) {
      res.status(404).json({ error: 'Không tìm thấy xe.' });
      return;
    }
    if ('conflict' in result) {
      res.status(409).json({ error: result.conflict });
      return;
    }
    res.json(result);
  });

  app.delete('/api/admin/vehicles/:id', requireAdmin, async (req, res) => {
    const vehicleId = req.params.id;
    const removed = await withDbLock(async (db) => {
      const before = db.vehicles.length;
      db.vehicles = db.vehicles.filter((v) => v.id !== vehicleId);
      if (db.vehicles.length === before) return { result: false };
      return { db, result: true };
    });
    if (!removed) {
      res.status(404).json({ error: 'Không tìm thấy xe.' });
      return;
    }
    res.json({ ok: true });
  });

  // Google Sheet Apps Script settings routes
  app.get('/api/admin/settings/sheet', requireAdmin, async (_req, res) => {
    const db = await readDatabase();
    res.json({
      appsScriptUrl: db.settings.appsScriptUrl,
      lastTestedAt: db.settings.lastTestedAt,
    });
  });

  app.put('/api/admin/settings/sheet', requireAdmin, async (req, res) => {
    const rawUrl = String(req.body?.appsScriptUrl || '');
    const check = validateAppsScriptUrl(rawUrl);
    if (!check.valid) {
      res.status(400).json({ error: check.error });
      return;
    }

    const updated = await withDbLock(async (db) => {
      db.settings.appsScriptUrl = check.normalized;
      return { db, result: db.settings };
    });
    res.json(updated);
  });

  app.post('/api/admin/settings/sheet/test', requireAdmin, async (req, res) => {
    const rawUrl = String(req.body?.appsScriptUrl || '');
    const check = validateAppsScriptUrl(rawUrl);
    if (!check.valid || !check.normalized) {
      res.status(400).json({ error: check.error || 'Vui lòng nhập URL Google Apps Script.' });
      return;
    }

    try {
      const response = await fetch(check.normalized, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ping', timestamp: new Date().toISOString() }),
        redirect: 'follow',
        signal: AbortSignal.timeout(10000),
      });

      const text = await response.text();
      if (!response.ok) {
        res.status(502).json({ error: `Apps Script trả về mã lỗi HTTP ${response.status}` });
        return;
      }

      if (text.includes('ServiceLogin') || text.includes('accounts.google.com')) {
        res.status(400).json({
          error: 'Web App đang chặn quyền truy cập. Hãy chọn "Who has access: Anyone" khi Deploy.',
        });
        return;
      }

      let message = 'Kết nối Google Apps Script thành công!';
      try {
        const json = JSON.parse(text) as { ok?: boolean; message?: string; error?: string };
        if (json.ok === false) {
          res.status(400).json({ error: json.error || 'Apps Script báo lỗi.' });
          return;
        }
        if (json.message) message = json.message;
      } catch {
        // Non-JSON 200 response still indicates reachable endpoint
      }

      const testedAt = new Date().toISOString();
      await withDbLock(async (db) => {
        db.settings.appsScriptUrl = check.normalized;
        db.settings.lastTestedAt = testedAt;
        return { db, result: true };
      });

      res.json({ ok: true, message, lastTestedAt: testedAt });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Không thể kết nối tới URL Google Apps Script.',
      });
    }
  });

  // Return JSON 404 for unknown /api routes instead of falling through to SPA HTML
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Đường dẫn API không tồn tại.' });
  });

  // Vite integration in dev vs static dist in production
  const distDir = path.resolve(process.cwd(), 'dist');
  const hasDistBuild = fsSync.existsSync(path.join(distDir, 'index.html'));
  const isDevServer =
    process.env.NODE_ENV !== 'production' &&
    process.env.npm_lifecycle_event !== 'start' &&
    !(process.env.NODE_ENV !== 'development' && hasDistBuild);

  if (isDevServer) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use('/Nhaplieu2T', express.static(distDir));
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
