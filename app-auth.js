async function railopsCheckSession(requiredRole = null) {
  try {
    const res = await fetch("/api/session", {
      method: "GET",
      cache: "no-store",
    });

    const data = await res.json();

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
      userLabel.textContent = `${data.username} (${data.role})`;
    }

    return data;
  } catch (err) {
    window.location.href = "/login.html";
    return null;
  }
}

async function railopsLogout() {
  await fetch("/api/logout", {
    method: "POST",
  });

  window.location.href = "/login.html";
}