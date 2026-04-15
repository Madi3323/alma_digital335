/* ── SHARED AUTH HELPERS ── */
async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

function setError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

function clearErrors() {
  ["loginError", "registerError"].forEach(id => setError(id, ""));
}

/* ── MODAL (index.html) ── */
function openModal(tab = "login") {
  const overlay = document.getElementById("authModal");
  if (!overlay) return;
  overlay.classList.add("open");
  switchTab(tab);
}

function closeModal() {
  const overlay = document.getElementById("authModal");
  if (overlay) overlay.classList.remove("open");
  clearErrors();
}

document.addEventListener("click", (e) => {
  const overlay = document.getElementById("authModal");
  if (overlay && e.target === overlay) closeModal();
});

/* ── TAB SWITCH ── */
function switchTab(tab) {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const tabLogin = document.getElementById("tabLogin");
  const tabRegister = document.getElementById("tabRegister");

  if (!loginForm || !registerForm) return;

  if (tab === "login") {
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
    tabLogin && tabLogin.classList.add("active");
    tabRegister && tabRegister.classList.remove("active");
  } else {
    loginForm.classList.add("hidden");
    registerForm.classList.remove("hidden");
    tabLogin && tabLogin.classList.remove("active");
    tabRegister && tabRegister.classList.add("active");
  }
  clearErrors();
}

/* ── LOGIN FORM ── */
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearErrors();
      const email = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value;
      const { ok, data } = await apiFetch("/api/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (ok) {
        window.location.href = "/cabinet";
      } else {
        setError("loginError", data.error || "Login failed");
      }
    });
  }

  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearErrors();
      const name = document.getElementById("regName").value.trim();
      const email = document.getElementById("regEmail").value.trim();
      const password = document.getElementById("regPassword").value;
      if (password.length < 6) {
        setError("registerError", "Password must be at least 6 characters");
        return;
      }
      const { ok, data } = await apiFetch("/api/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      if (ok) {
        window.location.href = "/cabinet";
      } else {
        setError("registerError", data.error || "Registration failed");
      }
    });
  }

  /* ── CABINET INIT ── */
  if (document.getElementById("cabinetApp")) {
    initCabinet();
  }
});

/* ── CABINET ── */
async function initCabinet() {
  const { ok, data } = await apiFetch("/api/me");
  if (!ok) {
    document.getElementById("authGate").classList.remove("hidden");
    document.getElementById("cabinetApp").classList.add("hidden");
    return;
  }

  document.getElementById("authGate").classList.add("hidden");
  document.getElementById("cabinetApp").classList.remove("hidden");
  populateUser(data);
}

function populateUser(user) {
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl("ovName", user.name);
  setEl("ovEmail", user.email);
  setEl("ovTariff", capitalize(user.tariff));
  setEl("ovDate", user.created_at ? formatDate(user.created_at) : "—");
  setEl("currentPlanBadge", capitalize(user.tariff));

  const mini = document.getElementById("userMini");
  if (mini) mini.innerHTML = `<strong>${escHtml(user.name)}</strong><br/>${escHtml(user.email)}`;
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function formatDate(str) {
  const d = new Date(str);
  return isNaN(d) ? str : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function escHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

/* ── TABS ── */
let tetrisInitialized = false;

function showTab(name, btn) {
  document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
  document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("active"));

  const tab = document.getElementById("tab-" + name);
  if (tab) tab.classList.remove("hidden");

  const navBtn = btn || document.querySelector(`[data-tab="${name}"]`);
  if (navBtn) navBtn.classList.add("active");

  if (name === "tetris" && !tetrisInitialized) {
    tetrisInitialized = true;
    if (typeof initTetris === "function") initTetris();
  }

  const sidebar = document.querySelector(".sidebar");
  if (sidebar) sidebar.classList.remove("open");
}

function toggleSidebar() {
  const sidebar = document.querySelector(".sidebar");
  if (sidebar) sidebar.classList.toggle("open");
}

async function doLogout() {
  await apiFetch("/api/logout", { method: "POST" });
  window.location.href = "/";
}

function selectPlan(plan) {
  alert(`Plan "${capitalize(plan)}" selected! (Demo mode — no payment processing)`);
}
