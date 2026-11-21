# Working on web-kit

Reusable modules for static web apps, each copied into projects at a released version. Read `README.md` first: it explains how projects take modules, how releases work, and the checks.

## Ground rules

- Plain ES modules and CSS. No packages, no build step, no frameworks, nothing loaded from elsewhere at run time.
- A module is one top-level folder and imports only from itself. Projects copy only that folder. `tools/check-modules.mjs` enforces it.
- Nothing project-specific in a module: a project gives it what it needs through options (see `feedback-kit/README.md`).
- Keep each module's `README.md` (its interface) and `CHANGELOG.md` up to date with every change.
- Versions: `<major>.<minor>.<patch>`. A change a project must adapt to is a new major version, and the changelog says what to change. Additions are minor; fixes are patch.
- Everything written in the repository (code comments, READMEs, changelogs, issues, PRs, commit messages) is in English, in plain words. The owner often gives feedback in Czech.
- `consumer/update-vendor.mjs` and `consumer/update-vendor.yml` are the originals that projects copy. After changing them, say in the PR that projects need a new copy.

## Checks (run both before opening a PR)

```sh
node --test
node tools/check-modules.mjs
```

Add tests in `<module>/*.test.mjs` for logic that runs in plain Node. Code that needs a browser is best tried in the project that uses it, with a vendored copy of the branch (copy the folder by hand, don't commit it there).

## Releasing

Only when the owner asks. Merge first, then tag `main` with `<module>-v<version>`. The changelog must already have a section for that version. See "Releasing a module" in the README. A Claude Code cloud session can't push tags (its git proxy refuses them): give the owner the `gh api` command from the README instead.
