# Changes to the consumer files

The consumer files are copied into each project and don't update themselves: `update-vendor.mjs` and `update-vendor.yml` (see `docs/setup-project.md`, step 1), and `build-site.mjs`, `preview-runtime.js` and `pages.yml` for previews (see "Adding previews to a project" there). A new project made with `tools/new-project.mjs` gets the newest of all five. Each entry says whether projects should copy them again.

## 2026-11-22

- New: pull request previews. `pages.yml` (to `.github/workflows/pages.yml`), `build-site.mjs` and `preview-runtime.js` (to `tools/`) publish `main` with GitHub Pages and every open pull request from the repository at `/preview/pr-<number>/`, with a bot comment linking it. They are one general version of what Ultimate Playbook and Protogames each built for themselves, with the same safety: `pull_request_target` with the pull request's files only copied out of git, no previews from forks, `main` checked before every publish, a preview gone when its pull request closes, separate browser storage per preview, and the latest run wins. What differs between projects (the site's folder, what is published, the checks, a service worker, scripts left out of previews, the Feedback link, the comment) goes in a `site.json`; the copies aren't edited. Besides what the two projects had, a preview's IndexedDB and Cache Storage names get its prefix too, the runtime goes into every HTML page, and the badge links to the same page on the live site.
- `update-vendor.mjs` and `update-vendor.yml` are unchanged: projects don't need new copies of them.
- Projects that already have previews of their own don't have to switch. To switch, follow "Adding previews to a project" in `docs/setup-project.md`; keep the old `commentMarker` in `site.json` so the bot updates the comments already there.

## 2026-11-21

- First version. Ultimate Playbook has it.
