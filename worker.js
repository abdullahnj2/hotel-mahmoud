// ============================================================
// Hotel Booking System — Cloudflare Worker API (Hono + D1)
// نفس نمط البنية المستخدمة في jwatha-op (Workers + D1 + React)
// ============================================================
import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();
app.use("*", cors());

// ---------- أدوات مساعدة ----------
const nights = (ci, co) => Math.max(1, Math.round((new Date(co) - new Date(ci)) / 86400000));
const genBookingId = () => `JW-${Math.floor(1000 + Math.random() * 8999)}`;

// ---------- الغرف ----------
app.get("/api/rooms", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT r.*, rt.label_ar, rt.capacity, rt.base_price
     FROM rooms r JOIN room_types rt ON rt.id = r.type_id
     ORDER BY r.floor, r.number`
  ).all();
  return c.json(results);
});

app.patch("/api/rooms/:id/maintenance", async (c) => {
  const id = c.req.param("id");
  const { is_maintenance } = await c.req.json();
  await c.env.DB.prepare(`UPDATE rooms SET is_maintenance = ? WHERE id = ?`)
    .bind(is_maintenance ? 1 : 0, id)
    .run();
  return c.json({ ok: true });
});

// ---------- البحث عن غرف متاحة ----------
// GET /api/availability?check_in=2026-08-05&check_out=2026-08-07&guests=2&type=double
app.get("/api/availability", async (c) => {
  const { check_in, check_out, guests, type } = c.req.query();
  if (!check_in || !check_out) return c.json({ error: "check_in and check_out are required" }, 400);

  let query = `
    SELECT r.*, rt.label_ar, rt.capacity, rt.base_price
    FROM rooms r
    JOIN room_types rt ON rt.id = r.type_id
    WHERE r.is_maintenance = 0
      AND (? IS NULL OR rt.capacity >= ?)
      AND (? IS NULL OR r.type_id = ?)
      AND r.id NOT IN (
        SELECT room_id FROM bookings
        WHERE status IN ('confirmed','checked_in')
          AND check_in < ? AND check_out > ?
      )
    ORDER BY r.floor, r.number`;

  const g = guests ? Number(guests) : null;
  const { results } = await c.env.DB.prepare(query)
    .bind(g, g, type || null, type || null, check_out, check_in)
    .all();

  return c.json(results);
});

// ---------- الحجوزات ----------
app.get("/api/bookings", async (c) => {
  const { status, from, to } = c.req.query();
  let q = `SELECT b.*, r.number AS room_number, rt.label_ar AS room_type
           FROM bookings b
           JOIN rooms r ON r.id = b.room_id
           JOIN room_types rt ON rt.id = r.type_id
           WHERE 1=1`;
  const binds = [];
  if (status) { q += ` AND b.status = ?`; binds.push(status); }
  if (from)   { q += ` AND b.check_in >= ?`; binds.push(from); }
  if (to)     { q += ` AND b.check_out <= ?`; binds.push(to); }
  q += ` ORDER BY b.check_in`;
  const { results } = await c.env.DB.prepare(q).bind(...binds).all();
  return c.json(results);
});

// إنشاء حجز جديد (يُستخدم من واجهة النزيل)
app.post("/api/bookings", async (c) => {
  const body = await c.req.json();
  const { room_id, guest_name, guest_phone, guest_email, guests_count, check_in, check_out, notes } = body;

  if (!room_id || !guest_name || !guest_phone || !check_in || !check_out) {
    return c.json({ error: "missing required fields" }, 400);
  }

  // تحقق من عدم وجود تعارض قبل التأكيد (حماية من الحجز المزدوج)
  const clash = await c.env.DB.prepare(
    `SELECT id FROM bookings
     WHERE room_id = ? AND status IN ('confirmed','checked_in')
       AND check_in < ? AND check_out > ?`
  ).bind(room_id, check_out, check_in).first();

  if (clash) return c.json({ error: "room_not_available" }, 409);

  const room = await c.env.DB.prepare(
    `SELECT rt.base_price FROM rooms r JOIN room_types rt ON rt.id = r.type_id WHERE r.id = ?`
  ).bind(room_id).first();
  if (!room) return c.json({ error: "room_not_found" }, 404);

  const id = genBookingId();
  const total = nights(check_in, check_out) * room.base_price;

  await c.env.DB.prepare(
    `INSERT INTO bookings (id, room_id, guest_name, guest_phone, guest_email, guests_count, check_in, check_out, status, total_amount, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?)`
  ).bind(id, room_id, guest_name, guest_phone, guest_email || null, guests_count || 1, check_in, check_out, total, notes || null).run();

  // ملاحظة: هنا مكان مناسب لإرسال إشعار تيليجرام/واتساب للاستقبال
  // مشابه لنمط الإشعارات المستخدم في jwatha-op

  return c.json({ id, total_amount: total }, 201);
});

// تحديث حالة الحجز (تسجيل دخول / خروج / إلغاء) — للوحة التحكم فقط
app.patch("/api/bookings/:id/status", async (c) => {
  const id = c.req.param("id");
  const { status } = await c.req.json();
  const allowed = ["confirmed", "checked_in", "checked_out", "cancelled"];
  if (!allowed.includes(status)) return c.json({ error: "invalid_status" }, 400);

  await c.env.DB.prepare(
    `UPDATE bookings SET status = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(status, id).run();

  return c.json({ ok: true });
});

// ---------- إحصائيات لوحة التحكم ----------
app.get("/api/stats/overview", async (c) => {
  const today = new Date().toISOString().slice(0, 10);

  const checkInsToday = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM bookings WHERE check_in = ? AND status != 'cancelled'`
  ).bind(today).first();

  const inHouse = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM bookings WHERE status = 'checked_in'`
  ).first();

  const totalRooms = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM rooms WHERE is_maintenance = 0`
  ).first();

  const revenue = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(total_amount),0) AS total FROM bookings WHERE status != 'cancelled'`
  ).first();

  return c.json({
    check_ins_today: checkInsToday.n,
    in_house: inHouse.n,
    rooms_available: totalRooms.n - inHouse.n,
    occupancy_rate: totalRooms.n ? Math.round((inHouse.n / totalRooms.n) * 100) : 0,
    total_revenue: revenue.total,
  });
});

export default app;
