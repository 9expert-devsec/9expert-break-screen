/* ============================================================
   9Expert Break Screen — pure config helpers (no DOM / no window)
   Extracted verbatim from the original single-file app so it can be
   shared with the MSDB #cfg= generator. Logic is byte-identical.
   ============================================================ */

export const DAY_NAMES = ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"];
export const SITE = "https://www.9experttraining.com";

export const DEFAULTS = {
  v: 2,
  presets: [
    { label: "พักเบรกเช้า",  min: 15 },
    { label: "พักเที่ยง",     min: 60 },
    { label: "พักเบรกบ่าย",  min: 15 }
  ],
  videos: {
    mode: "daily", // "same" | "daily"
    same: ["https://www.youtube.com/playlist?list=PLNc5iOROSzEsi4ceEsC08OvC8xG4aVKIs"],
    byDay: {
      "1": [ // จันทร์ — Excel เริ่มต้นและสูตรยอดฮิต
        "https://youtu.be/fHRfja_Wl4I — สอน Excel พื้นฐาน สำหรับมือใหม่",
        "https://youtu.be/LoIUyOQ0BvI — 9 สูตร Excel ยอดฮิต",
        "https://youtu.be/jz9IfSRUHqQ — สอน XLOOKUP พื้นฐาน",
        "https://youtu.be/zkYW4ohyLjo — จัดการวันที่ใน Excel"
      ],
      "2": [ // อังคาร — Excel ขั้นสูงและ Automation
        "https://youtu.be/KgeGUBi5Kr0 — PivotTable พื้นฐานสู่ Dashboard",
        "https://youtu.be/FgblcbjyKt8 — Conditional Formatting ขั้นสูง",
        "https://youtu.be/bTNE1vcB6xA — Excel Macro เบื้องต้น",
        "https://youtu.be/IrgXKfn-6U0 — สร้างใบแจ้งหนี้ PDF 100 ไฟล์ด้วย Macro"
      ],
      "3": [ // พุธ — Power BI
        "https://youtu.be/WSvkcRjTBMQ — แนะนำ Power BI Desktop สำหรับผู้เริ่มต้น",
        "https://youtu.be/nThhgzLPPZA — เริ่มต้น Power BI เพื่อการวิเคราะห์ข้อมูล",
        "https://youtu.be/xZHRyPpK23A — Power BI วิเคราะห์ข้อมูลจากไฟล์ Excel",
        "https://youtu.be/jbwhA0sEWiE — แนะนำหลักสูตร Power BI for Data Analytics"
      ],
      "4": [ // พฤหัสบดี — Power Platform
        "https://youtu.be/wRpuaN6MjUA — Power Automate Desktop กรอกข้อมูลอัตโนมัติ",
        "https://youtu.be/fXLCHbhJa_8 — Power Automate Cloud กรณีศึกษา POS",
        "https://youtu.be/_M-vfh3gUGU — ส่งอีเมลอัตโนมัติจาก Excel ด้วย Power Automate",
        "https://youtu.be/xa0hHrtHR84 — สร้างแอปด้วย Power Apps เก็บข้อมูลใน Excel"
      ],
      "5": [ // ศุกร์ — AI Friday
        "https://youtu.be/gYXE8LC1h4o — ลองใช้ Claude Cowork โหมดใหม่",
        "https://youtu.be/LXQKKPINLws — NotebookLM ผู้ช่วย AI ส่วนตัว",
        "https://youtu.be/-8afAwe8isE — สอนใช้ ChatGPT 9 เทคนิค",
        "https://youtu.be/y9mrBauGxHQ — Copilot ใน Excel เก่งขึ้นหลายเท่า"
      ],
      "6": [ // เสาร์ — Data Preparation
        "https://youtu.be/x3oee_-sY-M — Excel Power Query พื้นฐาน ep.1",
        "https://youtu.be/fQQNj0_maAs — Excel Power Query พื้นฐาน ep.2",
        "https://youtu.be/PZpKAPM3a28 — Excel Automation ด้วย Power Query",
        "https://youtu.be/5w0wNVpbBCc — สร้าง Dashboard ฟรีด้วย Looker Studio"
      ],
      "0": [ // อาทิตย์ — รวมเทคนิคยอดนิยม
        "https://youtu.be/Q1N5LCxIFRc — VLOOKUP HLOOKUP XLOOKUP ครบ 3 สูตร",
        "https://youtu.be/qheuHGJs2Wk — Checkbox ใน Excel",
        "https://youtu.be/TasD-H1z8vc — Dropdown list 2 ชั้น",
        "https://youtu.be/qsMmE_fXXPI — ดึงข้อความจากรูปด้วย ChatGPT และ Power Automate"
      ]
    }
  },
  playback: { shuffle: false, loop: true },
  display: {
    layout: "standard",       // standard | wide | video
    showCountdown: true,
    tickerOn: true,
    tickerText: [
      "ยินดีต้อนรับสู่ *9Expert Training* — สอนสไตล์ใช้งานจริง",
      "โปรโมชันหลักสูตร *Claude* และ AI ดูรายละเอียดที่ 9experttraining.com",
      "อบรม Power BI · Excel · Power Automate · Generative AI โดยทีม *Microsoft MVP*",
      "*อย่าหยุดเรียนรู้* Never Stop Learning"
    ].join("\n"),
    tickerSpeed: "normal",    // slow | normal | fast
    profileLabel: ""          // ชื่อโปรไฟล์หลักสูตร (บริบท) แสดงบนหัวจอ — ว่าง = ไม่แสดง
  },
  courses: [
    { badge:"Best Seller", title:"Power BI Desktop for Business Analytics",
      desc:"เปลี่ยนข้อมูลเป็น Insight สร้างรายงานแบบ Interactive Dashboard เพื่อการตัดสินใจทางธุรกิจ",
      meta:"2 วัน (12 ชม.) · 8,500.-",
      img:"https://www.9experttraining.com/sites/default/files/styles/cover/public/course/cover/Power%20BI%20Desktop%20for%20Business%20Analytics.png.webp?itok=bS-YZgVY",
      url:"https://www.9experttraining.com/power-bi-desktop-business-analytics-training-course" },
    { badge:"Advanced", title:"Microsoft Excel Advanced",
      desc:"สูตรคำนวณซับซ้อน PivotTable PivotChart และ Power Query พร้อมเทคนิคใช้งานได้จริง",
      meta:"2 วัน (12 ชม.) · 8,500.-",
      img:"https://www.9experttraining.com/sites/default/files/styles/large_cover/public/course/images/Microsoft%20Excel%20Advanced-100.webp?itok=7l3lIv6L",
      url:"https://www.9experttraining.com/excel-advanced-training-course" },
    { badge:"AI Skills", title:"Microsoft 365 Copilot for Business Professionals",
      desc:"เปลี่ยน Microsoft 365 ให้เป็นทีมงาน AI ส่วนตัว ลดเวลาทำเอกสาร สรุปประชุม และวิเคราะห์ข้อมูล",
      meta:"2 วัน (12 ชม.) · 14,900.-",
      img:"https://www.9experttraining.com/sites/default/files/styles/cover/public/course/cover/Business%20Professionals_1.png.webp?itok=3M7gPvff",
      url:"https://www.9experttraining.com/microsoft-365-copilot-training-course" },
    { badge:"New", title:"Claude Cowork for Business",
      desc:"ใช้ Claude AI สำหรับงานบริหาร ทั้งโหมด Cowork และ Claude Code สอนสไตล์ใช้งานจริง",
      meta:"2 วัน (12 ชม.) · 14,900.-",
      img:"https://www.9experttraining.com/sites/default/files/styles/cover/public/course/cover/cover-course-claude-cowork-for-business.png.webp?itok=FIIOw0AU",
      url:"https://www.9experttraining.com/claude-cowork-training-course" },
    { badge:"New", title:"Build Business Apps with Claude Code",
      desc:"สร้างเครื่องมือทำงาน Internal Tool และ Web App ด้วย AI Coding Agent โดยไม่ต้องมีพื้นฐานการเขียนโปรแกรม",
      meta:"2 วัน (12 ชม.) · 18,900.-",
      img:"https://www.9experttraining.com/sites/default/files/styles/cover/public/course/cover/Build%20Business%20Apps%20with%20Claude%20Code_0.png.webp?itok=7-qGx8sJ",
      url:"https://www.9experttraining.com/build-business-apps-with-claude-code-training-course" }
  ],
  rotateSec: 12,
  endTitle: "หมดเวลาพักแล้ว",
  endSub: "เชิญกลับเข้าห้องอบรมได้เลยครับ",
  slogan: "อย่าหยุดเรียนรู้",
  site: "9experttraining.com",
  chime: true,
  warnSec: 60
};

// ---------------------------------------------------------------------------
// Per-course break-screen profiles, keyed by course_id.
// Each profile is a PARTIAL config — only fields that differ from DEFAULTS.
// mergeCfg(DEFAULTS, profile) fills in everything else.
//
// ⚠️ FALLBACK / SEED ONLY: แหล่งข้อมูลจริงคือไฟล์ profiles.json (same-origin)
//    ที่ตัวสร้างฝั่ง MSDB export ออกมา และ deploy คู่กับไฟล์นี้ (ดู init())
//    ออบเจ็กต์ด้านล่างใช้เป็น fallback ตอน fetch profiles.json ไม่สำเร็จ
//    (ออฟไลน์ / ยังไม่ได้ deploy) และเป็น seed สำหรับ dev ในเครื่อง
//
// `label` = ข้อความสำหรับ UI picker เท่านั้น (metadata) — ต้องถูกตัดทิ้งก่อน merge
// เข้า cfg เสมอ เพื่อไม่ให้รั่วเข้าไปใน frozen config (#cfg=)
// ---------------------------------------------------------------------------
export const PROFILES = {
  "power-bi-desktop": {
    label: "Power BI Desktop for Business Analytics",
    // แนะนำเฉพาะหลักสูตรสาย Data/Analytics
    courses: [ DEFAULTS.courses[0], DEFAULTS.courses[2], DEFAULTS.courses[1] ],
    videos: { mode: "same", same: DEFAULTS.videos.byDay["3"] } // ชุดวิดีโอ Power BI
  },
  "excel-advanced": {
    label: "Microsoft Excel Advanced",
    // แนะนำ Excel Advanced + คอร์สต่อยอด
    courses: [ DEFAULTS.courses[1], DEFAULTS.courses[0] ],
    videos: { mode: "same", same: DEFAULTS.videos.byDay["2"] } // ชุดวิดีโอ Excel ขั้นสูง
  }
};

/* ---------- pure helpers ---------- */
export function deepClone(o){ return JSON.parse(JSON.stringify(o)); }
export function pad2(n){ return String(n).padStart(2,"0"); }
export function esc(s){ return String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c])); }

export function encodeCfg(c){ return btoa(unescape(encodeURIComponent(JSON.stringify(c)))); }
export function decodeCfg(s){
  try { return JSON.parse(decodeURIComponent(escape(atob(s)))); }
  catch(e){ return null; }
}
export function mergeCfg(base, inc){
  const out = deepClone(base);
  if (!inc || typeof inc !== "object") return out;
  for (const k of Object.keys(base)){
    if (inc[k] === undefined) continue;
    out[k] = deepClone(inc[k]);
  }
  if (!Array.isArray(out.presets) || !out.presets.length) out.presets = deepClone(base.presets);
  if (!out.videos || typeof out.videos !== "object") out.videos = deepClone(base.videos);
  if (!out.videos.byDay) out.videos.byDay = deepClone(base.videos.byDay);
  if (!Array.isArray(out.videos.same)) out.videos.same = [];
  if (!Array.isArray(out.courses)) out.courses = deepClone(base.courses);
  if (!out.playback || typeof out.playback !== "object") out.playback = deepClone(base.playback);
  if (!out.display || typeof out.display !== "object") out.display = deepClone(base.display);
  for (const dk of Object.keys(base.display)){
    if (out.display[dk] === undefined) out.display[dk] = deepClone(base.display[dk]);
  }
  for (const pk of Object.keys(base.playback)){
    if (out.playback[pk] === undefined) out.playback[pk] = deepClone(base.playback[pk]);
  }
  return out;
}

/* ---------- YouTube parsing ---------- */
export function parseEntry(raw){
  const s = (raw||"").trim();
  if (!s) return null;
  let m = s.match(/[?&]list=([A-Za-z0-9_-]+)/);
  if (m) return { type:"playlist", id:m[1] };
  if (/^(PL|UU|OL|FL|RD)[A-Za-z0-9_-]{8,}$/.test(s.split(/\s/)[0])) return { type:"playlist", id:s.split(/\s/)[0] };
  m = s.match(/(?:youtu\.be\/|v=|shorts\/|embed\/|live\/)([A-Za-z0-9_-]{11})/);
  if (m) return { type:"video", id:m[1] };
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return { type:"video", id:s };
  return null;
}
export function shuffleArr(a){
  const x = a.slice();
  for (let i=x.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [x[i],x[j]] = [x[j],x[i]];
  }
  return x;
}

// buildEmbedSrc — pure. In the original it closed over module-level `cfg`,
// `IS_FILE`, and `location.origin`; those are now threaded as params so the
// helper is DOM/window-free. The URL-building logic is otherwise byte-identical.
export function buildEmbedSrc(entries, isMuted, cfg, isFile, origin){
  if (!entries.length) return null;
  const loop = !!cfg.playback.loop;
  let common =
    "autoplay=1&rel=0&iv_load_policy=3&playsinline=1&modestbranding=1&color=white" +
    "&mute=" + (isMuted ? 1 : 0);
  if (!isFile && origin && origin !== "null"){
    common += "&enablejsapi=1&origin=" + encodeURIComponent(origin);
  }
  const first = entries[0];
  if (first.type === "playlist"){
    return "https://www.youtube-nocookie.com/embed/videoseries?list=" + first.id +
           (loop ? "&loop=1" : "") + "&" + common;
  }
  let ids = entries.filter(e=>e.type==="video").map(e=>e.id);
  if (cfg.playback.shuffle) ids = shuffleArr(ids);
  const head = ids[0];
  let plist = "";
  if (loop){
    plist = (ids.length > 1 ? ids.slice(1).concat(head) : [head]).join(",");
    return "https://www.youtube-nocookie.com/embed/" + head +
           "?playlist=" + plist + "&loop=1&" + common;
  }
  if (ids.length > 1){
    plist = ids.slice(1).join(",");
    return "https://www.youtube-nocookie.com/embed/" + head +
           "?playlist=" + plist + "&" + common;
  }
  return "https://www.youtube-nocookie.com/embed/" + head + "?" + common;
}

export function shortUrl(u){
  return (u||"").replace(/^https?:\/\//,"").replace(/^www\./,"").replace(/\/$/,"");
}
