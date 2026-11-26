export async function safeParseJson<T>(response: Response): Promise<T | null> {
  try {
    const text = await response.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function getApiFailureMessage(status: number, parsedError?: string, fallback = 'Không thể xử lý yêu cầu.'): string {
  if (parsedError) return parsedError;
  if (status === 404 || status === 405) {
    return `Đường dẫn này đang chạy bản xem trước tĩnh không có máy chủ xử lý (HTTP ${status}). Vui lòng mở bằng Dev URL hoặc triển khai (Deploy) lên Cloud Run để lưu chuyến và gửi Google Sheet.`;
  }
  if (status >= 500) {
    return `Máy chủ đang khởi động lại hoặc gặp sự cố (HTTP ${status}). Vui lòng thử lại sau vài giây.`;
  }
  return `${fallback} (HTTP ${status})`;
}
