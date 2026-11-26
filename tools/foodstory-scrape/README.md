# FoodStory Menu Scraper

ระบบสำหรับดึงข้อมูลเมนูอาหารจาก FoodStory Back-office และเชื่อมต่อกับ GitHub Actions เพื่อรันอัตโนมัติ

## 📋 คุณสมบัติ (Features)

- ✅ ดึงข้อมูลเมนูจากหน้าเว็บ FoodStory ด้วย Playwright
- ✅ Login อัตโนมัติด้วยบัญชีผู้ใช้ที่ปลอดภัยผ่าน GitHub Secrets
- ✅ ดึงข้อมูลละเอียดจาก Modal ของแต่ละเมนู
- ✅ เพิ่มชื่อภาษาจีนโดยอ้างอิงจากไฟล์ Mapping
- ✅ ส่งออกข้อมูลเป็น Excel, CSV และ JSON
- ✅ รันอัตโนมัติทุกวันจันทร์ผ่าน GitHub Actions

## 📁 โครงสร้างโปรเจค (Project Structure)

```
foodstory-scrape/
├── scripts/
│   └── scrape_foodstory_modal.py      # สคริปต์หลักสำหรับดึงข้อมูลเมนู
├── data/
│   ├── menu_zh_mapping.json           # Mapping ข้อมูลภาษาจีน
│   └── foodstory_menu_export_*.xlsx   # ไฟล์ส่งออก (สร้างอัตโนมัติ)
├── tests/
│   └── test_scrape_foodstory_modal.py # Unit Tests
└── README.md                           # คู่มือการใช้งาน
```

GitHub Actions workflow อยู่ที่ `../../.github/workflows/scrape_foodstory_modal.yml`.

## 🚀 การติดตั้งและใช้งาน (Installation & Usage)

### ตั้งค่า GitHub Secrets

1. ไปยังหน้า repository `khatawutt/in-room-express-grab-go` บน GitHub
2. คลิกที่แท็บ **Settings**
3. เลื่อนลงมาหาส่วน **Secrets and variables > Actions**
4. กดปุ่ม **New repository secret** แล้วเพิ่มค่าดังนี้:

| Name | Value |
|------|-------|
| `FOODSTORY_USERNAME` | อีเมลล็อกอิน FoodStory ของคุณ (เช่น `user@example.com`) |
| `FOODSTORY_PASSWORD` | รหัสผ่าน FoodStory ของคุณ |

> ⚠️ **ความปลอดภัย:** อย่าใส่รหัสผ่านในโค้ดหรือไฟล์ที่ commit ให้ใช้ GitHub Secrets แทนเสมอ!

### ติดตั้งและทดสอบในเครื่อง (Local Testing)

จากโฟลเดอร์ root ของ repository:

```powershell
python -m pip install -r tools/foodstory-scrape/requirements.txt
python -m playwright install chromium
python -m unittest discover -s tools/foodstory-scrape/tests -v
```

เพื่อรัน scraper ให้ตั้งค่า `FOODSTORY_USERNAME` และ `FOODSTORY_PASSWORD` ใน environment ก่อน แล้วรัน:

```powershell
python tools/foodstory-scrape/scripts/scrape_foodstory_modal.py
```

### สั่งรันผ่าน GitHub Actions

1. ไปยังแท็บ **Actions**
2. เลือก workflow **Scrape FoodStory Menu from Modal**
3. กด **Run workflow** (หรือรอรันตามกำหนดทุกวันจันทร์)

ผลลัพธ์จะอยู่ใน **Artifacts** ของ workflow run:

## 🔧 การปรับแต่ง (Configuration)

### แก้ไขสคริปต์หลัก (`scripts/scrape_foodstory_modal.py`)

หากต้องการแก้ไข URL หรือ selector ของหน้าเว็บ ให้ค้นหาและแก้ไขในฟังก์ชันเหล่านี้:

- `login()`: ฟังก์ชันสำหรับ Login
- `get_menu_list()`: ดึงรายการเมนูทั้งหมด
- `open_menu_modal()`: เปิด Modal ของแต่ละเมนู
- `get_menu_details()`: ดึงข้อมูลละเอียดจาก Modal

### เพิ่มข้อมูล Mapping ภาษาจีน (`data/menu_zh_mapping.json`)

แก้ไขไฟล์ mapping เพื่อเพิ่มชื่อภาษาจีนของเมนูอาหาร:

```json
{
  "by_code": {
    "M001": "ชื่อเมนูภาษาจีน"
  },
  "by_english": {
    "Menu Name": "ชื่อเมนูภาษาจีน"
  },
  "by_thai": {
    "ชื่อเมนูไทย": "ชื่อเมนูภาษาจีน"
  }
}
```

## 📊 ข้อมูลที่ดึงได้ (Data Fields)

ระบบจะดึงข้อมูลเมนูอาหารดังนี้:

| Field | คำอธิบาย |
|-------|----------|
| `menu_code` | รหัสเมนู (เช่น M001, M002) |
| `thai_name` | ชื่อเมนูภาษาไทย |
| `english_name` | ชื่อเมนูภาษาอังกฤษ |
| `price` | ราคา |
| `category` | หมวดหมู่ |
| `image_url` | URL รูปภาพเมนู |
| `chinese_name` | ชื่อเมนูภาษาจีน (จากไฟล์ mapping) |

## 🧪 การทดสอบ (Testing)

รัน Unit Tests เพื่อตรวจสอบความถูกต้องของโค้ด:

```bash
# รันทดสอบทั้งหมด
python -m unittest tests/test_scrape_foodstory_modal.py -v
```

หรือใช้ pytest:

```bash
pytest tests/ -v
```

## 📝 ข้อกำหนดระบบ (System Requirements)

- Python 3.10 หรือสูงกว่า
- Playwright และ Chromium browser
- GitHub Actions (สำหรับรันอัตโนมัติบนคลาวด์)

## 🤝 การสนับสนุน (Support)

หากพบปัญหาหรือต้องการความช่วยเหลือ กรุณา:
- ตรวจสอบ Log ในไฟล์ `scripts/scrape_foodstory_modal.py`
- ตรวจสอบ GitHub Actions Logs ที่หน้า Repository ของคุณ
- เปิด Issue หรือ Contact Developer

---

**สร้างด้วย Model_Coding** ✨