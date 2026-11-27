# MANA In-Room Dining — Web App

เว็บแอปสั่งอาหารเข้าห้องพัก (MANA Ratchayothin) สร้างจาก UI ต้นแบบ `MenuApp.dc.html`
เป็น HTML/CSS/JS ล้วน **ไม่ต้อง build** อัปโหลดขึ้น static hosting ได้ทันที (GitHub Pages, Netlify, Vercel)

## โครงสร้าง

| ไฟล์ | หน้าที่ |
|---|---|
| `index.html` | โครงหน้า: เมนู, แถบตะกร้า, Checkout, ใบเสร็จ, Dish sheet, เครื่องมือแก้รูป |
| `css/styles.css` | Design tokens + 2 ธีม (classical / original) + Responsive |
| `js/config.js` | **ค่าตั้งค่าทั้งหมด** (Apps Script URL, Google Sheet, PromptPay QR) |
| `js/i18n.js` | ข้อความ ไทย / อังกฤษ / จีน |
| `js/menu.js` | โหลดเมนูจาก Published CSV ของ Menu Master ก่อน แล้วสำรองด้วย `data/menu-data.js` |
| `js/promptpay.js` | สร้าง Thai QR พร้อมยอดเงิน (EMVCo + CRC16) |
| `js/app.js` | State, การ render, ตะกร้า, ส่งออร์เดอร์, ใบเสร็จ, โหมดแก้รูป |
| `data/menu-data.js` | เมนู Active สำรองตอนออฟไลน์ (snapshot จาก Published CSV ของ Menu Master) |
| `images/` | รูปเมนู `M###.jpg` |
| `apps-script/ImageUpload.gs` | โค้ดฝั่ง Google Apps Script สำหรับอัปโหลดรูปเมนู |
| `apps-script/OrderSystem.gs` | ตัวรับออร์เดอร์และ API สำหรับ KDS; ย้ายหัวคอลัมน์ชีตและเก็บรายการ/จำนวน/ช่องทางชำระเงิน |
| `test_ordersystem.js` | ทดสอบจำลอง OrderSystem API ใน Node.js (column migration, สั่งออร์เดอร์, ดึงออร์เดอร์ KDS, ยกเลิก pending เกิน 1 ชั่วโมง) |
| `tools/foodstory-scrape/` | เครื่องมือดึงเมนู FoodStory และ tests |
| `tools/Flipbook/` | ข้อมูลเมนูสำหรับโปรเจกต์ Flipbook |
| `.github/workflows/scrape_foodstory_modal.yml` | รัน FoodStory scraper ตามกำหนดเวลา/สั่งรันเอง |
| `docs/SOP-MENU-UPDATE.md` | ขั้นตอนอัปเดตเมนูและตรวจผล |
| `serve.ps1` | เซิร์ฟเวอร์ทดสอบในเครื่อง (ไม่ต้องลง Node/Python) |

## เปิดทดสอบในเครื่อง

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1
```
จากนั้นเปิด http://localhost:8080/?room=101

## ลิงก์ / พารามิเตอร์ URL

| พารามิเตอร์ | ตัวอย่าง | ผล |
|---|---|---|
| `room` | `?room=Mana%201` | ใส่เลขห้องอัตโนมัติ (ใช้ทำ QR ติดในแต่ละห้อง) |
| `lang` | `?lang=th` / `en` / `zh` | ภาษาเริ่มต้น (ถ้าไม่ใส่ จะดูจากภาษาเครื่อง) |
| `layout` | `?layout=list` / `editorial` | รูปแบบเมนู (ค่าเริ่มต้น `grid`) |
| `theme` | `?theme=original` | ธีมทอง-ดำแบบเดิม (ค่าเริ่มต้น `classical`) |

## การส่งออร์เดอร์

POST ไปที่ `CONFIG.appsScriptUrl` โดยส่ง `roomNumber`, `name`, `items` (ชื่อ, จำนวน, ราคา, หมายเหตุ), `menu`, `price`, `orderId` และ `payment`; แนบ `slip` เฉพาะช่องทาง Thai QR
หมายเหตุจากแขก (เช่น "Less spicy") ต่อท้ายชื่อเมนูในวงเล็บ `[...]` เป็นภาษาอังกฤษเสมอ เพื่อให้ครัวอ่านง่าย
ชำระเงินได้ 4 ช่องทาง: Thai QR (PromptPay พร้อมแนบสลิป), Alipay (พนักงานนำ QR ไปให้สแกนเมื่อส่งถึงห้อง), บัตรเครดิต Visa/Mastercard/JCB (ชำระที่ร้าน), เงินสด (ชำระที่เคาน์เตอร์ร้าน)

## โหมดแก้รูปเมนู (สำหรับพนักงาน)

แตะหมวด **Wine** 9 ครั้งติดกัน → กรอก Username/Password → แตะรูปเมนูเพื่อครอปและอัปโหลด
รหัสผ่าน **ไม่ได้อยู่ในโค้ดหน้าเว็บแล้ว** ตรวจสอบที่ Apps Script (Script properties `DEV_USER` / `DEV_PASS`) ตอนกดบันทึก
การ sync และอัปโหลดรูปต้องติดตั้ง `apps-script/ImageUpload.gs` ใน Apps Script เดียวกับ `OrderSystem.gs` (route `images` และ `uploadImage` ถูกเชื่อมไว้แล้ว) แล้ว Deploy เวอร์ชันใหม่

## ระบบออร์เดอร์และ KDS

นำ `apps-script/OrderSystem.gs` ไปแทนโค้ดรับออร์เดอร์เดิมใน Apps Script ของแท็บชีตที่ใช้งานจริง (ตรวจ `SHEET_GID` ในไฟล์ก่อน) แล้ว Deploy เป็นเวอร์ชันใหม่ของ deployment เดิม ไฟล์จะเพิ่มคอลัมน์ `เวลา`, `ชื่อ`, `จำนวน`, `Payment`, `Order ID` และ `Cancel Reason` โดยแทรกคอลัมน์ติดกับข้อมูลเดิม และเก็บหัวคอลัมน์เดิม/ข้อมูลเดิมไว้

ออร์เดอร์ใหม่ที่ส่ง `items` จะถูกบันทึกหนึ่งรายการอาหารต่อหนึ่งแถว พร้อมจำนวน; `GET ?action=getOrders` จะรวมแถวกลับเป็นออร์เดอร์และส่ง `payment`, `items` (รวม `rowIndex` และสถานะรายรายการ), `menu`, `overdue`, `canCancel` และ `cancelReasonOptions` ให้ KDS สำหรับการยกเลิกทั้งออร์เดอร์ ใช้ `POST` `{action:"updateStatus", orderId, status:"Cancelled", reason:"เกินกำหนดเวลาชำระเงิน"}`; เซิร์ฟเวอร์อนุญาตเฉพาะออร์เดอร์ `Pending` ที่เกิน 1 ชั่วโมง การยกเลิกรายการเดี่ยวใช้ `POST` `{action:"cancelItem", orderId, rowIndex}` และบันทึกเหตุผล `ลูกค้าไม่เอาแล้ว` ในแถวนั้น โดยไม่คำนวณยอดหรือคืนเงินอัตโนมัติ

`GET ?action=getDailySalesSummary&date=YYYY-MM-DD` สรุปออร์เดอร์ Completed ตามเวลาไทย (Asia/Bangkok) และแยกตามช่องทางชำระเงิน; `POST` `{action:"closeDailySales", date:"YYYY-MM-DD", token:"..."}` บันทึก snapshot ลงแท็บ `Daily Sales Closing` โดยปิดได้เฉพาะวันปัจจุบัน เมื่อมีออร์เดอร์ที่ยังไม่เสร็จหรือออร์เดอร์ Completed ที่ไม่มีราคาถูกต้อง ระบบจะปฏิเสธการปิดรอบ เมื่อปิดแล้วจะไม่รับออร์เดอร์ใหม่ของวันนั้น ยอดสรุปเป็นราคาทั้งออเดอร์ และไม่ลดตามการยกเลิกรายการเดี่ยว ทั้งการยกเลิกรายการและปิดรอบต้องส่งค่า Script Property `KDS_ACTION_TOKEN` ที่ตั้งไว้อย่างลับใน Apps Script; ห้ามบันทึก token ลงในซอร์สสาธารณะ

**สลิปโอนเงิน:** ออเดอร์ที่แนบ `slip: {data(base64), mime}` จะถูกบันทึกลง Google Drive โฟลเดอร์ `MANA In-Room Slips` (สร้างอัตโนมัติ ไฟล์เป็นส่วนตัว ไม่แชร์สาธารณะ) และเก็บลิงก์ในคอลัมน์ `Slip` ของแถวแรกของออเดอร์ — รับเฉพาะ JPEG/PNG/WebP ไม่เกิน 5 MB; `getOrders` ส่ง `slip` ให้ KDS แสดงปุ่ม "ดูสลิป"

**ขั้นตอน Deploy (ต้องทำครบ):** วาง `OrderSystem.gs` และ `ImageUpload.gs` (2 ไฟล์) ใน Apps Script ของชีต → ตั้ง Script Property `KDS_ACTION_TOKEN` → Deploy → Manage deployments → Edit → New version (ครั้งแรกจะขออนุญาตสิทธิ์ Google Drive ให้กดอนุญาต)

ใบเสร็จฝั่งเว็บแสดงช่องทางชำระเงินอยู่แล้ว ส่วนหน้าจอ KDS และการสั่งพิมพ์ไปยังเครื่อง Bar ไม่ได้อยู่ในซอร์สชุดนี้ จึงต้องปรับแอป KDS/การตั้งค่าเครื่องพิมพ์แยกต่างหาก โดยใช้ข้อมูล `payment`, `menu` หรือ `items` จาก API ด้านบน

## ทดสอบระบบออร์เดอร์ในเครื่อง (Node.js)

รัน `node test_ordersystem.js` เพื่อจำลองการทำงานของ `OrderSystem.gs` โดยไม่ต้องอัปโหลดไป Google Apps Script:

- ย้ายหัวคอลัมน์ชีต (`ensureOrderColumns_`) โดยรักษาข้อมูลเดิม
- สั่งออร์เดอร์ใหม่ (`appendOrder_`) พร้อม `room`, `name`, `items` (ชื่อ, จำนวน, ราคา, หมายเหตุ) และคงฟิลด์ `menu`, `price`, `payment`, `orderId` เดิมเพื่อความเข้ากันได้
- ดึงออร์เดอร์สำหรับ KDS (`getOrders_`) รวมแถวรายการกลับเป็นออร์เดอร์พร้อมตำแหน่ง/สถานะของแต่ละรายการ, `overdue`, `canCancel`, `cancelReasonOptions`
- ยกเลิกเฉพาะ `Pending` ที่เกิน 1 ชั่วโมง (`updateStatus_`) พร้อมเหตุผลที่กำหนดไว้ใน `CANCEL_REASON_OPTIONS`
- ยกเลิกหนึ่งรายการโดยไม่เปลี่ยนสถานะรายการอื่น (`cancelItem_`)
- สรุปและปิดรอบขายรายวัน พร้อมทดสอบการบล็อกออเดอร์ค้าง, snapshot ซ้ำ และการไม่รับออเดอร์หลังปิดรอบ

ทดสอบทั้งหมดผ่านในสภาพแวดล้อมนี้โดยใช้ mock Google Apps Script services

## Deploy (GitHub Pages)

1. อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ขึ้น repo (ไม่ต้องใส่ `serve.ps1` ก็ได้)
2. Settings → Pages → Source: `main` / root
3. ลิงก์ QR ของแต่ละห้อง: `https://<user>.github.io/<repo>/?room=<เลขห้อง>`

## เมนูเล่มเต็ม (Full Menu)
- ต้นฉบับ Canva: https://www.canva.com/d/uBAjrgsJMp7Dq1m (MANA Ratchayothin Photo Book Menu)
- Flipbook (Heyzine): https://heyzine.com/flip-book/c976158379.html
- ปุ่ม "ดูเมนูเต็ม" ในหน้าเว็บจะเปิด `FLIPBOOK_URL` (ลิงก์ Heyzine) ใน `index.html` — ถ้าเว้นว่างจะเปิดลิงก์ Canva แทน
- ข้อมูลราคา/รายการที่ใช้สั่งจริงยึด Google Sheet (Menu Master) → `menuData.json` เป็นหลัก
