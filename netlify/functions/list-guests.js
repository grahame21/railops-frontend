const {
  json,
  requireAdmin,
  listJSON,
  publicGuest,
} = require("./_access-lib");

exports.handler = async function (event) {
  try {
    const admin = requireAdmin(event);
    if (!admin) return json(403, { ok: false, error: "Admin only" });

    const guests = await listJSON("guests/");

    return json(200, {
      ok: true,
      guests: guests.map(publicGuest).sort((a, b) => {
        return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
      }),
    });
  } catch (err) {
    return json(500, { ok: false, error: String(err.message || err) });
  }
};