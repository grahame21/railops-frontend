function railopsGetDeviceId() {
  const key = "railops_device_id_v1";

  try {
    let id = localStorage.getItem(key);

    if (!id) {
      id = "dev_" + crypto.randomUUID();
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
  } catch {}

  window.location.href = "/login.html";
}

setInterval(() => {
  if (!location.pathname.endsWith("/login.html") && !location.pathname.endsWith("/access.html")) {
    railopsCheckSession();
  }
}, 60000);