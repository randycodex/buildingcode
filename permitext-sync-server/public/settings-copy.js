export const settingsCopy = Object.freeze({
  freePlanSummary: "Reading and search are available anytime, with recent history, 25 saved sections, 10 notes, continuity, and cross-device sync.",
  proPlanSummary: "Pro is active, including Research. Projects, Notebook, Report, professional exports, offline access, and selected-evidence Research are unlocked.",
  lifetimePlanSummary: "Lifetime Pro is active, including Research. This gifted account does not need an App Store subscription.",
  freePlanDetails: "No trial. Renews monthly until canceled. Pro includes unlimited saved sections and notes, Projects, Notebook, Report, professional exports, offline access, and up to 100 selected-evidence Research turns each month. Code reading and search remain free.",
  signedOutAccountSummary: "Use passwordless email, Apple, Google, or Microsoft. New users create an account during sign-in, then saved sections, notes, and Projects can sync across devices.",
  signedInAccountSuffix: "Saved sections, notes, and Projects can sync across your devices."
});

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
