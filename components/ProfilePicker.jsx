"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Live profile picker for the home page. Fetches the SAME-ORIGIN proxy
// (/api/profiles-list) — no MSDB key ever reaches the browser. Always shows
// the full list (never auto-redirects, even for a single profile).
export default function ProfilePicker() {
  const [state, setState] = useState({ loading: true, profiles: [] });

  useEffect(() => {
    let alive = true;
    fetch("/api/profiles-list", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { profiles: [] }))
      .catch(() => ({ profiles: [] }))
      .then((data) => {
        if (!alive) return;
        const profiles = Array.isArray(data?.profiles) ? data.profiles : [];
        setState({ loading: false, profiles });
      });
    return () => {
      alive = false;
    };
  }, []);

  const { loading, profiles } = state;

  return (
    <>
      {/* ambient orbital motif — same as BreakScreen so it feels like one product */}
      <div className="orbits" aria-hidden="true">
        <svg className="orb-tr" width="560" height="560" viewBox="0 0 560 560" fill="none">
          <circle cx="280" cy="280" r="200" stroke="#2486FF" strokeOpacity=".10" />
          <circle cx="280" cy="280" r="278" stroke="#2486FF" strokeOpacity=".06" />
          <circle cx="480" cy="280" r="4" fill="#2486FF" fillOpacity=".5" />
          <circle cx="280" cy="80" r="3" fill="#D4F73F" fillOpacity=".55" />
        </svg>
        <svg className="orb-bl" width="640" height="640" viewBox="0 0 640 640" fill="none">
          <circle cx="320" cy="320" r="230" stroke="#2486FF" strokeOpacity=".08" />
          <circle cx="320" cy="320" r="318" stroke="#48B0FF" strokeOpacity=".05" />
          <circle cx="550" cy="320" r="4" fill="#48B0FF" fillOpacity=".45" />
        </svg>
      </div>

      <section className="picker">
        <header className="picker-head">
          <img
            className="logo"
            src="/images/9expert-logo.png"
            width={720}
            height={255}
            alt="9Expert Training"
          />
          <div className="eyebrow">Knowledge Provider</div>
          <h1>
            เลือกหลักสูตร <span className="hl">Break Screen</span>
          </h1>
          <p className="picker-sub">
            เลือกโปรไฟล์หลักสูตรเพื่อเปิดหน้าจอพักเบรกที่กำหนดไว้ — เนื้อหาอัปเดตอัตโนมัติจากระบบหลังบ้าน
          </p>
        </header>

        {loading ? (
          <div className="picker-state" role="status" aria-live="polite">
            <span className="picker-spinner" aria-hidden="true" />
            <span>กำลังโหลดโปรไฟล์…</span>
          </div>
        ) : profiles.length === 0 ? (
          <div className="picker-state">
            <p className="picker-empty">ยังไม่มีโปรไฟล์</p>
            <p className="picker-empty-sub">เพิ่มโปรไฟล์หลักสูตรได้ที่ระบบหลังบ้าน (MSDB)</p>
          </div>
        ) : (
          <div className="picker-grid">
            {profiles.map((p) => (
              <Link key={p.slug} href={`/${p.slug}`} className="picker-card">
                <div className="picker-thumb">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt="" loading="lazy" />
                  ) : (
                    <span className="picker-thumb-fb" aria-hidden="true">
                      {(p.label || "9").trim().charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="picker-card-body">
                  <div className="picker-card-title">{p.label}</div>
                  <div className="picker-card-slug">/{p.slug}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
