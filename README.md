# 9Expert Break Screen

หน้าจอพักเบรกสำหรับฉายบนโปรเจคเตอร์ในห้องอบรม — เป็นไฟล์ static ไฟล์เดียว
(`9Expert-Break-Screen_2.html`) ไม่ต้องมี backend / build step / framework

## โครงสร้างไฟล์ที่ deploy

```
9Expert-Break-Screen_2.html   ← ตัวแอป (single file)
profiles.json                 ← โปรไฟล์หลักสูตร (ดูด้านล่าง)
assets/
  js/qrcode.min.js            ← qrcode-generator (self-hosted)
  fonts/                      ← Google Sans + LINE Seed Sans TH (self-hosted)
```

ทั้งหมดต้องเปิดผ่าน **http/https** เท่านั้น (ห้าม `file://` — ไม่งั้น YouTube embed จะ Error 153)
เช่น Cloudflare Pages หรือ Vercel

## การเลือกเนื้อหาตามหลักสูตร (`?course=`)

ลำดับความสำคัญของ config (เฉพาะเจาะจงสุดชนะ):

1. `#cfg=...` ใน URL hash — snapshot ที่ freeze ค่าไว้ทั้งหมด
2. `?course=<course_id>` — โหลดโปรไฟล์ของหลักสูตรนั้น
3. ค่าเริ่มต้นของสถาบัน (`DEFAULTS`)

### `profiles.json` — แหล่งข้อมูลจริงของโปรไฟล์หลักสูตร

- `?course=<course_id>` จะ resolve จาก **`profiles.json`** ก่อน โดยแอป fetch แบบ
  **relative path** (`profiles.json`) ตอนเริ่มทำงาน → ต้อง deploy อยู่ **origin เดียวกัน**
  กับไฟล์ HTML (จึงไม่มีปัญหา CORS และพกพาข้าม subpath/โดเมนได้)
- ถ้า fetch ล้มเหลว (ออฟไลน์ / ยังไม่ได้ deploy / 404 / ไฟล์เสีย) แอปจะ **fallback**
  ไปใช้ชุด `PROFILES` ที่ hardcode ไว้ในไฟล์ HTML โดยอัตโนมัติ — **จอจะไม่ว่างเด็ดขาด**
- ไฟล์ `profiles.json` ในรีโปนี้เป็น **placeholder** (2 หลักสูตร seed) เพื่อให้ same-origin
  fetch สำเร็จตั้งแต่ deploy ครั้งแรก

> ⚠️ **สำคัญ:** `profiles.json` จะถูก **เขียนทับ (OVERWRITTEN)** ด้วยไฟล์ที่ตัวสร้าง
> ฝั่ง MSDB export ออกมา (Prompt 04-C) อย่าแก้ด้วยมือถ้าจะให้ระบบ generate ทับ
> และต้อง deploy ไฟล์นี้ไว้ที่ **origin เดียวกัน** กับ `9Expert-Break-Screen_2.html`
