import { LogIn, LogOut } from 'lucide-react';

export type AppRoute = 'driver' | 'sheet' | 'analytics' | 'vehicles' | 'settings';

interface TopBarProps {
  activeRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  adminUsername: string | null;
  onOpenLogin: () => void;
  onLogout: () => void;
}

const ADMIN_NAV_ITEMS: Array<{ id: AppRoute; label: string }> = [
  { id: 'driver', label: 'Nhập chuyến' },
  { id: 'sheet', label: 'Bảng tổng hợp' },
  { id: 'analytics', label: 'Thống kê' },
  { id: 'vehicles', label: 'Đội xe (BKS)' },
  { id: 'settings', label: 'Google Sheet' },
];

export function TopBar({
  activeRoute,
  onNavigate,
  adminUsername,
  onOpenLogin,
  onLogout,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 h-14 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-[1440px] mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4 sm:gap-8">
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => onNavigate('driver')}
            className="font-display text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 rounded leading-tight"
          >
            Nhật Ký Lộ Trình
          </button>
          <span className="hidden sm:inline text-slate-300 select-none" aria-hidden="true">
            ·
          </span>
          <span className="text-[11px] sm:text-xs font-medium text-emerald-700 tracking-tight whitespace-nowrap truncate">
            Phát triển bởi <span className="font-semibold text-emerald-800">Minh Quan Doan</span>
          </span>
        </div>

        {adminUsername ? (
          <nav
            aria-label="Điều hướng chính"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 overflow-x-auto"
          >
            {ADMIN_NAV_ITEMS.map((item) => {
              const isActive = activeRoute === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 ${
                    isActive
                      ? 'border-sky-700 text-slate-900 font-semibold'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        ) : (
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <span className="text-slate-900 font-semibold border-b-2 border-sky-700 py-1.5 whitespace-nowrap shrink-0">
              Phiếu nhập lộ trình lái xe
            </span>
          </div>
        )}

        <div className="flex items-center shrink-0">
          {adminUsername ? (
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-2 min-h-[40px] px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
            >
              <LogOut className="w-4 h-4 text-slate-600" aria-hidden="true" />
              <span>Đăng xuất ({adminUsername})</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenLogin}
              className="inline-flex items-center gap-2 min-h-[40px] px-4 py-2 text-xs sm:text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
            >
              <LogIn className="w-4 h-4" aria-hidden="true" />
              <span>Quản lý đội xe</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
