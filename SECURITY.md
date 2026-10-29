# Security policy

## Reporting a vulnerability

Write to **team@get-on.tech** with what you found, the page or web address
involved, and the steps to reproduce it. We reply within 3 working days.

Please do not test against customer websites or accounts that are not yours, and
do not run automated scanners that could affect other people's sites.

`/.well-known/security.txt` points to the same address.

## Scope

- The Get-On application (`get-on.tech`) including sign-in, signup, the
  dashboard, billing and the editor.
- The published-site renderer and its hosting rules.
- Our API routes under `/api/*`.

Out of scope: reports from automated tools with no demonstrated impact, social
engineering of staff, and denial-of-service testing.

## What we do

- Two-step sign-in by emailed code for every account.
- Authentication codes are stored as keyed hashes, are single use and expire.
- We never ask for a code by email, phone or chat.
- Security-relevant events are recorded and shown to the account owner.

Our internal rules and runbooks live in `docs/security.md`.
