// Test mock for OrderSystem.gs (Google Apps Script) — runs in Node.js
const fs = require('fs');

// --- Mock Google Apps Script services ---
class SimulatedRange {
  constructor(sheet, row, col, numRows, numCols) {
    this.sheet = sheet; this.row = row; this.col = col; this.numRows = numRows; this.numCols = numCols;
    this.values = [];
    for (let r = 0; r < numRows; r++) {
      this.values[r] = [];
      for (let c = 0; c < numCols; c++) {
        const sr = row - 1 + r, sc = col - 1 + c;
        this.values[r][c] = (sr >= 0 && sr < sheet.data.length && sc >= 0 && sc < sheet.data[sr].length) ? sheet.data[sr][sc] : '';
      }
    }
  }
  getValues() { return this.values; }
  getDisplayValues() { return this.values.map(row => row.map(String)); }
  setValue(v) { const r=this.row-1, c=this.col-1; const s=this.sheet; while(s.data.length<=r)s.data.push([]); while(s.data[r].length<=c)s.data[r].push(''); s.data[r][c]=v; s.lastRow=Math.max(s.lastRow,r+1); s.lastCol=Math.max(s.lastCol,c+1); return this; }
  setValues(vs) { const s=this.sheet; for (let i=0;i<vs.length;i++) { const r=this.row-1+i; while(s.data.length<=r)s.data.push([]); for (let j=0;j<vs[i].length;j++) { const c=this.col-1+j; while(s.data[r].length<=c)s.data[r].push(''); s.data[r][c]=vs[i][j]; } } s.lastRow=s.data.length; s.lastCol=s.data[0]?s.data[0].length:0; return this; }
}

class SimulatedSheet {
  constructor(name, data, sheetId) {
    this.name = name; this.data = data.map(row=>row.slice()); this.sheetId = sheetId;
    this.lastRow = this.data.length; this.lastCol = this.data[0] ? this.data[0].length : 0;
  }
  getName() { return this.name; }
  getSheetId() { return this.sheetId; }
  getLastRow() { return this.lastRow; }
  getLastColumn() { return this.lastCol; }
  getRange(row,col,numRows=1,numCols=1) { return new SimulatedRange(this,row,col,numRows,numCols); }
  getDataRange() { return this.getRange(1,1,this.lastRow,this.lastCol); }
  insertColumnAfter(after) { const ci=after; for(let r=0;r<this.data.length;r++) this.data[r].splice(ci,0,''); this.lastCol=this.data[0]?this.data[0].length:0; return this; }
  appendRow(row) { this.data.push(row.slice()); this.lastRow=this.data.length; if(row.length>this.lastCol)this.lastCol=row.length; return this; }
}

class SimulatedSpreadsheet {
  constructor(sheets){ this.sheets=sheets; }
  getSheets(){return this.sheets;}
  getSheetByName(name){return this.sheets.find(sheet=>sheet.name===name)||null;}
  insertSheet(name){const sheet=new SimulatedSheet(name,[],this.sheets.length+20000);this.sheets.push(sheet);return sheet;}
  getSpreadsheetTimeZone(){return 'Asia/Bangkok';}
}

function pad(n,w){return String(n).padStart(w,'0');}
function formatDateMs(ms,tz,fmt){
  const d=new Date(ms);
  if(fmt==='HH:mm') {
    const parts=new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d);
    return parts.find(part=>part.type==='hour').value+':'+parts.find(part=>part.type==='minute').value;
  }
  if(fmt==='yyyy-MM-dd') return new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  return d.toISOString();
}

global.SpreadsheetApp={ getActiveSpreadsheet:()=>global._testSpreadsheet };
global.Utilities={
  formatDate:(date,tz,fmt)=>formatDateMs(date.getTime(),tz,fmt),
  getUuid:()=>'test-uuid-'+Math.random().toString(36).slice(2),
  base64Decode:(s)=>Buffer.from(s,'base64'),
  newBlob:(bytes,mime,name)=>({getBytes:()=>bytes,getContentType:()=>mime,getName:()=>name})
};
global.LockService={ getScriptLock:()=>({waitLock:()=>{},releaseLock:()=>{}}) };
global._kdsActionToken='test-kds-token';
global.PropertiesService={
  getScriptProperties:()=>({getProperty:key=>key==='KDS_ACTION_TOKEN'?global._kdsActionToken:null})
};
global.ContentService={
  createTextOutput:(s)=>{ const o = typeof s==='string' ? JSON.parse(s) : s; o.getContent=()=>JSON.stringify(o||{}); o.setMimeType=()=>o; return o; },
  MimeType:{JSON:'application/json'}
};
global.console={error:(...a)=>process.stderr.write(a.join(' ')+'\n'),log:(...a)=>process.stdout.write(a.join(' ')+'\n')};

// --- Load OrderSystem.gs source and eval in this context ---
const gsSource = fs.readFileSync('apps-script/OrderSystem.gs','utf8');
eval(gsSource);

let passed=0, failed=0;
function assert(cond,msg){ if(cond){passed++;}else{failed++; console.log('FAIL: '+msg);} }
function doPostQuiet(event) {
  const originalError = console.error;
  console.error = () => {};
  try { return doPost(event); }
  finally { console.error = originalError; }
}

// ====== TEST 1: Column migration (ensureOrderColumns_) ======
console.log('--- TEST 1: Column migration ---');

// Test 1a: Empty sheet
const sheet1 = new SimulatedSheet('Orders', [], 12345);
global._testSpreadsheet = new SimulatedSpreadsheet([sheet1]);
ensureOrderColumns_(sheet1);
assert(sheet1.getLastRow()===1, '1a: empty sheet gets header row');
assert(sheet1.getLastColumn()===11, '1a: 11 headers');
const h1 = sheet1.getDataRange().getValues()[0];
assert(h1[0]==='Timestamp'&&h1[3]==='ชื่อ'&&h1[5]==='จำนวน'&&h1[10]==='Cancel Reason','1a: headers correct');

// Test 1b: Sheet with old partial headers + data, missing ชื่อ/จำนวน/Cancel Reason
const oldHeaders = ['Timestamp','เวลา','Room','Menu Details','Price','Status','Payment','Order ID'];
const oldData = [
  oldHeaders,
  ['2026-11-26','10:00','101','Pizza (x2)','690','Pending','Thai QR','ord-001'],
  ['2026-11-26','10:05','102','Salad (x1)','350','Pending','Cash','ord-002']
];
const sheet2 = new SimulatedSheet('Orders', oldData, 12345);
global._testSpreadsheet = new SimulatedSpreadsheet([sheet2]);
ensureOrderColumns_(sheet2);
const h2 = sheet2.getDataRange().getValues()[0];
assert(h2.includes('ชื่อ'),'1b: missing column ชื่อ added');
assert(h2.includes('จำนวน'),'1b: missing column จำนวน added');
assert(h2.includes('Cancel Reason'),'1b: Cancel Reason added');
assert(sheet2.getDataRange().getValues()[1][0]==='2026-11-26','1b: row1 col1 preserved');
assert(sheet2.getDataRange().getValues()[1][2]==='101','1b: row1 col3 preserved');
console.log('TEST 1 done. passed='+passed+' failed='+failed);

// ====== TEST 2: appendOrder_ ======
console.log('--- TEST 2: appendOrder_ ---');

// Test 2a: New order with 2 items
const sheet3 = new SimulatedSheet('Orders', [], 12345);
global._testSpreadsheet = new SimulatedSpreadsheet([sheet3]);
ensureOrderColumns_(sheet3);
let res1;
try {
  res1 = appendOrder_(sheet3, {
    roomNumber: '101', room: '101', name: 'Somchai',
    items: [
      { name: 'Pizza', quantity: 2, price: 690 },
      { name: 'Salad', quantity: 1, price: 350 }
    ],
    price: 1730, orderId: 'ORD-001', payment: 'Thai QR (PromptPay - slip attached)'
  });
} catch(e) { res1 = { status: 'error', message: e.message }; console.log('2a ERROR:', e.message); }
assert(res1.status==='success','2a: status success');
assert(res1.orderId==='ORD-001','2a: orderId returned');
const data3 = sheet3.getDataRange().getValues();
assert(data3.length===3,'2a: header + 2 item rows = 3 rows');
assert(data3[1][4]==='Pizza','2a: row1 menu Pizza');
assert(data3[1][5]===2,'2a: row1 qty 2');
assert(data3[1][3]==='Somchai','2a: row1 name Somchai');
assert(data3[1][2]==='101','2a: row1 room 101');
assert(data3[2][4]==='Salad','2a: row2 menu Salad');
assert(data3[2][5]===1,'2a: row2 qty 1');
assert(data3[2][9]==='ORD-001','2a: row2 orderId ORD-001');
assert(data3[2][8]==='Thai QR (PromptPay - slip attached)','2a: row2 payment');

// Test 2b: Duplicate orderId
const res2 = appendOrder_(sheet3, {
  roomNumber: '101', room: '101', name: 'Somchai',
  items: [{ name: 'Pizza', quantity: 2 }],
  price: 1730, orderId: 'ORD-001', payment: 'Cash'
});
assert(res2.duplicate===true,'2b: duplicate detected');
assert(data3.length===3,'2b: no new rows added');

console.log('TEST 2 done. passed='+passed+' failed='+failed);

// ====== TEST 3: getOrders_ (KDS grouping) ======
console.log('--- TEST 3: getOrders_ ---');
const sheet4 = new SimulatedSheet('Orders', [], 12345);
global._testSpreadsheet = new SimulatedSpreadsheet([sheet4]);
ensureOrderColumns_(sheet4);
appendOrder_(sheet4, { roomNumber:'101', room:'101', name:'Alice', items:[{name:'Pizza',quantity:2},{name:'Salad',quantity:1}], price:1730, orderId:'ORD-A', payment:'Thai QR' });
appendOrder_(sheet4, { roomNumber:'102', room:'102', name:'Bob', items:[{name:'Steak',quantity:1}], price:590, orderId:'ORD-B', payment:'Cash' });
const result = getOrders_(sheet4);
assert(result.status==='success','3a: status success');
assert(result.orders.length===2,'3a: 2 orders');
const ordA = result.orders.find(o=>o.orderId==='ORD-A');
assert(ordA!=null,'3a: ORD-A found');
assert(ordA.room==='101','3a: ORD-A room 101');
assert(ordA.name==='Alice','3a: ORD-A name Alice');
assert(ordA.items.length===2,'3a: ORD-A 2 items');
assert(ordA.items[0].name==='Pizza'&&ordA.items[0].quantity===2,'3a: ORD-A item1 Pizza x2');
assert(ordA.status==='Pending','3a: ORD-A status Pending');
assert(ordA.payment==='Thai QR','3a: ORD-A payment Thai QR');
console.log('TEST 3 done. passed='+passed+' failed='+failed);

// ====== TEST 4: updateStatus_ (cancel pending >1 hour) ======
console.log('--- TEST 4: updateStatus_ ---');
const sheet5 = new SimulatedSheet('Orders', [], 12345);
global._testSpreadsheet = new SimulatedSpreadsheet([sheet5]);
ensureOrderColumns_(sheet5);
const twoHoursAgo = new Date(Date.now() - 2*60*60*1000);
appendOrder_(sheet5, { roomNumber:'101', room:'101', name:'OldOrder', items:[{name:'Pizza',quantity:1}], price:690, orderId:'ORD-OLD', payment:'Thai QR' });
const map5 = headerMap_(sheet5);
const rows5 = sheet5.getDataRange().getValues();
rows5[1][map5.timestamp] = twoHoursAgo;
rows5[1][map5.time] = '10:00';
sheet5.getRange(2,1,1,rows5[1].length).setValues([rows5[1]]);
appendOrder_(sheet5, { roomNumber:'102', room:'102', name:'NewOrder', items:[{name:'Salad',quantity:1}], price:350, orderId:'ORD-NEW', payment:'Cash' });

const cancelOld = updateStatus_(sheet5, { orderId:'ORD-OLD', status:'Cancelled', reason:'เกินกำหนดเวลาชำระเงิน' });
assert(cancelOld.status==='success','4a: cancel old order success');
const data5a = sheet5.getDataRange().getValues();
assert(data5a[1][map5.status]==='Cancelled','4a: status Cancelled');
assert(data5a[1][map5.cancelReason]==='เกินกำหนดเวลาชำระเงิน','4a: cancel reason set');

try { updateStatus_(sheet5, { orderId:'ORD-NEW', status:'Cancelled', reason:'เกินกำหนดเวลาชำระเงิน' }); assert(false,'4b: should throw'); }
catch(e) { assert(e.message==='Only Pending orders older than one hour can be cancelled','4b: correct error'); }

try { updateStatus_(sheet5, { orderId:'ORD-OLD', status:'Cancelled', reason:'ไม่ชอบอาหาร' }); assert(false,'4c: should throw'); }
catch(e) { assert(e.message==='Choose a valid cancellation reason','4c: correct error'); }

console.log('TEST 4 done. passed='+passed+' failed='+failed);

// ====== TEST 5: cancel a single menu item ======
console.log('--- TEST 5: cancelItem_ ---');
const sheet6 = new SimulatedSheet('Orders', [], 1306309405);
global._testSpreadsheet = new SimulatedSpreadsheet([sheet6]);
ensureOrderColumns_(sheet6);
appendOrder_(sheet6, {
  roomNumber:'201', name:'Guest',
  items:[{name:'Soup',quantity:1},{name:'Tea',quantity:2}],
  price:250, orderId:'ORD-ITEM'
});
const map6 = headerMap_(sheet6);
const itemCancel = cancelItem_(sheet6, { orderId:'ORD-ITEM', rowIndex:2 });
assert(itemCancel.status==='success','5a: item cancellation succeeds');
assert(sheet6.getRange(2,map6.status+1).getValues()[0][0]==='Cancelled','5a: only selected item is cancelled');
assert(sheet6.getRange(3,map6.status+1).getValues()[0][0]==='Pending','5a: other item remains pending');
assert(sheet6.getRange(2,map6.cancelReason+1).getValues()[0][0]==='ยกเลิกจากหน้าจอ KDS','5a: item cancellation is audited');
const itemOrder = getOrders_(sheet6).orders[0];
assert(itemOrder.status==='Pending','5a: order remains active while another item is pending');
assert(itemOrder.items[0].rowIndex===2&&itemOrder.items[0].status==='Cancelled','5a: KDS receives cancelled item metadata');
assert(itemOrder.items[1].rowIndex===3&&itemOrder.items[1].status==='Pending','5a: KDS receives active item row index');
updateStatus_(sheet6, { orderId:'ORD-ITEM', status:'Completed' });
assert(sheet6.getRange(2,map6.status+1).getValues()[0][0]==='Cancelled','5b: completing order preserves cancelled item');
assert(sheet6.getRange(3,map6.status+1).getValues()[0][0]==='Completed','5b: completing order updates active item');
try { cancelItem_(sheet6, { orderId:'ORD-ITEM', rowIndex:3 }); assert(false,'5c: completed item should not cancel'); }
catch(e) { assert(e.message==='Only pending menu items can be cancelled','5c: completed item rejected'); }
appendOrder_(sheet6, { roomNumber:'202', items:[{name:'Cake',quantity:1}], price:80, orderId:'ORD-ITEM-AUTH' });
let authCancel = doPostQuiet({ postData:{ contents:JSON.stringify({ action:'cancelItem', orderId:'ORD-ITEM-AUTH', rowIndex:4, token:'wrong' }) } });
assert(authCancel.status==='error'&&authCancel.message==='KDS authorization failed','5d: item cancellation requires the KDS token');
assert(sheet6.getRange(4,map6.status+1).getValues()[0][0]==='Pending','5d: failed authorization does not change item');
authCancel = doPostQuiet({ postData:{ contents:JSON.stringify({ action:'cancelItem', orderId:'ORD-ITEM-AUTH', rowIndex:4, token:'test-kds-token' }) } });
assert(authCancel.status==='success'&&sheet6.getRange(4,map6.status+1).getValues()[0][0]==='Cancelled','5e: authorized item cancellation succeeds');
console.log('TEST 5 done. passed='+passed+' failed='+failed);

// ====== TEST 6: daily summary and close ======
console.log('--- TEST 6: daily sales close ---');
const sheet7 = new SimulatedSheet('Orders', [], 1306309405);
global._testSpreadsheet = new SimulatedSpreadsheet([sheet7]);
ensureOrderColumns_(sheet7);
appendOrder_(sheet7, { roomNumber:'301', items:[{name:'Soup',quantity:1}], price:100, orderId:'ORD-SALES-1', payment:'Cash' });
sheet7.getRange(2,map6.status+1).setValue('Completed');
appendOrder_(sheet7, { roomNumber:'302', items:[{name:'Tea',quantity:1}], price:50, orderId:'ORD-SALES-2', payment:'Thai QR' });
const today = todayDateKey_();
let salesSummary = dailySalesSummary_(sheet7, today);
assert(salesSummary.completedOrderCount===1&&salesSummary.totalSales===100,'6a: summary totals completed sales');
assert(salesSummary.pendingOrderCount===1,'6a: summary counts pending orders');
try { closeDailySales_(sheet7, { date:today }); assert(false,'6b: pending orders should block close'); }
catch(e) { assert(e.message.indexOf('still pending')>=0,'6b: pending order blocks close'); }
sheet7.getRange(3,map6.status+1).setValue('Cancelled');
const closeResult = closeDailySales_(sheet7, { date:today });
assert(closeResult.status==='success'&&closeResult.summary.closed,'6c: daily close stores snapshot');
assert(closeResult.summary.totalSales===100,'6c: closing snapshot preserves sales total');
const closeSheet = global._testSpreadsheet.getSheetByName('Daily Sales Closing');
assert(closeSheet.getLastRow()===2,'6c: daily close is recorded once');
const repeatClose = closeDailySales_(sheet7, { date:today });
assert(repeatClose.summary.alreadyClosed===true&&closeSheet.getLastRow()===2,'6d: repeated close is idempotent');
let routeClose = doPostQuiet({ postData:{ contents:JSON.stringify({ action:'closeDailySales', date:today, token:'wrong' }) } });
assert(routeClose.status==='error'&&routeClose.message==='KDS authorization failed','6d: closing requires the KDS token');
routeClose = doPostQuiet({ postData:{ contents:JSON.stringify({ action:'closeDailySales', date:today, token:'test-kds-token' }) } });
assert(routeClose.status==='success'&&routeClose.summary.alreadyClosed===true,'6e: authorized close API returns existing snapshot');
const summaryRoute = doGet({ parameter:{ action:'getDailySalesSummary', date:today } });
assert(summaryRoute.status==='success'&&summaryRoute.summary.closed,'6f: summary endpoint returns the stored close');
try { appendOrder_(sheet7, { roomNumber:'303', items:[{name:'Cake',quantity:1}], price:80, orderId:'ORD-AFTER-CLOSE' }); assert(false,'6e: closed day should reject new orders'); }
catch(e) { assert(e.message.indexOf('Sales for today are closed')===0,'6e: closed day rejects new orders'); }
console.log('TEST 6 done. passed='+passed+' failed='+failed);

console.log('TOTAL: passed='+passed+' failed='+failed);
