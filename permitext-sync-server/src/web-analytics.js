import { inject } from "@vercel/analytics";

export function privacySafePageView(event) {
  if (event?.type !== "pageview" || typeof event.url !== "string" || !event.url) return null;

  try {
    const url = new URL(event.url, window.location.origin);
    url.search = "";
    url.hash = "";
    return { ...event, url: `${url.origin}${url.pathname}` };
  } catch {
    return null;
  }
}

inject({
  mode: "production",
  beforeSend: privacySafePageView
});
