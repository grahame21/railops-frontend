function base64urlToString(value) {
  value = value.replace(/-/g, "+").replace(/_/g, "/");
  while (value.length % 4) value += "=";
  return atob(value);
}

async function hmacSha256(message, secret) {
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message)
  );

  const bytes = new Uint8Array(signature);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function getCookie(request, name) {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookies = cookieHeader.split(";").map(v => v.trim());

  for (const cookie of cookies) {
    if (cookie.startsWith(`${name}=`)) {
      return cookie.slice(name.length + 1);
    }
  }

  return "";
}

async function verifyToken(token, secret) {
  if (!token || !secret) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [encodedPayload, signature] = parts;
  const expected = await hmacSha256(encodedPayload, secret);

  if (signature !== expected) return null;

  const payload = JSON.parse(base64urlToString(encodedPayload));
  const now = Math.floor(Date.now() / 1000);

  if (!payload.exp || payload.exp < now) return null;

  return payload;
}

export default async (request, context) => {
  const url = new URL(request.url);
  const secret = Netlify.env.get("JWT_SECRET") || "";
  const token = getCookie(request, "railops_session");
  const session = await verifyToken(token, secret);

  if (!session) {
    return Response.redirect(`${url.origin}/login.html`, 302);
  }

  if (url.pathname === "/admin.html" && session.role !== "admin") {
    return Response.redirect(`${url.origin}/dashboard.html`, 302);
  }

  return context.next();
};