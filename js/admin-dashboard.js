// ====================================================================
// admin-dashboard.js
// Admin dashboard logic. Reads registrations, renders stats and a
// searchable / filterable table. Uses the auth-guard for protection.
// ====================================================================

console.log("admin-dashboard.js loaded");

import {
  db,
  auth,
  signOut,
  collection,
  getDocs,
  deleteDoc,
  doc,
  orderBy,
  query,
} from "./firebase-config.js";

// State
let allRegistrations = [];
let filteredRegistrations = [];

// DOM references (resolved once DOM is ready)
let tableBody, searchInput, filterDept, filterYear, refreshBtn,
    logoutBtn, totalEl, recentEl, deptStatsEl, yearStatsEl,
    emptyState;

// --------------------------------------------------------------------
// Render helpers
// --------------------------------------------------------------------
function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(timestamp) {
  if (!timestamp) return "—";
  try {
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

// Debounce: avoid re-rendering the whole table on every keystroke.
function debounce(fn, ms) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

let renderScheduled = false;
function scheduleRender() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    renderTable();
    renderStats();
  });
}

function applyFilters() {
  const q   = (searchInput?.value || "").toLowerCase().trim();
  const dpt = filterDept?.value || "";
  const yr  = filterYear?.value || "";

  filteredRegistrations = allRegistrations.filter((r) => {
    if (dpt && r.department !== dpt) return false;
    if (yr  && r.year !== yr)        return false;
    if (q) {
      const haystack = [
        r.fullName, r.rollNumber, r.email, r.mobile,
        r.department, r.year, r.registrationId,
      ].map(v => String(v || "").toLowerCase()).join(" ");
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  // Stats don't change with search/filter — only update them on data load.
  renderTable();
}

function renderStats() {
  if (totalEl) totalEl.textContent = allRegistrations.length;

  // Department-wise
  const deptCounts = {};
  allRegistrations.forEach(r => {
    const k = r.department || "Unknown";
    deptCounts[k] = (deptCounts[k] || 0) + 1;
  });
  if (deptStatsEl) {
    const entries = Object.entries(deptCounts).sort((a,b) => b[1]-a[1]);
    if (entries.length === 0) {
      deptStatsEl.innerHTML = '<li class="muted">No data yet</li>';
    } else {
      deptStatsEl.innerHTML = entries
        .map(([k, v]) => `<li><span>${escapeHtml(k)}</span><span>${v}</span></li>`)
        .join("");
    }
  }

  // Year-wise
  const yearCounts = {};
  allRegistrations.forEach(r => {
    const k = r.year || "Unknown";
    yearCounts[k] = (yearCounts[k] || 0) + 1;
  });
  if (yearStatsEl) {
    const entries = Object.entries(yearCounts).sort((a,b) => b[1]-a[1]);
    if (entries.length === 0) {
      yearStatsEl.innerHTML = '<li class="muted">No data yet</li>';
    } else {
      yearStatsEl.innerHTML = entries
        .map(([k, v]) => `<li><span>${escapeHtml(k)}</span><span>${v}</span></li>`)
        .join("");
    }
  }

  // Recent (last 24h if any have createdAt; otherwise last 5)
  if (recentEl) {
    const sorted = [...allRegistrations].sort((a,b) => {
      const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return tb - ta;
    });
    const last24 = sorted.filter(r => {
      const ms = r.createdAt?.toMillis ? r.createdAt.toMillis() : 0;
      return ms && (Date.now() - ms) < 24*60*60*1000;
    });
    const count = last24.length;
    recentEl.textContent = count > 0 ? count : (sorted.length > 0 ? "0 (last 24h)" : "0");
  }
}

function renderTable() {
  if (!tableBody) return;

  if (filteredRegistrations.length === 0) {
    tableBody.innerHTML = "";
    if (emptyState) emptyState.style.display = "block";
    return;
  }
  if (emptyState) emptyState.style.display = "none";

  // Sort by createdAt desc
  const sorted = [...filteredRegistrations].sort((a, b) => {
    const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return tb - ta;
  });

  // Build via DocumentFragment for a single DOM commit.
  const frag = document.createDocumentFragment();
  for (const r of sorted) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="reg-id-pill">${escapeHtml(r.registrationId || "—")}</span></td>
      <td>${escapeHtml(r.fullName)}</td>
      <td>${escapeHtml(r.rollNumber)}</td>
      <td>${escapeHtml(r.department)}</td>
      <td>${escapeHtml(r.year)}</td>
      <td>${escapeHtml(r.email)}</td>
      <td>${escapeHtml(r.mobile)}</td>
      <td>${formatDate(r.createdAt)}</td>
      <td>
        <div class="row-actions">
          <a class="btn-icon" href="registration-details.html?id=${encodeURIComponent(r.registrationId || "")}">View</a>
          <button class="btn-icon danger" data-delete="${escapeHtml(r.registrationId || "")}">Delete</button>
        </div>
      </td>
    `;
    frag.appendChild(tr);
  }
  tableBody.replaceChildren(frag);

  // Delete handlers are bound via event delegation on tableBody
  // (set up once in bindUI), so no per-row listeners here.
}

async function handleDelete(registrationId) {
  if (!registrationId) return;
  const ok = window.confirm(`Delete registration ${registrationId}? This cannot be undone.`);
  if (!ok) return;

  try {
    await deleteDoc(doc(db, "registrations", registrationId));
    console.log("Deleted", registrationId);
    await loadRegistrations();
  } catch (err) {
    console.error("Delete failed:", err);
    alert("Delete failed: " + (err.message || err));
  }
}

// --------------------------------------------------------------------
// Data loading
// --------------------------------------------------------------------
async function loadRegistrations() {
  console.log("Loading registrations from Firestore");
  if (tableBody) {
    tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:30px;">Loading…</td></tr>`;
  }
  try {
    const q = query(collection(db, "registrations"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    allRegistrations = [];
    snap.forEach(d => allRegistrations.push(d.data()));
    console.log("Loaded", allRegistrations.length, "registrations");
    applyFilters();
  } catch (err) {
    console.error("Failed to load registrations:", err);
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:30px; color:#dc2626;">Failed to load: ${escapeHtml(err.message || String(err))}</td></tr>`;
    }
  }
}

// --------------------------------------------------------------------
// Init
// --------------------------------------------------------------------
function bindUI() {
  tableBody   = document.getElementById("regTableBody");
  searchInput = document.getElementById("searchInput");
  filterDept  = document.getElementById("filterDept");
  filterYear  = document.getElementById("filterYear");
  refreshBtn  = document.getElementById("refreshBtn");
  logoutBtn   = document.getElementById("logoutBtn");
  totalEl     = document.getElementById("totalCount");
  recentEl    = document.getElementById("recentCount");
  deptStatsEl = document.getElementById("deptStats");
  yearStatsEl = document.getElementById("yearStats");
  emptyState  = document.getElementById("emptyState");

  // Debounced search: avoids re-rendering the table on every keystroke.
  // 150 ms feels instant to a human but cuts ~90% of intermediate renders
  // while the user is still typing.
  const debouncedApply = debounce(applyFilters, 150);
  if (searchInput) searchInput.addEventListener("input", debouncedApply);
  if (filterDept)  filterDept.addEventListener("change", applyFilters);
  if (filterYear)  filterYear.addEventListener("change", applyFilters);
  if (refreshBtn)  refreshBtn.addEventListener("click", loadRegistrations);

  // Event delegation: one listener on the tbody, not one per row.
  // Critical for large tables — 500 rows = 500 listeners avoided.
  if (tableBody) {
    tableBody.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-delete]");
      if (btn) handleDelete(btn.dataset.delete);
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await signOut(auth);
        console.log("Signed out, redirecting");
        window.location.href = "admin-login.html";
      } catch (err) {
        console.error("Sign out failed:", err);
        alert("Sign out failed: " + (err.message || err));
      }
    });
  }

  // Populate department filter from a known list (extend as needed)
  if (filterDept) {
    const known = ["", "B.A.", "B.Com", "B.Sc", "B.Sc (MPC)", "B.Sc (BZC)", "BCA", "BBA", "Other"];
    filterDept.innerHTML = known.map(d =>
      `<option value="${d}">${d === "" ? "All Departments" : d}</option>`
    ).join("");
  }
  if (filterYear) {
    const known = ["", "1st Year", "2nd Year", "3rd Year"];
    filterYear.innerHTML = known.map(y =>
      `<option value="${y}">${y === "" ? "All Years" : y}</option>`
    ).join("");
  }
}

function init() {
  console.log("admin-dashboard.js init()");
  bindUI();
  loadRegistrations();
}

// This runs only when auth-guard confirms a user is signed in
window.onAdminReady = function (user) {
  console.log("onAdminReady fired with", user.email);
  // Show the admin email in the header
  const emailEl = document.getElementById("adminEmailDisplay");
  if (emailEl) emailEl.textContent = user.email || "Admin";
  init();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => { /* bindUI runs inside init via onAdminReady */ });
} else {
  // already loaded
}
