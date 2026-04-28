const { json, clearSessionCookie } = require("./_access-lib");

exports.handler = async function () {
  return json(
    200,
    { ok: true },
    {
      "Set-Cookie": clearSessionCookie(),
    }
  );
};