function railopsGetDeviceId() {
  const key = "railops_device_id_v1";

  try {
    let id = localStorage.getItem(key);

    if (!id) {
      if (window.crypto && typeof crypto.randomUUID === "function") {
        id = "dev_" + crypto.randomUUID();
      } else {
        id = "dev_" + Math.random().toString(36).slice(2) + Date.now();
      }

      localStorage.setItem(key, id);
    }

    return id;
  } catch {
    return "dev_" + Math.random().toString(36).slice(2) + Date.now();
  }
}

async function railopsCheckSession(requiredRole = null) {
  try {
    const res = await fetch("/api/session", {
      method: "GET",
      cache: "no-store",
    });

    let data = null;

    try {
      data = await res.json();
    } catch {
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
      const accessType = data.accessType || "login";
      userLabel.textContent = `${username} (${role} / ${accessType})`;
    }

    return data;
  } catch {
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
  } catch {
    // Still redirect even if logout function fails.
  }

  window.location.href = "/login.html";
}

setInterval(() => {
  const path = location.pathname.toLowerCase();

  const isLoginPage =
    path.endsWith("/login.html") ||
    path.endsWith("/login") ||
    path.endsWith("/access.html") ||
    path.endsWith("/access") ||
    path === "/" ||
    path === "";

  if (!isLoginPage) {
    railopsCheckSession();
  }
}, 60000);