async function railopsCheckSession(requiredRole = null) {
  try {
    const res = await fetch("/api/session", {
      method: "GET",
      cache: "no-store",
    });

    let data = null;

    try {
      data = await res.json();
    } catch (jsonErr) {
      window.location.href = "/login.html";
      return null;
    }

    if (!res.ok || !data.ok || !data.loggedIn) {
      window.location.href = "/login.html";
      return null;
    }

    if (requiredRole && data.role !== requiredRole) {
      window.location.href = "/dashboard.html";
      return null;
    }

    const userLabel = document.querySelector("[data-user-label]");
    if (userLabel) {
      const username = data.username || "user";
      const role = data.role || "guest";
      userLabel.textContent = `${username} (${role})`;
    }

    return data;
  } catch (err) {
    window.location.href = "/login.html";
    return null;
  }
}

async function railopsLogout() {
  try {
    await fetch("/api/logout", {
      method: "POST",
      cache: "no-store",
    });
  } catch (err) {
    // Still redirect even if logout request fails.
  }

  window.location.href = "/login.html";
}