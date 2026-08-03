import React, { useState, useMemo } from "react";
import {
  BedDouble, Users, Calendar, CheckCircle2, XCircle, LogIn, LogOut,
  Search, Wrench, TrendingUp, Building2, Sparkles, ArrowRight, X
} from "lucide-react";

/* ---------------- design tokens ---------------- */
const T = {
  navy: "#101B2A",
  navy2: "#16263B",
  gold: "#C9A227",
  goldSoft: "#E4C868",
  teal: "#2C6E68",
  clay: "#A9633F",
  parchment: "#F4F1E6",
  paper: "#FBF9F3",
  ink: "#1C2430",
  stone: "#83796A",
  line: "#E4DCC8",
  danger: "#B4483A",
};

const TODAY = new Date(2026, 7, 3); // Aug 3, 2026

/* ---------------- helpers ---------------- */
const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (iso, n) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};
const nights = (ci, co) => Math.max(1, Math.round((new Date(co) - new Date(ci)) / 86400000));
const arDay = (iso) => {
  const days = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const d = new Date(iso);
  return days[d.getDay()];
};
const arDate = (iso) => {
  const d = new Date(iso);
  const months = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
};
const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;
const money = (n) => `${n.toLocaleString("en-US")} ر.س`;

/* ---------------- seed data ---------------- */
const ROOM_TYPES = {
  single: { label: "مفردة", price: 250, capacity: 1 },
  double: { label: "مزدوجة", price: 380, capacity: 2 },
  suite: { label: "جناح", price: 650, capacity: 3 },
  family: { label: "عائلية", price: 500, capacity: 4 },
};

const INITIAL_ROOMS = [
  { id: "R101", number: "101", floor: 1, type: "single" },
  { id: "R102", number: "102", floor: 1, type: "single" },
  { id: "R103", number: "103", floor: 1, type: "single" },
  { id: "R201", number: "201", floor: 2, type: "double" },
  { id: "R202", number: "202", floor: 2, type: "double" },
  { id: "R203", number: "203", floor: 2, type: "double" },
  { id: "R204", number: "204", floor: 2, type: "double" },
  { id: "R301", number: "301", floor: 3, type: "suite" },
  { id: "R302", number: "302", floor: 3, type: "suite" },
  { id: "R401", number: "401", floor: 4, type: "family" },
].map((r) => ({ ...r, maintenance: false }));

let bookingSeq = 1006;
const mkBooking = (roomId, ci, nightsN, guestName, phone, status) => {
  const co = addDays(ci, nightsN);
  const room = INITIAL_ROOMS.find((r) => r.id === roomId);
  return {
    id: `JW-${bookingSeq++}`,
    roomId,
    guestName,
    phone,
    checkIn: ci,
    checkOut: co,
    guests: Math.min(2, ROOM_TYPES[room.type].capacity),
    status, // confirmed | checked_in | checked_out | cancelled
    total: nights(ci, co) * ROOM_TYPES[room.type].price,
  };
};

const INITIAL_BOOKINGS = [
  mkBooking("R101", toISO(TODAY), 2, "سالم القحطاني", "0501112233", "checked_in"),
  mkBooking("R201", addDays(toISO(TODAY), -1), 3, "فهد المطيري", "0559876543", "checked_in"),
  mkBooking("R301", toISO(TODAY), 1, "عبدالعزيز الشمري", "0533221144", "confirmed"),
  mkBooking("R202", addDays(toISO(TODAY), 2), 2, "خالد العتيبي", "0567788990", "confirmed"),
  mkBooking("R102", addDays(toISO(TODAY), 4), 1, "منصور الدوسري", "0512233445", "confirmed"),
  mkBooking("R401", addDays(toISO(TODAY), 1), 4, "أسرة الحربي", "0544455667", "confirmed"),
  mkBooking("R103", addDays(toISO(TODAY), -3), 2, "تركي العنزي", "0598765432", "checked_out"),
];

const STATUS_META = {
  confirmed: { label: "مؤكد", color: T.teal },
  checked_in: { label: "مسجل دخول", color: T.gold },
  checked_out: { label: "غادر", color: T.stone },
  cancelled: { label: "ملغى", color: T.danger },
};

/* ---------------- shared UI bits ---------------- */
function Badge({ status }) {
  const m = STATUS_META[status];
  return (
    <span
      style={{
        background: `${m.color}1F`,
        color: m.color,
        border: `1px solid ${m.color}55`,
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {m.label}
    </span>
  );
}

/* ================= GUEST VIEW ================= */
function GuestView({ rooms, bookings, addBooking }) {
  const [checkIn, setCheckIn] = useState(toISO(TODAY));
  const [checkOut, setCheckOut] = useState(addDays(toISO(TODAY), 1));
  const [guests, setGuests] = useState(2);
  const [typeFilter, setTypeFilter] = useState("all");
  const [modalRoom, setModalRoom] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [confirmed, setConfirmed] = useState(null);

  const n = nights(checkIn, checkOut);

  const available = useMemo(() => {
    return rooms.filter((r) => {
      if (r.maintenance) return false;
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (ROOM_TYPES[r.type].capacity < guests) return false;
      const clash = bookings.some(
        (b) =>
          b.roomId === r.id &&
          b.status !== "cancelled" &&
          b.status !== "checked_out" &&
          overlaps(checkIn, checkOut, b.checkIn, b.checkOut)
      );
      return !clash;
    });
  }, [rooms, bookings, checkIn, checkOut, guests, typeFilter]);

  const submitBooking = () => {
    if (!form.name.trim() || !form.phone.trim()) return;
    const booking = {
      id: `JW-${Math.floor(1000 + Math.random() * 8999)}`,
      roomId: modalRoom.id,
      guestName: form.name.trim(),
      phone: form.phone.trim(),
      checkIn,
      checkOut,
      guests,
      status: "confirmed",
      total: n * ROOM_TYPES[modalRoom.type].price,
    };
    addBooking(booking);
    setConfirmed(booking);
    setModalRoom(null);
    setForm({ name: "", phone: "" });
  };

  return (
    <div style={{ background: T.paper, minHeight: "100%" }}>
      {/* hero */}
      <div
        style={{
          background: `linear-gradient(180deg, ${T.navy} 0%, ${T.navy2} 100%)`,
          padding: "48px 24px 90px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute", inset: 0, opacity: 0.12,
            backgroundImage: `radial-gradient(circle at 20% 30%, ${T.gold} 0, transparent 45%), radial-gradient(circle at 85% 60%, ${T.teal} 0, transparent 40%)`,
          }}
        />
        <div style={{ maxWidth: 980, margin: "0 auto", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.goldSoft, fontSize: 13, letterSpacing: 1, marginBottom: 14 }}>
            <Sparkles size={15} />
            <span style={{ fontFamily: "'Tajawal', sans-serif" }}>فندق نجم الشرق — الجُبيل</span>
          </div>
          <h1 style={{
            fontFamily: "'Tajawal', sans-serif", fontWeight: 800, fontSize: 40, color: "#fff",
            margin: 0, lineHeight: 1.3,
          }}>
            إقامة هادئة، على ساحل الخليج
          </h1>
          <p style={{ color: "#C7CEDA", fontSize: 15, marginTop: 10, maxWidth: 520 }}>
            اختر تواريخك وشاهد الغرف المتاحة فورًا — بلا انتظار وبلا اتصال.
          </p>
        </div>
      </div>

      {/* search card */}
      <div style={{ maxWidth: 980, margin: "-56px auto 0", padding: "0 24px", position: "relative" }}>
        <div style={{
          background: "#fff", borderRadius: 16, boxShadow: "0 18px 40px rgba(16,27,42,0.18)",
          padding: 20, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end",
        }}>
          <Field label="تاريخ الوصول">
            <input type="date" value={checkIn} min={toISO(TODAY)}
              onChange={(e) => { setCheckIn(e.target.value); if (e.target.value >= checkOut) setCheckOut(addDays(e.target.value, 1)); }}
              style={inputStyle} />
          </Field>
          <Field label="تاريخ المغادرة">
            <input type="date" value={checkOut} min={addDays(checkIn, 1)}
              onChange={(e) => setCheckOut(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="عدد الضيوف">
            <select value={guests} onChange={(e) => setGuests(Number(e.target.value))} style={inputStyle}>
              {[1, 2, 3, 4].map((g) => <option key={g} value={g}>{g} {g === 1 ? "ضيف" : "ضيوف"}</option>)}
            </select>
          </Field>
          <Field label="نوع الغرفة">
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={inputStyle}>
              <option value="all">جميع الأنواع</option>
              {Object.entries(ROOM_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.stone, fontSize: 13, marginInlineStart: "auto" }}>
            <Search size={16} />
            {n} {n === 1 ? "ليلة" : "ليالٍ"} · {available.length} غرفة متاحة
          </div>
        </div>
      </div>

      {/* results */}
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "32px 24px 60px" }}>
        {available.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: T.stone }}>
            <BedDouble size={32} style={{ opacity: 0.4, marginBottom: 10 }} />
            <div style={{ fontFamily: "'Tajawal', sans-serif", fontWeight: 700, color: T.ink }}>لا توجد غرف متاحة لهذه التواريخ</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>جرّب تعديل التواريخ أو نوع الغرفة</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {available.map((r) => {
              const rt = ROOM_TYPES[r.type];
              return (
                <div key={r.id} style={{
                  background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 18,
                  display: "flex", flexDirection: "column", gap: 10,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontFamily: "'Tajawal', sans-serif", fontWeight: 800, fontSize: 17, color: T.ink }}>
                        غرفة {rt.label}
                      </div>
                      <div style={{ fontSize: 12, color: T.stone, marginTop: 2 }}>الدور {r.floor} · رقم {r.number}</div>
                    </div>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10, background: `${T.gold}1A`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <BedDouble size={19} color={T.gold} />
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: T.stone, fontSize: 13 }}>
                    <Users size={14} /> حتى {rt.capacity} {rt.capacity === 1 ? "ضيف" : "ضيوف"}
                  </div>
                  <div style={{ height: 1, background: T.line, margin: "4px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontFamily: "'Tajawal', sans-serif", fontWeight: 800, fontSize: 20, color: T.ink }}>{rt.price}</span>
                      <span style={{ fontSize: 12, color: T.stone }}> ر.س / ليلة</span>
                    </div>
                    <button onClick={() => setModalRoom(r)} style={primaryBtn}>
                      احجز الآن
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* booking modal */}
      {modalRoom && (
        <Modal onClose={() => setModalRoom(null)}>
          <div style={{ fontFamily: "'Tajawal', sans-serif", fontWeight: 800, fontSize: 18, color: T.ink, marginBottom: 4 }}>
            تأكيد الحجز
          </div>
          <div style={{ fontSize: 13, color: T.stone, marginBottom: 16 }}>
            غرفة {ROOM_TYPES[modalRoom.type].label} رقم {modalRoom.number}
          </div>
          <SummaryRow label="الوصول" value={`${arDay(checkIn)} ${arDate(checkIn)}`} />
          <SummaryRow label="المغادرة" value={`${arDay(checkOut)} ${arDate(checkOut)}`} />
          <SummaryRow label="عدد الليالٍ" value={n} />
          <SummaryRow label="الإجمالي" value={money(n * ROOM_TYPES[modalRoom.type].price)} bold />
          <div style={{ height: 1, background: T.line, margin: "14px 0" }} />
          <Field label="الاسم الكامل">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: محمد العتيبي" style={inputStyle} />
          </Field>
          <div style={{ height: 10 }} />
          <Field label="رقم الجوال">
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="05XXXXXXXX" style={inputStyle} />
          </Field>
          <button onClick={submitBooking} disabled={!form.name.trim() || !form.phone.trim()}
            style={{ ...primaryBtn, width: "100%", marginTop: 18, padding: "12px 0", fontSize: 14, opacity: (!form.name.trim() || !form.phone.trim()) ? 0.5 : 1 }}>
            تأكيد الحجز
          </button>
        </Modal>
      )}

      {/* confirmation modal */}
      {confirmed && (
        <Modal onClose={() => setConfirmed(null)}>
          <div style={{ textAlign: "center", padding: "10px 0 6px" }}>
            <CheckCircle2 size={40} color={T.teal} style={{ marginBottom: 10 }} />
            <div style={{ fontFamily: "'Tajawal', sans-serif", fontWeight: 800, fontSize: 18, color: T.ink }}>
              تم تأكيد حجزك
            </div>
            <div style={{ fontSize: 13, color: T.stone, marginTop: 4 }}>رقم الحجز: {confirmed.id}</div>
          </div>
          <div style={{ height: 1, background: T.line, margin: "16px 0" }} />
          <SummaryRow label="الضيف" value={confirmed.guestName} />
          <SummaryRow label="الوصول" value={arDate(confirmed.checkIn)} />
          <SummaryRow label="المغادرة" value={arDate(confirmed.checkOut)} />
          <SummaryRow label="الإجمالي" value={money(confirmed.total)} bold />
          <button onClick={() => setConfirmed(null)} style={{ ...primaryBtn, width: "100%", marginTop: 18, padding: "12px 0" }}>
            تم
          </button>
        </Modal>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 140px" }}>
      <span style={{ fontSize: 12, color: T.stone, fontWeight: 600 }}>{label}</span>
      {children}
    </div>
  );
}
function SummaryRow({ label, value, bold }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: bold ? 15 : 13.5 }}>
      <span style={{ color: T.stone }}>{label}</span>
      <span style={{ color: T.ink, fontWeight: bold ? 800 : 600 }}>{value}</span>
    </div>
  );
}
function Modal({ children, onClose }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(16,27,42,0.55)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16,
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 380,
        maxHeight: "90vh", overflowY: "auto", position: "relative",
      }}>
        <button onClick={onClose} style={{
          position: "absolute", insetInlineEnd: 16, insetBlockStart: 16, border: "none",
          background: T.parchment, borderRadius: 999, width: 28, height: 28, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <X size={14} color={T.stone} />
        </button>
        {children}
      </div>
    </div>
  );
}

const inputStyle = {
  border: `1px solid ${T.line}`, borderRadius: 9, padding: "9px 11px", fontSize: 13.5,
  fontFamily: "inherit", color: T.ink, background: T.paper, outline: "none", width: "100%",
  boxSizing: "border-box",
};
const primaryBtn = {
  background: T.navy, color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px",
  fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Tajawal', sans-serif",
};

/* ================= ADMIN VIEW ================= */
function AdminView({ rooms, setRooms, bookings, setBookings }) {
  const [tab, setTab] = useState("overview");

  const todayISO = toISO(TODAY);
  const checkInsToday = bookings.filter((b) => b.checkIn === todayISO && b.status !== "cancelled").length;
  const inHouse = bookings.filter((b) => b.status === "checked_in").length;
  const occupiedNow = new Set(
    bookings.filter((b) => b.status === "checked_in").map((b) => b.roomId)
  ).size;
  const freeNow = rooms.filter((r) => !r.maintenance).length - occupiedNow;
  const revenue = bookings.filter((b) => b.status !== "cancelled").reduce((s, b) => s + b.total, 0);
  const occRate = Math.round((occupiedNow / rooms.filter((r) => !r.maintenance).length) * 100);

  const updateStatus = (id, status) => {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
  };
  const toggleMaintenance = (id) => {
    setRooms((prev) => prev.map((r) => (r.id === id ? { ...r, maintenance: !r.maintenance } : r)));
  };

  const days = Array.from({ length: 14 }, (_, i) => addDays(todayISO, i));

  return (
    <div style={{ background: T.parchment, minHeight: "100%" }}>
      <div style={{ background: T.navy, padding: "22px 24px 0" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#fff", marginBottom: 18 }}>
            <Building2 size={20} color={T.gold} />
            <span style={{ fontFamily: "'Tajawal', sans-serif", fontWeight: 800, fontSize: 18 }}>لوحة تحكم الفندق</span>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {[
              ["overview", "نظرة عامة"],
              ["occupancy", "لوحة الإشغال"],
              ["bookings", "الحجوزات"],
              ["rooms", "الغرف"],
            ].map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} style={{
                background: "transparent", border: "none", cursor: "pointer",
                padding: "10px 16px", fontFamily: "'Tajawal', sans-serif", fontWeight: 700, fontSize: 13.5,
                color: tab === k ? "#fff" : "#8C99AD",
                borderBottom: tab === k ? `2px solid ${T.gold}` : "2px solid transparent",
              }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 24px 60px" }}>
        {tab === "overview" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
              <StatCard icon={<LogIn size={17} />} label="تسجيل دخول اليوم" value={checkInsToday} color={T.gold} />
              <StatCard icon={<Users size={17} />} label="نزلاء داخل الفندق" value={inHouse} color={T.teal} />
              <StatCard icon={<BedDouble size={17} />} label="غرف متاحة الآن" value={freeNow} color={T.clay} />
              <StatCard icon={<TrendingUp size={17} />} label="نسبة الإشغال" value={`${occRate}%`} color={T.navy} />
            </div>
            <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${T.line}`, padding: 20 }}>
              <div style={{ fontFamily: "'Tajawal', sans-serif", fontWeight: 800, color: T.ink, marginBottom: 4 }}>
                الإيراد الإجمالي (الحجوزات النشطة)
              </div>
              <div style={{ fontFamily: "'Tajawal', sans-serif", fontWeight: 800, fontSize: 30, color: T.navy }}>
                {money(revenue)}
              </div>
              <div style={{ fontSize: 12.5, color: T.stone, marginTop: 4 }}>عبر {bookings.filter(b=>b.status!=="cancelled").length} حجزًا</div>
            </div>
          </div>
        )}

        {tab === "occupancy" && (
          <div style={{ background: T.navy, borderRadius: 14, padding: 18, overflowX: "auto" }}>
            <div style={{ fontFamily: "'Tajawal', sans-serif", fontWeight: 800, color: "#fff", marginBottom: 14, fontSize: 15 }}>
              خريطة الإشغال — 14 يومًا القادمة
            </div>
            <div style={{ minWidth: 900 }}>
              <div style={{ display: "grid", gridTemplateColumns: `120px repeat(${days.length}, 1fr)`, gap: 3, marginBottom: 4 }}>
                <div />
                {days.map((d) => (
                  <div key={d} style={{ textAlign: "center", fontSize: 10.5, color: "#8C99AD" }}>
                    <div>{arDay(d).slice(0, 3)}</div>
                    <div style={{ color: "#5F6C80" }}>{new Date(d).getDate()}</div>
                  </div>
                ))}
              </div>
              {rooms.map((r) => (
                <div key={r.id} style={{ display: "grid", gridTemplateColumns: `120px repeat(${days.length}, 1fr)`, gap: 3, marginBottom: 3 }}>
                  <div style={{ color: "#C7CEDA", fontSize: 12, display: "flex", alignItems: "center" }}>
                    {r.number} · {ROOM_TYPES[r.type].label}
                  </div>
                  {days.map((d) => {
                    const dEnd = addDays(d, 1);
                    const b = bookings.find(
                      (bk) => bk.roomId === r.id && bk.status !== "cancelled" && overlaps(d, dEnd, bk.checkIn, bk.checkOut)
                    );
                    const bg = r.maintenance ? "#3A3128" : b ? STATUS_META[b.status].color : "#1E3049";
                    return (
                      <div key={d} title={b ? `${b.guestName} (${STATUS_META[b.status].label})` : r.maintenance ? "صيانة" : "متاح"}
                        style={{ height: 26, borderRadius: 4, background: bg, opacity: b || r.maintenance ? 0.9 : 0.5 }} />
                    );
                  })}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
              {Object.entries(STATUS_META).filter(([k]) => k !== "cancelled").map(([k, v]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#C7CEDA" }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: v.color }} /> {v.label}
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#C7CEDA" }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: "#3A3128" }} /> صيانة
              </div>
            </div>
          </div>
        )}

        {tab === "bookings" && (
          <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${T.line}`, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: T.parchment, textAlign: "start" }}>
                    {["رقم الحجز", "الضيف", "الغرفة", "الوصول", "المغادرة", "الحالة", "الإجمالي", "إجراءات"].map((h) => (
                      <th key={h} style={{ padding: "11px 14px", fontWeight: 700, color: T.stone, fontSize: 11.5, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...bookings].sort((a, b) => a.checkIn.localeCompare(b.checkIn)).map((b) => {
                    const room = rooms.find((r) => r.id === b.roomId);
                    return (
                      <tr key={b.id} style={{ borderTop: `1px solid ${T.line}` }}>
                        <td style={{ padding: "10px 14px", color: T.stone, fontFamily: "monospace" }}>{b.id}</td>
                        <td style={{ padding: "10px 14px", fontWeight: 700, color: T.ink }}>{b.guestName}</td>
                        <td style={{ padding: "10px 14px" }}>{room?.number} · {ROOM_TYPES[room?.type]?.label}</td>
                        <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>{arDate(b.checkIn)}</td>
                        <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>{arDate(b.checkOut)}</td>
                        <td style={{ padding: "10px 14px" }}><Badge status={b.status} /></td>
                        <td style={{ padding: "10px 14px", fontWeight: 700 }}>{money(b.total)}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            {b.status === "confirmed" && (
                              <IconBtn title="تسجيل دخول" onClick={() => updateStatus(b.id, "checked_in")}><LogIn size={14} /></IconBtn>
                            )}
                            {b.status === "checked_in" && (
                              <IconBtn title="تسجيل خروج" onClick={() => updateStatus(b.id, "checked_out")}><LogOut size={14} /></IconBtn>
                            )}
                            {(b.status === "confirmed" || b.status === "checked_in") && (
                              <IconBtn title="إلغاء" danger onClick={() => updateStatus(b.id, "cancelled")}><XCircle size={14} /></IconBtn>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "rooms" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
            {rooms.map((r) => (
              <div key={r.id} style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontFamily: "'Tajawal', sans-serif", fontWeight: 800, color: T.ink }}>غرفة {r.number}</div>
                    <div style={{ fontSize: 12, color: T.stone }}>الدور {r.floor} · {ROOM_TYPES[r.type].label}</div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999,
                    background: r.maintenance ? `${T.danger}1F` : `${T.teal}1F`,
                    color: r.maintenance ? T.danger : T.teal,
                  }}>
                    {r.maintenance ? "صيانة" : "تشغيلية"}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: T.ink, marginBottom: 12 }}>{ROOM_TYPES[r.type].price} ر.س / ليلة</div>
                <button onClick={() => toggleMaintenance(r.id)} style={{
                  width: "100%", padding: "7px 0", borderRadius: 8, fontSize: 12.5, fontWeight: 700,
                  cursor: "pointer", border: `1px solid ${T.line}`, background: T.paper, color: T.ink,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}>
                  <Wrench size={13} /> {r.maintenance ? "إنهاء الصيانة" : "وضع تحت الصيانة"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, padding: 16 }}>
      <div style={{
        width: 34, height: 34, borderRadius: 9, background: `${color}1A`, color,
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10,
      }}>
        {icon}
      </div>
      <div style={{ fontFamily: "'Tajawal', sans-serif", fontWeight: 800, fontSize: 22, color: T.ink }}>{value}</div>
      <div style={{ fontSize: 12, color: T.stone, marginTop: 2 }}>{label}</div>
    </div>
  );
}
function IconBtn({ children, onClick, title, danger }) {
  return (
    <button onClick={onClick} title={title} style={{
      width: 28, height: 28, borderRadius: 7, border: `1px solid ${danger ? T.danger + "55" : T.line}`,
      background: danger ? `${T.danger}12` : T.paper, color: danger ? T.danger : T.ink,
      display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
    }}>
      {children}
    </button>
  );
}

/* ================= ROOT ================= */
export default function App() {
  const [view, setView] = useState("guest");
  const [rooms, setRooms] = useState(INITIAL_ROOMS);
  const [bookings, setBookings] = useState(INITIAL_BOOKINGS);

  const addBooking = (b) => setBookings((prev) => [...prev, b]);

  return (
    <div dir="rtl" style={{ fontFamily: "'IBM Plex Sans Arabic', 'Tajawal', sans-serif", minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800;900&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        input, select, button { font-family: inherit; }
        input[type="date"] { color-scheme: light; }
      `}</style>

      <div style={{
        display: "flex", justifyContent: "center", gap: 4, background: T.ink, padding: 8,
      }}>
        <button onClick={() => setView("guest")} style={{
          background: view === "guest" ? T.gold : "transparent", color: view === "guest" ? T.ink : "#B9C0CC",
          border: "none", borderRadius: 8, padding: "7px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer",
          fontFamily: "'Tajawal', sans-serif", display: "flex", alignItems: "center", gap: 6,
        }}>
          واجهة النزيل <ArrowRight size={13} />
        </button>
        <button onClick={() => setView("admin")} style={{
          background: view === "admin" ? T.gold : "transparent", color: view === "admin" ? T.ink : "#B9C0CC",
          border: "none", borderRadius: 8, padding: "7px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer",
          fontFamily: "'Tajawal', sans-serif",
        }}>
          لوحة التحكم
        </button>
      </div>

      {view === "guest"
        ? <GuestView rooms={rooms} bookings={bookings} addBooking={addBooking} />
        : <AdminView rooms={rooms} setRooms={setRooms} bookings={bookings} setBookings={setBookings} />}
    </div>
  );
}
