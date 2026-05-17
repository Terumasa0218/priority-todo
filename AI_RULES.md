# AI Rules for Priority Todo

These rules define the mandatory operating contract for any AI coding agent working in this repository.

## Canonical Repository

The canonical repository is:

```text
https://github.com/Terumasa0218/priority-todo
```

Treat the GitHub repository, especially `origin/main`, as the most accurate source of truth. Local working copies should be checked against the remote before important planning, implementation, or documentation changes when network access is available.

## Current Technical Direction

- Application: student-focused task and timetable management app.
- Framework: Next.js App Router.
- Primary language: TypeScript with React.
- Data: local storage plus Firebase Auth / Firestore sync.
- Deployment: Vercel from `main`.
- Product direction: follow `docs/work-plan.md` and `docs/product-market-report.md`.
- Collaboration flow: follow `WORKFLOW.md`.

This repository is only for Priority Todo. Do not use paths, branches, pull requests, assets, or implementation assumptions from unrelated repositories as context for this project.

## 1. Scope Boundary

The AI agent may read and modify only this repository and its subdirectories, except when the user explicitly provides another path for a specific task.

Allowed areas:

- `AI_RULES.md`
- `CLAUDE.md`
- `WORKFLOW.md`
- `README.md`
- `docs/`
- `src/`
- `public/`
- configuration files in the repository root
- Git metadata for normal non-destructive status, diff, add, commit, branch, fetch, and push operations

The AI agent must not access, inspect, or modify:

- other repositories or unrelated projects
- user home directories outside this repository
- Desktop, Downloads, cloud-sync folders, SSH keys, browser profiles, or credential stores
- system directories such as `C:\Windows` or `C:\Users` outside this repository
- OS settings, services, registry entries, package managers, or global editor settings
- secret files such as `.env`, `.env.local`, `firebase-adminsdk-*.json`, or `service-account*.json`

## 2. Required Startup Checklist

Before making changes, the AI agent must:

1. Read `AGENTS.md` if present.
2. Read `AI_RULES.md`.
3. Read `CLAUDE.md`.
4. Read `WORKFLOW.md`.
5. Read `docs/work-plan.md`.
6. Read `docs/product-market-report.md` when the task affects product direction, prioritization, onboarding, UI strategy, or differentiation.
7. Read `docs/ui-design-analysis-report.md` when the task affects UI, visual quality, motion, forms, navigation, or interaction design.
8. Confirm the current working directory is the repository root.
9. Run `git status --short` or `git status -sb`.
10. Confirm the canonical remote with `git remote -v`.
11. Identify the files expected to change.
12. Avoid touching unrelated files.

## 3. Default Delivery Policy

Unless the user explicitly says `議論のみ`, `相談のみ`, or says not to commit or push, repository changes should be completed through:

1. focused edits,
2. validation,
3. Git commit,
4. push to a dated branch,
5. pull request creation or update with `YYYY-MM-DD HH:mm JST` in the title,
6. merge into `main`,
7. local `main` synchronization,
8. a Japanese work report.

Pull request titles must include date, time, and `JST` in `YYYY-MM-DD HH:mm JST` format so rollback points are easy to identify.

Direct pushes to `main` require explicit user instruction. Force pushing is prohibited.

Work must follow the phase-based review flow in `WORKFLOW.md`: finish a phase, push it, merge it, report it, and wait for user confirmation before starting the next phase.

## 4. Tool Execution Restrictions

Allowed command categories:

- `git status`, `git diff`, `git diff --check`, `git add`, `git commit`, `git branch`, `git switch`, `git log`, `git fetch`, `git remote`, `git rev-parse`, `git push`
- repository-local validation commands such as `npx tsc --noEmit`, `npm run build`, and `npm run lint`
- repository-local development commands such as `npm run dev` when visual verification is needed

Prohibited command categories:

- force pushing
- history rewriting
- deleting untracked repository content without explicit user approval
- recursive destructive shell commands outside generated build/cache directories
- package installation or dependency upgrades without a clear reason and user-facing explanation
- commands that read or write outside the repository root
- commands that inspect or expose secrets

## 5. Product and Data Rules

- Priority Todo is a student-focused assignment management app, not a generic calendar replacement.
- Moodle support must not make non-Moodle users second-class users.
- Moodle URL values may contain private calendar tokens and must be treated as secrets.
- Do not read, dump, copy, aggregate, or expose production Firestore user data.
- Do not use Firebase Admin SDK or service account keys.
- Do not loosen Firestore Security Rules below the per-user access model in `CLAUDE.md`.
- If a new collection is added, update `firestore.rules` in the same phase and explain the rule change.
- Do not add analytics, logging, or external API transmission for production user data without explicit approval.

## 6. Implementation Rules

- Preserve TypeScript strictness.
- Avoid `any` unless there is a narrow and explained reason.
- Prefer existing local components and utilities before adding new abstractions.
- Keep changes small, reviewable, and aligned with `docs/work-plan.md`.
- For UI work, verify layout and behavior visually when feasible.
- For Moodle parsing and synchronization, prefer safe behavior: keep earliest plausible deadlines, require user confirmation for inferred data, and never delete missing Moodle events automatically.
- For non-Moodle flows, keep time-table based templates, recurring assignments, and hand entry fast and reliable.

## 7. Git Rules

Branch names must include an ISO date in `YYYY-MM-DD` format.

Recommended branch pattern:

```text
ai/YYYY-MM-DD-short-description
```

Commit rules:

- Commit focused, reviewable changes.
- Use clear messages such as `docs: add AI rules` or `ui: refine today task cards`.
- Review `git diff` and run `git diff --check` before every commit.
- Push the dated branch unless the user requested discussion only or asked not to push.
- Use dated pull request titles, such as `2026-05-15 12:34 JST: docs add AI rules`.
- Merge approved work into `main` and synchronize local `main`.

Prohibited Git operations:

- `git push --force`
- `git push --force-with-lease`
- `git reset --hard` unless explicitly requested by the user
- `git rebase` unless explicitly requested by the user
- `git commit --amend` unless explicitly requested by the user
- filtering or rewriting history

## 8. Rollback Requirements

Every AI task must preserve rollback capability:

- Use Git commits as restore points.
- Prefer corrective commits or `git revert` over destructive history operations.
- Keep terminal commands reproducible.
- Report the branch, pull request, task commit, and final `main` commit after each phase.

Rollback examples:

```bash
git status --short
git log --oneline --max-count=10
git revert <commit-sha>
```

## 9. Human Approval Policy

The AI agent should behave conservatively:

- Explain planned changes before large refactors.
- Prefer small diffs.
- Never assume destructive cleanup is acceptable.
- Ask before touching secrets, production data, authentication domain behavior, or Firestore access scope.
- Treat user-created app data, design direction, and product plans as protected unless explicitly instructed otherwise.
