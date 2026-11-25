# Changes to the consumer files

The consumer files are copied into each project and don't update themselves: `update-vendor.mjs` and `update-vendor.yml` (see `docs/setup-project.md`, step 1), and `build-site.mjs`, `preview-runtime.js` and `pages.yml` for previews (see "Adding previews to a project" there). A new project made with `tools/new-project.mjs` gets the newest of all five. Each entry says whether projects should copy them again.

## 2026-11-25

- New, optional: `previewSections` in `site.json`. A pull request with the GitHub label of a section is listed under that section's title (and optional note) on the list of previews, after the others, so a kind of pull request can be told apart at a glance. Protogames uses it for `outside-source`, a fork's pull request that a maintainer copied to a branch of the repository so it gets a preview. `pages.yml` now puts each pull request's `labels` in `previews.json`, and `build-site.mjs` reads them; sections with no pull request are not shown.
- Projects that want sections copy `build-site.mjs` and `pages.yml` again and add `previewSections` to `site.json`. Nothing else changes, and old copies keep working: without `previewSections`, or with an old `pages.yml` (no labels), the list is as before. `preview-runtime.js`, `update-vendor.mjs` and `update-vendor.yml` are unchanged.

## 2026-11-24

- `pages.yml`: building and publishing are now two jobs (`build`, then `deploy`), as in GitHub's own Pages workflows. In one job, `deploy-pages` ran right after `upload-pages-artifact` and sometimes found no artifact ("No artifacts named github-pages were found for this workflow run"), because GitHub lists a new artifact a moment after the upload reports it done. It failed about one run in four in web-kit (pull request runs of every kind, not only after merges), and it hurt most after a merge: the run for the closed pull request cancelled the push run and then failed itself, so the live site stayed on the old `main` until someone ran the workflow by hand.
- `pages.yml`: a pull request closed by a merge no longer gets a run that builds; the push to `main` that the merge makes publishes the site without that pull request's preview. Such a run, and a fork's pull request, gets a concurrency group of its own, so it can't cancel the push run. A pull request closed without merging still gets a run, which takes its preview down. The concurrency group is now on the workflow instead of the job, so a run's build and deploy are cancelled together by a newer run.
- If a publish still fails, use "Re-run failed jobs" (only `deploy` runs again) or run the workflow by hand; "Re-run all jobs" uploads a second artifact and fails with "Multiple artifacts".
- Projects should copy `pages.yml` again (step 1 of "Adding previews to a project" in `docs/setup-project.md`). An old copy keeps working as before, with the occasional failed publish. Nothing changes in `site.json`, `build-site.mjs`, `preview-runtime.js`, `update-vendor.mjs` or `update-vendor.yml`.

## 2026-11-22

- New: pull request previews. `pages.yml` (to `.github/workflows/pages.yml`), `build-site.mjs` and `preview-runtime.js` (to `tools/`) publish `main` with GitHub Pages and every open pull request from the repository at `/preview/pr-<number>/`, with a bot comment linking it. They are one general version of what Ultimate Playbook and Protogames each built for themselves, with the same safety: `pull_request_target` with the pull request's files only copied out of git, no previews from forks, `main` checked before every publish, a preview gone when its pull request closes, separate browser storage per preview, and the latest run wins. What differs between projects (the site's folder, what is published, the checks, a service worker, scripts left out of previews, the Feedback link, the comment) goes in a `site.json`; the copies aren't edited. Besides what the two projects had, a preview's IndexedDB and Cache Storage names get its prefix too, the runtime goes into every HTML page, and the badge links to the same page on the live site.
- `update-vendor.mjs` and `update-vendor.yml` are unchanged: projects don't need new copies of them.
- Projects that already have previews of their own don't have to switch. To switch, follow "Adding previews to a project" in `docs/setup-project.md`; keep the old `commentMarker` in `site.json` so the bot updates the comments already there.

## 2026-11-21

- First version. Ultimate Playbook has it.
