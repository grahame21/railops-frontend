const {
  json,
  safeString,
  requireAdmin,
  deleteKey,
  guestKey,
} = require("./_access-lib");

exports.handler = async function (event) {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    const admin = requireAdmin(event);
    if (!admin) return json(403, { ok: false, error: "Admin only" });

    const body = JSON.parse(event.body || "{}");
    const username = safeString(body.username).toLowerCase();

    if (!username) return json(400, { ok: false, error: "Missing username" });

    await deleteKey(guestKey(username));

    return json(200, { ok: true });
  } catch (err) {
    return json(500, { ok: false, error: String(err.message || err) });
  }
};