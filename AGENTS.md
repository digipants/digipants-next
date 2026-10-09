# Repository working agreement

## Task discipline

- Work on one clearly stated objective per task.
- Make the smallest change that satisfies the approved scope and acceptance criteria.
- Inspect existing instructions, relevant files, and nearby patterns before editing.
- Preserve the current Next.js, TypeScript, and Tailwind architecture unless the task explicitly requires a change.
- Do not silently overwrite, discard, stage, or reformat unrelated user work.

## Accuracy and security

- Treat repository code and project documentation as the source of truth for factual claims.
- Distinguish verified, planned, and experimental functionality; do not invent features, results, metrics, or production status.
- Never expose, commit, or reproduce credentials, environment values, access tokens, private operational details, or other secrets.

## Validation

- Run checks targeted to the files and behavior changed.
- For application changes, normally run TypeScript validation, the production build, and `git diff --check`; add focused tests or visual checks where relevant.
- Report commands run, outcomes, remaining risks, and anything that could not be verified.

## GitHub workflow

1. Start from the current `main` branch and an approved GitHub Issue with one objective.
2. Create a dedicated feature branch and implement only the issue scope.
3. Validate the change and review the complete diff, preserving unrelated local work.
4. Open a descriptive pull request linked to the issue. Include a changed-file summary, test results, risks or verification gaps, and screenshots for visual changes.
5. Wait for review and approval before merging.

Do not commit, push, merge, or deploy without explicit authorization. A specific approved GitHub Issue may authorize Codex to commit, push its feature branch, and open a draft pull request. That authorization never includes merging to `main` or deploying unless those actions are separately and explicitly approved.

GitHub coordination only reflects published commits and pull requests. Uncommitted local Codex work is not visible to ChatGPT or other collaborators through GitHub.
