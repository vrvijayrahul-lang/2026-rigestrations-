// ====================================================================
// nav.js — shared navigation behavior
//
// Replaces the duplicated inline <script> blocks previously embedded
// on every page. Handles:
//   1. Scroll state for the floating nav pill
//   2. Hamburger / overlay toggle
//   3. Scroll-reveal observer for [data-reveal] elements
//
// All work is throttled with rAF and observer-based — no scroll-event
// thrash. Reduced-motion users get an instant reveal.
// ====================================================================

(function () {
  "use strict";

  // ---- 1. Nav scroll state (rAF-throttled) ------------------------
  const nav = document.getElementById("nav");
  if (nav) {
    let ticking = false;
    let lastScrolled = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrolled = window.scrollY > 20;
        if (scrolled !== lastScrolled) {
          nav.classList.toggle("is-scrolled", scrolled);
          lastScrolled = scrolled;
        }
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // ---- 2. Hamburger / overlay -------------------------------------
  const ham = document.getElementById("hamburger");
  const overlay = document.getElementById("navOverlay");
  if (ham && overlay) {
    const close = () => {
      ham.classList.remove("active");
      overlay.classList.remove("open");
      document.body.style.overflow = "";
    };
    ham.addEventListener("click", () => {
      const isOpen = overlay.classList.toggle("open");
      ham.classList.toggle("active", isOpen);
      document.body.style.overflow = isOpen ? "hidden" : "";
    });
    overlay.querySelectorAll("a").forEach((a) => a.addEventListener("click", close));
    // Close on Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.classList.contains("open")) close();
    });
  }

  // ---- 3. Scroll-reveal (IntersectionObserver) --------------------
  const revealEls = document.querySelectorAll("[data-reveal]");
  if (revealEls.length) {
    // Honor reduced motion: reveal everything immediately.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      revealEls.forEach((el) => el.classList.add("is-visible"));
    } else {
      // Fallback for very old browsers: just reveal all.
      if (!("IntersectionObserver" in window)) {
        revealEls.forEach((el) => el.classList.add("is-visible"));
      } else {
        const io = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                io.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
        );
        revealEls.forEach((el) => io.observe(el));
      }
    }
  }
})();
