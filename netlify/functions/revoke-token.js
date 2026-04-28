const {
  json,
  safeString,
  requireAdmin,
  readJSON,
  writeJSON,
  tokenKey,
  nowISO,
} = require("./_access-lib");

exports.handler = async function (event) {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    const admin = requireAdmin(event);
    if (!admin) return json(403, { ok: false, error: "Admin only" });

    const body = JSON.parse(event.body || "{}");
    const id = safeString(body.id);

    const record = await readJSON(tokenKey(id));
    if (!record) return json(404, { ok: false, error: "Token not found" });

    record.revoked = Boolean(body.revoked ?? true);
    record.revokedAt = record.revoked ? nowISO() : null;

    await writeJSON(tokenKey(id), record);

    return json(200, { ok: true });
  } catch (err) {
    return json(500, { ok: false, error: String(err.message || err) });
  }
};