# in-room-express-grab-go
Hotel in-room express dining service - Grab &amp; Go ordering system with Google Sheets integration

## เมนูเล่มเต็ม (Full Menu)
- ต้นฉบับ Canva: https://www.canva.com/d/uBAjrgsJMp7Dq1m (MANA Ratchayothin Photo Book Menu)
- ลิงก์ถาวรสำหรับ QR / ปุ่ม "ดูเมนูเต็ม": `menu.html` → redirect ไปเมนูเล่มจริง
- อัปเดตเมนูใหม่: อัปโหลด PDF เป็น flipbook ใหม่ แล้วแก้ `FULL_MENU_URL` ใน `menu.html` บรรทัดเดียว (QR ไม่ต้องพิมพ์ใหม่)
- Flipbook ปัจจุบัน (Heyzine): https://heyzine.com/flip-book/c976158379.html
- ข้อมูลราคา/รายการที่ใช้สั่งจริงยึด Google Sheet (Menu Master) → `menuData.json` เป็นหลัก
