# Lifetime Pro invitations

The invitation button opens the branded Clerk Account Portal. Clerk chooses
sign-up or sign-in for the invited email, then returns the user to the Permitext
workspace. Complimentary access does not enter the paid upgrade or checkout flow.

In the production Clerk Dashboard, Account Portal → Redirects, both **After
sign-up fallback** and **After sign-in fallback** must be:

```
https://permitext.com/workspace?clerk_return=1
```

These values were saved and confirmed after a dashboard reload on 2026-11-06.
The `clerk_return` callback completes Permitext account sign-in and activates a
pending Lifetime Pro grant by matching the account's verified email. Invitation
metadata is only for choosing email wording; it does not authorize access.

Do not set an invitation's `redirectUrl` to the workspace: that bypasses Clerk's
hosted invitation-ticket handling. New invitations omit that override so Clerk
can select the appropriate account screen. Existing invitations created by
Permitext point at the hosted sign-up screen and use the same fallback after
authentication. Already delivered emails retain their original text.

## Approved email copy

**Subject: Your complimentary Lifetime Pro access to Permitext**

You’ve been given complimentary lifetime access to Permitext Pro.

Create your account using this email address to activate your access. No
subscription or payment is required.

**Activate Lifetime Pro**

This invitation link expires in 30 days. Your Lifetime Pro access does not
expire after 30 days.

## Template publication

The prepared template is in
`permitext-sync-server/email-templates/clerk-invitation.pending.json`. Its
Handlebars condition checks
`invitation.public_metadata.permitextLifetimeProInvitation`; other invitations
keep their generic wording. Preserve `{{action_url}}` on both invitation links.

Production publication is **pending**. On 2026-11-06 the dashboard rejected Save
because custom production email templates are unavailable on the current Hobby
plan. No plan upgrade or invitation email was sent while verifying this change.

References: [Clerk application invitations](https://clerk.com/docs/guides/development/custom-flows/authentication/application-invitations)
and [email template variables](https://clerk.com/docs/guides/customizing-clerk/email-sms-templates).
