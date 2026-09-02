// ====================================================================
// main.js
// Shared UI helpers (mobile menu, smooth scroll, etc.).
// This file is NOT module-only; the inline scripts handle navbar on
// each page. Kept here for completeness and to demonstrate the loader.
// ====================================================================

console.log("main.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  console.log("main.js: DOM ready");

  // Auto-dismiss any alert after 6s
  document.querySelectorAll(".alert.show").forEach(a => {
    setTimeout(() => a.classList.remove("show"), 6000);
  });

  // Mobile menu fallback
  const menuBtn = document.getElementById("menuBtn");
  const navLinks = document.getElementById("navLinks");
  if (menuBtn && navLinks) {
    menuBtn.addEventListener("click", () => navLinks.classList.toggle("open"));
  }
});
