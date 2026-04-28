const {
  json,
  safeString,
  sha256,
  verifyPassword,
  signSession,
  sessionCookie,
  readJSON,
  writeJSON,
  tokenKey,
  guestKey,
  isExpired,
  nowISO,
  nowSeconds,
} = require("./_access-lib");

async function handleTokenLogin(tokenText, deviceId) {
  const parts = String(tokenText || "").split(".");

  if (parts.length !== 2) {
    return {
      ok: false,
      status: 401,
      error: "Invalid token format",
    };
  }

  const [tokenId, tokenSecret] = parts;
  const record = await readJSON(tokenKey(tokenId));

  if (!record) {
    return {
      ok: false,
      status: 401,
      error: "Token not found",
    };
  }

  if (record.revoked) {
    return {
      ok: false,
      status: 401,
      error: "Token has been revoked",
    };
  }

  if (isExpired(record)) {
    return {
      ok: false,
      status: 401,
      error: "Token has expired",
    };
  }

  if (record.secretHash !== sha256(tokenSecret)) {
    return {
      ok: false,
      status: 401,
      error: "Invalid token secret",
    };
  }

  const cleanDeviceId = safeString(deviceId);

  if (record.deviceLocked) {
    if (!cleanDeviceId) {
      return {
        ok: false,
        status: 400,
        error: "Missing device ID",
      };
    }

    if (!record.deviceId) {
      record.deviceId = cleanDeviceId;
      record.deviceLockedAt = nowISO();
    } else if (record.deviceId !== cleanDeviceId) {
      return {
        ok: false,
        status: 403,
        error: "This token is locked to another device",
      };
    }
  }

  record.lastUsedAt = nowISO();
  await writeJSON(tokenKey(record.id), record);

  return {
    ok: true,
    role: "guest",
    subject: record.label || "token-guest",
    accessType: "token",
    tokenId: record.id,
    expiresAt: record.expiresAt,
    unlimited: record.unlimited,
  };
}

async function handleStoredGuestLogin(username, password, deviceId) {
  const record = await readJSON(guestKey(username));

  if (!record) {
    return null;
  }

  if (record.disabled) {
    return {
      ok: false,
      status: 401,
      error: "Guest login is disabled",
    };
  }

  if (isExpired(record)) {
    return {
      ok: false,
      status: 401,
      error: "Guest login has expired",
    };
  }

  if (!verifyPassword(password, record.passwordHash)) {
    return {
      ok: false,
      status: 401,
      error: "Invalid guest password",
    };
  }

  const cleanDeviceId = safeString(deviceId);

  if (record.deviceLocked) {
    if (!cleanDeviceId) {
      return {
        ok: false,
        status: 400,
        error: "Missing device ID",
      };
    }

    if (!record.deviceId) {
      record.deviceId = cleanDeviceId;
      record.deviceLockedAt = nowISO();
    } else if (record.deviceId !== cleanDeviceId) {
      return {
        ok: false,
        status: 403,
        error: "This guest login is locked to another device",
      };
    }
  }

  record.lastUsedAt = nowISO();
  await writeJSON(guestKey(record.username), record);

  return {
    ok: true,
    role: "guest",
    subject: record.username,
    accessType: "guest",
    username: record.username,
    expiresAt: record.expiresAt,
    unlimited: record.unlimited,
  };
}

exports.handler = async function (event) {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, {
        ok: false,
        error: "Method not allowed",
      });
    }

    const body = JSON.parse(event.body || "{}");

    const username = String(body.username || "").trim();
    const password = String(body.password || "").trim();
    const deviceId = safeString(body.deviceId);

    const adminUser = String(process.env.ADMIN_USERNAME || "").trim();
    const adminPass = String(process.env.ADMIN_PASSWORD || "").trim();
    const jwtSecret = String(process.env.JWT_SECRET || "").trim();

    const legacyGuestUser = String(process.env.GUEST_USERNAME || "").trim();
    const legacyGuestPass = String(process.env.GUEST_PASSWORD || "").trim();

    if (!jwtSecret) {
      return json(500, {
        ok: false,
        error: "Missing JWT_SECRET in Netlify environment variables",
      });
    }

    if (!adminUser || !adminPass) {
      return json(500, {
        ok: false,
        error: "Missing ADMIN_USERNAME or ADMIN_PASSWORD in Netlify environment variables",
      });
    }

    let auth = null;

    const usernameMatchesAdmin =
      username.toLowerCase() === adminUser.toLowerCase();

    const passwordMatchesAdmin =
      password === adminPass;

    if (username === "__token__") {
      auth = await handleTokenLogin(password, deviceId);
    } else if (usernameMatchesAdmin && passwordMatchesAdmin) {
      auth = {
        ok: true,
        role: "admin",
        subject: adminUser,
        accessType: "admin",
        unlimited: false,
      };
    } else {
      auth = await handleStoredGuestLogin(username.toLowerCase(), password, deviceId);

      if (
        !auth &&
        legacyGuestUser &&
        legacyGuestPass &&
        username.toLowerCase() === legacyGuestUser.toLowerCase() &&
        password === legacyGuestPass
      ) {
        auth = {
          ok: true,
          role: "guest",
          subject: legacyGuestUser,
          accessType: "legacyGuest",
          unlimited: false,
        };
      }
    }

    if (!auth || !auth.ok) {
      const debugHint = {
        typedUsernameLength: username.length,
        adminUsernameLength: adminUser.length,
        usernameMatchedAdmin: usernameMatchesAdmin,
        passwordLengthMatchedAdmin: password.length === adminPass.length,
      };

      return json(auth?.status || 401, {
        ok: false,
        error: auth?.error || "Invalid login",
        hint: debugHint,
      });
    }

    const now = nowSeconds();

    let expiresIn = 60 * 60 * 24 * 30;

    if (auth.accessType === "token" || auth.accessType === "guest") {
      if (auth.unlimited) {
        expiresIn = 60 * 60 * 24 * 3650;
      } else if (auth.expiresAt) {
        expiresIn = Math.max(
          60,
          Math.floor((new Date(auth.expiresAt).getTime() - Date.now()) / 1000)
        );
      }
    }

    const sessionPayload = {
      sub: auth.subject,
      role: auth.role,
      accessType: auth.accessType,
      iat: now,
      exp: now + expiresIn,
    };

    if (auth.tokenId) {
      sessionPayload.tokenId = auth.tokenId;
    }

    if (auth.username) {
      sessionPayload.username = auth.username;
    }

    const sessionToken = signSession(sessionPayload);

    return json(
      200,
      {
        ok: true,
        role: auth.role,
        accessType: auth.accessType,
        redirect: auth.role === "admin" ? "/admin.html" : "/dashboard.html",
      },
      {
        "Set-Cookie": sessionCookie(sessionToken, expiresIn),
      }
    );
  } catch (err) {
    return json(500, {
      ok: false,
      error: String(err.message || err),
    });
  }
};