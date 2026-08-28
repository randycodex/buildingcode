const parameters = new URLSearchParams(window.location.search);
const sessionID = String(parameters.get("session_id") || "").trim();
const continueURL = new URL("/", window.location.origin);

continueURL.searchParams.set("checkout", "success");
continueURL.searchParams.set("package", "pro");
if (/^cs_[A-Za-z0-9_]+$/.test(sessionID)) {
  continueURL.searchParams.set("session_id", sessionID);
}

document.querySelector(".subscription-continue")?.setAttribute("href", continueURL.toString());
document.querySelector(".subscription-print")?.addEventListener("click", () => window.print());
