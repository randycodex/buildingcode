# Research experiment and recovery — 2026-10-06

The user authorized the simpler Research writer on main and the shared hosted backend, so web and the existing phone app use it for new questions. There is no user-facing switch. Source bindings, authoritative evidence, material conditions, semantic review and fresh review after repairs remain enforced. Models, billing settings, runtime environment and database schema are unchanged by this release.

## Return points

| Snapshot | Immutable tag | Commit |
| --- | --- | --- |
| Hosted Production immediately before adoption | `permitext-research-production-baseline-2026-10-06` | `f4644bdfe8e89c4ef4014097350b4aa2cb859320` |
| Original local Research checkout before simplification | `permitext-research-baseline-2026-10-06` | `e74bef9c9b8bc4a39421decb82d9c13309b1ca2b` |
| Adopted simplified writer | `permitext-research-simplified-2026-10-06` | Resolve the tag after the release commit |
| Simplified writer with populated-project retrieval repair | `permitext-research-simplified-retrieval-fix-2026-10-06` | Resolve the tag after the repair commit |
| Experiment with saved-answer and property-link repairs | `permitext-research-simplified-verified-2026-10-06` | Resolve the tag after the final repair commit |

The baseline branches are `codex/research-production-baseline-2026-10-06` and `codex/research-baseline-2026-10-06`. Keep the annotated tags fixed. The local snapshot differs from the previously hosted release; use the Production snapshot for restoring the hosted service.

## Fast hosted return

The previous READY Production deployment is `dpl_8c8Yfdt8ZKRUS2h4TpiayhBWyLud`, at `https://permitext-sync-7thlfn3iv-randycodexs-projects-b72fc111.vercel.app`.

Project: `permitext-sync` (`prj_6rWwwb50xxxKI7qu92HzzqB5nkYs`). Team: `team_9EJNb6mc4ZUQ5bhRcRhmoBRR`.

Redeploy/promote that saved Production deployment to restore the exact previously hosted build. Check `/release` and `/health` on both `https://permitext.com` and `https://permitext-sync.vercel.app`; the release must identify `f4644bdfe8e89c4ef4014097350b4aa2cb859320`. The phone uses the second hostname. No native rebuild is required for this backend return.

Also revert the experiment's source commits on main so later deployments do not inadvertently re-enable it. From a clean, up-to-date main checkout, preserve later work and review conflicts before committing:

```sh
git revert --no-commit permitext-research-production-baseline-2026-10-06..permitext-research-simplified-verified-2026-10-06
git diff --cached --stat
git commit -m "Restore Research behavior before simplified-writer experiment"
```

Test, push and deploy that revert. Do not reset shared main, force-push, or overwrite the original dirty checkout. Vercel rollback can suspend automatic Production alias assignment; verify alias assignment and the actual serving SHA after any return.

The final tag includes the retrieval, saved-answer and property-link repairs as well as the original experiment commits. The older experiment tags remain fixed for historical comparison.

## Independent local backup

Private directory: `/Users/randy/.codex/backups/permitext/research-baseline-2026-10-06`.

It contains the full tracked local source archive, exact original tracked diffs, copies and hashes of 100 modified/untracked files, the original status, checkpoint/verification records, a successful local rollback rehearsal, and `production-baseline.json`. This is separate from Git and the Vercel deployment.

The original checkout `/Users/randy/Documents/X_CODING/Building Code` retains its existing branch and unrelated uncommitted work. Extract archives into a new empty directory if Git recovery is unavailable. Ignored credentials, database contents and hosted environment settings are outside the source backup; this release changes none of them.

## Release evidence

See `PERMITEXT_RESEARCH_SIMPLIFIED_VALIDATION_2026-10-06.md` for request-preservation and live-case checks. Hosted deployment identity and post-release checks are recorded separately in the private release evidence. A successful hosted check does not establish physical-phone acceptance.
