export const APPS_SCRIPT_TEMPLATE = `/**
 * Google Apps Script — Nhật Ký Lộ Trình (Km & Giờ Lạnh)
 * Dán đoạn mã này vào Extensions -> Apps Script trong Google Sheet của bạn,
 * sau đó chọn Deploy -> New deployment -> Web app (Who has access: Anyone).
 */
function doPost(e) {
  try {
    var lock = LockService.getScriptLock();
    lock.waitLock(15000);

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheets()[0];
    var data = JSON.parse(e.postData.contents);

    if (data && data.action === 'ping') {
      lock.releaseLock();
      return ContentService.createTextOutput(
        JSON.stringify({ ok: true, message: 'Ket noi thanh cong toi Google Sheet: ' + ss.getName() })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    ensureHeaders_(sheet);

    var driverDisplay = data.driver2
      ? data.driver1 + ' / ' + data.driver2
      : data.driver1;

    var routeText = (data.origin || '') + ' - ' + (data.destination || '');
    var t = data.tripType;

    var kdStart = t === 'kinh_doanh' ? data.kmStart : '';
    var kdEnd   = t === 'kinh_doanh' ? data.kmEnd   : '';
    var kdTotal = t === 'kinh_doanh' ? data.kmTotal : 0;

    var knStart = t === 'ket_noi' ? data.kmStart : '';
    var knEnd   = t === 'ket_noi' ? data.kmEnd   : '';
    var knTotal = t === 'ket_noi' ? data.kmTotal : 0;

    var pvStart = t === 'pvdc' ? data.kmStart : '';
    var pvEnd   = t === 'pvdc' ? data.kmEnd   : '';
    var pvTotal = t === 'pvdc' ? data.kmTotal : 0;

    var bdStart = t === 'bdsc' ? data.kmStart : '';
    var bdEnd   = t === 'bdsc' ? data.kmEnd   : '';
    var bdTotal = t === 'bdsc' ? data.kmTotal : 0;

    var rowValues = [
      data.id || '',
      data.startDate || '',
      data.endDate || '',
      data.bks || '',
      driverDisplay,
      data.mcx || '',
      routeText,
      data.servicePostOffice || '',
      data.customerName || '',
      kdStart, kdEnd, kdTotal,
      knStart, knEnd, knTotal,
      pvStart, pvEnd, pvTotal,
      bdStart, bdEnd, bdTotal,
      data.kmStart, data.kmEnd, data.kmTotal,
      data.coldStart || '',
      data.coldEnd || '',
      data.coldDurationFormatted || ''
    ];

    // Nếu đã tồn tại ID chuyến xe (khi điều hành sửa), cập nhật tại dòng đó; ngược lại nối dòng mới
    var lastRow = sheet.getLastRow();
    var updated = false;
    if (data.id && lastRow >= 3) {
      var idCol = sheet.getRange(3, 1, lastRow - 2, 1).getValues();
      for (var i = 0; i < idCol.length; i++) {
        if (String(idCol[i][0]) === String(data.id)) {
          sheet.getRange(i + 3, 1, 1, rowValues.length).setValues([rowValues]);
          updated = true;
          break;
        }
      }
    }

    if (!updated) {
      sheet.appendRow(rowValues);
    }

    lock.releaseLock();
    return ContentService.createTextOutput(
      JSON.stringify({ ok: true, updated: updated })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, error: String(err) })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() >= 2) return;
  sheet.clear();

  var row1 = [
    'ID', 'Ngày bắt đầu', 'Ngày kết thúc', 'BKS', 'Tên lái xe', 'MCX',
    'LỘ TRÌNH GIẤY', 'BC sử dụng', 'MKH',
    'Kinh doanh', '', '',
    'Kết nối', '', '',
    'PVĐC', '', '',
    'BDSC', '', '',
    'Tổng', '', '',
    'Giờ lạnh', '', ''
  ];
  var row2 = [
    'ID', 'Ngày bắt đầu', 'Ngày kết thúc', 'BKS', 'Tên lái xe', 'MCX',
    'LỘ TRÌNH GIẤY', 'BC sử dụng', 'MKH',
    'đầu', 'cuối', 'km',
    'đầu', 'cuối', 'km',
    'đầu', 'cuối', 'km',
    'đầu', 'cuối', 'km',
    'km đầu', 'km cuối', 'số km',
    'bắt đầu', 'kết thúc', 'tổng giờ'
  ];

  sheet.getRange(1, 1, 1, row1.length).setValues([row1]);
  sheet.getRange(2, 1, 1, row2.length).setValues([row2]);

  for (var col = 1; col <= 9; col++) {
    sheet.getRange(1, col, 2, 1).merge();
  }
  var groupStarts = [10, 13, 16, 19, 22, 25];
  groupStarts.forEach(function(startCol) {
    sheet.getRange(1, startCol, 1, 3).merge();
  });

  sheet.getRange(1, 1, 2, row1.length)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.setFrozenRows(2);
  sheet.hideColumns(1);
}
`;
