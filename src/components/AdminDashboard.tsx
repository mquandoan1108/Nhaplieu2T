import { useCallback, useEffect, useState } from 'react';
import { BarChart3, FileSpreadsheet, Settings, Truck } from 'lucide-react';
import { safeParseJson, getApiFailureMessage } from '../utils/safeFetchJson';
import { TripRecord, Vehicle } from '../types/fleet';
import { AppRoute } from './TopBar';
import { TripSheetTable } from './TripSheetTable';
import { FleetAnalyticsPanel } from './FleetAnalyticsPanel';
import { VehicleManagerPanel } from './VehicleManagerPanel';
import { SheetConfigPanel } from './SheetConfigPanel';

interface AdminDashboardProps {
  token: string;
  activeTab: Exclude<AppRoute, 'driver'>;
  onChangeTab: (tab: Exclude<AppRoute, 'driver'>) => void;
  onSessionExpired: () => void;
}

export function AdminDashboard({
  token,
  activeTab,
  onChangeTab,
  onSessionExpired,
}: AdminDashboardProps) {
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [appsScriptUrl, setAppsScriptUrl] = useState('');
  const [lastTestedAt, setLastTestedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
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
    },
    [token, onSessionExpired]
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErrorBanner(null);
    try {
      const [tripsRes, vehiclesRes, settingsRes] = await Promise.all([
        authFetch('/api/admin/trips'),
        authFetch('/api/admin/vehicles'),
        authFetch('/api/admin/settings/sheet'),
      ]);

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

      setTrips(Array.isArray(tripsData?.trips) ? tripsData.trips : []);
      setVehicles(Array.isArray(vehiclesData?.vehicles) ? vehiclesData.vehicles : []);
      setAppsScriptUrl(settingsData?.appsScriptUrl || '');
      setLastTestedAt(settingsData?.lastTestedAt || '');
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Không thể tải dữ liệu quản lý.');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleUpdateTrip = async (tripId: string, payload: Record<string, unknown>) => {
    const res = await authFetch(`/api/admin/trips/${tripId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { trip?: TripRecord; error?: string };
    if (!res.ok || !data.trip) {
      throw new Error(data.error || 'Không thể cập nhật chuyến xe.');
    }
    setTrips((prev) => prev.map((t) => (t.id === tripId ? data.trip! : t)));
  };

  const handleDeleteTrip = async (tripId: string) => {
    const res = await authFetch(`/api/admin/trips/${tripId}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      throw new Error(data.error || 'Không thể xóa chuyến xe.');
    }
    setTrips((prev) => prev.filter((t) => t.id !== tripId));
  };

  const handleSyncTrip = async (tripId: string) => {
    const res = await authFetch(`/api/admin/trips/${tripId}/sync`, { method: 'POST' });
    const data = (await res.json()) as { trip?: TripRecord; error?: string };
    if (!res.ok || !data.trip) {
      setErrorBanner(data.error || 'Đồng bộ Google Sheet thất bại.');
      return;
    }
    setTrips((prev) => prev.map((t) => (t.id === tripId ? data.trip! : t)));
  };

  const handleSyncPending = async () => {
    const res = await authFetch('/api/admin/trips/sync-pending', { method: 'POST' });
    const data = (await res.json()) as { trips?: TripRecord[]; error?: string };
    if (!res.ok) {
      setErrorBanner(data.error || 'Đồng bộ hàng loạt thất bại.');
      return;
    }
    if (Array.isArray(data.trips)) {
      setTrips(data.trips);
    }
  };

  const handleAddVehicle = async (payload: {
    bks: string;
    label: string;
    coldHourDailyQuota: number;
  }) => {
    const res = await authFetch('/api/admin/vehicles', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { vehicle?: Vehicle; error?: string };
    if (!res.ok || !data.vehicle) {
      throw new Error(data.error || 'Không thể thêm xe.');
    }
    setVehicles((prev) => [...prev, data.vehicle!]);
  };

  const handleUpdateVehicle = async (
    id: string,
    payload: { bks?: string; label?: string; coldHourDailyQuota?: number; active?: boolean }
  ) => {
    const res = await authFetch(`/api/admin/vehicles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { vehicle?: Vehicle; error?: string };
    if (!res.ok || !data.vehicle) {
      throw new Error(data.error || 'Không thể cập nhật xe.');
    }
    setVehicles((prev) => prev.map((v) => (v.id === id ? data.vehicle! : v)));
  };

  const handleDeleteVehicle = async (id: string) => {
    const res = await authFetch(`/api/admin/vehicles/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      throw new Error(data.error || 'Không thể xóa xe.');
    }
    setVehicles((prev) => prev.filter((v) => v.id !== id));
  };

  const handleSaveSheetUrl = async (url: string) => {
    const res = await authFetch('/api/admin/settings/sheet', {
      method: 'PUT',
      body: JSON.stringify({ appsScriptUrl: url }),
    });
    const data = (await res.json()) as { appsScriptUrl?: string; error?: string };
    if (!res.ok) {
      throw new Error(data.error || 'Không thể lưu URL.');
    }
    setAppsScriptUrl(data.appsScriptUrl || '');
  };

  const handleTestSheetUrl = async (url: string): Promise<string> => {
    const res = await authFetch('/api/admin/settings/sheet/test', {
      method: 'POST',
      body: JSON.stringify({ appsScriptUrl: url }),
    });
    const data = (await res.json()) as { message?: string; lastTestedAt?: string; error?: string };
    if (!res.ok) {
      throw new Error(data.error || 'Kiểm tra kết nối thất bại.');
    }
    setAppsScriptUrl(url);
    if (data.lastTestedAt) setLastTestedAt(data.lastTestedAt);
    return data.message || 'Kết nối thành công!';
  };

  const tabs: Array<{ id: Exclude<AppRoute, 'driver'>; label: string; icon: typeof FileSpreadsheet }> = [
    { id: 'sheet', label: 'Bảng tổng hợp & Sheet', icon: FileSpreadsheet },
    { id: 'analytics', label: 'Thống kê Km & Lạnh', icon: BarChart3 },
    { id: 'vehicles', label: 'Đội xe (BKS)', icon: Truck },
    { id: 'settings', label: 'Kết nối Google Sheet', icon: Settings },
  ];

  return (
    <section className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Mobile/Tablet quick switcher for Admin Tabs */}
      <div className="md:hidden grid grid-cols-2 gap-2 p-1 bg-slate-200/70 rounded-xl">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeTab(tab.id)}
              className={`min-h-[42px] px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer ${
                active ? 'bg-white text-slate-900 font-semibold shadow-sm' : 'text-slate-600'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {errorBanner && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-900 flex items-center justify-between gap-4">
          <span>{errorBanner}</span>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            className="text-xs font-semibold underline cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {activeTab === 'sheet' && (
        <TripSheetTable
          trips={trips}
          vehicles={vehicles}
          loading={loading}
          onUpdateTrip={handleUpdateTrip}
          onDeleteTrip={handleDeleteTrip}
          onSyncTrip={handleSyncTrip}
          onSyncPending={handleSyncPending}
          onOpenSettings={() => onChangeTab('settings')}
        />
      )}

      {activeTab === 'analytics' && (
        <FleetAnalyticsPanel trips={trips} vehicles={vehicles} />
      )}

      {activeTab === 'vehicles' && (
        <VehicleManagerPanel
          vehicles={vehicles}
          onAddVehicle={handleAddVehicle}
          onUpdateVehicle={handleUpdateVehicle}
          onDeleteVehicle={handleDeleteVehicle}
        />
      )}

      {activeTab === 'settings' && (
        <SheetConfigPanel
          appsScriptUrl={appsScriptUrl}
          lastTestedAt={lastTestedAt}
          onSaveUrl={handleSaveSheetUrl}
          onTestUrl={handleTestSheetUrl}
        />
      )}
    </section>
  );
}
