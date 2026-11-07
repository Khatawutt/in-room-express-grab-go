// Menu loading (Google Sheet -> fallback file) and menu business rules.
(function () {
  const C = window.CONFIG;

  const ORDERED_CATEGORIES = window.MENU_CATEGORIES_ORDER || [
    'Recommend', 'Pizza', 'Appetizer', 'Salad', 'Pasta', 'Steak',
    'ยำ', 'ทอด', 'ย่าง', 'ต้ม', 'ผัด', 'ข้าว', 'นู๊ดเดิ้ล', 'Cake & Bakery', 'น้ำ'
  ];
  const CAT_RANK = {};
  ORDERED_CATEGORIES.forEach((c, idx) => { CAT_RANK[c] = idx; });

  const FRIED_IDS = new Set(['M150', 'M151', 'M152', 'M154', 'M155', 'M156', 'M157', 'M158', 'M162']);
  const STIR_FRY_IDS = new Set(['M147', 'M148', 'M149', 'M153', 'M159', 'M160', 'M161', 'M163']);
  const RICE_IDS = new Set(['M072', 'M073', 'M074', 'M077', 'M078', 'M079', 'M081']);
  const NOODLE_IDS = new Set(['M071', 'M075', 'M076', 'M080', 'M082', 'M083']);
  const REMOVED_CAKE_IDS = new Set(['M025', 'M026', 'M028']);
  const KEEP_CAKE_IDS = new Set(['M023', 'M024', 'M029', 'M030', 'M031', 'M032', 'M033']);

  const FALLBACK_BY_ID = {};
  if (Array.isArray(window.MENU_FALLBACK)) {
    window.MENU_FALLBACK.forEach(i => { if (i && i.id) FALLBACK_BY_ID[i.id] = i; });
  }

  function parseCSV(text) {
    const rows = []; let row = [], f = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(f); rows.push(row); row = []; f = '';
      } else f += c;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    return rows;
  }

  function sheetRowsToMenu(rows) {
    const head = rows[0].map(x => x.trim().toLowerCase());
    const col = n => head.indexOf(n.toLowerCase());
    const idx = {
      id: col('ID'), status: col('Status'), cat: col('Category'),
      th: col('Name TH'), en: col('Name EN'), zh: col('Name CHI'),
      price: col('Price (THB)') >= 0 ? col('Price (THB)') : col('Price'), img: col('Image URL')
    };
    const get = (r, k) => (idx[k] >= 0 && r[idx[k]] != null ? String(r[idx[k]]).trim() : '');
    return rows.slice(1)
      .filter(r => get(r, 'id') && get(r, 'status').toLowerCase() === 'active')
      .map(r => {
        const id = get(r, 'id');
        const fb = FALLBACK_BY_ID[id];
        const rawTh = get(r, 'th').replace(/​/g, '').trim();
        const rawEn = get(r, 'en').replace(/​/g, '').trim();
        const th = rawTh || (fb && fb.name_th ? fb.name_th : rawEn);
        const en = (fb && fb.name_en) ? fb.name_en : rawEn;
        let img = get(r, 'img');
        if ((!img || img.includes('***')) && fb && fb.image) img = fb.image;
        return {
          id,
          desc: get(r, 'cat') || (fb ? fb.desc : 'Appetizer'),
          name: th && en && th !== en ? th + '-' + en : (th || en),
          name_th: th || en,
          name_en: en || '',
          name_zh: get(r, 'zh').replace(/​/g, '').trim() || (fb ? fb.name_zh : ''),
          price: Number(get(r, 'price').replace(/[^0-9.]/g, '')) || (fb ? fb.price : 0),
          image: img
        };
      });
  }

  const fixName = i => {
    const fTh = s => String(s || '').replace('ปลาสลิดทอด', 'ปลาทอด').replace('กระเพราะหมูสับคั่วกระทะ(กับข้าว)', 'กะเพราหมูสับคั่วกระทะ (กับข้าว)');
    const fEn = s => String(s || '')
      .replace(/Salmon Pasto Spaghetti/gi, 'Salmon Pesto Spaghetti')
      .replace(/Kurobuta Pork Loin Stak/gi, 'Kurobuta Pork Loin Steak')
      .replace(/Umicorn Smoothie/gi, 'Unicorn Smoothie')
      .replace(/Rynn sparking water/gi, 'Rynn Sparkling Water');
    return { ...i, name: fEn(fTh(i.name)), name_th: fTh(i.name_th), name_en: fEn(i.name_en) };
  };

  function isCakeOrHidden(i) {
    const id = String(i.id || '').trim();
    const text = ((i.name_en || '') + ' ' + (i.name_th || '') + ' ' + (i.name || '')).toLowerCase();
    if (id === 'M027' || id === 'M103' || REMOVED_CAKE_IDS.has(id)) return true;
    if (/strawberry coconut smoothie|tiramisu|jasmine yogurt|new york cheesecake/i.test(text)) return true;
    if ((/cornflakes?/i.test(text) || text.includes('คอนเฟลก')) && !(/chocolate/i.test(text) || text.includes('ช๊อคโกแลต') || text.includes('ช็อกโกแลต'))) return true;
    return false;
  }

  function mapCategory(i) {
    const id = String(i.id || '').trim();
    const rawCat = String(i.desc || '').trim();
    const lowerCat = rawCat.toLowerCase();
    const text = ((i.name_th || '') + ' ' + (i.name_en || '') + ' ' + (i.name || '')).toLowerCase();

    if (KEEP_CAKE_IDS.has(id) || lowerCat.includes('cake') || lowerCat.includes('bakery')) return 'Cake & Bakery';
    if (ORDERED_CATEGORIES.includes(rawCat)) return rawCat;
    if (lowerCat.startsWith('recommend')) return 'Recommend';
    if (lowerCat.includes('pizza')) return 'Pizza';
    if (rawCat === 'Appetizer' || rawCat === 'Other' || rawCat === 'Dipping Sauce') return 'Appetizer';
    if (lowerCat.includes('salad')) return 'Salad';
    if (lowerCat.includes('pasta') || id === 'M084' || text.includes('spaghetti') || text.includes('มักกะโรนี')) return 'Pasta';
    if (lowerCat.includes('steak')) return 'Steak';
    if (lowerCat === 'yum' || rawCat === 'ยำ') return 'ยำ';
    if (lowerCat.includes('grill') || rawCat === 'ย่าง') return 'ย่าง';
    if (lowerCat.includes('soup') || lowerCat.includes('curry') || rawCat === 'ต้ม') return 'ต้ม';
    if (FRIED_IDS.has(id)) return 'ทอด';
    if (STIR_FRY_IDS.has(id)) return 'ผัด';
    if (lowerCat.includes('wok') || lowerCat.includes('stir-fry') || lowerCat.includes('fried')) {
      if (/ทอด|คั่วพริกเกลือ|คั่วกระเทียม|คางกุ้ง|crispy|salt & chilli|garlic/.test(text)) return 'ทอด';
      return 'ผัด';
    }
    if (RICE_IDS.has(id)) return 'ข้าว';
    if (NOODLE_IDS.has(id)) return 'นู๊ดเดิ้ล';
    if (lowerCat.includes('rice') || lowerCat.includes('noodle')) {
      if (/ก๋วยเตี๋ยว|ขนมจีน|ข้าวซอย|ผัดซีอิ๊ว|ผัดไทย|noodle|pad thai|khao soi/.test(text)) return 'นู๊ดเดิ้ล';
      return 'ข้าว';
    }
    if (/beer|wine|matcha|kombucha|smoothie|blended|soft drink|drink|น้ำ/.test(lowerCat)) return 'น้ำ';
    return 'Appetizer';
  }

  const isRec = i => /^recommend/i.test(i.desc);
  const rotateCW = i => /brownie|tiramisu/i.test((i.name_en || '') + ' ' + (i.name || ''));

  function prepare(list) {
    const cleaned = list
      .map(fixName)
      .filter(i => !isCakeOrHidden(i))
      .map(i => ({ ...i, desc: mapCategory(i) }));
    cleaned.sort((a, b) => {
      const ra = CAT_RANK[a.desc] != null ? CAT_RANK[a.desc] : 99;
      const rb = CAT_RANK[b.desc] != null ? CAT_RANK[b.desc] : 99;
      if (ra !== rb) return ra - rb;
      return String(a.id).localeCompare(String(b.id));
    });
    return cleaned;
  }

  async function loadMenu() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const sep = C.sheetCsvUrl.includes('?') ? '&' : '?';
      const r = await fetch(C.sheetCsvUrl + sep + 't=' + Date.now(), { signal: controller.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const items = sheetRowsToMenu(parseCSV(await r.text()));
      if (items.length) return { items: prepare(items), source: 'sheet' };
      throw new Error('no active items');
    } catch (e) {
      console.warn('Published menu source failed, using fallback:', e.message);
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

  window.Menu = { loadMenu, fetchCloudPhotos, isRec, rotateCW, ORDERED_CATEGORIES };
})();
