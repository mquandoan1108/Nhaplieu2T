import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Copy, Send, Save } from 'lucide-react';
import { APPS_SCRIPT_TEMPLATE } from '../utils/appsScriptTemplate';

interface SheetConfigPanelProps {
  appsScriptUrl: string;
  lastTestedAt: string;
  onSaveUrl: (url: string) => Promise<void>;
  onTestUrl: (url: string) => Promise<string>;
}

export function SheetConfigPanel({
  appsScriptUrl,
  lastTestedAt,
  onSaveUrl,
  onTestUrl,
}: SheetConfigPanelProps) {
  const [urlInput, setUrlInput] = useState(appsScriptUrl);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    setUrlInput(appsScriptUrl);
  }, [appsScriptUrl]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSaving(true);
    try {
      await onSaveUrl(urlInput.trim());
      setFeedback({
        type: 'success',
        text: 'Đã lưu URL Google Apps Script. Từ nay mỗi khi lái xe bấm lưu, dữ liệu sẽ tự động gửi sang Google Sheet ngay lập tức.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể lưu URL.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setFeedback(null);
    setTesting(true);
    try {
      const msg = await onTestUrl(urlInput.trim());
      setFeedback({ type: 'success', text: msg });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Kiểm tra kết nối thất bại.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(APPS_SCRIPT_TEMPLATE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: URL Configuration & Test */}
      <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            Cấu hình kết nối Google Sheet (Real-time)
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Dán đường dẫn Web App từ Google Apps Script để hệ thống tự động ghi từng chuyến xe sang Google Sheet ngay khi lái xe bấm lưu — lái xe không cần đăng nhập Google.
          </p>
        </div>

        {feedback && (
          <div
            role="status"
            className={`flex items-start gap-2.5 p-3.5 rounded-xl border text-sm ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="apps-script-url" className="block text-sm font-medium text-slate-700 mb-1.5">
              Google Apps Script Web App URL
            </label>
            <input
              id="apps-script-url"
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
            {lastTestedAt && (
              <p className="mt-1.5 text-xs text-slate-500">
                Kiểm tra thành công gần nhất:{' '}
                <span className="font-mono text-slate-700">
                  {new Date(lastTestedAt).toLocaleString('vi-VN')}
                </span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-800 disabled:bg-slate-400 text-white text-sm font-semibold cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Đang lưu...' : 'Lưu cấu hình'}</span>
            </button>

            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !urlInput.trim()}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-800 text-sm font-medium cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{testing ? 'Đang kiểm tra...' : 'Gửi thử kiểm tra'}</span>
            </button>
          </div>
        </form>

        <div className="border-t border-slate-200 pt-5 space-y-2.5 text-sm text-slate-700">
          <h3 className="font-display font-semibold text-slate-900">
            Hướng dẫn cài đặt nhanh (1 lần duy nhất):
          </h3>
          <ol className="list-decimal list-inside space-y-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
            <li>Mở file Google Sheet bạn muốn nhận dữ liệu chuyến xe.</li>
            <li>
              Trên thanh menu, chọn <strong>Tiện ích mở rộng (Extensions)</strong> →{' '}
              <strong>Apps Script</strong>.
            </li>
            <li>
              Xóa mã mặc định và dán toàn bộ đoạn mã mẫu ở khung bên cạnh, sau đó bấm <strong>Lưu</strong>.
            </li>
            <li>
              Bấm <strong>Triển khai (Deploy)</strong> → <strong>Tạo triển khai mới (New deployment)</strong> → chọn loại <strong>Ứng dụng web (Web app)</strong>.
            </li>
            <li>
              Ở mục <strong>Ai có quyền truy cập (Who has access)</strong>, bắt buộc chọn{' '}
              <strong>Bất kỳ ai (Anyone)</strong> rồi bấm <strong>Triển khai</strong>.
            </li>
            <li>Sao chép đường dẫn Web App (`https://script.google.com/macros/s/.../exec`) dán vào ô phía trên và bấm <strong>Gửi thử kiểm tra</strong>.</li>
          </ol>
        </div>
      </div>

      {/* Right: Copyable Apps Script Code */}
      <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50">
          <div>
            <h3 className="font-display text-sm font-bold text-slate-900">
              Mã Google Apps Script mẫu (Code.gs)
            </h3>
            <p className="text-xs text-slate-500">
              Tự động tạo tiêu đề 2 tầng đúng cột Kinh doanh, Kết nối, PVĐC, BDSC, Tổng và Giờ lạnh
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopyCode}
            className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Đã sao chép' : 'Sao chép mã'}</span>
          </button>
        </div>
        <pre className="p-4 text-xs font-mono text-slate-800 bg-slate-50/50 overflow-x-auto max-h-[540px] leading-relaxed">
          <code>{APPS_SCRIPT_TEMPLATE}</code>
        </pre>
      </div>
    </div>
  );
}
