const {
  json,
  safeString,
  randomId,
  randomSecret,
  sha256,
  requireAdmin,
  writeJSON,
  tokenKey,
  expiryFromDays,
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

    const id = randomId("tok");
    const secret = randomSecret();
    const label = safeString(body.label) || "guest-token";
    const days = Number(body.days || 7);
    const unlimited = Boolean(body.unlimited);
    const deviceLocked = body.deviceLocked !== false;

    const record = {
      id,
      label,
      role: "guest",
      secretHash: sha256(secret),
      createdAt: nowISO(),
      createdBy: admin.sub || "admin",
      expiresAt: expiryFromDays(days, unlimited),
      unlimited,
      revoked: false,
      deviceLocked,
      deviceId: null,
      deviceLockedAt: null,
      lastUsedAt: null,
    };

    await writeJSON(tokenKey(id), record);

    const token = `${id}.${secret}`;

    return json(200, {
      ok: true,
      token,
      accessUrl: `/access?token=${encodeURIComponent(token)}`,
      record: {
        id: record.id,
        label: record.label,
        expiresAt: record.expiresAt,
        unlimited: record.unlimited,
        deviceLocked: record.deviceLocked,
      },
    });
  } catch (err) {
    return json(500, { ok: false, error: String(err.message || err) });
  }
};