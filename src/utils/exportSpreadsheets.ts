import ExcelJS from 'exceljs';
import {
  formatMinutesToDuration,
  formatRouteLabel,
  TripRecord,
  TRIP_TYPE_LABELS,
} from '../types/fleet';

function buildRowColumns(trip: TripRecord) {
  const drivers = trip.driver2 ? `${trip.driver1} / ${trip.driver2}` : trip.driver1;
  const route = formatRouteLabel(trip.origin, trip.destination);
  const t = trip.tripType;

  return {
    startDate: trip.startDate,
    endDate: trip.endDate,
    bks: trip.bks,
    drivers,
    mcx: trip.mcx,
    route,
    servicePostOffice: trip.servicePostOffice || '',
    customerName: trip.customerName,
    tripTypeLabel: TRIP_TYPE_LABELS[t],
    kdStart: t === 'kinh_doanh' ? trip.kmStart : null,
    kdEnd: t === 'kinh_doanh' ? trip.kmEnd : null,
    kdKm: t === 'kinh_doanh' ? trip.kmTotal : 0,
    knStart: t === 'ket_noi' ? trip.kmStart : null,
    knEnd: t === 'ket_noi' ? trip.kmEnd : null,
    knKm: t === 'ket_noi' ? trip.kmTotal : 0,
    pvStart: t === 'pvdc' ? trip.kmStart : null,
    pvEnd: t === 'pvdc' ? trip.kmEnd : null,
    pvKm: t === 'pvdc' ? trip.kmTotal : 0,
    bdStart: t === 'bdsc' ? trip.kmStart : null,
    bdEnd: t === 'bdsc' ? trip.kmEnd : null,
    bdKm: t === 'bdsc' ? trip.kmTotal : 0,
    totalStart: trip.kmStart,
    totalEnd: trip.kmEnd,
    totalKm: trip.kmTotal,
    coldStart: trip.coldStart || '',
    coldEnd: trip.coldEnd || '',
    coldDuration:
      trip.tripType === 'kinh_doanh' && (trip.coldStart || trip.coldEnd)
        ? formatMinutesToDuration(trip.coldDurationMinutes)
        : '',
  };
}

export async function exportTripsToExcel(trips: TripRecord[], filename = 'nhat-ky-lo-trinh.xlsx') {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Nhật Ký Lộ Trình';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Lo trinh xe', {
    views: [{ state: 'frozen', xSplit: 5, ySplit: 2 }],
  });

  const row1 = [
    'Ngày bắt đầu',
    'Ngày kết thúc',
    'BKS',
    'Tên lái xe',
    'MCX',
    'LỘ TRÌNH GIẤY',
    'BC sử dụng',
    'MKH',
    'Loại chuyến',
    'Kinh doanh',
    '',
    '',
    'Kết nối',
    '',
    '',
    'PVĐC',
    '',
    '',
    'BDSC',
    '',
    '',
    'Tổng',
    '',
    '',
    'Giờ lạnh',
    '',
    '',
  ];

  const row2 = [
    'Ngày bắt đầu',
    'Ngày kết thúc',
    'BKS',
    'Tên lái xe',
    'MCX',
    'LỘ TRÌNH GIẤY',
    'BC sử dụng',
    'MKH',
    'Loại chuyến',
    'đầu',
    'cuối',
    'km',
    'đầu',
    'cuối',
    'km',
    'đầu',
    'cuối',
    'km',
    'đầu',
    'cuối',
    'km',
    'km đầu',
    'km cuối',
    'số km',
    'bắt đầu',
    'kết thúc',
    'tổng giờ',
  ];

  sheet.addRow(row1);
  sheet.addRow(row2);

  // Merge single columns vertically (cols 1..9)
  for (let c = 1; c <= 9; c++) {
    sheet.mergeCells(1, c, 2, c);
  }
  // Merge grouped 3-col headers
  const groupCols = [
    { start: 10, fill: 'FFFEF08A' }, // Kinh doanh (yellow)
    { start: 13, fill: 'FFBBF7D0' }, // Kết nối (green)
    { start: 16, fill: 'FFBAE6FD' }, // PVĐC (sky)
    { start: 19, fill: 'FFFECDD3' }, // BDSC (rose)
    { start: 22, fill: 'FFCBD5E1' }, // Tổng (slate)
    { start: 25, fill: 'FFE0F2FE' }, // Giờ lạnh (ice blue)
  ];

  for (const g of groupCols) {
    sheet.mergeCells(1, g.start, 1, g.start + 2);
  }

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF94A3B8' } },
    left: { style: 'thin', color: { argb: 'FF94A3B8' } },
    bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
    right: { style: 'thin', color: { argb: 'FF94A3B8' } },
  };

  for (let r = 1; r <= 2; r++) {
    const row = sheet.getRow(r);
    row.height = 24;
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = thinBorder;
      let fillColor = 'FFF1F5F9';
      if (colNumber <= 9) {
        fillColor = colNumber === 8 ? 'FF93C5FD' : 'FFFDE047';
      } else {
        const matched = groupCols.find((g) => colNumber >= g.start && colNumber <= g.start + 2);
        if (matched) fillColor = matched.fill;
      }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
    });
  }

  for (const trip of trips) {
    const c = buildRowColumns(trip);
    const dataRow = sheet.addRow([
      c.startDate,
      c.endDate,
      c.bks,
      c.drivers,
      c.mcx,
      c.route,
      c.servicePostOffice,
      c.customerName,
      c.tripTypeLabel,
      c.kdStart,
      c.kdEnd,
      c.kdKm,
      c.knStart,
      c.knEnd,
      c.knKm,
      c.pvStart,
      c.pvEnd,
      c.pvKm,
      c.bdStart,
      c.bdEnd,
      c.bdKm,
      c.totalStart,
      c.totalEnd,
      c.totalKm,
      c.coldStart,
      c.coldEnd,
      c.coldDuration,
    ]);
    dataRow.height = 20;
    dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: 'Arial', size: 10, color: { argb: 'FF0F172A' } };
      cell.border = thinBorder;
      if (colNumber >= 10 && colNumber <= 24) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (typeof cell.value === 'number') {
          cell.numFmt = '#,##0.###';
        }
      } else if (colNumber >= 25 || colNumber <= 3) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });
  }

  const widths = [
    13, 13, 13, 24, 18, 30, 13, 28, 13,
    10, 10, 9,
    10, 10, 9,
    10, 10, 9,
    10, 10, 9,
    11, 11, 10,
    12, 12, 11,
  ];
  widths.forEach((w, idx) => {
    sheet.getColumn(idx + 1).width = w;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownload(blob, filename);
}

export function exportTripsToCsv(trips: TripRecord[], filename = 'nhat-ky-lo-trinh.csv') {
  const headers = [
    'Ngày bắt đầu',
    'Ngày kết thúc',
    'BKS',
    'Tên lái xe',
    'MCX',
    'LỘ TRÌNH GIẤY',
    'BC sử dụng',
    'MKH',
    'Loại chuyến',
    'Kinh doanh đầu',
    'Kinh doanh cuối',
    'Kinh doanh km',
    'Kết nối đầu',
    'Kết nối cuối',
    'Kết nối km',
    'PVĐC đầu',
    'PVĐC cuối',
    'PVĐC km',
    'BDSC đầu',
    'BDSC cuối',
    'BDSC km',
    'Tổng km đầu',
    'Tổng km cuối',
    'Tổng số km',
    'Giờ lạnh bắt đầu',
    'Giờ lạnh kết thúc',
    'Tổng giờ lạnh',
  ];

  const escapeCell = (val: unknown) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = trips.map((trip) => {
    const c = buildRowColumns(trip);
    return [
      c.startDate,
      c.endDate,
      c.bks,
      c.drivers,
      c.mcx,
      c.route,
      c.servicePostOffice,
      c.customerName,
      c.tripTypeLabel,
      c.kdStart ?? '',
      c.kdEnd ?? '',
      c.kdKm,
      c.knStart ?? '',
      c.knEnd ?? '',
      c.knKm,
      c.pvStart ?? '',
      c.pvEnd ?? '',
      c.pvKm,
      c.bdStart ?? '',
      c.bdEnd ?? '',
      c.bdKm,
      c.totalStart,
      c.totalEnd,
      c.totalKm,
      c.coldStart,
      c.coldEnd,
      c.coldDuration,
    ]
      .map(escapeCell)
      .join(',');
  });

  // UTF-8 BOM so Excel opens Vietnamese characters cleanly
  const csvContent = '\uFEFF' + [headers.map(escapeCell).join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
