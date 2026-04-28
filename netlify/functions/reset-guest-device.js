const {
  json,
  safeString,
  requireAdmin,
  readJSON,
  writeJSON,
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

    const record = await readJSON(guestKey(username));
    if (!record) return json(404, { ok: false, error: "Guest not found" });

    record.deviceId = null;
    record.deviceLockedAt = null;

    await writeJSON(guestKey(username), record);

    return json(200, { ok: true });
  } catch (err) {
    return json(500, { ok: false, error: String(err.message || err) });
  }
};