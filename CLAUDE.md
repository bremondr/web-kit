# Working on web-kit

Reusable modules for static web apps, each copied into projects at a released version. Read `README.md` first, then `docs/maintaining.md` (releases, tokens, adding a module, changing the consumer files). `docs/setup-project.md` is how a project starts using the modules.

## Ground rules

- Plain ES modules and CSS. No packages, no build step, no frameworks, nothing loaded from elsewhere at run time.
- A module is one top-level folder and imports only from itself. Projects copy only that folder. `tools/check-modules.mjs` enforces it.
- Nothing project-specific in a module: a project gives it what it needs through options (see `feedback-kit/README.md`).
- Keep each module's `README.md` (its interface) and `CHANGELOG.md` up to date with every change.
- Versions: `<major>.<minor>.<patch>`. A change a project must adapt to is a new major version, and the changelog says what to change. Additions are minor; fixes are patch.
- Everything written in the repository (code comments, READMEs, changelogs, issues, PRs, commit messages) is in English, in plain words. The owner often gives feedback in Czech.
- `consumer/update-vendor.mjs` and `consumer/update-vendor.yml` are the originals that projects copy, and they don't update themselves. Keep old copies working, add an entry to `consumer/CHANGELOG.md`, and say in the PR whether projects need a new copy.
- When a change affects how projects set up or use a module, update `docs/setup-project.md` and the module's "Setting it up in a project" section too.

## Checks (run both before opening a PR)

```sh
node --test
node tools/check-modules.mjs
```

Add tests in `<module>/*.test.mjs` for logic that runs in plain Node. Code that needs a browser is best tried in the project that uses it, with a vendored copy of the branch (copy the folder by hand, don't commit it there).

## Workflow

- Open work is in this repository's GitHub issues. One branch and one pull request per issue, with `Fixes #N` in the description.
- The owner merges. Before asking for that, the checks pass. For code that runs in a browser, also try it in a project that uses the module (Ultimate Playbook is the first): copy the branch's module folder over the project's vendored copy locally, run that project's checks and look at it, and don't commit the copy there.
- A change to a module isn't in any project until it's released and the project updates. Say in the PR which version it should be released as.

## Releasing

Only when the owner asks. Merge first, then tag `main` with `<module>-v<version>`. The changelog must already have a section for that version. See "Releasing a module" in `docs/maintaining.md`. A Claude Code cloud session can't push tags (its git proxy refuses them): give the owner the `gh api` command from `docs/maintaining.md` instead, with the tag filled in.
