const {
  json,
  getSessionFromEvent,
  sessionStillAllowed,
  clearSessionCookie,
} = require("./_access-lib");

exports.handler = async function (event) {
  try {
    const session = getSessionFromEvent(event);

    if (!session) {
      return json(401, {
        ok: false,
        loggedIn: false,
      });
    }

    const allowed = await sessionStillAllowed(session);

    if (!allowed) {
      return json(
        401,
        {
          ok: false,
          loggedIn: false,
          error: "Session no longer allowed",
        },
        {
          "Set-Cookie": clearSessionCookie(),
        }
      );
    }

    return json(200, {
      ok: true,
      loggedIn: true,
      username: session.sub || session.username || "user",
      role: session.role,
      accessType: session.accessType || "unknown",
      expires: session.exp,
    });
  } catch (err) {
    return json(500, {
      ok: false,
      error: String(err.message || err),
    });
  }
};