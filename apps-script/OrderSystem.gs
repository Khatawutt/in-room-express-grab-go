// Shared In-Room Dining order endpoint for the ordering app and restaurant KDS.
// Deploy as a new version of the existing Apps Script web app.

const SHEET_GID = 294978223;
const HEADERS = [
  'Timestamp', 'เวลา', 'Room', 'ชื่อ', 'Menu Details', 'จำนวน',
  'Price', 'Status', 'Payment', 'Order ID', 'Cancel Reason'
];
const CANCEL_REASON_OPTIONS = ['เกินกำหนดเวลาชำระเงิน'];
const PAYMENT_TIMEOUT_MS = 60 * 60 * 1000;

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheets().find(s => s.getSheetId() === SHEET_GID);
  if (!sheet) throw new Error('Orders sheet gid ' + SHEET_GID + ' was not found');
  ensureOrderColumns_(sheet);
  return sheet;
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
    const item = { name: shown[map.menu], quantity: quantity };
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
    const first = sheet.getRange(rowIndexes[0], 1, 1, sheet.getLastColumn()).getValues()[0];
    if (!isOverduePending_(first[map.status], first[map.timestamp], Date.now())) {
      throw new Error('Only Pending orders older than one hour can be cancelled');
    }
    rowIndexes.forEach(rowIndex => {
      sheet.getRange(rowIndex, map.cancelReason + 1).setValue(reason);
    });
  }
  rowIndexes.forEach(rowIndex => sheet.getRange(rowIndex, map.status + 1).setValue(status));
  return json({ status: 'success', orderId: orderId, rowIndexes: rowIndexes });
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
