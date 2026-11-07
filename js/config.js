// App-wide configuration. Change these values here only.
window.CONFIG = {
  hotelName: 'MANA Ratchayothin',

  // Store information
  storePhone: '0958577819',
  storePhoneDisplay: '095-857-7819',
  storeAddressTh: 'อาคาร รัชโยธิน ฮิลล์ (Ratchayothin Hills) ชั้น 1, 1799 ถนนพหลโยธิน แขวงจตุจักร เขตจตุจักร กรุงเทพฯ 10900 (ใกล้ BTS พหลโยธิน 24 / สี่แยกรัชโยธิน)',
  storeAddressEn: 'Floor 1, Ratchayothin Hills, 1799 Phahonyothin Rd, Chatuchak, Bangkok 10900 (Near BTS Phahonyothin 24)',
  googleMapsUrl: 'https://maps.google.com/?q=Mana+Ratchayothin',

  // Google Apps Script web app: receives orders (POST) and serves cloud menu photos (GET ?action=images)
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbwqT1lS6nhzEWxPLcOPvy-VU1GBuDLcd-XON3H5o1IG1PfiBdgukNV7AFyhqtSXxcDj/exec',

  // Published "Menu Master" CSV; falls back to data/menu-data.js if it is unavailable.
  sheetCsvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQIlPcFBNahWcP7yWRbzfJ_fZ8mQcJNzNoz1PsJbW0g0dd0uxr7vEeWurk2uEX5xo9VyEJmKeqhafnv/pub?output=csv',

  // Static PromptPay merchant QR (Thai QR). Amount is injected at checkout.
  merchantQr: '00020101021130650016A000000677010112011501075360001028602150140000034311520303SCB5802TH530376462200716000000000050737863045E8F',

  // Optional Alipay QR Image path (if available)
  alipayQrImage: 'images/alipay_qr.jpg',

  // Payment labels written to the order sheet
  payBackend: {
    qr: 'Thai QR (PromptPay - slip attached)',
    alipay: 'Alipay (screenshot attached)',
    card: 'Credit Card / บัตรเครดิต (pay at restaurant)',
    store: 'Cash / เงินสด (pay at restaurant)'
  },

  // How often to refresh cloud menu photos (ms)
  photoPollMs: 15000
};
