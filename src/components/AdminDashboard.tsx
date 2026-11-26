import { useCallback, useEffect, useState } from 'react';
import { BarChart3, FileSpreadsheet, Settings, Truck } from 'lucide-react';
import {
  adminAddVehicle,
  adminDeleteTrip,
  adminDeleteVehicle,
  adminSaveSheetUrl,
  adminSyncPendingTrips,
  adminSyncTrip,
  adminTestSheetUrl,
  adminUpdateTrip,
  adminUpdateVehicle,
  loadAdminDashboardData,
} from '../utils/backendClient';
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

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErrorBanner(null);
    try {
      const data = await loadAdminDashboardData(token, onSessionExpired);
      setTrips(data.trips);
      setVehicles(data.vehicles);
      setAppsScriptUrl(data.appsScriptUrl);
      setLastTestedAt(data.lastTestedAt);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Không thể tải dữ liệu quản lý.');
    } finally {
      setLoading(false);
    }
  }, [token, onSessionExpired]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleUpdateTrip = async (tripId: string, payload: Record<string, unknown>) => {
    const updated = await adminUpdateTrip(token, tripId, payload, onSessionExpired);
    setTrips((prev) => prev.map((t) => (t.id === tripId ? updated : t)));
  };

  const handleDeleteTrip = async (tripId: string) => {
    await adminDeleteTrip(token, tripId, onSessionExpired);
    setTrips((prev) => prev.filter((t) => t.id !== tripId));
  };

  const handleSyncTrip = async (tripId: string) => {
    try {
      const updated = await adminSyncTrip(token, tripId, onSessionExpired);
      setTrips((prev) => prev.map((t) => (t.id === tripId ? updated : t)));
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Đồng bộ Google Sheet thất bại.');
    }
  };

  const handleSyncPending = async () => {
    try {
      const updatedTrips = await adminSyncPendingTrips(token, onSessionExpired);
      setTrips(updatedTrips);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Đồng bộ hàng loạt thất bại.');
    }
  };

  const handleAddVehicle = async (payload: {
    bks: string;
    label: string;
    coldHourDailyQuota: number;
  }) => {
    const added = await adminAddVehicle(token, payload, onSessionExpired);
    setVehicles((prev) => [...prev, added]);
  };

  const handleUpdateVehicle = async (
    id: string,
    payload: { bks?: string; label?: string; coldHourDailyQuota?: number; active?: boolean }
  ) => {
    const updated = await adminUpdateVehicle(token, id, payload, onSessionExpired);
    setVehicles((prev) => prev.map((v) => (v.id === id ? updated : v)));
  };

  const handleDeleteVehicle = async (id: string) => {
    await adminDeleteVehicle(token, id, onSessionExpired);
    setVehicles((prev) => prev.filter((v) => v.id !== id));
  };

  const handleSaveSheetUrl = async (url: string) => {
    const savedUrl = await adminSaveSheetUrl(token, url, onSessionExpired);
    setAppsScriptUrl(savedUrl);
  };

  const handleTestSheetUrl = async (url: string): Promise<string> => {
    const res = await adminTestSheetUrl(token, url, onSessionExpired);
    setAppsScriptUrl(url);
    if (res.lastTestedAt) setLastTestedAt(res.lastTestedAt);
    return res.message;
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
