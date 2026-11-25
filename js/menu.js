// Menu loading (Ratchayothin Menu_POS_Export → embedded snapshot) and category rules.
// Live rules match the digital flipbook: only Status "พร้อมขาย", in-house price,
// sheet Image URL, then verified Ratchayothin FoodStory fallbacks.
(function () {
  const C = window.CONFIG;
  const TIMEOUT_MS = 12000;
  const ON_SALE = 'พร้อมขาย';
  // Another restaurant's FoodStory library. Never use these photos for Ratchayothin.
  const OTHER_RESTAURANT = '47f6102c-ca12-49bb-ace4-0f7cd19561b3';
  const RATCHAYOTHIN_HOST = '1d843830-1d8e-404c-b6ae-ef20152653ab';

  const ORDERED_CATEGORIES = window.MENU_CATEGORIES_ORDER || [
    'Recommend', 'โปรโมชัน', 'Pizza', 'Appetizer', 'Salad', 'Pasta', 'Steak',
    'ยำ', 'ทอด', 'ย่าง', 'ต้ม', 'ผัด', 'ข้าว', 'นู๊ดเดิ้ล', 'Cake & Bakery', 'น้ำ'
  ];
  const CAT_RANK = {};
  ORDERED_CATEGORIES.forEach((c, idx) => { CAT_RANK[c] = idx; });

  const PHOTO_FALLBACKS = window.RATCHAYOTHIN_PHOTO_FALLBACKS || {};

  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9&\u0E00-\u0E7F]+/g, ' ').trim();
  const cleanName = s => String(s || '').replace(/[\u200b\u200c\u200d\ufeff]/g, '').trim();

  function parseCSV(text) {
    const rows = [];
    let row = [], field = '', q = false;
    text = String(text).replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
        } else field += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.some(v => String(v).trim() !== ''));
  }

  function httpUrl(url) {
    const u = String(url || '').trim();
    if (!/^https?:\/\//i.test(u) || u.includes('***') || u.includes(OTHER_RESTAURANT)) return '';
    return u;
  }

  // Fallbacks are verified Ratchayothin photos only. Reject any other host.
  function fallbackPhoto(id) {
    const u = httpUrl(PHOTO_FALLBACKS[id]);
    return u && u.includes(RATCHAYOTHIN_HOST) ? u : '';
  }

  // Sheet Category / Subcategory → this app's chips. Unknown pairs become their own chip.
  function mapCategory(cat, sub, names) {
    const c = norm(cat);
    const s = norm(sub);
    const raw = String(names || '');

    if (c === 'best sellers' || c === 'recommend' || s.startsWith('recommendation')) return 'Recommend';
    if (s === 'pizza') return 'Pizza';
    if (s === 'appetizer' || s === 'dipping sauce') return 'Appetizer';
    if (s === 'salad') return 'Salad';
    if (s === 'pasta') return 'Pasta';
    if (s === 'steak') return 'Steak';
    if (s === 'yum' || s === 'ยำ') return 'ยำ';
    if (s === 'grilled' || s === 'ย่าง') return 'ย่าง';
    if (s === 'soup & curry' || s === 'ต้ม') return 'ต้ม';
    if (s.includes('wok') || (s.includes('stir') && s.includes('fry'))) {
      if (/ทอด|คั่วพริกเกลือ|คั่วกระเทียม|คางกุ้ง|crispy|salt\s*&?\s*chilli|garlic/i.test(raw)) return 'ทอด';
      return 'ผัด';
    }
    if ((s.includes('rice') && s.includes('noodle')) || s === 'rice' || s === 'noodles' || s === 'noodle' || s === 'ข้าว' || s === 'นู๊ดเดิ้ล') {
      if (/ก๋วยเตี๋ยว|ขนมจีน|ข้าวซอย|ผัดซีอิ๊ว|ผัดไทย|noodle|pad thai|khao soi/i.test(raw)) return 'นู๊ดเดิ้ล';
      if ((s.includes('noodle') && !s.includes('rice')) || s === 'นู๊ดเดิ้ล') return 'นู๊ดเดิ้ล';
      return 'ข้าว';
    }
    if (s.includes('cake') || s.includes('bakery') || s.includes('ceke') || c.includes('dessert')) return 'Cake & Bakery';
    if (c === 'promotion') return 'โปรโมชัน';
    // Soft drinks, tea, wine, beer, smoothie, matcha, kombucha, and ice service.
    if (c === 'beverage' || c === 'hot tea' || s === 'น้ำ') return 'น้ำ';
    return String(sub || cat || 'Other').replace(/[\u200b\u200c\u200d\ufeff]/g, '').trim() || 'Other';
  }

  function sheetRowsToMenu(rows) {
    if (!rows.length) throw new Error('Sheet CSV is empty');
    const head = rows[0].map(x => String(x).trim().toLowerCase());
    const col = name => {
      const i = head.indexOf(name.toLowerCase());
      if (i < 0) throw new Error('Missing column: ' + name);
      return i;
    };
    const idx = {
      id: col('ID'), status: col('Status'), cat: col('Category'), sub: col('Subcategory'),
      th: col('Name TH'), en: col('Name EN'), zh: col('Name CHI'),
      price: col('Price (THB)'), img: col('Image URL')
    };
    const cell = (r, k) => (r[idx[k]] == null ? '' : String(r[idx[k]]).trim());
    const items = [];
    rows.slice(1).forEach((r, n) => {
      const id = cell(r, 'id');
      if (!id) return;
      // Hide anything that is not exactly on sale (including งดขายชั่วคราว). No badge.
      if (cell(r, 'status') !== ON_SALE) return;
      const th = cleanName(cell(r, 'th'));
      const en = cleanName(cell(r, 'en'));
      const zh = cleanName(cell(r, 'zh'));
      const names = [th, en, zh].filter(Boolean).join(' ');
      const price = Number(cell(r, 'price').replace(/[^0-9.]/g, ''));
      items.push({
        id,
        desc: mapCategory(cell(r, 'cat'), cell(r, 'sub'), names),
        name: th && en && th !== en ? th + '-' + en : (th || en),
        name_th: th || en,
        name_en: en || '',
        name_zh: zh,
        price: Number.isFinite(price) ? price : 0,
        image: httpUrl(cell(r, 'img')) || fallbackPhoto(id),
        seq: n
      });
    });
    return items;
  }

  function prepare(list) {
    const cleaned = list.filter(i => i && i.id).map(i => ({ ...i }));
    cleaned.sort((a, b) => {
      const ra = CAT_RANK[a.desc] != null ? CAT_RANK[a.desc] : 1000;
      const rb = CAT_RANK[b.desc] != null ? CAT_RANK[b.desc] : 1000;
      if (ra !== rb) return ra - rb;
      const sa = Number.isFinite(a.seq) ? a.seq : 0;
      const sb = Number.isFinite(b.seq) ? b.seq : 0;
      if (sa !== sb) return sa - sb;
      return String(a.id).localeCompare(String(b.id));
    });
    return cleaned;
  }

  function itemsFromCsv(text) {
    if (/^\s*<(!doctype|html)/i.test(text)) throw new Error('Sheet is not CSV');
    const items = prepare(sheetRowsToMenu(parseCSV(text)));
    if (!items.length) throw new Error('no on-sale items');
    return items;
  }

  async function loadMenu() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const sep = C.sheetCsvUrl.includes('?') ? '&' : '?';
      const r = await fetch(C.sheetCsvUrl + sep + '_=' + Date.now(), {
        signal: controller.signal,
        cache: 'no-store',
        credentials: 'omit'
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return { items: itemsFromCsv(await r.text()), source: 'sheet' };
    } catch (e) {
      console.warn('Ratchayothin menu sheet failed, using embedded snapshot:', e.message);
    } finally {
      clearTimeout(timeout);
    }
    if (Array.isArray(window.MENU_FALLBACK) && window.MENU_FALLBACK.length) {
      return { items: prepare(window.MENU_FALLBACK), source: 'fallback' };
    }
    throw new Error('menu unavailable');
  }

  async function fetchCloudPhotos() {
    const r = await fetch(C.appsScriptUrl + '?action=images&t=' + Date.now());
    const j = await r.json();
    return j && j.status === 'success' && j.images ? j.images : null;
  }

  const isRec = i => i && i.desc === 'Recommend';
  const rotateCW = i => /brownie|tiramisu/i.test((i.name_en || '') + ' ' + (i.name || ''));

  window.Menu = {
    loadMenu, fetchCloudPhotos, itemsFromCsv, isRec, rotateCW, ORDERED_CATEGORIES, ON_SALE
  };
})();
