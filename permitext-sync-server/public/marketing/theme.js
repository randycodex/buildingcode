// Apply appearance before the stylesheet paints; this preference is local to the homepage.
(() => {
  const key = "permitext.marketing.appearance";
  const system = matchMedia("(prefers-color-scheme: dark)");
  const normalize = value => ["light", "dark"].includes(value) ? value : "system";
  let preference = "system";
  try { preference = normalize(localStorage.getItem(key)); } catch {}
  function apply() {
    const theme = preference === "system" ? (system.matches ? "dark" : "light") : preference;
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#171a16" : "#f8f8f5");
    const button = document.querySelector(".theme-toggle");
    const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
    button?.setAttribute("aria-label", label);
    button?.setAttribute("title", label);
  }
  apply();
  system.addEventListener("change", apply);
  addEventListener("storage", event => {
    if (event.key === key || event.key === null) {
      preference = normalize(event.newValue);
      apply();
    }
  });
  addEventListener("DOMContentLoaded", () => {
    apply();
    document.querySelector(".theme-toggle")?.addEventListener("click", () => {
      preference = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      try { localStorage.setItem(key, preference); } catch {}
      apply();
    });
  });
})();
