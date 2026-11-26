// Shared In-Room Dining order endpoint for the ordering app and restaurant KDS.
// Deploy as a new version of the existing Apps Script web app.

const SHEET_GID = 1306309405;
const HEADERS = [
  'Timestamp', 'เวลา', 'Room', 'ชื่อ', 'Menu Details', 'จำนวน',
  'Price', 'Status', 'Payment', 'Order ID', 'Cancel Reason'
];
const CANCEL_REASON_OPTIONS = ['เกินกำหนดเวลาชำระเงิน'];
const PAYMENT_TIMEOUT_MS = 60 * 60 * 1000;
const DAILY_SALES_TIMEZONE = 'Asia/Bangkok';
const DAILY_CLOSING_SHEET_NAME = 'Daily Sales Closing';
const DAILY_CLOSING_HEADERS = [
  'Date', 'Closed At', 'Completed Orders', 'Sales Total',
  'Payment Totals JSON', 'Pending Orders', 'Cancelled Orders', 'Orders Missing Price'
];
const KDS_ITEM_CANCEL_REASON = 'ยกเลิกจากหน้าจอ KDS';
const KDS_ACTION_TOKEN_PROPERTY = 'KDS_ACTION_TOKEN';

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheets().find(s => s.getSheetId() === SHEET_GID);
  if (!sheet) throw new Error('Orders sheet gid ' + SHEET_GID + ' was not found');
  ensureOrderColumns_(sheet);
  return sheet;
}

function getDailySalesClosingSheet_(create) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(DAILY_CLOSING_SHEET_NAME);
  if (!sheet && create) {
    sheet = ss.insertSheet(DAILY_CLOSING_SHEET_NAME);
  }
  if (sheet && sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, DAILY_CLOSING_HEADERS.length).setValues([DAILY_CLOSING_HEADERS]);
  }
  return sheet;
}

function dateKey_(value, timezone) {
  const timestamp = timestampMs_(value);
  return timestamp == null ? '' : Utilities.formatDate(new Date(timestamp), timezone, 'yyyy-MM-dd');
}

function todayDateKey_() {
  return Utilities.formatDate(new Date(), DAILY_SALES_TIMEZONE, 'yyyy-MM-dd');
}

function validDateKey_(value) {
  const date = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(date + 'T00:00:00Z');
  return !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function dailyClosingRecord_(date) {
  const sheet = getDailySalesClosingSheet_(false);
  if (!sheet || sheet.getLastRow() < 2) return null;
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0] || '') === date) {
      return {
        closedAt: rows[i][1] instanceof Date ? rows[i][1].toISOString() : String(rows[i][1] || ''),
        completedOrderCount: Number(rows[i][2]) || 0,
        totalSales: Number(rows[i][3]) || 0,
        paymentTotals: JSON.parse(String(rows[i][4] || '{}')),
        pendingOrderCount: Number(rows[i][5]) || 0,
        cancelledOrderCount: Number(rows[i][6]) || 0,
        ordersWithoutAmount: Number(rows[i][7]) || 0
      };
    }
  }
  return null;
}

function moneyNumber_(value) {
  if (typeof value === 'number') return isFinite(value) ? value : null;
  const normalized = String(value == null ? '' : value).replace(/,/g, '').replace(/[^\d.-]/g, '');
  if (!normalized) return null;
  const amount = Number(normalized);
  return isFinite(amount) ? amount : null;
}

function dailySalesSummary_(sheet, date) {
  if (!validDateKey_(date)) throw new Error('Date must be YYYY-MM-DD');
  const map = headerMap_(sheet);
  const data = sheet.getDataRange().getValues();
  const timezone = DAILY_SALES_TIMEZONE;
  const grouped = Object.create(null);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!String(row[map.menu] || '').trim() || dateKey_(row[map.timestamp], timezone) !== date) continue;
    const orderId = map.orderId == null ? '' : String(row[map.orderId] || '');
    const key = orderId || 'legacy-row-' + (i + 1);
    let order = grouped[key];
    if (!order) {
      order = grouped[key] = { statuses: [], price: null, payment: '' };
    }
    order.statuses.push(String(row[map.status] || '').trim().toLowerCase());
    if (order.price == null && map.price != null && row[map.price] !== '') {
      order.price = moneyNumber_(row[map.price]);
    }
    if (!order.payment && map.payment != null) order.payment = String(row[map.payment] || '').trim();
  }

  const summary = {
    date: date,
    completedOrderCount: 0,
    pendingOrderCount: 0,
    cancelledOrderCount: 0,
    ordersWithoutAmount: 0,
    totalSales: 0,
    paymentTotals: {},
    closed: false,
    closedAt: ''
  };
  Object.keys(grouped).forEach(key => {
    const order = grouped[key];
    const activeStatuses = order.statuses.filter(status => status !== 'cancelled');
    if (!activeStatuses.length) {
      summary.cancelledOrderCount++;
      return;
    }
    if (!activeStatuses.every(status => status === 'completed')) {
      summary.pendingOrderCount++;
      return;
    }

    summary.completedOrderCount++;
    if (order.price == null) {
      summary.ordersWithoutAmount++;
      return;
    }
    summary.totalSales += order.price;
    const payment = order.payment || 'ไม่ระบุ';
    summary.paymentTotals[payment] = (summary.paymentTotals[payment] || 0) + order.price;
  });
  summary.totalSales = Math.round(summary.totalSales * 100) / 100;

  const record = dailyClosingRecord_(date);
  if (record) {
    summary.completedOrderCount = record.completedOrderCount;
    summary.totalSales = record.totalSales;
    summary.paymentTotals = record.paymentTotals;
    summary.pendingOrderCount = record.pendingOrderCount;
    summary.cancelledOrderCount = record.cancelledOrderCount;
    summary.ordersWithoutAmount = record.ordersWithoutAmount;
    summary.closed = true;
    summary.closedAt = record.closedAt;
  }
  return summary;
}

function closeDailySales_(sheet, data) {
  const date = String(data.date || '');
  if (!validDateKey_(date)) throw new Error('Date must be YYYY-MM-DD');
  if (date !== todayDateKey_()) throw new Error('Only today sales can be closed');

  const existing = dailyClosingRecord_(date);
  if (existing) {
    const summary = dailySalesSummary_(sheet, date);
    summary.alreadyClosed = true;
    return json({ status: 'success', summary: summary });
  }

  const summary = dailySalesSummary_(sheet, date);
  if (summary.pendingOrderCount > 0) {
    throw new Error('Cannot close sales while ' + summary.pendingOrderCount + ' order(s) are still pending');
  }
  if (summary.ordersWithoutAmount > 0) {
    throw new Error('Cannot close sales: ' + summary.ordersWithoutAmount + ' completed order(s) have no valid price');
  }

  const closingSheet = getDailySalesClosingSheet_(true);
  closingSheet.appendRow([
    date, new Date(), summary.completedOrderCount, summary.totalSales,
    JSON.stringify(summary.paymentTotals), summary.pendingOrderCount,
    summary.cancelledOrderCount, summary.ordersWithoutAmount
  ]);
  summary.closed = true;
  summary.closedAt = new Date().toISOString();
  summary.alreadyClosed = false;
  return json({ status: 'success', summary: summary });
}

function headerKey_(value) {
  const compact = String(value || '').trim().toLowerCase().replace(/[\s_-]/g, '');
  const aliases = {
    timestamp: 'timestamp', time: 'time', 'เวลา': 'time',
    room: 'room', name: 'name', guest: 'name', 'ชื่อ': 'name',
    menu: 'menu', menudetails: 'menu',
    quantity: 'quantity', qty: 'quantity', 'จำนวน': 'quantity',
    price: 'price', totalprice: 'price',
    status: 'status',
    payment: 'payment', paymentmethod: 'payment', 'ช่องทางชำระเงิน': 'payment',
    orderid: 'orderId', cancelreason: 'cancelReason'
  };
  return aliases[compact] || compact;
}

function headerMap_(sheet) {
  const width = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, width).getDisplayValues()[0];
  const map = {};
  headers.forEach((value, i) => {
    const key = headerKey_(value);
    if (key && map[key] == null) map[key] = i;
  });
  return map;
}

function ensureColumnAfter_(sheet, anchorKey, key, label) {
  let map = headerMap_(sheet);
  if (map[key] != null) {
    sheet.getRange(1, map[key] + 1).setValue(label);
    return;
  }
  const anchor = map[anchorKey];
  const after = anchor == null ? sheet.getLastColumn() : anchor + 1;
  sheet.insertColumnAfter(Math.max(after, 1));
  sheet.getRange(1, after + 1).setValue(label);
}

function ensureOrderColumns_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    return;
  }

  ensureColumnAfter_(sheet, 'timestamp', 'timestamp', 'Timestamp');
  ensureColumnAfter_(sheet, 'timestamp', 'time', 'เวลา');
  ensureColumnAfter_(sheet, 'room', 'room', 'Room');
  ensureColumnAfter_(sheet, 'room', 'name', 'ชื่อ');
  ensureColumnAfter_(sheet, 'menu', 'menu', 'Menu Details');
  ensureColumnAfter_(sheet, 'menu', 'quantity', 'จำนวน');
  ['price', 'status', 'payment', 'orderId', 'cancelReason'].forEach(key => {
    const labels = {
      price: 'Price', status: 'Status', payment: 'Payment',
      orderId: 'Order ID', cancelReason: 'Cancel Reason'
    };
    const map = headerMap_(sheet);
    if (map[key] == null) {
      const after = sheet.getLastColumn();
      sheet.insertColumnAfter(Math.max(after, 1));
      sheet.getRange(1, after + 1).setValue(labels[key]);
    } else {
      sheet.getRange(1, map[key] + 1).setValue(labels[key]);
    }
  });
}

function formatTime_(value, timezone) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, timezone, 'HH:mm');
  }
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? '' : Utilities.formatDate(parsed, timezone, 'HH:mm');
}

function timestampMs_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value.getTime();
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function isOverduePending_(status, timestamp, nowMs) {
  const created = timestampMs_(timestamp);
  return String(status || '').trim().toLowerCase() === 'pending'
    && created != null && nowMs - created >= PAYMENT_TIMEOUT_MS;
}

function orderItems_(data) {
  if (Array.isArray(data.items) && data.items.length) {
    return data.items.map(item => {
      const name = String(item && (item.name || item.menu) || '').trim();
      const quantity = Number(item && (item.quantity == null ? item.qty : item.quantity));
      if (!name || !Number.isInteger(quantity) || quantity < 1) {
        throw new Error('Each item needs a name and a positive whole-number quantity');
      }
      const note = String(item.note || '').trim();
      return { name: name + (note ? ' [' + note + ']' : ''), quantity: quantity };
    });
  }
  const menu = String(data.menu || '').trim();
  if (!menu) throw new Error('Order menu is required');
  return [{ name: menu, quantity: '' }];
}

function appendOrder_(sheet, data) {
  if (dailyClosingRecord_(todayDateKey_())) {
    throw new Error('Sales for today are closed; new orders are not being accepted');
  }
  const items = orderItems_(data);
  const map = headerMap_(sheet);
  const orderId = String(data.orderId || Utilities.getUuid());
  const existing = sheet.getDataRange().getValues();
  if (map.orderId != null && existing.slice(1).some(row => String(row[map.orderId] || '') === orderId)) {
    return json({ status: 'success', orderId: orderId, duplicate: true });
  }

  const now = new Date();
  const timezone = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const room = String(data.roomNumber || data.room || '').trim();
  const name = String(data.name || '').trim();
  if (!room) throw new Error('Room is required');

  items.forEach((item, index) => {
    const row = new Array(sheet.getLastColumn()).fill('');
    row[map.timestamp] = now;
    row[map.time] = Utilities.formatDate(now, timezone, 'HH:mm');
    row[map.room] = room;
    row[map.name] = name;
    row[map.menu] = item.name;
    row[map.quantity] = item.quantity;
    row[map.price] = index === 0 ? (data.price == null ? '' : data.price) : '';
    row[map.status] = 'Pending';
    row[map.payment] = String(data.payment || data.paymentMethod || '');
    row[map.orderId] = orderId;
    row[map.cancelReason] = '';
    sheet.appendRow(row);
  });
  return json({ status: 'success', orderId: orderId });
}

function getOrders_(sheet) {
  const data = sheet.getDataRange().getValues();
  const display = sheet.getDataRange().getDisplayValues();
  const map = headerMap_(sheet);
  const timezone = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const nowMs = Date.now();
  const grouped = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i], shown = display[i];
    if (!String(shown[map.menu] || '').trim()) continue;
    const orderId = map.orderId == null ? '' : String(row[map.orderId] || '');
    const key = orderId || 'legacy-row-' + (i + 1);
    let order = grouped[key];
    if (!order) {
      const timestamp = row[map.timestamp];
      order = grouped[key] = {
        orderId: orderId,
        timestamp: shown[map.timestamp] || '',
        createdAt: timestampMs_(timestamp) == null ? '' : new Date(timestampMs_(timestamp)).toISOString(),
        time: map.time == null ? formatTime_(timestamp, timezone) : shown[map.time],
        room: shown[map.room] || '',
        name: map.name == null ? '' : shown[map.name],
        price: shown[map.price] || '',
        status: shown[map.status] || '',
        payment: map.payment == null ? '' : shown[map.payment],
        cancelReason: map.cancelReason == null ? '' : shown[map.cancelReason],
        rowIndex: i + 1,
        rowIndexes: [],
        items: []
      };
    }
    const rawQuantity = map.quantity == null ? '' : row[map.quantity];
    const quantity = rawQuantity === '' ? '' : Number(rawQuantity);
    const item = {
      name: shown[map.menu],
      quantity: quantity,
      rowIndex: i + 1,
      status: String(row[map.status] || '').trim(),
      cancelReason: map.cancelReason == null ? '' : String(row[map.cancelReason] || '')
    };
    order.items.push(item);
    order.rowIndexes.push(i + 1);
    order.menu = order.items.map(entry =>
      entry.name + (entry.quantity ? ' (x' + entry.quantity + ')' : '')
    ).join('\n');
    if (!order.price && shown[map.price]) order.price = shown[map.price];
    if (!order.payment && map.payment != null) order.payment = shown[map.payment] || '';
  }

  const orders = Object.keys(grouped).map(key => {
    const order = grouped[key];
    const activeItems = order.items.filter(item => item.status.toLowerCase() !== 'cancelled');
    order.status = activeItems.length
      ? activeItems[0].status
      : 'Cancelled';
    order.menu = order.items.map(entry =>
      entry.name + (entry.quantity ? ' (x' + entry.quantity + ')' : '')
    ).join('\n');
    order.overdue = isOverduePending_(order.status, order.createdAt || order.timestamp, nowMs);
    order.canCancel = order.overdue;
    order.cancelReasonOptions = order.canCancel ? CANCEL_REASON_OPTIONS : [];
    return order;
  });
  return json({
    status: 'success',
    orders: orders,
    cancelReasonOptions: CANCEL_REASON_OPTIONS
  });
}

function updateStatus_(sheet, data) {
  const map = headerMap_(sheet);
  const orderId = String(data.orderId || '');
  let rowIndexes = [];
  if (orderId && map.orderId != null) {
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][map.orderId] || '') === orderId) rowIndexes.push(i + 1);
    }
  } else {
    const rowIndex = Number(data.rowIndex);
    if (Number.isInteger(rowIndex) && rowIndex >= 2 && rowIndex <= sheet.getLastRow()) {
      rowIndexes = [rowIndex];
      if (map.orderId != null) {
        const rowOrderId = String(sheet.getRange(rowIndex, map.orderId + 1).getValue() || '');
        if (rowOrderId) {
          const rows = sheet.getDataRange().getValues();
          rowIndexes = [];
          for (let i = 1; i < rows.length; i++) {
            if (String(rows[i][map.orderId] || '') === rowOrderId) rowIndexes.push(i + 1);
          }
        }
      }
    }
  }
  if (!rowIndexes.length) throw new Error('Order was not found');

  const status = String(data.status || '').trim();
  if (!status) throw new Error('Status is required');
  if (status.toLowerCase() === 'cancelled') {
    const reason = String(data.reason || data.cancelReason || '').trim();
    if (CANCEL_REASON_OPTIONS.indexOf(reason) < 0) throw new Error('Choose a valid cancellation reason');
    const currentRows = sheet.getDataRange().getValues();
    const activeRowIndexes = rowIndexes.filter(rowIndex =>
      String(currentRows[rowIndex - 1][map.status] || '').trim().toLowerCase() !== 'cancelled'
    );
    if (!activeRowIndexes.length) throw new Error('Order has no active items');
    const first = sheet.getRange(activeRowIndexes[0], 1, 1, sheet.getLastColumn()).getValues()[0];
    if (!isOverduePending_(first[map.status], first[map.timestamp], Date.now())) {
      throw new Error('Only Pending orders older than one hour can be cancelled');
    }
    rowIndexes.forEach(rowIndex => {
      sheet.getRange(rowIndex, map.cancelReason + 1).setValue(reason);
    });
    rowIndexes.forEach(rowIndex => sheet.getRange(rowIndex, map.status + 1).setValue(status));
    return json({ status: 'success', orderId: orderId, rowIndexes: rowIndexes });
  }
  const rows = sheet.getDataRange().getValues();
  const activeRowIndexes = rowIndexes.filter(rowIndex =>
    String(rows[rowIndex - 1][map.status] || '').trim().toLowerCase() !== 'cancelled'
  );
  activeRowIndexes.forEach(rowIndex => sheet.getRange(rowIndex, map.status + 1).setValue(status));
  return json({ status: 'success', orderId: orderId, rowIndexes: activeRowIndexes });
}

function cancelItem_(sheet, data) {
  const map = headerMap_(sheet);
  const rowIndex = Number(data.rowIndex);
  if (!Number.isInteger(rowIndex) || rowIndex < 2 || rowIndex > sheet.getLastRow()) {
    throw new Error('Menu item was not found');
  }
  const row = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
  const orderId = String(row[map.orderId] || '');
  if (data.orderId && String(data.orderId) !== orderId) {
    throw new Error('Menu item no longer belongs to this order');
  }
  if (String(row[map.status] || '').trim().toLowerCase() !== 'pending') {
    throw new Error('Only pending menu items can be cancelled');
  }
  sheet.getRange(rowIndex, map.status + 1).setValue('Cancelled');
  sheet.getRange(rowIndex, map.cancelReason + 1).setValue(KDS_ITEM_CANCEL_REASON);
  return json({ status: 'success', orderId: orderId, rowIndex: rowIndex });
}

function requireKdsActionToken_(data) {
  const expected = PropertiesService.getScriptProperties().getProperty(KDS_ACTION_TOKEN_PROPERTY);
  if (!expected) throw new Error(KDS_ACTION_TOKEN_PROPERTY + ' is not configured in Script Properties');
  if (String(data.token || '') !== expected) throw new Error('KDS authorization failed');
}

function doGet(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (e && e.parameter && e.parameter.action === 'images') {
      return handleImages_();
    }
    if (e && e.parameter && e.parameter.action === 'getOrders') {
      return getOrders_(getSheet());
    }
    if (e && e.parameter && e.parameter.action === 'getDailySalesSummary') {
      const date = String(e.parameter.date || todayDateKey_());
      return json({ status: 'success', summary: dailySalesSummary_(getSheet(), date) });
    }
    return json({ status: 'error', message: 'unknown action' });
  } catch (error) {
    console.error(error);
    return json({ status: 'error', message: error.message });
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action === 'uploadImage') return handleImageUpload_(data);
    const sheet = getSheet();
    if (data.action === 'updateStatus') return updateStatus_(sheet, data);
    if (data.action === 'cancelItem') {
      requireKdsActionToken_(data);
      return cancelItem_(sheet, data);
    }
    if (data.action === 'closeDailySales') {
      requireKdsActionToken_(data);
      return closeDailySales_(sheet, data);
    }
    if (data.action) return json({ status: 'error', message: 'unknown action' });
    return appendOrder_(sheet, data);
  } catch (error) {
    console.error(error);
    return json({ status: 'error', message: error.message });
  } finally {
    lock.releaseLock();
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
