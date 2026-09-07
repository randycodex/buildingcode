# App Store forms and reviewer preparation — September 7, 2026

Scope: the owner's instruction to complete step 1 of the final three groups.
No physical phone use, screenshot work, app/build submission or public release.

## Completed in Apple

- Age questionnaire saved and retained after reload. Calculated rating 13+;
  overridden to 18+ to match the existing Terms minimum age, with
  `https://permitext.com/terms` as the age-suitability URL. Apple displays 18+
  for 173 countries/regions, a Korea exception, and legacy OS ratings. App
  availability remains U.S.-only; no territories were added.
- App version review notes saved and retained after reload. They describe the
  standard reviewer login, complimentary Pro, synthetic Project/Note/Research/
  Report material, source/AI boundaries and the separate StoreKit subscription.
- Subscription `com.randycodex.permitext.pro.monthly` review notes were corrected
  from the obsolete Settings/future-sync description to Saved → Account → Plan,
  current features and the distinction between reviewer grants and purchases.
  Notes saved and retained after reload. The subscription remains Prepare for
  Submission. Price, duration, availability, allowance and Family Sharing were
  not changed. Review screenshot still waits for the owner's final UI.
- Business page rechecked: Paid Apps Agreement, Free Apps Agreement, bank
  account and U.S. tax form all Active. No new agreement was signed, bank/tax
  details changed or EU trader declaration made. Private account details are
  excluded from this receipt.
- Privacy policy and Apple App Privacy publication retain the earlier
  [separate receipt](./PERMITEXT_PRIVACY_DISCLOSURE_PUBLICATION_2026-09-07.md).

## Age questionnaire basis

The current Apple [questionnaire definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions)
and [rating override guidance](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating)
were read before entry. The override reflects the existing Terms, not a newly
invented age restriction or in-app age-assurance mechanism.

| Item | Saved answer | Basis |
| --- | --- | --- |
| Parental Controls; Age Assurance | No | No such current mechanism; Terms age text is not age verification |
| Unrestricted Web Access | No | Reader external links leave the bundled reader; no general in-app browser |
| User-Generated Content; Social Media; Social Media Disabled Under 13 | No | No broad public distribution/feed; private Notes and Projects are not the public-distribution capability Apple defines |
| Messaging and Chat | No | Current individual Free/Pro workflow has no user-to-user messaging; organization collaboration is separately gated |
| Advertising | No | No third-party advertising integration |
| Alcohol/Tobacco/Drug references | Infrequent | Incidental references in the legal corpus, including tobacco-use/manufacturing provisions |
| Mature or Suggestive Themes | Infrequent | Zoning's adult-establishment definitions; non-entertainment legal context |
| Guns or Other Weapons | Infrequent | Incidental references in regulatory text |
| Profanity; Horror; medical/treatment; sexual/nudity depictions; violence; simulated gambling; contests | None | No corresponding intended content or activity; legal references are not medical guidance or violent/sexual depictions |
| Health/Wellness; Gambling; Loot Boxes | No | No such product functions |

Source checks included `ChapterHTMLWebView.swift` external-link handling,
`CodeLibraryViewModel.swift` capability gates, the server's explicit organization
membership gate, the Terms minimum age, and bundled Zoning/Construction text.
Reassess these answers if public sharing, social/messaging, general browsing,
content or age-assurance behavior is enabled later.

## Reviewer access prepared

At `2026-09-07T22:17:03.477Z`, the existing admin grant mechanism enabled
no-charge Pro only for the designated `permitext@gmail.com` test identity.
Exact target SHA-256:
`d5f4fa47dccfdb4a6f5b2cd2b63b9f2a1bed0a9aba59dc1a365bde108373b645`.
Source is `lifetimeGrant`, plan Pro; no Apple/Stripe purchase was made.

This administrative grant has no automatic expiry. It is intentionally retained
for the remaining acceptance and App Review, and must be revoked when reviewer
access is no longer needed or a replacement review identity is used. It is not
a customer lifetime purchase. Do not revoke it between planned review checks.

The existing password already passed a new web login. After the grant, the web
session showed Pro and Synced; the retained Notebook, saved cited Research,
Report and enabled Export Report control were visible. There were 99 remaining
monthly turns; no new turn, export or paid operation was requested. All 24
content/usage groups were unchanged across before/after account exports; only
session metadata changed, apart from the intended entitlement change.

The owner reported seeing the username/password with Save disabled in Apple.
Automation cannot reliably read those sensitive fields; do not repeat resets
or treat masked/unavailable values as proof they are empty. Native login and
the full phone Pro/purchase path remain step 2. See the
[reviewer access record](./PERMITEXT_REVIEWER_ACCESS_2026-09-07.md).

## Content-rights declaration remains open

Apple's exact form requires either necessary rights or otherwise lawful
permission for third-party content. Neither answer was selected. The owner was
asked whether written permissions/licensing documentation already exists. The
owner answered No and clarified that Permitext republishes the code in its own
format. A publisher license must not be treated as automatically necessary for
enacted law. See the source review correction below.

The specific existing source gate is
`NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/SOURCE.md`.
Its enacted-only import came from American Legal's NYC Administrative Code XML
archive and explicitly says to confirm republication rights before publication.
Its catalog also permits replacement with corresponding enacted law or a
first-party NYC publication if reuse rights are not established.

The bundled library currently contains 134 chapters in eight groups: Titles
24, 25 and 26, the 1968 Building Code, Housing Maintenance Code, Title 28, Fire
Code and construction-related local laws. This is a concrete unresolved source
record, not a finding that all NYC law requires a private license. Do not attest,
remove the library or claim other sources cleared without appropriate evidence.

Step 1 is therefore substantially prepared but not fully closed. Content-rights
evidence remains outstanding; phone acceptance and owner-led UI/screenshots
remain the already-separated steps 2 and 3.

### Correction: enacted law versus publisher material and access terms

The owner correctly distinguished the enacted law from a publisher's additions.
The [U.S. Copyright Office Compendium, section 313.6(C)(2)](https://www.copyright.gov/comp3/chap300/ch300-copyrightable-authorship.pdf)
identifies legislative enactments and public ordinances as government edicts
that it will not register. The Supreme Court's
[Georgia v. Public.Resource.Org opinion](https://www.supremecourt.gov/opinions/19pdf/18-1150_new_d18e.pdf)
supports the government-edicts principle and distinguishes private authored
explanatory material. Public availability alone is not the rule; enacted legal
status matters. No license requirement for the enacted text is established here.

The actual importer, `permitext-sync-server/scripts/import-nyc-enacted-admin-code.py`,
skips `HIGHLIGHTER`, `ednote` styles and ALP-only marker paragraphs. A bounded
scan of its bundled chapter HTML found no editor-note, American Legal Publishing,
ednote or highlighter markers. These checks support the intended enacted-only
boundary; they are not a full section-by-section provenance certification.

American Legal's current [website terms](https://amlegal.com/terms-of-use) assert
personal-use and republication restrictions. Those assertions are separate from
copyright ownership of enacted law. Their application/enforceability for this
specific bulk-archive acquisition has not been determined; do not assume either
that the site owns NYC law or that a new presentation resolves every access-term
question. The remaining item is source/provenance and access-terms verification,
not an automatic instruction to obtain or buy an American Legal license. Apple's
declaration remains unselected pending resolution of that narrower item.
