const crypto = require("crypto");

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function sign(payload, secret) {
  const encodedPayload = base64url(JSON.stringify(payload));

  const signature = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${encodedPayload}.${signature}`;
}

function verifySessionToken(token, secret) {
  if (!token || !secret) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [encodedPayload, signature] = parts;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  if (signature !== expected) return null;

  const json = Buffer.from(encodedPayload, "base64").toString("utf8");
  const payload = JSON.parse(json);

  const now = Math.floor(Date.now() / 1000);

  if (!payload.exp || payload.exp < now) {
    return null;
  }

  return payload;
}

function getCookie(header, name) {
  const cookies = String(header || "").split(";").map(v => v.trim());

  for (const cookie of cookies) {
    if (cookie.startsWith(`${name}=`)) {
      return cookie.slice(name.length + 1);
    }
  }

  return "";
}

exports.handler = async function (event) {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({
          ok: false,
          error: "Method not allowed",
        }),
      };
    }

    const secret = process.env.JWT_SECRET || "";

    if (!secret) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          ok: false,
          error: "Missing JWT_SECRET",
        }),
      };
    }

    const sessionToken = getCookie(event.headers.cookie, "railops_session");
    const session = verifySessionToken(sessionToken, secret);

    if (!session || session.role !== "admin") {
      return {
        statusCode: 403,
        body: JSON.stringify({
          ok: false,
          error: "Admin only",
        }),
      };
    }

    const body = JSON.parse(event.body || "{}");

    const label = String(body.label || "guest").trim();
    const unlimited = Boolean(body.unlimited);
    const days = Number(body.days || 1);

    const safeDays = Math.max(1, Math.min(days, 3650));
    const now = Math.floor(Date.now() / 1000);

    const payload = {
      sub: label,
      role: "guest",
      tokenLogin: true,
      iat: now,
      unlimited,
    };

    if (!unlimited) {
      payload.exp = now + safeDays * 24 * 60 * 60;
      payload.days = safeDays;
    }

    if (unlimited) {
      payload.exp = null;
      payload.days = null;
    }

    const token = sign(payload, secret);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ok: true,
        token,
        accessUrl: `/access?token=${encodeURIComponent(token)}`,
        unlimited,
        days: unlimited ? null : safeDays,
        expires: unlimited ? null : payload.exp,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        error: String(err.message || err),
      }),
    };
  }
};