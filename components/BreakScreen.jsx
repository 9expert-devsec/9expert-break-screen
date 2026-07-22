'use client';

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Settings, Maximize, Check, X, ArrowLeft, Volume2, VolumeX, DoorOpen } from "lucide-react";
import {
  DAY_NAMES,
  SITE,
  DEFAULTS,
  PROFILES,
  deepClone,
  pad2,
  esc,
  encodeCfg,
  decodeCfg,
  mergeCfg,
  parseEntry,
  shuffleArr,
  buildEmbedSrc,
  shortUrl,
} from "@/lib/breakConfig";

export default function BreakScreen({ initialCourseSlug = null, initialProfile = null }) {
  useEffect(() => {
    /* ============================================================
       9Expert Break Screen v2 — imperative engine (ported as-is)
       - Config persists in URL hash (#cfg=...) → พกติดลิงก์ไปเปิดบนทีวีได้
       - window.storage (ถ้ามี ใน Claude.ai artifact) ใช้เป็น cache เสริม
       - QR Code สร้างในเครื่องด้วย qrcode-generator (self-hosted: /qrcode.min.js)
       ============================================================ */

    // YouTube (ปลายปี 2025 เป็นต้นมา) บังคับให้หน้า embed ส่ง Referrer ที่ valid
    // เปิดจาก file:// จะไม่มี Referrer ให้ส่ง → Error 153 เสมอ ต้องเปิดผ่าน http(s)
    const IS_FILE = location.protocol === "file:";

    let cfg = deepClone(DEFAULTS);
    let activeCourseId = "";     // course_id ที่โหลดผ่าน ?course= (ว่าง = ใช้ DEFAULTS)
    let unknownCourseId = null;  // ?course= ที่ไม่พบในโปรไฟล์ (สำหรับแจ้งเตือนในตั้งค่า)
    // lookup โปรไฟล์ที่ใช้จริง = seed ในไฟล์ (PROFILES) ทับด้วย profiles.json ตอน init()
    // เริ่มต้นเป็น seed ไว้ก่อน เผื่อ fetch ล้มเหลว UI ก็ยังมีโปรไฟล์ให้เลือก
    let effectiveProfiles = { ...PROFILES };

    /* ---------- state ---------- */
    let endAt = 0, totalMs = 0, tickId = null, running = false, infiniteMode = false;
    let muted = false;
    let promoIdx = 0, promoTimer = null;
    let playerFrame = null;

    /* ---------- helpers ---------- */
    function $(id){ return document.getElementById(id); }

    const STORE_KEY = "nine-expert-break-cfg";

    async function storGet(){
      // 1) localStorage (real domain)
      try {
        const v = localStorage.getItem(STORE_KEY);
        if (v) return JSON.parse(v);
      } catch(e){}
      // 2) window.storage fallback (Claude.ai artifact only)
      try {
        if (window.storage && window.storage.get){
          const r = await window.storage.get(STORE_KEY);
          if (r && r.value) return JSON.parse(r.value);
        }
      } catch(e){}
      return null;
    }

    async function storSet(c){
      const payload = JSON.stringify(c);
      try { localStorage.setItem(STORE_KEY, payload); } catch(e){}
      try {
        if (window.storage && window.storage.set){
          await window.storage.set(STORE_KEY, payload);
        }
      } catch(e){}
    }

    function writeHash(){
      const h = "#cfg=" + encodeCfg(cfg);
      try { history.replaceState(null, "", location.pathname + location.search + h); }
      catch(e){ location.hash = h; }
      updateShareLink();
    }
    function updateShareLink(){
      const base = location.href.split("#")[0];
      $("shareLink").value = base + "#cfg=" + encodeCfg(cfg);
    }

    /* ---------- YouTube parsing ---------- */
    function todayEntries(){
      const v = cfg.videos;
      let list = [];
      if (v.mode === "daily"){
        const d = String(new Date().getDay());
        list = (v.byDay[d]||[]).map(parseEntry).filter(Boolean);
        if (!list.length) list = (v.same||[]).map(parseEntry).filter(Boolean);
      } else {
        list = (v.same||[]).map(parseEntry).filter(Boolean);
      }
      return list;
    }
    function ytCmd(func){
      if (!playerFrame || !playerFrame.contentWindow) return;
      try{
        playerFrame.contentWindow.postMessage(
          JSON.stringify({ event:"command", func:func, args:[] }), "*");
      }catch(e){}
    }

    /* ---------- clock ---------- */
    function tickClock(){
      const now = new Date();
      $("clockNow").textContent = pad2(now.getHours())+":"+pad2(now.getMinutes())+":"+pad2(now.getSeconds());
    }
    const clockId = setInterval(tickClock, 1000); tickClock();

    /* ---------- start screen ---------- */
    function renderStart(){
      const row = $("presetRow");
      row.innerHTML = "";
      cfg.presets.forEach(p=>{
        const b = document.createElement("button");
        b.className = "preset-card";
        b.innerHTML =
          '<span class="num">'+Number(p.min)+'</span>'+
          '<span class="unit">นาที</span>'+
          '<span class="lab"></span>';
        b.querySelector(".lab").textContent = p.label || ("พัก "+p.min+" นาที");
        b.addEventListener("click", ()=> startBreak(Number(p.min), p.label, false));
        row.appendChild(b);
      });
      const inf = document.createElement("button");
      inf.className = "preset-card infinite";
      inf.innerHTML =
        '<span class="num">&#8734;</span>'+
        '<span class="unit">ไม่จับเวลา</span>'+
        '<span class="lab">เล่นวิดีโอต่อเนื่อง</span>';
      inf.addEventListener("click", ()=> startBreak(0, "เล่นวิดีโอต่อเนื่อง", false));
      row.appendChild(inf);

      const n = todayEntries().length;
      const dayName = DAY_NAMES[new Date().getDay()];
      $("startMeta").innerHTML =
        'วิดีโอของวัน'+dayName+': <b>'+(n? n+" รายการ" : "ยังไม่ได้ตั้งค่า")+'</b>' +
        ' &nbsp;·&nbsp; หลักสูตรแนะนำ: <b>'+cfg.courses.length+' รายการ</b>';
      $("footSlogan").textContent = cfg.slogan;
      $("footSite").textContent = cfg.site;

      // บริบทหลักสูตรบนหน้าแรก: แสดงว่ากำลังโหลดโปรไฟล์หลักสูตรใดอยู่ (ถ้ามี)
      const pl = ((cfg.display && cfg.display.profileLabel) || "").trim();
      const sp = $("startProfile");
      if (sp){ sp.textContent = pl ? ("หลักสูตร: " + pl) : ""; sp.hidden = !pl; }
    }

    /* ---------- ticker ---------- */
    function tickerItems(){
      return (cfg.display.tickerText||"").split(/\n+/).map(s=>s.trim()).filter(Boolean);
    }
    function tickerHtml(text){
      // *word* → เน้นสี Lime
      return esc(text).replace(/\*([^*]+)\*/g, "<b>$1</b>");
    }
    function buildTicker(){
      const bar = $("tickerBar"), track = $("tickerTrack");
      const items = tickerItems();
      const show = cfg.display.tickerOn && items.length > 0 && running;
      bar.hidden = !show;
      if (!show){ track.innerHTML = ""; return; }
      const spark = '<svg class="tick-spark" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
        '<path d="M12 2l2.2 6.6L21 11l-6.8 2.4L12 20l-2.2-6.6L3 11l6.8-2.4z"/></svg>';
      const seq = items.map(t=>'<span class="tick-item">'+spark+'<span>'+tickerHtml(t)+'</span></span>').join("");
      track.innerHTML = seq + seq; // duplicate for seamless loop
      requestAnimationFrame(()=>{
        const half = track.scrollWidth / 2;
        const speeds = { slow:40, normal:70, fast:115 };
        const px = speeds[cfg.display.tickerSpeed] || 70;
        track.style.animationDuration = Math.max(8, half / px) + "s";
      });
    }

    /* ---------- display / layout ---------- */
    // แสดง profileLabel เป็นบรรทัดหลักบนหัวจอ (บริบทหลักสูตร) โดย session label (พัก..นาที)
    // จะกลายเป็นบรรทัดรอง — ถ้าไม่มี profileLabel ก็แสดง session label แบบเดิมทุกอย่าง
    function renderSessHeader(){
      const pl = ((cfg.display && cfg.display.profileLabel) || "").trim();
      const pEl = $("profileLabel");
      const sess = pEl && pEl.parentElement;
      if (pEl){ pEl.textContent = pl; pEl.hidden = !pl; }
      if (sess) sess.classList.toggle("has-profile", !!pl);
    }

    function applyDisplay(){
      document.body.dataset.layout = cfg.display.layout || "standard";
      const showTimerUi = running && !infiniteMode && cfg.display.showCountdown;
      $("countCard").hidden = !(showTimerUi && cfg.display.layout !== "video");
      $("miniCount").hidden = !(showTimerUi && cfg.display.layout === "video");
      $("btnPlus5").hidden = !running || infiniteMode;
      $("btnMinus5").hidden = !running || infiniteMode;
      renderSessHeader();
      buildTicker();
      $("footSlogan").textContent = cfg.slogan;
      $("footSite").textContent = cfg.site;
    }

    /* ---------- player mount ---------- */
    function mountPlayer(){
      const panel = $("videoPanel");
      panel.querySelectorAll("iframe").forEach(f=>f.remove());
      const src = buildEmbedSrc(todayEntries(), muted, cfg, IS_FILE, location.origin);
      if (src){
        $("noVideo").hidden = true;
        playerFrame = document.createElement("iframe");
        playerFrame.src = src;
        playerFrame.allow = "autoplay; encrypted-media; picture-in-picture";
        playerFrame.setAttribute("allowfullscreen","");
        playerFrame.referrerPolicy = "strict-origin-when-cross-origin";
        playerFrame.title = "YouTube video player";
        playerFrame.addEventListener("load", ()=>{
          try{
            playerFrame.contentWindow.postMessage(
              JSON.stringify({ event:"listening", id:"break-player", channel:"widget" }), "*");
          }catch(e){}
        });
        panel.appendChild(playerFrame);
      } else {
        playerFrame = null;
        $("noVideo").hidden = false;
      }
      $("fileWarn").hidden = !(IS_FILE && src);
    }

    /* ---------- break flow ---------- */
    function startBreak(minutes, label, startMuted){
      running = true;
      infiniteMode = !(minutes > 0);
      muted = !!startMuted;
      if (!infiniteMode){
        totalMs = minutes * 60000;
        endAt = Date.now() + totalMs;
        updateResumeAt();
      }
      $("sessionLabel").textContent = infiniteMode
        ? (label || "เล่นวิดีโอต่อเนื่อง")
        : (label || "พักเบรก") + " " + minutes + " นาที";
      $("todayChip").textContent = "วัน" + DAY_NAMES[new Date().getDay()];
      updateMuteBtn(); // #4 reflect initial mute state on the speaker icon

      mountPlayer();

      document.body.classList.add("in-break");
      $("screenStart").hidden = true;
      $("overlayEnd").hidden = true;
      $("screenBreak").hidden = false;

      startPromo();
      applyDisplay();
      clearInterval(tickId); tickId = null;
      if (!infiniteMode){
        tickId = setInterval(tickCountdown, 250);
        tickCountdown();
      }
    }

    function updateResumeAt(){
      const d = new Date(endAt);
      const t = pad2(d.getHours())+":"+pad2(d.getMinutes());
      $("resumeAt").textContent = t;
      $("miniResume").textContent = t;
    }
    function fmtRemain(ms){
      const s = Math.max(0, Math.ceil(ms/1000));
      const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), ss = s%60;
      return h > 0 ? h+":"+pad2(m)+":"+pad2(ss) : pad2(m)+":"+pad2(ss);
    }
    function tickCountdown(){
      const remain = endAt - Date.now();
      const txt = fmtRemain(remain);
      $("countDigits").textContent = txt;
      $("miniDigits").textContent = txt;
      const pct = totalMs > 0 ? Math.max(0, Math.min(1, remain/totalMs)) : 0;
      $("progBar").style.width = (pct*100).toFixed(2) + "%";
      const warn = remain <= cfg.warnSec*1000 && remain > 0;
      $("countCard").classList.toggle("warn", warn);
      $("miniCount").classList.toggle("warn", warn);
      if (remain <= 0) finishBreak();
    }
    function adjustMinutes(delta){
      if (!running || infiniteMode) return;
      const now = Date.now();
      let newEnd = endAt + delta*60000;
      if (newEnd <= now) newEnd = now + 1000;
      totalMs = Math.max(60000, totalMs + (newEnd - endAt));
      endAt = newEnd;
      updateResumeAt();
      tickCountdown();
    }
    function finishBreak(){
      if (!running) return;
      running = false;
      clearInterval(tickId); tickId = null;
      stopPromo();
      if (IS_FILE){
        $("videoPanel").querySelectorAll("iframe").forEach(f=>f.remove());
        playerFrame = null;
      } else {
        ytCmd("pauseVideo"); ytCmd("mute");
      }
      $("endMsgTitle").textContent = cfg.endTitle;
      $("endMsgSub").textContent = cfg.endSub;
      $("overlayEnd").hidden = false;
      $("countCard").classList.remove("warn");
      $("miniCount").classList.remove("warn");
      $("countDigits").textContent = "00:00";
      $("miniDigits").textContent = "00:00";
      $("progBar").style.width = "0%";
      if (cfg.chime) playChime();
    }
    function stopAllToHome(){
      running = false; infiniteMode = false;
      clearInterval(tickId); tickId = null;
      stopPromo();
      const panel = $("videoPanel");
      panel.querySelectorAll("iframe").forEach(f=>f.remove());
      playerFrame = null;
      document.body.classList.remove("in-break");
      $("overlayEnd").hidden = true;
      $("screenBreak").hidden = true;
      $("miniCount").hidden = true;
      $("screenStart").hidden = false;
      renderStart();
    }
    function extendFive(){
      $("overlayEnd").hidden = true;
      running = true; infiniteMode = false;
      totalMs = 5*60000;
      endAt = Date.now() + totalMs;
      updateResumeAt();
      if (!playerFrame){
        mountPlayer();
      } else {
        ytCmd("playVideo");
        if (!muted) ytCmd("unMute");
      }
      startPromo();
      applyDisplay();
      clearInterval(tickId);
      tickId = setInterval(tickCountdown, 250);
      tickCountdown();
    }

    /* ---------- chime (WebAudio) ---------- */
    function playChime(){
      try{
        const ctx = new (window.AudioContext||window.webkitAudioContext)();
        const seq = [[659.25,0],[880,0.28],[659.25,0.9],[880,1.18],[659.25,1.8],[880,2.08]];
        seq.forEach(([f,t])=>{
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = "sine"; o.frequency.value = f;
          g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
          g.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + t + 0.03);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.5);
          o.connect(g); g.connect(ctx.destination);
          o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.55);
        });
      }catch(e){}
    }

    /* ---------- QR (สร้างในเครื่อง) ---------- */
    function qrDataUrl(data){
      try{
        if (typeof qrcode !== "function") return null;
        const qr = qrcode(0, "M");
        qr.addData(data);
        qr.make();
        return qr.createDataURL(4, 2);
      }catch(e){ return null; }
    }

    /* ---------- promo rotation ---------- */
    function renderPromo(i, instant){
      const list = cfg.courses;
      const body = $("promoBody");
      const apply = ()=>{
        if (!list.length){
          $("promoBadge").hidden = true;
          $("promoTitle").textContent = "ยังไม่มีหลักสูตรแนะนำ";
          $("promoMeta").textContent = "";
          $("promoDesc").textContent = "เพิ่มหลักสูตรได้ที่เมนูตั้งค่า (หลังบ้าน)";
          setCover(null, "9");
          setQr(SITE);
          renderDots(0,0);
          return;
        }
        const c = list[i % list.length];
        $("promoBadge").hidden = !c.badge;
        $("promoBadge").textContent = c.badge || "";
        $("promoTitle").textContent = c.title || "";
        $("promoMeta").textContent = c.meta || "";
        $("promoDesc").textContent = c.desc || "";
        const link = c.url || SITE;
        setCover(c.img, (c.title||"9").trim().charAt(0).toUpperCase());
        setQr(link);
        renderDots(list.length, i % list.length);
      };
      if (instant){ apply(); return; }
      body.classList.add("fade");
      setTimeout(()=>{ apply(); body.classList.remove("fade"); }, 360);
    }
    function setCover(url, initial){
      const img = $("promoCover"), fb = $("promoCoverFb");
      $("promoCoverInit").textContent = initial || "9";
      if (url){
        fb.hidden = true;
        img.hidden = false;
        img.onerror = ()=>{ img.hidden = true; fb.hidden = false; };
        img.src = url;
      } else {
        img.hidden = true;
        img.removeAttribute("src");
        fb.hidden = false;
      }
    }
    function setQr(link){
      const du = qrDataUrl(link);
      const wrap = $("qrWrap");
      if (du){ wrap.hidden = false; $("promoQr").src = du; }
      else { wrap.hidden = true; }
    }
    function renderDots(n, on){
      const d = $("promoDots");
      d.innerHTML = "";
      for (let k=0;k<n;k++){
        const el = document.createElement("i");
        if (k===on) el.className = "on";
        d.appendChild(el);
      }
    }
    function startPromo(){
      stopPromo();
      promoIdx = 0;
      renderPromo(0, true);
      const sec = Math.max(4, Number(cfg.rotateSec)||12);
      if (cfg.courses.length > 1){
        promoTimer = setInterval(()=>{
          promoIdx = (promoIdx+1) % cfg.courses.length;
          renderPromo(promoIdx, false);
        }, sec*1000);
      }
    }
    function stopPromo(){ clearInterval(promoTimer); promoTimer = null; }

    /* ---------- settings (back office) ---------- */
    let draft = null;

    // เติมทุก field ในฟอร์มตั้งค่าจาก draft ปัจจุบัน (ใช้ร่วมกันหลายที่ ไม่ซ้ำโค้ด)
    function refreshSettingsFields(){
      buildPresetEditor();
      buildVideoEditor();
      buildCourseEditor();
      $("optShuffle").checked = !!draft.playback.shuffle;
      $("optLoop").checked = !!draft.playback.loop;
      document.querySelectorAll('input[name="layoutMode"]').forEach(r=>{
        r.checked = (r.value === draft.display.layout);
      });
      $("optCountdown").checked = !!draft.display.showCountdown;
      $("tickerOn").checked = !!draft.display.tickerOn;
      $("tickerText").value = draft.display.tickerText || "";
      $("tickerSpeed").value = draft.display.tickerSpeed || "normal";
      $("rotateSec").value = draft.rotateSec;
      $("endTitle").value = draft.endTitle;
      $("endSub").value = draft.endSub;
      $("sloganText").value = draft.slogan;
      $("siteUrl").value = draft.site;
      $("chimeOn").checked = !!draft.chime;
    }

    // เติมตัวเลือกโปรไฟล์หลักสูตรจาก effectiveProfiles (seed + profiles.json) — idempotent
    function populateProfileSelect(){
      const sel = $("courseProfile");
      sel.innerHTML = '<option value="">— ค่าเริ่มต้นของสถาบัน —</option>';
      for (const id of Object.keys(effectiveProfiles)){
        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = effectiveProfiles[id].label || id;
        sel.appendChild(opt);
      }
    }

    // origin ล้วน (ไม่รวม pathname) สำหรับสร้างลิงก์หลักสูตรแบบ path /{slug}
    function courseLinkOrigin(){
      return (location.origin && location.origin !== "null") ? location.origin : "";
    }

    // อัปเดตช่องลิงก์หลักสูตรตามโปรไฟล์ที่เลือกใน picker — ลิงก์แบบ path /{slug}
    // (ISR cache ต่อ pathname) ไม่ใช่ ?course= เดิมอีกต่อไป
    function updateCourseLink(){
      const id = $("courseProfile").value;
      const el = $("courseLink");
      const btn = $("btnCopyCourseLink");
      if (id && effectiveProfiles[id]){
        el.value = courseLinkOrigin() + "/" + id;
        el.disabled = false; btn.disabled = false;
      } else {
        el.value = "";
        el.disabled = true; btn.disabled = true;
      }
    }

    // แจ้งเตือนเมื่อ ?course= ตอนโหลดไม่พบใน PROFILES
    function renderProfileNotice(){
      const n = $("courseNotice");
      if (unknownCourseId){
        n.textContent = "ไม่พบโปรไฟล์หลักสูตร '" + unknownCourseId + "' — กำลังใช้ค่าเริ่มต้น";
        n.hidden = false;
      } else {
        n.textContent = "";
        n.hidden = true;
      }
    }

    // เมื่อเปลี่ยนโปรไฟล์ใน picker: โหลดลง draft (partial-merge over DEFAULTS) แล้วสร้างฟอร์มใหม่
    // ไม่บันทึกอัตโนมัติ — ผู้ดูแลยังต้องกด "บันทึกการตั้งค่า" เอง
    function onProfileChange(){
      const id = $("courseProfile").value;
      if (id && effectiveProfiles[id]){
        const p = { ...effectiveProfiles[id] };
        delete p.label;                     // label เป็น UI metadata ไม่ใช่ config
        draft = mergeCfg(DEFAULTS, p);
      } else {
        draft = deepClone(DEFAULTS);
      }
      refreshSettingsFields();
      updateCourseLink();
    }

    function openSettings(){
      draft = deepClone(cfg);
      populateProfileSelect();
      $("courseProfile").value = activeCourseId;
      refreshSettingsFields();
      updateShareLink();
      updateCourseLink();
      renderProfileNotice();
      $("modalSettings").hidden = false;
    }
    function closeSettings(){ $("modalSettings").hidden = true; }

    function buildPresetEditor(){
      const box = $("presetEditor");
      box.innerHTML = "";
      draft.presets.forEach((p, idx)=>{
        const row = document.createElement("div");
        row.className = "preset-edit";
        row.innerHTML =
          '<input class="inp" type="text" placeholder="ชื่อปุ่ม เช่น พักเที่ยง">' +
          '<input class="inp" type="number" min="1" max="480" placeholder="นาที">' +
          '<button class="mini-x" title="ลบ">&times;</button>';
        const [name, min] = row.querySelectorAll("input");
        name.value = p.label; min.value = p.min;
        name.addEventListener("input", ()=> draft.presets[idx].label = name.value);
        min.addEventListener("input", ()=> draft.presets[idx].min = Number(min.value)||0);
        row.querySelector("button").addEventListener("click", ()=>{
          draft.presets.splice(idx,1); buildPresetEditor();
        });
        box.appendChild(row);
      });
    }

    function buildVideoEditor(){
      const same = draft.videos.mode !== "daily";
      $("vmSame").checked = same;
      $("vmDaily").checked = !same;
      $("videoSame").value = (draft.videos.same||[]).join("\n");
      const grid = $("dailyBox");
      grid.innerHTML = "";
      const order = [1,2,3,4,5,6,0];
      order.forEach(d=>{
        const f = document.createElement("div");
        f.className = "field";
        f.innerHTML = '<label>วัน'+DAY_NAMES[d]+'</label><textarea class="inp" rows="4"></textarea>';
        const ta = f.querySelector("textarea");
        ta.value = (draft.videos.byDay[String(d)]||[]).join("\n");
        ta.addEventListener("input", ()=>{
          draft.videos.byDay[String(d)] = ta.value.split(/\n+/).map(s=>s.trim()).filter(Boolean);
        });
        grid.appendChild(f);
      });
      toggleVideoMode();
    }
    function toggleVideoMode(){
      const daily = $("vmDaily").checked;
      draft.videos.mode = daily ? "daily" : "same";
      $("dailyBox").hidden = !daily;
      $("dailyHint").hidden = !daily;
    }

    function buildCourseEditor(){
      const box = $("courseEditor");
      box.innerHTML = "";
      draft.courses.forEach((c, idx)=>{
        const row = document.createElement("div");
        row.className = "course-edit";
        row.innerHTML =
          '<div class="stack">' +
            '<div class="duo">' +
              '<input class="inp f-badge" type="text" placeholder="ป้าย เช่น New">' +
              '<input class="inp f-title" type="text" placeholder="ชื่อหลักสูตร">' +
            '</div>' +
            '<input class="inp f-meta" type="text" placeholder="ข้อมูลย่อ เช่น 2 วัน (12 ชม.) · 8,500.-">' +
            '<textarea class="inp f-desc" rows="2" placeholder="คำอธิบายสั้น ๆ"></textarea>' +
            '<input class="inp f-img" type="text" placeholder="URL รูป Cover หลักสูตร">' +
            '<input class="inp f-url" type="text" placeholder="ลิงก์หน้าหลักสูตร (URL)">' +
          '</div>' +
          '<button class="mini-x" title="ลบ">&times;</button>';
        const q = sel => row.querySelector(sel);
        q(".f-badge").value = c.badge||""; q(".f-title").value = c.title||"";
        q(".f-meta").value = c.meta||""; q(".f-desc").value = c.desc||"";
        q(".f-img").value = c.img||""; q(".f-url").value = c.url||"";
        q(".f-badge").addEventListener("input", e=> draft.courses[idx].badge = e.target.value);
        q(".f-title").addEventListener("input", e=> draft.courses[idx].title = e.target.value);
        q(".f-meta").addEventListener("input",  e=> draft.courses[idx].meta  = e.target.value);
        q(".f-desc").addEventListener("input",  e=> draft.courses[idx].desc  = e.target.value);
        q(".f-img").addEventListener("input",   e=> draft.courses[idx].img   = e.target.value.trim());
        q(".f-url").addEventListener("input",   e=> draft.courses[idx].url   = e.target.value.trim());
        row.querySelector(".mini-x").addEventListener("click", ()=>{
          draft.courses.splice(idx,1); buildCourseEditor();
        });
        box.appendChild(row);
      });
    }

    function saveSettings(){
      draft.videos.same = $("videoSame").value.split(/\n+/).map(s=>s.trim()).filter(Boolean);
      draft.presets = draft.presets.filter(p=> p.min > 0);
      if (!draft.presets.length) draft.presets = deepClone(DEFAULTS.presets);
      draft.courses = draft.courses.filter(c=> (c.title||"").trim());
      draft.playback.shuffle = $("optShuffle").checked;
      draft.playback.loop = $("optLoop").checked;
      const lm = document.querySelector('input[name="layoutMode"]:checked');
      draft.display.layout = lm ? lm.value : "standard";
      draft.display.showCountdown = $("optCountdown").checked;
      draft.display.tickerOn = $("tickerOn").checked;
      draft.display.tickerText = $("tickerText").value;
      draft.display.tickerSpeed = $("tickerSpeed").value;
      draft.rotateSec = Math.max(4, Number($("rotateSec").value)||12);
      draft.endTitle = $("endTitle").value.trim() || DEFAULTS.endTitle;
      draft.endSub = $("endSub").value.trim() || DEFAULTS.endSub;
      draft.slogan = $("sloganText").value.trim() || DEFAULTS.slogan;
      draft.site = shortUrl($("siteUrl").value.trim()) || DEFAULTS.site;
      draft.chime = $("chimeOn").checked;

      cfg = draft;
      writeHash();
      storSet(cfg);
      renderStart();
      applyDisplay();
      if (running){ startPromo(); }
      const f = $("savedFlash");
      f.classList.add("on");
      setTimeout(()=> f.classList.remove("on"), 1800);
    }

    function resetDefaults(){
      draft = deepClone(DEFAULTS);
      $("courseProfile").value = "";   // กลับไปใช้ค่าเริ่มต้นของสถาบัน
      refreshSettingsFields();
      updateCourseLink();
    }

    /* ---------- misc UI ---------- */
    // #4 speaker icon toggle — presentation only. Swaps which lucide icon shows
    // (Volume2 ↔ VolumeX via the .is-muted class) and updates aria-label/title.
    // The mute/unmute logic itself (below) is unchanged.
    function updateMuteBtn(){
      const b = $("btnMute");
      if (!b) return;
      b.classList.toggle("is-muted", muted);
      const lbl = muted ? "เปิดเสียง" : "ปิดเสียง";
      b.setAttribute("aria-label", lbl);
      b.setAttribute("title", lbl);
    }
    function toggleMute(){
      muted = !muted;
      if (IS_FILE){
        if (running && playerFrame) mountPlayer();
      } else {
        ytCmd(muted ? "mute" : "unMute");
      }
      updateMuteBtn();
    }
    function toggleFullscreen(){
      if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
      else document.documentElement.requestFullscreen().catch(()=>{});
    }
    function copyShareLink(){
      const el = $("shareLink");
      el.select(); el.setSelectionRange(0, 99999);
      if (navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(el.value).catch(()=>{ try{document.execCommand("copy");}catch(e){} });
      } else {
        try{ document.execCommand("copy"); }catch(e){}
      }
      $("btnCopyLink").textContent = "คัดลอกแล้ว";
      setTimeout(()=> $("btnCopyLink").textContent = "คัดลอกลิงก์", 1600);
    }
    function copyCourseLink(){
      const el = $("courseLink");
      if (!el.value) return;
      el.select(); el.setSelectionRange(0, 99999);
      if (navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(el.value).catch(()=>{ try{document.execCommand("copy");}catch(e){} });
      } else {
        try{ document.execCommand("copy"); }catch(e){}
      }
      $("btnCopyCourseLink").textContent = "คัดลอกแล้ว";
      setTimeout(()=> $("btnCopyCourseLink").textContent = "คัดลอกลิงก์หลักสูตร", 1600);
    }

    /* ---------- events ---------- */
    $("btnCustomStart").addEventListener("click", ()=>{
      const m = Number($("customMin").value);
      if (m > 0) startBreak(m, "พักเบรก", false);
    });
    $("customMin").addEventListener("keydown", e=>{
      if (e.key === "Enter") $("btnCustomStart").click();
    });
    $("btnPlus5").addEventListener("click", ()=> adjustMinutes(5));
    $("btnMinus5").addEventListener("click", ()=> adjustMinutes(-5));
    $("btnMute").addEventListener("click", toggleMute);
    $("btnEnd").addEventListener("click", stopAllToHome);
    $("btnBackHome").addEventListener("click", stopAllToHome);
    $("btnExtend5").addEventListener("click", extendFive);
    document.querySelectorAll(".js-settings").forEach(b=> b.addEventListener("click", openSettings));
    document.querySelectorAll(".js-fullscreen").forEach(b=> b.addEventListener("click", toggleFullscreen));
    $("btnCloseSettings").addEventListener("click", closeSettings);
    $("btnSave").addEventListener("click", saveSettings);
    $("btnResetDefaults").addEventListener("click", resetDefaults);
    $("btnCopyLink").addEventListener("click", copyShareLink);
    $("btnCopyCourseLink").addEventListener("click", copyCourseLink);
    $("courseProfile").addEventListener("change", onProfileChange);
    $("btnAddPreset").addEventListener("click", ()=>{
      draft.presets.push({label:"พักเบรก", min:15}); buildPresetEditor();
    });
    $("btnAddCourse").addEventListener("click", ()=>{
      draft.courses.push({badge:"", title:"", meta:"", desc:"", img:"", url:""}); buildCourseEditor();
    });
    $("fileWarnClose").addEventListener("click", ()=> $("fileWarn").hidden = true);
    $("vmSame").addEventListener("change", toggleVideoMode);
    $("vmDaily").addEventListener("change", toggleVideoMode);
    $("modalSettings").addEventListener("click", e=>{
      if (e.target === $("modalSettings")) closeSettings();
    });
    const onKeydown = e=>{
      if (e.key === "Escape"){
        if (!$("modalSettings").hidden) closeSettings();
        else if (!$("overlayEnd").hidden) stopAllToHome();
      }
    };
    document.addEventListener("keydown", onKeydown);

    /* ---------- init ---------- */
    async function init(){
      // ลำดับความสำคัญของ config (เฉพาะเจาะจงสุดชนะ):
      //   1) #cfg=...            → snapshot ที่ freeze มาแล้ว (client-only, override เต็มรูปแบบ)
      //   2) initialProfile      → โปรไฟล์ที่ server resolve มาแล้วสำหรับเส้นทาง /{slug} (ISR)
      //   3) DEFAULTS/stored     → ค่าเริ่มต้นของสถาบัน (safety net)
      //
      // ความต่างจากเดิม: การ resolve หลักสูตรไม่พึ่ง fetch("/profiles.json") อีกต่อไป
      // เส้นทาง /{slug} จะได้โปรไฟล์จาก server (initialProfile) ตรง ๆ ผ่าน props —
      // ปิดจุดบั๊กที่ ?course= ไม่พบแล้วตกไป localStorage เก่า
      const m = location.hash.match(/#cfg=([A-Za-z0-9+/=_-]+)/);
      const qs = new URLSearchParams(location.search);

      if (m){
        // 1) #cfg= — client-only, ชนะทุกกรณี (แม้อยู่บนหน้า /{slug})
        const parsed = decodeCfg(m[1]);
        if (parsed) cfg = mergeCfg(DEFAULTS, parsed);
      } else if (initialProfile){
        // 2) โปรไฟล์จาก server (เส้นทาง /{slug})
        const p = { ...initialProfile };
        const plabel = p.label || "";         // เก็บ label ไว้แสดงบนหัวจอก่อนตัดทิ้ง
        delete p.label;                       // label ไม่ใช่ config ปกติ → ตัดก่อน merge
        cfg = mergeCfg(DEFAULTS, p);
        cfg.display.profileLabel = plabel;    // ใส่กลับเป็นค่าสำหรับ render (สตริงสั้น ๆ)
        activeCourseId = initialCourseSlug || "";
      } else if (initialCourseSlug){
        // 2') server เห็น slug แต่ MSDB ไม่มีโปรไฟล์นั้น → แจ้งเตือน + ใช้ DEFAULTS/stored
        //     (ห้าม fallback ไป localStorage สำหรับหลักสูตรที่ server รู้จักจริง; กรณีนี้คือ "ไม่รู้จัก")
        unknownCourseId = initialCourseSlug;
        const stored = await storGet();
        if (stored) cfg = mergeCfg(DEFAULTS, stored);
      } else {
        // 3) หน้าแรก (institution default) — พฤติกรรมเดิมทุกอย่าง
        const stored = await storGet();
        if (stored) cfg = mergeCfg(DEFAULTS, stored);
      }
      document.body.dataset.layout = cfg.display.layout || "standard";
      renderStart();
      updateShareLink();

      const raw = qs.get("start");
      if (raw !== null){
        const auto = Number(raw);
        // autostart เริ่มแบบปิดเสียงตามนโยบาย autoplay ของเบราว์เซอร์ (?start=0 = เล่นต่อเนื่อง)
        startBreak(auto > 0 ? auto : 0, auto > 0 ? "พักเบรก" : "เล่นวิดีโอต่อเนื่อง", true);
      }

      // ---- non-critical: เติมโปรไฟล์ชุดเต็มให้ตัวเลือกในหน้าตั้งค่า ----
      // best-effort, offline-safe; ไม่ block/ไม่ตัดสินการ resolve หลักสูตรหลัก
      loadProfilesForPicker();
    }

    // โหลด map โปรไฟล์ทั้งหมดจาก /profiles.json สำหรับ picker เท่านั้น (ไม่เกี่ยวกับ
    // การ resolve หลักสูตรที่แสดงอยู่) — ล้มเหลว/404/malformed → เหลือแต่ seed PROFILES
    async function loadProfilesForPicker(){
      let ext = null;
      try {
        ext = await fetch("/profiles.json").then(r => r.ok ? r.json() : null).catch(() => null);
      } catch(e){ ext = null; }
      if (!ext || typeof ext !== "object" || Array.isArray(ext)){
        if (ext) console.warn("profiles.json รูปแบบไม่ถูกต้อง — ใช้โปรไฟล์ seed ในไฟล์แทน");
        ext = null;
      }
      effectiveProfiles = { ...PROFILES, ...(ext || {}) };
      // โปรไฟล์ที่ server resolve มา (จาก MSDB) อาจยังไม่มีใน /profiles.json แบบ static
      // → ยัดเข้า picker เองเพื่อให้ตัวเลือกปัจจุบันปรากฏและลิงก์หลักสูตรสร้างได้
      if (initialCourseSlug && initialProfile && !effectiveProfiles[initialCourseSlug]){
        effectiveProfiles[initialCourseSlug] = initialProfile;
      }
      // ถ้าเปิดหน้าตั้งค่าค้างอยู่ ให้รีเฟรช select ให้เห็นชุดใหม่ทันที
      if (!$("modalSettings").hidden){
        populateProfileSelect();
        $("courseProfile").value = activeCourseId;
        updateCourseLink();
      }
    }
    init();

    /* ---------- cleanup (dev fast-refresh: don't stack timers/listeners) ---------- */
    return () => {
      clearInterval(clockId);
      clearInterval(tickId);
      clearInterval(promoTimer);
      document.removeEventListener("keydown", onKeydown);
    };
  }, []);

  return (
    <>
      {/* ambient orbital motif */}
      <div className="orbits" aria-hidden="true">
        <svg className="orb-tr" width="560" height="560" viewBox="0 0 560 560" fill="none">
          <circle cx="280" cy="280" r="200" stroke="#2486FF" strokeOpacity=".10"/>
          <circle cx="280" cy="280" r="278" stroke="#2486FF" strokeOpacity=".06"/>
          <circle cx="480" cy="280" r="4" fill="#2486FF" fillOpacity=".5"/>
          <circle cx="280" cy="80" r="3" fill="#D4F73F" fillOpacity=".55"/>
        </svg>
        <svg className="orb-bl" width="640" height="640" viewBox="0 0 640 640" fill="none">
          <circle cx="320" cy="320" r="230" stroke="#2486FF" strokeOpacity=".08"/>
          <circle cx="320" cy="320" r="318" stroke="#48B0FF" strokeOpacity=".05"/>
          <circle cx="550" cy="320" r="4" fill="#48B0FF" fillOpacity=".45"/>
        </svg>
      </div>

      {/* back to the home profile picker — only in the duration-selection state;
          hidden once a break starts (body.in-break) so it never overlaps the video/countdown */}
      <Link href="/" className="back-link">
        <ArrowLeft size={18} strokeWidth={1.8} />
        <span>Back</span>
      </Link>

      <div className="corner-actions" id="cornerActions">
        <button className="btn btn-icon js-settings" title="ตั้งค่า (หลังบ้าน)" aria-label="ตั้งค่า">
          <Settings size={18} strokeWidth={1.8} />
        </button>
        <button className="btn btn-icon js-fullscreen" title="เต็มจอ" aria-label="เต็มจอ">
          <Maximize size={18} strokeWidth={1.8} />
        </button>
      </div>

      {/* ================= START SCREEN ================= */}
      <section className="screen-start" id="screenStart">
        <img className="logo" src="/images/9expert-logo.png" width={720} height={255} alt="9Expert Training" />
        <div>
          <div className="eyebrow" style={{marginBottom:"10px"}}>Knowledge Provider</div>
          <h1>พักเบรก <span className="hl">Break Time</span></h1>
        </div>
        <p className="sub">เลือกเวลาพัก ระบบจะเปิดวิดีโอของวันนี้ พร้อมนับถอยหลังและแสดงหลักสูตรแนะนำโดยอัตโนมัติ</p>
        <p className="start-course" id="startProfile" hidden></p>
        <div className="preset-row" id="presetRow"></div>
        <div className="custom-row">
          <input type="number" id="customMin" min="1" max="480" placeholder="นาที" aria-label="กำหนดเวลาเอง (นาที)" />
          <button className="btn btn-lime" id="btnCustomStart">เริ่มพักตามเวลาที่กำหนด</button>
        </div>
        <p className="start-meta" id="startMeta"></p>
      </section>

      {/* ================= BREAK SCREEN ================= */}
      <section className="screen-break" id="screenBreak" hidden>
        <div className="ticker" id="tickerBar" hidden aria-hidden="true">
          <div className="ticker-track" id="tickerTrack"></div>
        </div>

        <header className="topbar">
          {/* #1 brand logo (next/image), far top-left of the header. File is
              /images/9exp-stand.png (the "9expert-stand" asset added to the repo). */}
          <Image className="logo" src="/images/9exp-stand.png" width={400} height={400} alt="9Expert Training" priority />

          {/* #2 wording block commented out — the logo now identifies the brand and the
              control cluster moved left, so the eyebrow + profile label are not needed here.
              The lab-session element is KEPT (hidden) because the imperative engine writes to
              $("sessionLabel") in startBreak(); removing it would throw. Restore by
              un-hiding and un-commenting. */}
          <div className="sess" hidden>
            {/* <span className="eyebrow">9Expert Training</span> */}
            {/* <span className="lab lab-profile" id="profileLabel" hidden></span> */}
            <span className="lab lab-session" id="sessionLabel">พักเบรก</span>
          </div>

          {/* #3 control cluster moved to the LEFT, immediately after the logo:
              [logo] [clock] [sound icon] [exit icon]. The trailing spacer keeps the
              right side of the bar empty. */}
          <span className="clock" id="clockNow">--:--:--</span>
          <div className="ctrls">
            <button className="btn" id="btnMinus5">-5 นาที</button>
            <button className="btn" id="btnPlus5">+5 นาที</button>

            {/* #4 mute → icon-only speaker toggle (Volume2 ↔ VolumeX). Both icons are
                rendered; CSS shows the one matching state via .is-muted (toggled by
                updateMuteBtn()). aria-label/title updated with state. */}
            <button className="btn btn-icon btn-mute" id="btnMute" aria-label="ปิดเสียง" title="ปิดเสียง">
              <Volume2 className="mute-on" size={18} strokeWidth={1.8} aria-hidden="true" />
              <VolumeX className="mute-off" size={18} strokeWidth={1.8} aria-hidden="true" />
            </button>

            {/* #5 settings (gear) not used on the running-break view — commented out, not deleted */}
            {/* <button className="btn btn-icon js-settings" title="ตั้งค่า" aria-label="ตั้งค่า">
              <Settings size={17} strokeWidth={1.8} />
            </button> */}

            <button className="btn btn-icon js-fullscreen" title="เต็มจอ" aria-label="เต็มจอ">
              <Maximize size={17} strokeWidth={1.8} />
            </button>

            {/* #6 จบเบรก → exit/leave icon (DoorOpen). Same onClick (stopAllToHome). */}
            <button className="btn btn-icon btn-blue" id="btnEnd" aria-label="จบเบรก" title="จบเบรก">
              <DoorOpen size={18} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
          <div className="spacer"></div>
        </header>

        <main className="layout">
          {/* left column: player + relocated page footer (#10) */}
          <div className="video-col">
            <div className="video-panel" id="videoPanel">
              <div className="no-video" id="noVideo" hidden>
                <div className="eyebrow">YouTube</div>
                <p>ยังไม่ได้ตั้งค่าวิดีโอสำหรับวันนี้ — เพิ่มลิงก์ YouTube ได้ที่เมนูตั้งค่า (หลังบ้าน)</p>
                <button className="btn btn-lime js-settings">ตั้งค่าวิดีโอ</button>
              </div>
              <div className="file-warn" id="fileWarn" hidden>
                <span><b>เปิดจากไฟล์โดยตรง (file://)</b> — YouTube จะบล็อกวิดีโอ (Error 153) เพราะไม่ได้รับ Referrer
                ให้เปิดไฟล์นี้ผ่านเว็บ (http/https) เช่น อัปโหลดขึ้น hosting หรือรันเซิร์ฟเวอร์ในเครื่อง แล้ววิดีโอจะเล่นได้ปกติ</span>
                <button id="fileWarnClose" aria-label="ปิดคำเตือน">×</button>
              </div>
            </div>

            {/* #10 footer relocated from the bottom of the right rail to the bottom-left of
                the page, underneath the YouTube player. Same IDs (footSlogan/footSite are
                written by applyDisplay/renderStart) and same span styling. */}
            <div className="rail-foot page-foot">
              <span className="slog" id="footSlogan">อย่าหยุดเรียนรู้</span>
              <span id="footSite">9experttraining.com</span>
            </div>
          </div>

          <aside className="rail">
            <div className="count-card" id="countCard">
              <div className="lbl">
                <span className="t">เหลือเวลาพักอีก</span>
                <span className="chip" id="todayChip">วันนี้</span>
              </div>
              <div className="count-digits" id="countDigits">15:00</div>
              <div className="prog"><i id="progBar"></i></div>
              <div className="resume-line">กลับเข้าอบรมเวลา <b id="resumeAt">--:--</b> น.</div>
            </div>

            <div className="promo-card">
              <div className="head">
                <span className="bar"></span>
                <span className="eyebrow" style={{color:"var(--sky)"}}>หลักสูตรแนะนำ</span>
              </div>
              <div className="promo-body" id="promoBody">
                <div className="promo-cover" id="promoCoverWrap">
                  <img id="promoCover" alt="Cover หลักสูตร" />
                  <div className="fb" id="promoCoverFb" hidden><span id="promoCoverInit">9</span></div>
                  <span className="promo-badge" id="promoBadge">แนะนำ</span>
                  {/* #7 QR moved ONTO the cover — anchored to the bottom-right corner,
                      white background + padding + rounded + shadow so it stays scannable
                      over any cover art. Same IDs; setQr() still targets these. */}
                  <div className="qr-wrap qr-overlay" id="qrWrap"><img id="promoQr" alt="QR Code ดูรายละเอียดหลักสูตร" /></div>
                </div>
                <div className="promo-title" id="promoTitle">—</div>
                {/* #8 meta line (duration · hours · price) hidden per redesign. Element is
                    KEPT in the DOM (hidden) because renderPromo() writes to $("promoMeta");
                    removing it would throw. Un-hide to restore. */}
                <div className="promo-meta" id="promoMeta" hidden></div>
                <p className="promo-desc" id="promoDesc">—</p>
                {/* #7/#9 promo-foot removed from view: the QR was relocated onto the cover
                    (above), and the "สแกนเพื่อดูรายละเอียดและตารางอบรม" caption is no longer
                    needed. Commented out (not deleted) for easy restore. No JS references
                    the .info/.scan nodes, so this is safe to comment. */}
                {/* <div className="promo-foot">
                  <div className="info">
                    <span className="scan">สแกนเพื่อดูรายละเอียด<br/>และตารางอบรม</span>
                  </div>
                </div> */}
                <div className="dots" id="promoDots"></div>
              </div>
            </div>

            {/* #10 rail-foot relocated to the left column (under the player) — see <main>. */}
          </aside>
        </main>
      </section>

      {/* floating mini countdown for video-focus layout */}
      <div className="mini-count" id="miniCount" hidden>
        <span className="d" id="miniDigits">15:00</span>
        <span className="r">กลับ <b id="miniResume">--:--</b> น.</span>
      </div>

      {/* ================= END OVERLAY ================= */}
      <div className="overlay" id="overlayEnd" hidden>
        <div className="end-box">
          <div className="ring">
            <Check size={40} strokeWidth={2.2} />
          </div>
          <h2 id="endMsgTitle">หมดเวลาพักแล้ว</h2>
          <p id="endMsgSub">เชิญกลับเข้าห้องอบรมได้เลยครับ</p>
          <div className="acts">
            <button className="btn btn-lime" id="btnBackHome">กลับหน้าหลัก</button>
            <button className="btn" id="btnExtend5">ต่อเวลาอีก 5 นาที</button>
          </div>
        </div>
      </div>

      {/* ================= SETTINGS MODAL ================= */}
      <div className="modal" id="modalSettings" hidden>
        <div className="panel" role="dialog" aria-modal="true" aria-label="ตั้งค่าหลังบ้าน">
          <div className="panel-head">
            <h2>ตั้งค่า (หลังบ้าน)</h2>
            <span className="saved-flash" id="savedFlash">บันทึกแล้ว</span>
            <button className="btn btn-icon x" id="btnCloseSettings" aria-label="ปิด">
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          <div className="panel-body">

            <div className="sec">
              <h3>เวลาเบรก (ปุ่มลัดหน้าแรก)</h3>
              <p className="hint">กำหนดปุ่มเวลาพักที่ใช้บ่อย เช่น พักเบรก 15 นาที หรือพักเที่ยง 60 นาที (หน้าแรกจะมีปุ่ม "เล่นวิดีโอต่อเนื่อง" แบบไม่จับเวลาให้อัตโนมัติ)</p>
              <div className="row-grid" id="presetEditor"></div>
              <button className="btn add-btn" id="btnAddPreset">+ เพิ่มปุ่มเวลา</button>
            </div>

            <div className="sec">
              <h3>โปรไฟล์หลักสูตร</h3>
              <p className="hint">เลือกหลักสูตรเพื่อโหลดชุดหลักสูตรแนะนำและวิดีโอที่กำหนดไว้สำหรับหลักสูตรนั้นลงในฟอร์มด้านล่าง แล้วตรวจทานก่อนกด "บันทึกการตั้งค่า" (การเลือกที่นี่ยังไม่บันทึกอัตโนมัติ)</p>
              <div className="field" style={{maxWidth:"420px"}}>
                <label htmlFor="courseProfile">หลักสูตร</label>
                <select className="inp" id="courseProfile">
                  <option value="">— ค่าเริ่มต้นของสถาบัน —</option>
                </select>
              </div>
              <p className="hint" id="courseNotice" style={{color:"var(--lime)",marginTop:"10px"}} hidden></p>
            </div>

            <div className="sec">
              <h3>วิดีโอ YouTube</h3>
              <p className="hint">วางลิงก์วิดีโอหรือเพลย์ลิสต์ YouTube บรรทัดละ 1 รายการ — รองรับ youtube.com/watch, youtu.be, Shorts และลิงก์ Playlist (playlist?list=...) ข้อความหลังลิงก์ในบรรทัดเดียวกันใช้เป็นโน้ตได้ ระบบอ่านเฉพาะลิงก์</p>
              <div className="radio-row">
                <label><input type="radio" name="vidMode" value="same" id="vmSame" /> ใช้รายการเดียวกันทุกวัน</label>
                <label><input type="radio" name="vidMode" value="daily" id="vmDaily" /> กำหนดรายวัน (จันทร์-อาทิตย์)</label>
              </div>
              <div className="field" id="sameBox">
                <label>รายการวิดีโอหลัก</label>
                <textarea className="inp" id="videoSame" rows="3" placeholder="เช่น https://www.youtube.com/playlist?list=XXXX"></textarea>
              </div>
              <div className="day-grid" id="dailyBox" hidden></div>
              <p className="hint" id="dailyHint" hidden>วันไหนเว้นว่างไว้ ระบบจะใช้รายการวิดีโอหลักแทน</p>
              <div className="check-row">
                <input type="checkbox" id="optShuffle" />
                <label htmlFor="optShuffle">สุ่มลำดับวิดีโอ <small>— ใช้ได้กับรายการวิดีโอ ส่วนลิงก์ Playlist จะเล่นตามลำดับใน Playlist</small></label>
              </div>
              <div className="check-row">
                <input type="checkbox" id="optLoop" />
                <label htmlFor="optLoop">เล่นวนซ้ำจนกว่าจะหมดเวลา <small>— ปิดแล้ววิดีโอจะหยุดเมื่อเล่นครบรายการ</small></label>
              </div>
            </div>

            <div className="sec">
              <h3>การแสดงผลบนจอ</h3>
              <p className="hint">เลือกสัดส่วนหน้าจอให้เหมาะกับแต่ละจุดติดตั้ง เปรียบเทียบได้ทันทีระหว่างเบรก</p>
              <div className="radio-stack">
                <label><input type="radio" name="layoutMode" value="standard" />
                  <span><b>มาตรฐาน</b><small>วิดีโอใหญ่ด้านซ้าย แถบหลักสูตรด้านขวาขนาดปกติ</small></span></label>
                <label><input type="radio" name="layoutMode" value="wide" />
                  <span><b>เน้นประชาสัมพันธ์</b><small>แถบขวากว้างขึ้น Cover และชื่อหลักสูตรใหญ่ขึ้น เหมาะกับจอหน้าห้องอบรม</small></span></label>
                <label><input type="radio" name="layoutMode" value="video" />
                  <span><b>วิดีโอเต็มจอ</b><small>ซ่อนแถบขวาทั้งหมด เหมาะกับทีวีห้องพักส่วนกลางที่ต้องการดูวิดีโออย่างเดียว</small></span></label>
                <label><input type="radio" name="layoutMode" value="projector" />
                  <span><b>โปรเจคเตอร์ (ตัวใหญ่ อ่านไกล)</b><small>เหมือนมาตรฐานแต่ขยายตัวเลข ตัวอักษร และ QR ให้ใหญ่ขึ้น เหมาะกับการมิเรอร์ขึ้นโปรเจคเตอร์ให้ผู้เรียนหลังห้องอ่านได้ชัด</small></span></label>
              </div>
              <div className="check-row">
                <input type="checkbox" id="optCountdown" />
                <label htmlFor="optCountdown">แสดงตัวนับถอยหลัง <small>— ปิดได้สำหรับจอที่ไม่ต้องโชว์เวลา (ระบบยังคงจบเบรกตามเวลาที่ตั้งไว้)</small></label>
              </div>
              <div className="check-row">
                <input type="checkbox" id="tickerOn" />
                <label htmlFor="tickerOn">แสดงข้อความวิ่งด้านบน</label>
              </div>
              <div className="two-col" style={{marginTop:"10px"}}>
                <div className="field">
                  <label>ข้อความวิ่ง (บรรทัดละ 1 ข้อความ — ใส่ *ดอกจัน* รอบคำที่อยากเน้นสี Lime)</label>
                  <textarea className="inp" id="tickerText" rows="4"></textarea>
                </div>
                <div className="field">
                  <label>ความเร็วข้อความวิ่ง</label>
                  <select className="inp" id="tickerSpeed">
                    <option value="slow">ช้า</option>
                    <option value="normal">ปกติ</option>
                    <option value="fast">เร็ว</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="sec">
              <h3>หลักสูตรแนะนำ (แถบด้านขวา)</h3>
              <p className="hint">การ์ดสลับแสดงอัตโนมัติ พร้อม Cover หลักสูตรจากเว็บไซต์และ QR Code (สร้างในเครื่อง ไม่ต้องพึ่งบริการภายนอก) — ใช้ URL รูปจากหน้าเว็บ 9experttraining.com ได้เลย</p>
              <div className="row-grid" id="courseEditor"></div>
              <button className="btn add-btn" id="btnAddCourse">+ เพิ่มหลักสูตร</button>
              <div className="field" style={{marginTop:"14px",maxWidth:"280px"}}>
                <label>สลับการ์ดทุก (วินาที)</label>
                <input className="inp" type="number" id="rotateSec" min="4" max="120" />
              </div>
            </div>

            <div className="sec">
              <h3>ทั่วไป</h3>
              <div className="two-col">
                <div className="field">
                  <label>ข้อความเมื่อหมดเวลา (บรรทัดหลัก)</label>
                  <input className="inp" id="endTitle" type="text" />
                </div>
                <div className="field">
                  <label>ข้อความเมื่อหมดเวลา (บรรทัดรอง)</label>
                  <input className="inp" id="endSub" type="text" />
                </div>
                <div className="field">
                  <label>สโลแกนมุมล่างขวา</label>
                  <input className="inp" id="sloganText" type="text" />
                </div>
                <div className="field">
                  <label>เว็บไซต์</label>
                  <input className="inp" id="siteUrl" type="text" />
                </div>
              </div>
              <div className="check-row" style={{marginTop:"14px"}}>
                <input type="checkbox" id="chimeOn" />
                <label htmlFor="chimeOn">ส่งเสียงเตือนเมื่อหมดเวลาพัก</label>
              </div>
            </div>

            <div className="sec">
              <h3>เปิดบนทีวี</h3>
              <p className="hint">การตั้งค่าทั้งหมดฝังอยู่ในลิงก์ด้านล่าง — คัดลอกไปเปิด/บุ๊กมาร์กบนเบราว์เซอร์ของทีวีได้เลย และเติม <b style={{color:"var(--sky)"}}>?start=15</b> ท้ายชื่อไฟล์เพื่อเริ่มนับถอยหลังทันที หรือ <b style={{color:"var(--sky)"}}>?start=0</b> เพื่อเล่นวิดีโอต่อเนื่องทันที (เริ่มแบบปิดเสียงตามนโยบายเบราว์เซอร์)<br/><br/><b style={{color:"var(--lime)"}}>สำคัญ:</b> YouTube กำหนดให้หน้าที่ฝังวิดีโอต้องส่ง Referrer — ต้องเปิดไฟล์นี้ผ่าน <b style={{color:"var(--sky)"}}>http/https</b> เท่านั้น เช่น อัปโหลดขึ้นเว็บไซต์ Cloudflare Pages หรือ Vercel ถ้าดับเบิลคลิกเปิดจากไฟล์ตรง ๆ (file://) หรือดูใน Preview ของ Claude.ai วิดีโอจะขึ้น Error 153 / ถูกบล็อก ทั้งที่ตั้งค่าถูกต้องแล้ว</p>
            </div>

          </div>

          <div className="panel-foot">
            <button className="btn btn-lime" id="btnSave">บันทึกการตั้งค่า</button>
            <button className="btn" id="btnResetDefaults">คืนค่าเริ่มต้น</button>
            <div className="share-stack">
              <div className="share-row">
                <input className="inp" id="shareLink" readOnly aria-label="ลิงก์ snapshot (#cfg=)" />
                <button className="btn" id="btnCopyLink">คัดลอกลิงก์</button>
              </div>
              <div className="share-row">
                <input className="inp" id="courseLink" readOnly aria-label="ลิงก์หลักสูตร (path /หลักสูตร)" placeholder="เลือกโปรไฟล์หลักสูตรด้านบนเพื่อสร้างลิงก์" />
                <button className="btn" id="btnCopyCourseLink">คัดลอกลิงก์หลักสูตร</button>
              </div>
              <p className="hint" style={{margin:0}}>
                <b style={{color:"var(--sky)"}}>ลิงก์หลักสูตร (path /หลักสูตร)</b> — สะท้อนโปรไฟล์ล่าสุดจาก MSDB ผ่าน ISR เสมอ เหมาะสำหรับส่งให้ผู้สอน/ปักหมุดไว้ เนื้อหาอัปเดตอัตโนมัติ ไม่ต้อง redeploy<br/>
                <b style={{color:"var(--lime)"}}>ลิงก์ snapshot (#cfg=)</b> — freeze ค่าที่ตั้งไว้ ณ ตอนนี้ทั้งหมด เหมาะกับการตั้งค่าเฉพาะกิจครั้งเดียว
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
