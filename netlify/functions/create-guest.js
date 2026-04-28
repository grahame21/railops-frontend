const {
  json,
  safeString,
  passwordHash,
  requireAdmin,
  writeJSON,
  readJSON,
  guestKey,
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

    const username = safeString(body.username).toLowerCase();
    const password = String(body.password || "");
    const label = safeString(body.label) || username;
    const days = Number(body.days || 30);
    const unlimited = Boolean(body.unlimited);
    const deviceLocked = body.deviceLocked !== false;

    if (!/^[a-z0-9_-]{3,32}$/.test(username)) {
      return json(400, {
        ok: false,
        error: "Username must be 3-32 characters using letters, numbers, _ or -",
      });
    }

    if (password.length < 6) {
      return json(400, {
        ok: false,
        error: "Password must be at least 6 characters",
      });
    }

    const existing = await readJSON(guestKey(username));
    if (existing) {
      return json(409, {
        ok: false,
        error: "Guest username already exists",
      });
    }

    const record = {
      username,
      label,
      role: "guest",
      passwordHash: passwordHash(password),
      createdAt: nowISO(),
      createdBy: admin.sub || "admin",
      expiresAt: expiryFromDays(days, unlimited),
      unlimited,
      disabled: false,
      deviceLocked,
      deviceId: null,
      deviceLockedAt: null,
      lastUsedAt: null,
    };

    await writeJSON(guestKey(username), record);

    return json(200, {
      ok: true,
      guest: {
        username: record.username,
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