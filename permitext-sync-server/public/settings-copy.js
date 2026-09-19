export const settingsCopy = Object.freeze({
  freePlanSummary: "Browse enacted codes, read the text, follow code references, and search. Saving, Projects, Research, Notebook, and Reports require Pro.",
  proPlanSummary: "Pro is active. Projects, Notebook, Report, professional exports, offline access, and AI-assisted Research are unlocked.",
  lifetimePlanSummary: "Lifetime Pro is active, including Research. This gifted account does not need an App Store subscription.",
  freePlanDetails: "No trial. Renews monthly until canceled. To stop the next charge, cancel before the next monthly renewal using Manage Subscription on web or Apple subscription settings on iOS. Pro includes unlimited saved sections and notes, Projects, Notebook, Report, professional exports, offline access, and 100 AI-assisted Research turns each month. Code reading and search remain free.",
  signedOutAccountSummary: "Sign in to access your account. Saving, Projects, and synced work require Pro; reading and search are free.",
  signedInAccountSuffix: "Pro unlocks saved sections, notes, Projects, and sync across your devices."
});

export const webStripePriceDisclosure = "$20/month plus applicable taxes shown by Stripe.";

export function settingsPlanCopy({ pro = false, source = null } = {}) {
  if (!pro) {
    return {
      title: "Free",
      summary: settingsCopy.freePlanSummary,
      details: settingsCopy.freePlanDetails
    };
  }
  if (source === "lifetimeGrant") {
    return {
      title: "Lifetime Pro",
      summary: settingsCopy.lifetimePlanSummary,
      details: null
    };
  }
  return {
    title: "Pro",
    summary: settingsCopy.proPlanSummary,
    details: null
  };
}

export function settingsAccountSummary(account) {
  if (!account) return settingsCopy.signedOutAccountSummary;
  const displayName = String(account.displayName || "").trim();
  if (displayName) {
    return `Signed in as ${displayName}. ${settingsCopy.signedInAccountSuffix}`;
  }
  const provider = String(account.authProvider || "Permitext").trim() || "Permitext";
  return `Signed in with ${provider}. ${settingsCopy.signedInAccountSuffix}`;
}

export function settingsResearchAllowanceSummary(usage) {
  if (!usage) return "100 turns included monthly";
  const included = Math.max(0, Number(usage.includedRemaining) || 0);
  const purchased = Math.max(0, Number(usage.purchasedRemaining) || 0);
  if (usage.totalRemaining === null) {
    return `${included.toLocaleString()} included turns remain this month. Continued access is available.`;
  }
  if (purchased > 0) {
    return `${included.toLocaleString()} included + ${purchased.toLocaleString()} additional`;
  }
  return `${included.toLocaleString()} included turns remain this month.`;
}
