# Permitext Research product-example confirmation — pre-dispatch stop

Date: September 2, 2026

Status: **STOPPED BEFORE RUN LOCK OR PROVIDER ACCESS; `$0` SPEND**

Authorized package: `70b2d3b4f013f2966d14a40c9eabfedb561a27f6`

Authorization commit: `4c2a5af83dd5d5294602ac1dd50734c3722a7b5a`

Authorization ID: `17baf770-5f0b-4f51-91f3-fea23b415e2d`

## Exact owner scope

The owner authorized all nine ordered turns in seven conversations, one repetition, with a maximum cumulative API spend of `$2` using the package-bound sentence required by the locked record.

## What stopped

The exact package accepted the owner scope, but its pre-dispatch Git guard then required `execution.executionCommit` in the committed authorization record to equal that record's own commit SHA. A Git commit hash depends on the tree containing the record, so this is self-referential and cannot be prepared as an ordinary immutable commit.

The exact observed assertion was:

`The active owner-example authorization must name the exact execution commit.`

The authorization commit had `execution.executionCommit: null`; immutable `HEAD` was `4c2a5af83dd5d5294602ac1dd50734c3722a7b5a`.

## Safety outcome

- The runner stopped before creating `.research-product-example-confirmation-paid-run.lock`.
- It stopped before creating the temporary evaluation server or account.
- It stopped before any OpenAI/provider request.
- It created no live result artifact.
- Actual and reserved API spend are `$0` with zero pending requests.
- The authorization does not transfer to corrected code.

A replacement package must remove only the self-reference, add an authorized-state regression check, rerun every no-cost package guard, receive a new exact package-bound owner authorization, and retain the same seven conversations, nine turns, one repetition, no-judge policy, and `$2` ceiling.
