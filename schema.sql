-- ============================================================
-- Hotel Booking System — Cloudflare D1 Schema
-- ============================================================

DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS room_types;
DROP TABLE IF EXISTS admin_users;

-- أنواع الغرف وأسعارها
CREATE TABLE room_types (
  id TEXT PRIMARY KEY,          -- single | double | suite | family
  label_ar TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  base_price REAL NOT NULL
);

-- الغرف الفعلية في الفندق
CREATE TABLE rooms (
  id TEXT PRIMARY KEY,          -- e.g. R101
  number TEXT NOT NULL UNIQUE,
  floor INTEGER NOT NULL,
  type_id TEXT NOT NULL REFERENCES room_types(id),
  is_maintenance INTEGER NOT NULL DEFAULT 0,  -- 0/1
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- الحجوزات
CREATE TABLE bookings (
  id TEXT PRIMARY KEY,          -- e.g. JW-1001
  room_id TEXT NOT NULL REFERENCES rooms(id),
  guest_name TEXT NOT NULL,
  guest_phone TEXT NOT NULL,
  guest_email TEXT,
  guests_count INTEGER NOT NULL DEFAULT 1,
  check_in TEXT NOT NULL,       -- ISO date YYYY-MM-DD
  check_out TEXT NOT NULL,      -- ISO date YYYY-MM-DD
  status TEXT NOT NULL DEFAULT 'confirmed',
      -- confirmed | checked_in | checked_out | cancelled
  total_amount REAL NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_bookings_room_dates ON bookings(room_id, check_in, check_out);
CREATE INDEX idx_bookings_status ON bookings(status);

-- مستخدمو لوحة التحكم (موظفو الاستقبال / الإدارة)
CREATE TABLE admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff', -- staff | manager
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- بيانات أولية
-- ============================================================
INSERT INTO room_types (id, label_ar, capacity, base_price) VALUES
  ('single', 'مفردة', 1, 250),
  ('double', 'مزدوجة', 2, 380),
  ('suite',  'جناح',   3, 650),
  ('family', 'عائلية', 4, 500);

INSERT INTO rooms (id, number, floor, type_id) VALUES
  ('R101','101',1,'single'), ('R102','102',1,'single'), ('R103','103',1,'single'),
  ('R201','201',2,'double'), ('R202','202',2,'double'), ('R203','203',2,'double'), ('R204','204',2,'double'),
  ('R301','301',3,'suite'),  ('R302','302',3,'suite'),
  ('R401','401',4,'family');
