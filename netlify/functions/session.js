const crypto = require("crypto");

function verifyToken(token, secret) {
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
  if (!payload.exp || payload.exp < now) return null;

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
    const token = getCookie(event.headers.cookie, "railops_session");
    const payload = verifyToken(token, process.env.JWT_SECRET || "");

    if (!payload) {
      return {
        statusCode: 401,
        body: JSON.stringify({ ok: false, loggedIn: false }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ok: true,
        loggedIn: true,
        username: payload.sub,
        role: payload.role,
        expires: payload.exp,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: String(err.message || err) }),
    };
  }
};