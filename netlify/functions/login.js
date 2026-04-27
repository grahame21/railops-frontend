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

exports.handler = async function (event) {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ ok: false, error: "Method not allowed" }),
      };
    }

    const body = JSON.parse(event.body || "{}");
    const username = String(body.username || "").trim();
    const password = String(body.password || "").trim();

    const adminUser = process.env.ADMIN_USERNAME || "admin";
    const adminPass = process.env.ADMIN_PASSWORD || "";
    const guestUser = process.env.GUEST_USERNAME || "guest";
    const guestPass = process.env.GUEST_PASSWORD || "";
    const secret = process.env.JWT_SECRET || "";

    if (!secret) {
      return {
        statusCode: 500,
        body: JSON.stringify({ ok: false, error: "Missing JWT_SECRET" }),
      };
    }

    let role = null;

    if (username === adminUser && password === adminPass) {
      role = "admin";
    }

    if (username === guestUser && password === guestPass) {
      role = "guest";
    }

    if (!role) {
      return {
        statusCode: 401,
        body: JSON.stringify({ ok: false, error: "Invalid login" }),
      };
    }

    const now = Math.floor(Date.now() / 1000);

    const payload = {
      sub: username,
      role,
      iat: now,
      exp: now + 60 * 60 * 24 * 30,
    };

    const token = sign(payload, secret);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `railops_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`,
      },
      body: JSON.stringify({
        ok: true,
        role,
        redirect: role === "admin" ? "/admin.html" : "/dashboard.html",
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: String(err.message || err) }),
    };
  }
};