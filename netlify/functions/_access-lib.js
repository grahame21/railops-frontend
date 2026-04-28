const crypto = require("crypto");

const COOKIE_NAME = "railops_session";
const STORE_NAME = "railops-access";

let cachedStore = null;

async function accessStore() {
  if (cachedStore) return cachedStore;

  const blobs = await import("@netlify/blobs");

  cachedStore = blobs.getStore({
    name: STORE_NAME,
    consistency: "strong",
  });

  return cachedStore;
}

function nowISO() {
  return new Date().toISOString();
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function json(statusCode, data, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
    body: JSON.stringify(data),
  };
}

function safeString(value) {
  return String(value || "").trim();
}

function randomId(prefix = "id") {
  return `${prefix}_${crypto.randomBytes(10).toString("hex")}`;
}

function randomSecret() {
  return crypto.randomBytes(32).toString("hex");
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function passwordHash(password, salt = randomSecret()) {
  const hash = crypto
    .pbkdf2Sync(String(password), salt, 120000, 64, "sha512")
    .toString("hex");

  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(":")) return false;

  const [salt, expected] = storedHash.split(":");

  const actual = crypto
    .pbkdf2Sync(String(password), salt, 120000, 64, "sha512")
    .toString("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  } catch {
    return false;
  }
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signSession(payload) {
  const secret = process.env.JWT_SECRET || "";

  if (!secret) {
    throw new Error("Missing JWT_SECRET");
  }

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

function verifySessionToken(token) {
  const secret = process.env.JWT_SECRET || "";

  if (!secret || !token) return null;

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

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64").toString("utf8")
    );

    if (!payload.exp || payload.exp < nowSeconds()) return null;

    return payload;
  } catch {
    return null;
  }
}

function getCookie(header, name) {
  const cookies = String(header || "")
    .split(";")
    .map((v) => v.trim());

  for (const cookie of cookies) {
    if (cookie.startsWith(`${name}=`)) {
      return cookie.slice(name.length + 1);
    }
  }

  return "";
}

function getSessionFromEvent(event) {
  const token = getCookie(
    event.headers.cookie || event.headers.Cookie || "",
    COOKIE_NAME
  );

  return verifySessionToken(token);
}

function requireAdmin(event) {
  const session = getSessionFromEvent(event);
  return session && session.role === "admin" ? session : null;
}

function sessionCookie(token, maxAge) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

async function readJSON(key) {
  try {
    const store = await accessStore();

    const value = await store.get(key, {
      type: "json",
      consistency: "strong",
    });

    return value || null;
  } catch (err) {
    console.error("readJSON failed:", key, err);
    return null;
  }
}

async function writeJSON(key, value) {
  const store = await accessStore();

  await store.setJSON(key, value, {
    consistency: "strong",
  });

  return value;
}

async function deleteKey(key) {
  const store = await accessStore();
  await store.delete(key);
}

async function listJSON(prefix) {
  const store = await accessStore();

  const result = await store.list({
    prefix,
  });

  const blobs = result.blobs || [];
  const items = [];

  for (const blob of blobs) {
    const item = await readJSON(blob.key);
    if (item) items.push(item);
  }

  return items;
}

function tokenKey(id) {
  return `tokens/${id}`;
}

function guestKey(username) {
  return `guests/${String(username || "").toLowerCase()}`;
}

function isExpired(record) {
  if (!record) return true;
  if (record.unlimited) return false;
  if (!record.expiresAt) return false;

  return new Date(record.expiresAt).getTime() < Date.now();
}

function expiryFromDays(days, unlimited) {
  if (unlimited) return null;

  const safeDays = Math.max(1, Math.min(Number(days || 7), 3650));

  return new Date(
    Date.now() + safeDays * 24 * 60 * 60 * 1000
  ).toISOString();
}

function publicToken(record) {
  if (!record) return null;

  return {
    id: record.id,
    label: record.label,
    role: record.role,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    unlimited: Boolean(record.unlimited),
    revoked: Boolean(record.revoked),
    deviceLocked: Boolean(record.deviceLocked),
    hasDevice: Boolean(record.deviceId),
    deviceId: record.deviceId ? `${record.deviceId.slice(0, 8)}…` : null,
    lastUsedAt: record.lastUsedAt || null,
    status: record.revoked ? "revoked" : isExpired(record) ? "expired" : "active",
  };
}

function publicGuest(record) {
  if (!record) return null;

  return {
    username: record.username,
    label: record.label,
    role: record.role,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    unlimited: Boolean(record.unlimited),
    disabled: Boolean(record.disabled),
    deviceLocked: Boolean(record.deviceLocked),
    hasDevice: Boolean(record.deviceId),
    deviceId: record.deviceId ? `${record.deviceId.slice(0, 8)}…` : null,
    lastUsedAt: record.lastUsedAt || null,
    status: record.disabled ? "disabled" : isExpired(record) ? "expired" : "active",
  };
}

async function sessionStillAllowed(session) {
  if (!session) return false;

  if (session.accessType === "admin") {
    return true;
  }

  if (session.accessType === "token") {
    const token = await readJSON(tokenKey(session.tokenId));

    if (!token || token.revoked || isExpired(token)) {
      return false;
    }

    return true;
  }

  if (session.accessType === "guest") {
    const guest = await readJSON(guestKey(session.username));

    if (!guest || guest.disabled || isExpired(guest)) {
      return false;
    }

    return true;
  }

  if (session.accessType === "legacyGuest") {
    return true;
  }

  return false;
}

module.exports = {
  COOKIE_NAME,
  json,
  safeString,
  randomId,
  randomSecret,
  sha256,
  passwordHash,
  verifyPassword,
  signSession,
  verifySessionToken,
  getCookie,
  getSessionFromEvent,
  requireAdmin,
  sessionCookie,
  clearSessionCookie,
  readJSON,
  writeJSON,
  deleteKey,
  listJSON,
  tokenKey,
  guestKey,
  isExpired,
  expiryFromDays,
  publicToken,
  publicGuest,
  sessionStillAllowed,
  nowISO,
  nowSeconds,
};