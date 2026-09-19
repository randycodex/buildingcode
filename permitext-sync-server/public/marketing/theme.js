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
    const select = document.querySelector(".theme-select");
    if (select) select.value = preference;
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
    document.querySelector(".theme-select")?.addEventListener("change", event => {
      preference = normalize(event.target.value);
      try { localStorage.setItem(key, preference); } catch {}
      apply();
    });
  });
})();
