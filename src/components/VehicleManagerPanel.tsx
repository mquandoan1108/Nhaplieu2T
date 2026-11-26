import React, { useState } from 'react';
import { AlertCircle, Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Vehicle } from '../types/fleet';

interface VehicleManagerPanelProps {
  vehicles: Vehicle[];
  onAddVehicle: (payload: { bks: string; label: string; coldHourDailyQuota: number }) => Promise<void>;
  onUpdateVehicle: (
    id: string,
    payload: { bks?: string; label?: string; coldHourDailyQuota?: number; active?: boolean }
  ) => Promise<void>;
  onDeleteVehicle: (id: string) => Promise<void>;
}

export function VehicleManagerPanel({
  vehicles,
  onAddVehicle,
  onUpdateVehicle,
  onDeleteVehicle,
}: VehicleManagerPanelProps) {
  const [bks, setBks] = useState('');
  const [label, setLabel] = useState('');
  const [quota, setQuota] = useState('12');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBks, setEditBks] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [editQuota, setEditQuota] = useState('12');

  const [confirmDelete, setConfirmDelete] = useState<Vehicle | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const numQuota = Number(quota);
    if (!bks.trim()) {
      setError('Vui lòng nhập Biển kiểm soát (BKS).');
      return;
    }
    if (!Number.isFinite(numQuota) || numQuota < 0) {
      setError('Định mức giờ lạnh không hợp lệ.');
      return;
    }

    setSubmitting(true);
    try {
      await onAddVehicle({
        bks: bks.trim().toUpperCase(),
        label: label.trim() || 'Xe tải đông lạnh',
        coldHourDailyQuota: numQuota,
      });
      setBks('');
      setLabel('');
      setQuota('12');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể thêm xe.');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (v: Vehicle) => {
    setEditingId(v.id);
    setEditBks(v.bks);
    setEditLabel(v.label);
    setEditQuota(String(v.coldHourDailyQuota));
  };

  const saveEdit = async (id: string) => {
    const numQuota = Number(editQuota);
    if (!editBks.trim() || !Number.isFinite(numQuota) || numQuota < 0) return;
    await onUpdateVehicle(id, {
      bks: editBks.trim().toUpperCase(),
      label: editLabel.trim(),
      coldHourDailyQuota: numQuota,
    });
    setEditingId(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Add Vehicle Form */}
      <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
        <h2 className="font-display text-base font-bold text-slate-900">
          Thêm xe vào đội xe (BKS)
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Các xe đang hoạt động sẽ hiển thị ngay trong danh sách chọn của lái xe.
        </p>

        {error && (
          <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleAdd} className="mt-4 space-y-4">
          <div>
            <label htmlFor="new-bks" className="block text-xs font-medium text-slate-700 mb-1">
              Biển kiểm soát (BKS) <span className="text-red-600">*</span>
            </label>
            <input
              id="new-bks"
              type="text"
              value={bks}
              onChange={(e) => setBks(e.target.value.toUpperCase())}
              placeholder="Ví dụ: 29KT01765"
              required
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm font-semibold"
            />
          </div>

          <div>
            <label htmlFor="new-label" className="block text-xs font-medium text-slate-700 mb-1">
              Mô tả / Tải trọng xe
            </label>
            <input
              id="new-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ví dụ: Xe tải lạnh 2.5 tấn"
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label htmlFor="new-quota" className="block text-xs font-medium text-slate-700 mb-1">
              Định mức giờ lạnh (giờ / ngày)
            </label>
            <input
              id="new-quota"
              type="number"
              min="0"
              max="240"
              step="0.5"
              value={quota}
              onChange={(e) => setQuota(e.target.value)}
              required
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm tabular-nums"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-800 disabled:bg-slate-400 text-white text-sm font-semibold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{submitting ? 'Đang thêm...' : 'Thêm xe mới'}</span>
          </button>
        </form>
      </div>

      {/* Vehicle List Table */}
      <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-slate-900">
            Danh sách đội xe ({vehicles.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
                <th className="px-4 py-3">BKS</th>
                <th className="px-4 py-3">Loại xe / Ghi chú</th>
                <th className="px-4 py-3 text-right">Định mức giờ lạnh/ngày</th>
                <th className="px-4 py-3 text-center">Trạng thái</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {vehicles.map((v) => {
                const isEditing = editingId === v.id;
                return (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editBks}
                          onChange={(e) => setEditBks(e.target.value.toUpperCase())}
                          className="w-28 px-2 py-1 rounded border border-slate-300 font-mono text-sm"
                        />
                      ) : (
                        v.bks
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          className="w-48 px-2 py-1 rounded border border-slate-300 text-sm"
                        />
                      ) : (
                        v.label || '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-sky-900 font-semibold">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={editQuota}
                          onChange={(e) => setEditQuota(e.target.value)}
                          className="w-20 px-2 py-1 rounded border border-slate-300 font-mono text-sm text-right"
                        />
                      ) : (
                        `${v.coldHourDailyQuota} giờ`
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => onUpdateVehicle(v.id, { active: !v.active })}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                          v.active
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {v.active ? 'Đang hoạt động' : 'Tạm ngưng'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => saveEdit(v.id)}
                              aria-label="Lưu sửa xe"
                              className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              aria-label="Hủy sửa xe"
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(v)}
                              aria-label={`Sửa xe ${v.bks}`}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-sky-700 hover:bg-sky-50 cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(v)}
                              aria-label={`Xóa xe ${v.bks}`}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {confirmDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-xl">
            <h3 className="font-display text-lg font-bold text-slate-900">Xác nhận xóa xe?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Bạn chắc chắn muốn xóa biển số <span className="font-mono font-bold">{confirmDelete.bks}</span> khỏi danh sách đội xe? Các chuyến đã lưu trước đó vẫn được giữ nguyên.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = confirmDelete;
                  setConfirmDelete(null);
                  await onDeleteVehicle(target.id);
                }}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold cursor-pointer"
              >
                Xóa xe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
