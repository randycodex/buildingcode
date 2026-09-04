# Provider privacy disclosures — owner-review proposal

Status: **Owner approved applying these disclosures to the local release package** with the reply “i do,” acknowledged at approximately `2026-09-04T01:02Z` (September 3 EDT). The local privacy manifest and checklist now include the approved categories/purposes. No app behavior, approved public policy, provider configuration, Apple field, or UI/UX changes are authorized by that approval. Reviewed proposal base: `85cf031563c65368c46ea70dc29bb28216c961e7`; proposal commit: `e3025da17a60a3175a0ce96c0b18dd92faa03a05`.

## Approved local answers

The [pinned SDK/source audit](./PERMITEXT_PRIVACY_DATA_FLOW_AUDIT_2026-09-03.md) established the app's actual Clerk integration. The provider sources below now support the following classifications. These are engineering interpretations of documented behavior, not a live inspection of a user's private session or a legal opinion.

| Item | Approved local classification | Basis |
| --- | --- | --- |
| Device ID | Collected, linked, App Functionality; not tracking | Pinned Clerk iOS sends identifierForVendor; Clerk documents retained event logs searchable by device ID and actor. |
| Coarse Location | Collected, linked, App Functionality; not tracking | Clerk's stored session-activity model contains account/session-associated IP-derived city and country. This is not permission to collect GPS data. |
| User ID | Retain App Functionality; add Analytics; linked; not tracking | Clerk computes production active-user and retention reports using distinct users across sessions/devices. |
| Product Interaction | Retain App Functionality; add Analytics; linked; not tracking | Clerk documents production sign-in, sign-up and active-use reporting. This is separate from its development-only SDK telemetry. |

Do not automatically add Analytics to names, email, images, code-search history, Research questions, device IDs, or location: the reviewed analytics documentation does not establish that each of those fields is an analytics input. Do not remove existing Search History, Performance Data, Other Diagnostic Data or other supported declarations.

## Authoritative evidence and scope

1. [Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/) requires third-party collection to be included, distinguishes off-device retention from transient processing, and defines linked data, approximate location, functionality, analytics and advertising tracking separately. Applying those definitions produces the proposed answers above.
2. [Clerk Application Logs](https://clerk.com/changelog/2026-05-06-application-logs) describes historical events, actor/device-ID filtering and plan-dependent retention. Together with the pinned native request header, this supports a device-identifier disclosure rather than the prior absence claim. It does not establish Permitext's exact current log-retention duration or that every device identifier uses the same storage representation.
3. [Clerk SessionActivity](https://clerk.com/docs/reference/backend/types/backend-session-activity) describes the retained activity record's IP-derived city/country, IP address and device metadata. This supports approximate-location disclosure; no real session/IP/location was fetched for this audit.
4. [Clerk Analytics](https://clerk.com/docs/guides/dashboard/analytics) documents per-user active-use, sign-in, sign-up and retention reporting on production instances. User identity and activity therefore have a documented analytics use even though the separate native development-telemetry collector rejects production instances.
5. [Clerk Privacy Policy, Scope](https://clerk.com/legal/privacy) distinguishes Clerk's own customer/website information from data processed for customers. Do not infer that Permitext embeds advertising or session replay merely because Clerk's corporate-site policy describes those activities.
6. [Clerk DPA](https://clerk.com/legal/dpa), processing schedule and U.S. addendum, describes configured end-user processing, including IP/device/usage data, and restrictions on customer-data uses. This is supporting scope evidence, not a substitute for the applicable contract or a blanket certification that every provider behavior is cleared.

The existing no-tracking proposal is consistent with the reviewed authentication/security and within-product analytics uses. This is not an assertion that any possible future SDK/provider configuration is non-tracking. No advertising identifier, ad network, or cross-app advertising purpose was added or enabled.

## Retention and deletion: do not overpromise

- Clerk's logs source says retention varies by plan; no numeric duration for Permitext's plan was verified.
- The DPA's deletion provision concerns termination/expiry of the customer agreement. It is not a promise that deleting one Permitext account erases every provider log or backup within that same interval.
- Keep the current public policy's provider-log/backup caveat. Do not replace it with an invented zero-retention claim or treat `store: false` in a different provider as controlling Clerk data.
- Actual disposable-account export/deletion verification remains a separate, explicitly authorized exercise. No account, session, subscription or stored record was changed during this review.

## Implementation and publication boundaries

The approved local implementation adds Device ID and Coarse Location as linked, functionality-only, non-tracking categories and adds Analytics only to User ID and Product Interaction. Existing categories/reasons remain intact. The regression contract checks all thirteen categories, exact purposes, linkage/non-tracking flags and matching checklist answers, including negative controls for omitted categories or Analytics purposes. No SDK option or collection code changes.

Before publication, reconcile any provider-specific exceptions or uses not reflected in the documented standard behavior and clarify the public policy through its existing version/hash approval process. Do not silently replace currently approved public-policy bytes. Approval of the classifications is not approval to publish new policy wording or enter Apple fields.

### Policy clarification draft — not published or hash-approved

For the next owner-reviewed policy revision, prepare wording along these lines:

> When you sign in, Clerk processes account- and device-linked session information, including device identifiers and technical metadata. Its session records can include approximate city and country derived from your IP address for account management and security. This is distinct from device GPS location and from Project addresses you enter.
>
> Clerk also uses account and session activity to provide sign-up, sign-in, active-user and retention reports. Those reports measure use of the service; they do not add cross-app advertising tracking. Provider-managed logs and backups follow the applicable provider retention practices.

This draft must be reconciled with the complete policy and assigned the next approved version/hash before a later authorized publication. The existing published policy and acceptance configuration are unchanged.

Final candidate privacy aggregation remains required after the owner's UI/UX work and the selected release build. This proposal does not authorize creating a build, uploading to TestFlight, configuring Apple, submitting for review or releasing the app.

No additional paid Research cohort is needed for this privacy work. The prior full no-cost runtime check remains evidence for its exact tested source; the declaration-only follow-up is checked separately and is not new physical-device acceptance.
