// رابط الـ API الحقيقي المنشور على Cloudflare Workers
export const API_BASE = "https://hotel-mahmoud.abdullah-alnajim.workers.dev";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `request_failed_${res.status}`);
  }
  return data;
}

export const getRooms = () => request("/api/rooms");

export const getAvailability = ({ checkIn, checkOut, guests, type }) => {
  const params = new URLSearchParams({ check_in: checkIn, check_out: checkOut });
  if (guests) params.set("guests", guests);
  if (type && type !== "all") params.set("type", type);
  return request(`/api/availability?${params.toString()}`);
};

export const createBooking = (payload) =>
  request("/api/bookings", { method: "POST", body: JSON.stringify(payload) });

export const getBookings = (query = {}) => {
  const params = new URLSearchParams(query);
  const qs = params.toString();
  return request(`/api/bookings${qs ? `?${qs}` : ""}`);
};

export const updateBookingStatus = (id, status) =>
  request(`/api/bookings/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

export const toggleRoomMaintenance = (id, is_maintenance) =>
  request(`/api/rooms/${id}/maintenance`, {
    method: "PATCH",
    body: JSON.stringify({ is_maintenance }),
  });

export const getStatsOverview = () => request("/api/stats/overview");
