// Preserve old installed-app launches and workspace links when the root becomes
// the public homepage. No account or workspace storage is read or changed here.
const parameters = new URLSearchParams(location.search);
const workspaceParameters = ["checkout", "session_id", "package", "appleSignIn", "clerk_return", "organizationInvite", "detachedWorkboard", "enableCodeQuestionWorkspace"];
const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
if (standalone || location.hash.startsWith("#cq/") || workspaceParameters.some(key => parameters.has(key))) {
  location.replace(`/workspace${location.search}${location.hash}`);
}

// Refresh an existing offline installation; do not install one for marketing visitors.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistration("/").then(registration => registration?.update()).catch(() => {});
}

const stickyCTA = document.querySelector(".mobile-cta");
const heroCTA = document.querySelector("#hero-cta");
if (stickyCTA && heroCTA && "IntersectionObserver" in window) {
  new IntersectionObserver(([entry]) => { stickyCTA.hidden = entry.isIntersecting; }).observe(heroCTA);
}

function openLinkedQuestion() {
  if (location.hash === "#ios-details") document.querySelector("#ios-details")?.setAttribute("open", "");
}
document.querySelector('a[href="#ios-details"]')?.addEventListener("click", () => {
  document.querySelector("#ios-details")?.setAttribute("open", "");
});
addEventListener("hashchange", openLinkedQuestion);
openLinkedQuestion();
