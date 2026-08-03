import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  BedDouble, Users, CheckCircle2, XCircle, LogIn, LogOut,
  Search, Wrench, TrendingUp, Building2, Sparkles, ArrowRight, X, Loader2, AlertCircle
} from "lucide-react";
import {
  getRooms, getAvailability, createBooking, getBookings,
  updateBookingStatus, toggleRoomMaintenance, getStatsOverview
} from "./api.js";

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

/* ---------------- helpers ---------------- */
const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (iso, n) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};
const nightsBetween = (ci, co) => Math.max(1, Math.round((new Date(co) - new Date(ci)) / 86400000));
const arDay = (iso) => {
  const days = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  return days[new Date(iso).getDay()];
};
const arDate = (iso) => {
  const d = new Date(iso);
  const months = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
};
const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;
const money = (n) => `${Number(n).toLocaleString("en-US")} ر.س`;
const TODAY_ISO = toISO(new Date());

const STATUS_META = {
  confirmed: { label: "مؤكد", color: T.teal },
  checked_in: { label: "مسجل دخول", color: T.gold },
  checked_out: { label: "غادر", color: T.stone },
  cancelled: { label: "ملغى", color: T.danger },
};

/* ---------------- shared UI bits ---------------- */
function Badge({ status }) {
  const m = STATUS_META[status] || STATUS_META.confirmed;
  return (
    <span style={{
      background: `${m.color}1F`, color: m.color, border: `1px solid ${m.color}55`,
      padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
    }}>
      {m.label}
    </span>
  );
}
function Spinner({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.stone, fontSize: 13, padding: "40px 0", justifyContent: "center" }}>
      <Loader2 size={16} className="spin" /> {label || "جارِ التحميل..."}
    </div>
  );
}
function ErrorBox({ message, onRetry }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: T.danger, fontSize: 13, padding: "40px 0" }}>
      <AlertCircle size={20} />
      <span>{message || "تعذر الاتصال بالخادم"}</span>
      {onRetry && (
        <button onClick={onRetry} style={{ ...primaryBtn, marginTop: 6, padding: "6px 14px" }}>إعادة المحاولة</button>
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

/* ================= GUEST VIEW ================= */
function GuestView() {
  const [checkIn, setCheckIn] = useState(TODAY_ISO);
  const [checkOut, setCheckOut] = useState(addDays(TODAY_ISO, 1));
  const [guests, setGuests] = useState(2);
  const [typeFilter, setTypeFilter] = useState("all");
  const [typeOptions, setTypeOptions] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [modalRoom, setModalRoom] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [confirmed, setConfirmed] = useState(null);

  const n = nightsBetween(checkIn, checkOut);

  const search = useCallback(() => {
    setLoading(true);
    setError(null);
    getAvailability({ checkIn, checkOut, guests, type: typeFilter })
      .then((data) => {
        setRooms(data);
        if (typeOptions.length === 0) {
          const seen = new Map();
          data.forEach((r) => seen.set(r.type_id, r.label_ar));
          setTypeOptions(Array.from(seen, ([id, label]) => ({ id, label })));
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [checkIn, checkOut, guests, typeFilter, typeOptions.length]);

  useEffect(() => {
    // اجلب كل أنواع الغرف مرة واحدة (بدون فلترة) لتعبئة قائمة الأنواع
    getRooms().then((data) => {
      const seen = new Map();
      data.forEach((r) => seen.set(r.type_id, r.label_ar));
      setTypeOptions(Array.from(seen, ([id, label]) => ({ id, label })));
    }).catch(() => {});
  }, []);

  useEffect(() => { search(); }, [checkIn, checkOut, guests, typeFilter]); // eslint-disable-line

  const submitBooking = () => {
    if (!form.name.trim() || !form.phone.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    createBooking({
      room_id: modalRoom.id,
      guest_name: form.name.trim(),
      guest_phone: form.phone.trim(),
      guests_count: guests,
      check_in: checkIn,
      check_out: checkOut,
    })
      .then((res) => {
        setConfirmed({
          id: res.id,
          guestName: form.name.trim(),
          checkIn, checkOut,
          total: res.total_amount,
        });
        setModalRoom(null);
        setForm({ name: "", phone: "" });
        search();
      })
      .catch((e) => {
        setSubmitError(e.message === "room_not_available" ? "عذرًا، تم حجز هذه الغرفة للتو من نزيل آخر" : "تعذر إتمام الحجز، حاول مرة أخرى");
      })
      .finally(() => setSubmitting(false));
  };

  return (
    <div style={{ background: T.paper, minHeight: "100%" }}>
      <div style={{
        background: `linear-gradient(180deg, ${T.navy} 0%, ${T.navy2} 100%)`,
        padding: "48px 24px 90px", position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0, opacity: 0.12,
          backgroundImage: `radial-gradient(circle at 20% 30%, ${T.gold} 0, transparent 45%), radial-gradient(circle at 85% 60%, ${T.teal} 0, transparent 40%)`,
        }} />
        <div style={{ maxWidth: 980, margin: "0 auto", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.goldSoft, fontSize: 13, letterSpacing: 1, marginBottom: 14 }}>
            <Sparkles size={15} />
            <span style={{ fontFamily: "'Tajawal', sans-serif" }}>فندق نجم الشرق — الجُبيل</span>
          </div>
          <h1 style={{ fontFamily: "'Tajawal', sans-serif", fontWeight: 800, fontSize: 40, color: "#fff", margin: 0, lineHeight: 1.3 }}>
            إقامة هادئة، على ساحل الخليج
          </h1>
          <p style={{ color: "#C7CEDA", fontSize: 15, marginTop: 10, maxWidth: 520 }}>
            اختر تواريخك وشاهد الغرف المتاحة فورًا — بلا انتظار وبلا اتصال.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 980, margin: "-56px auto 0", padding: "0 24px", position: "relative" }}>
        <div style={{
          background: "#fff", borderRadius: 16, boxShadow: "0 18px 40px rgba(16,27,42,0.18)",
          padding: 20, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end",
        }}>
          <Field label="تاريخ الوصول">
            <input type="date" value={checkIn} min={TODAY_ISO}
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
              {typeOptions.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </Field>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.stone, fontSize: 13, marginInlineStart: "auto" }}>
            <Search size={16} />
            {n} {n === 1 ? "ليلة" : "ليالٍ"} {!loading && !error ? `· ${rooms.length} غرفة متاحة` : ""}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "32px 24px 60px" }}>
        {loading && <Spinner label="جارِ البحث عن الغرف المتاحة..." />}
        {!loading && error && <ErrorBox message="تعذر الاتصال بخادم الحجوزات" onRetry={search} />}
        {!loading && !error && rooms.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: T.stone }}>
            <BedDouble size={32} style={{ opacity: 0.4, marginBottom: 10 }} />
            <div style={{ fontFamily: "'Tajawal', sans-serif", fontWeight: 700, color: T.ink }}>لا توجد غرف متاحة لهذه التواريخ</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>جرّب تعديل التواريخ أو نوع الغرفة</div>
          </div>
        )}
        {!loading && !error && rooms.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {rooms.map((r) => (
              <div key={r.id} style={{
                background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 18,
                display: "flex", flexDirection: "column", gap: 10,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontFamily: "'Tajawal', sans-serif", fontWeight: 800, fontSize: 17, color: T.ink }}>
                      غرفة {r.label_ar}
                    </div>
                    <div style={{ fontSize: 12, color: T.stone, marginTop: 2 }}>الدور {r.floor} · رقم {r.number}</div>
                  </div>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: `${T.gold}1A`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <BedDouble size={19} color={T.gold} />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: T.stone, fontSize: 13 }}>
                  <Users size={14} /> حتى {r.capacity} {r.capacity === 1 ? "ضيف" : "ضيوف"}
                </div>
                <div style={{ height: 1, background: T.line, margin: "4px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontFamily: "'Tajawal', sans-serif", fontWeight: 800, fontSize: 20, color: T.ink }}>{r.base_price}</span>
                    <span style={{ fontSize: 12, color: T.stone }}> ر.س / ليلة</span>
                  </div>
                  <button onClick={() => { setModalRoom(r); setSubmitError(null); }} style={primaryBtn}>احجز الآن</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalRoom && (
        <Modal onClose={() => !submitting && setModalRoom(null)}>
          <div style={{ fontFamily: "'Tajawal', sans-serif", fontWeight: 800, fontSize: 18, color: T.ink, marginBottom: 4 }}>تأكيد الحجز</div>
          <div style={{ fontSize: 13, color: T.stone, marginBottom: 16 }}>غرفة {modalRoom.label_ar} رقم {modalRoom.number}</div>
          <SummaryRow label="الوصول" value={`${arDay(checkIn)} ${arDate(checkIn)}`} />
          <SummaryRow label="المغادرة" value={`${arDay(checkOut)} ${arDate(checkOut)}`} />
          <SummaryRow label="عدد الليالٍ" value={n} />
          <SummaryRow label="الإجمالي" value={money(n * modalRoom.base_price)} bold />
          <div style={{ height: 1, background: T.line, margin: "14px 0" }} />
          <Field label="الاسم الكامل">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: محمد العتيبي" style={inputStyle} />
          </Field>
          <div style={{ height: 10 }} />
          <Field label="رقم الجوال">
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="05XXXXXXXX" style={inputStyle} />
          </Field>
          {submitError && <div style={{ color: T.danger, fontSize: 12.5, marginTop: 10 }}>{submitError}</div>}
          <button onClick={submitBooking} disabled={!form.name.trim() || !form.phone.trim() || submitting}
            style={{ ...primaryBtn, width: "100%", marginTop: 18, padding: "12px 0", fontSize: 14, opacity: (!form.name.trim() || !form.phone.trim() || submitting) ? 0.5 : 1 }}>
            {submitting ? "جارِ التأكيد..." : "تأكيد الحجز"}
          </button>
        </Modal>
      )}

      {confirmed && (
        <Modal onClose={() => setConfirmed(null)}>
          <div style={{ textAlign: "center", padding: "10px 0 6px" }}>
            <CheckCircle2 size={40} color={T.teal} style={{ marginBottom: 10 }} />
            <div style={{ fontFamily: "'Tajawal', sans-serif", fontWeight: 800, fontSize: 18, color: T.ink }}>تم تأكيد حجزك</div>
            <div style={{ fontSize: 13, color: T.stone, marginTop: 4 }}>رقم الحجز: {confirmed.id}</div>
          </div>
          <div style={{ height: 1, background: T.line, margin: "16px 0" }} />
          <SummaryRow label="الضيف" value={confirmed.guestName} />
          <SummaryRow label="الوصول" value={arDate(confirmed.checkIn)} />
          <SummaryRow label="المغادرة" value={arDate(confirmed.checkOut)} />
          <SummaryRow label="الإجمالي" value={money(confirmed.total)} bold />
          <button onClick={() => setConfirmed(null)} style={{ ...primaryBtn, width: "100%", marginTop: 18, padding: "12px 0" }}>تم</button>
        </Modal>
      )}
    </div>
  );
}

/* ================= ADMIN VIEW ================= */
function AdminView() {
  const [tab, setTab] = useState("overview");

  return (
    <div style={{ background: T.parchment, minHeight: "100%" }}>
      <div style={{ background: T.navy, padding: "22px 24px 0" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#fff", marginBottom: 18 }}>
            <Building2 size={20} color={T.gold} />
            <span style={{ fontFamily: "'Tajawal', sans-serif", fontWeight: 800, fontSize: 18 }}>لوحة تحكم الفندق</span>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {[["overview", "نظرة عامة"], ["occupancy", "لوحة الإشغال"], ["bookings", "الحجوزات"], ["rooms", "الغرف"]].map(([k, label]) => (
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
        {tab === "overview" && <OverviewTab />}
        {tab === "occupancy" && <OccupancyTab />}
        {tab === "bookings" && <BookingsTab />}
        {tab === "rooms" && <RoomsTab />}
      </div>
    </div>
  );
}

function OverviewTab() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => {
    setError(null);
    getStatsOverview().then(setStats).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (error) return <ErrorBox onRetry={load} />;
  if (!stats) return <Spinner />;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
        <StatCard icon={<LogIn size={17} />} label="تسجيل دخول اليوم" value={stats.check_ins_today} color={T.gold} />
        <StatCard icon={<Users size={17} />} label="نزلاء داخل الفندق" value={stats.in_house} color={T.teal} />
        <StatCard icon={<BedDouble size={17} />} label="غرف متاحة الآن" value={stats.rooms_available} color={T.clay} />
        <StatCard icon={<TrendingUp size={17} />} label="نسبة الإشغال" value={`${stats.occupancy_rate}%`} color={T.navy} />
      </div>
      <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${T.line}`, padding: 20 }}>
        <div style={{ fontFamily: "'Tajawal', sans-serif", fontWeight: 800, color: T.ink, marginBottom: 4 }}>الإيراد الإجمالي (الحجوزات النشطة)</div>
        <div style={{ fontFamily: "'Tajawal', sans-serif", fontWeight: 800, fontSize: 30, color: T.navy }}>{money(stats.total_revenue)}</div>
      </div>
    </div>
  );
}

function OccupancyTab() {
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    Promise.all([getRooms(), getBookings()])
      .then(([r, b]) => { setRooms(r); setBookings(b); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(TODAY_ISO, i)), []);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox onRetry={load} />;

  return (
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
            <div style={{ color: "#C7CEDA", fontSize: 12, display: "flex", alignItems: "center" }}>{r.number} · {r.label_ar}</div>
            {days.map((d) => {
              const dEnd = addDays(d, 1);
              const b = bookings.find((bk) => bk.room_id === r.id && bk.status !== "cancelled" && overlaps(d, dEnd, bk.check_in, bk.check_out));
              const bg = r.is_maintenance ? "#3A3128" : b ? STATUS_META[b.status].color : "#1E3049";
              return (
                <div key={d} title={b ? `${b.guest_name} (${STATUS_META[b.status].label})` : r.is_maintenance ? "صيانة" : "متاح"}
                  style={{ height: 26, borderRadius: 4, background: bg, opacity: b || r.is_maintenance ? 0.9 : 0.5 }} />
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
  );
}

function BookingsTab() {
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    getBookings().then(setBookings).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const changeStatus = (id, status) => {
    setBusyId(id);
    updateBookingStatus(id, status)
      .then(() => setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b))))
      .catch(() => {})
      .finally(() => setBusyId(null));
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorBox onRetry={load} />;

  return (
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
            {[...bookings].sort((a, b) => a.check_in.localeCompare(b.check_in)).map((b) => (
              <tr key={b.id} style={{ borderTop: `1px solid ${T.line}`, opacity: busyId === b.id ? 0.5 : 1 }}>
                <td style={{ padding: "10px 14px", color: T.stone, fontFamily: "monospace" }}>{b.id}</td>
                <td style={{ padding: "10px 14px", fontWeight: 700, color: T.ink }}>{b.guest_name}</td>
                <td style={{ padding: "10px 14px" }}>{b.room_number} · {b.room_type}</td>
                <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>{arDate(b.check_in)}</td>
                <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>{arDate(b.check_out)}</td>
                <td style={{ padding: "10px 14px" }}><Badge status={b.status} /></td>
                <td style={{ padding: "10px 14px", fontWeight: 700 }}>{money(b.total_amount)}</td>
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    {b.status === "confirmed" && <IconBtn title="تسجيل دخول" onClick={() => changeStatus(b.id, "checked_in")}><LogIn size={14} /></IconBtn>}
                    {b.status === "checked_in" && <IconBtn title="تسجيل خروج" onClick={() => changeStatus(b.id, "checked_out")}><LogOut size={14} /></IconBtn>}
                    {(b.status === "confirmed" || b.status === "checked_in") && <IconBtn title="إلغاء" danger onClick={() => changeStatus(b.id, "cancelled")}><XCircle size={14} /></IconBtn>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RoomsTab() {
  const [rooms, setRooms] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    getRooms().then(setRooms).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = (r) => {
    setBusyId(r.id);
    toggleRoomMaintenance(r.id, r.is_maintenance ? 0 : 1)
      .then(() => setRooms((prev) => prev.map((x) => (x.id === r.id ? { ...x, is_maintenance: x.is_maintenance ? 0 : 1 } : x))))
      .catch(() => {})
      .finally(() => setBusyId(null));
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorBox onRetry={load} />;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
      {rooms.map((r) => (
        <div key={r.id} style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, padding: 16, opacity: busyId === r.id ? 0.6 : 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div>
              <div style={{ fontFamily: "'Tajawal', sans-serif", fontWeight: 800, color: T.ink }}>غرفة {r.number}</div>
              <div style={{ fontSize: 12, color: T.stone }}>الدور {r.floor} · {r.label_ar}</div>
            </div>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999,
              background: r.is_maintenance ? `${T.danger}1F` : `${T.teal}1F`,
              color: r.is_maintenance ? T.danger : T.teal,
            }}>
              {r.is_maintenance ? "صيانة" : "تشغيلية"}
            </span>
          </div>
          <div style={{ fontSize: 13, color: T.ink, marginBottom: 12 }}>{r.base_price} ر.س / ليلة</div>
          <button onClick={() => toggle(r)} disabled={busyId === r.id} style={{
            width: "100%", padding: "7px 0", borderRadius: 8, fontSize: 12.5, fontWeight: 700,
            cursor: "pointer", border: `1px solid ${T.line}`, background: T.paper, color: T.ink,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <Wrench size={13} /> {r.is_maintenance ? "إنهاء الصيانة" : "وضع تحت الصيانة"}
          </button>
        </div>
      ))}
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, padding: 16 }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: `${color}1A`, color, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
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

  return (
    <div dir="rtl" style={{ fontFamily: "'IBM Plex Sans Arabic', 'Tajawal', sans-serif", minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800;900&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        input, select, button { font-family: inherit; }
        input[type="date"] { color-scheme: light; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ display: "flex", justifyContent: "center", gap: 4, background: T.ink, padding: 8 }}>
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

      {view === "guest" ? <GuestView /> : <AdminView />}
    </div>
  );
}
