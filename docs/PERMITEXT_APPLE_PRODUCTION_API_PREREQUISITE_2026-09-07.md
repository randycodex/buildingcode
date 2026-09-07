# Apple Production notification API prerequisite — September 7, 2026

Status: **RELEASE-DEPENDENT FOLLOW-UP — Production test delivery is not verified**

## Live evidence

The existing owner-only In-App Purchase key was located outside the repository.
App Store Connect displayed it as the sole active key. Its key ID and issuer
matched the API request, and the local ES256 signature verified using the
corresponding public key. The key was not created, replaced or revoked.

The first Production test-notification request returned an empty body, causing
the receipt parser to fail before retaining its HTTP status. Its delivery outcome
is unverified. One subsequent captured request to Apple's documented Production
test endpoint returned HTTP 401 with an empty body at
`2026-09-07T18:29:52.487Z`; no test-notification token was issued in that response.

Two read-only notification-history requests then used the same credential and
documented JWT claims, constrained to TEST notifications in the preceding hour:

| Apple API environment | Checked at | Result |
| --- | --- | --- |
| Production | `2026-09-07T18:31:12.639Z` | HTTP 401, empty body |
| Sandbox | `2026-09-07T18:31:12.694Z` | HTTP 200, 42-byte response |

Apple's HTTPS Date header matched the local clock. These results distinguish
Production access from a general signing-key or clock failure. The app's live
App Store Connect record remains Prepare for Submission; no App Store release
or submission was performed.

## Interpretation and next step

An [Apple App Store Commerce Engineer states](https://developer.apple.com/forums/thread/806452)
that Production API access is unavailable until the app has a Production release.
The observed Sandbox-success/Production-401 result is consistent with that
restriction. The source is an identified Apple staff response; the later
non-staff reply is not used to infer the exact approval-versus-publication timing.

Do not rotate the working key or change notification URLs to work around this
restriction. Retain the configured Production/Sandbox separation and previous
Sandbox delivery evidence. Once Apple enables Production API access for the
released app, request one TEST notification and retain its token, Apple's test
status/send-attempt result and the matching Production endpoint log.

This is a release-dependent operational follow-up, not a passed Production
delivery test. It does not authorize release or loosen the activation JSON.
The existing billing lifecycle evidence retains its original environment.

Private API response receipts remain under the owner-only Apple evidence
directory outside the repository. Private keys, bearer tokens and raw provider
payloads are not committed. No purchase or entitlement grant was requested.

Official API references: [Request a Test Notification](https://developer.apple.com/documentation/appstoreserverapi/request-a-test-notification),
[Get Test Notification Status](https://developer.apple.com/documentation/appstoreserverapi/get-test-notification-status),
[Get Notification History](https://developer.apple.com/documentation/appstoreserverapi/get-notification-history).
