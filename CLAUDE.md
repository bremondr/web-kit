# Working on web-kit

Reusable modules for static web apps, each copied into projects at a released version. Read `README.md` first, then `docs/maintaining.md` (releases, tokens, adding a module, changing the consumer files). `docs/setup-project.md` is how an existing project starts using the modules (and adds pull request previews); `docs/new-project.md` starts a new project from `template/` with `tools/new-project.mjs`.

## Ground rules

- Plain ES modules and CSS. No packages, no build step, no frameworks, nothing loaded from elsewhere at run time.
- A module is one top-level folder and imports only from itself. Projects copy only that folder. `tools/check-modules.mjs` enforces it.
- Every module has a demo page in `demo/` (`demo/<module>.html`, linked from `demo/index.html`) that imports it straight from `../<module>/`. A new module gets one, and a change to what a module shows or does is reflected there.
- Nothing project-specific in a module: a project gives it what it needs through options (see `feedback-kit/README.md`).
- Keep each module's `README.md` (its interface) and `CHANGELOG.md` up to date with every change.
- Versions: `<major>.<minor>.<patch>`. A change a project must adapt to is a new major version, and the changelog says what to change. Additions are minor; fixes are patch.
- Everything written in the repository (code comments, READMEs, changelogs, issues, PRs, commit messages) is in English, in plain words. The owner often gives feedback in Czech.
- The files in `consumer/` are the originals that projects copy: `update-vendor.mjs` and `update-vendor.yml` (vendored modules), and `pages.yml`, `build-site.mjs` and `preview-runtime.js` (the site and pull request previews, set per project in `site.json`). They don't update themselves. Keep old copies working, add an entry to `consumer/CHANGELOG.md`, and say in the PR whether projects need a new copy.
- When a change affects how projects set up or use a module, update `docs/setup-project.md` and the module's "Setting it up in a project" section too.
- `.claude/skills/` holds Claude Code skills that sessions here use and that `tools/new-project.mjs` copies into new projects (`SKILL_DIRS`), for example `localize` (translating a module or an app). They are not modules; the site build doesn't publish them. A change to one reaches existing projects only when they copy it again (`docs/setup-project.md`).
- `template/` is a starting point for new projects, not a module. When a consumer file or the projects' common setup changes, keep `template/` and `docs/new-project.md` in step.

## Checks (run all three before opening a PR)

```sh
node --test
node tools/check-modules.mjs
node tools/check-demo.mjs        # the demo pages in headless Chromium (needs Playwright)
```

Add tests in `<module>/*.test.mjs` for logic that runs in plain Node. Code that needs a browser is tried in the demo: serve the repository's root (`python3 -m http.server`), open `http://localhost:8000/demo/`, and look at it at iPad (1180 × 820, 820 × 1180) and phone (390 × 844) sizes, in light and dark mode. `node tools/check-demo.mjs --screenshots <dir>` saves those pictures. GitHub Pages publishes `main` at https://bremondr.github.io/web-kit/demo/ (see "The demo online" in `docs/maintaining.md`), so a merged change can be tried there on a real iPad. Extend `tools/check-demo.mjs` when a demo page gets something new worth checking.

## Workflow

- Open work is in this repository's GitHub issues. One branch and one pull request per issue, with `Fixes #N` in the description.
- Open the pull request as soon as the work is pushed and the checks pass, without asking.
- The owner merges. Before asking for that, the checks pass, and for code that runs in a browser, the PR shows screenshots of its demo page. Trying it in a project as well (copying the branch's module folder over the project's vendored copy locally, without committing it there) is only needed when the change depends on how a project uses the module.
- A change to a module isn't in any project until it's released and the project updates. Say in the PR which version it should be released as.

## Releasing

Only when the owner asks. Merge first, then tag `main` with `<module>-v<version>`. The changelog must already have a section for that version. See "Releasing a module" in `docs/maintaining.md`. A Claude Code cloud session can't push tags (its git proxy refuses them): give the owner the `gh api` command from `docs/maintaining.md` instead, with the tag filled in.
