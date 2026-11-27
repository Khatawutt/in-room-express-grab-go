// App-wide configuration. Change these values here only.
window.CONFIG = {
  hotelName: 'MANA Ratchayothin',

  orderHours: {
    open: '11:00',
    close: '21:00',
    timeZone: 'Asia/Bangkok'
  },

  // Store information
  storePhone: '0958577819',
  storePhoneDisplay: '095-857-7819',
  storeAddressTh: 'อาคาร รัชโยธิน ฮิลล์ (Ratchayothin Hills) ชั้น 1, 1799 ถนนพหลโยธิน แขวงจตุจักร เขตจตุจักร กรุงเทพฯ 10900 (ใกล้ BTS พหลโยธิน 24 / สี่แยกรัชโยธิน)',
  storeAddressEn: 'Floor 1, Ratchayothin Hills, 1799 Phahonyothin Rd, Chatuchak, Bangkok 10900 (Near BTS Phahonyothin 24)',
  googleMapsUrl: 'https://maps.google.com/?q=Mana+Ratchayothin',

  // Google Apps Script web app: receives orders (POST) and serves cloud menu photos (GET ?action=images)
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbwXXEVJVTPfU4jF4Uh4ZMD-Je3wmGibKjgNpbv8CZ-JVAKJMdzHj350H1JzS8FbWzB_/exec',

  // MANA Master Database → Menu_POS_Export (Ratchayothin). Only Status "พร้อมขาย" is shown.
  // Falls back to data/menu-data.js if this CSV is unavailable.
  sheetCsvUrl: 'https://docs.google.com/spreadsheets/d/1cqtqFcxvCM_l6aZpkscfP76ndsg5RyM7Qv92-Qmb_EU/export?format=csv&gid=1306309405',

  // Static PromptPay merchant QR (Thai QR). Amount is injected at checkout.
  merchantQr: '00020101021130650016A000000677010112011501075360001028602150140000034311520303SCB5802TH530376462200716000000000050737863045E8F',

  // Payment labels written to the order sheet
  payBackend: {
    qr: 'Thai QR (PromptPay - slip attached)',
    alipay: 'Alipay (pay at room)',
    card: 'Credit Card / บัตรเครดิต (pay at restaurant)',
    store: 'Cash / เงินสด (pay at restaurant)'
  },

  // How often to refresh cloud menu photos (ms)
  photoPollMs: 15000
};
