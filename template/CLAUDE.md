# Working on {{TITLE}}

<!-- One or two sentences: what the app is, who it is for, and which devices come first. -->
A static web app. Live at {{PAGES_URL}}.

Read `README.md` first: what the app does, how the code is laid out, and the checks. Keep it up to date when a feature or the structure changes.

## Ground rules

- Plain HTML, CSS and ES modules. No build step, no packages, no frameworks. Serve the folder (`python3 -m http.server`) to run it.
- `package.json` holds only `"type": "module"`, so Node runs the `.js` files as ES modules in tests (no `MODULE_TYPELESS_PACKAGE_JSON` warning). Keep it; it is not for packages, and the site build doesn't publish it.
- Logic that doesn't need the page goes in modules without DOM code, so it can be tested in plain Node (like `js/tally.js`).
- `js/vendor/` holds copies of modules released in [bremondr/web-kit](https://github.com/bremondr/web-kit) (versions in `vendor.json`). Don't edit them here: change the module in web-kit, release it, then run `node tools/update-vendor.mjs` (or wait for the daily "Update vendored modules" pull request). Code of this app that uses a module stays outside `js/vendor/`.
- `tools/update-vendor.mjs`, `tools/build-site.mjs`, `tools/preview-runtime.js`, `.github/workflows/update-vendor.yml` and `.github/workflows/pages.yml` are copies of web-kit's consumer files. Don't edit them here either: what differs for this app goes in `site.json` and `vendor.json`.
- Everything written in the repository (code comments, README, issues, PRs, commit messages) is in English, in plain words.

## Checks (run before opening a PR)

```sh
node --test
```

Add tests in `tests/*.test.mjs` for logic that can run in plain Node. Check visual changes in a browser at iPad (1180 × 820 and 820 × 1180), phone (390 × 844) and desktop (1440 × 900) sizes, in light and dark mode, with screenshots. If a new check is added, add it to `site.json`'s `checks` too, so a broken `main` is never published.

## Workflow

- One branch and one pull request per issue, with `Fixes #N` in the description. Open work is in the GitHub issues.
- Open the pull request as soon as the work is pushed and the checks pass, without asking: the owner needs its preview to try it.
- Every open pull request gets a preview at `{{PAGES_URL}}preview/pr-N/` (a bot comments the link). It keeps its own saved data, separate from the live app. The owner tries it, then asks for the merge, so don't merge before that.
- Feedback from the app arrives as issues with the `feedback` label ("fix the open feedback issues" means those). Each one says where it was sent from (the live app or a preview, and the commit) and what was on screen.
- To try a change on a phone or tablet before pushing: `python3 -m http.server 8000 --bind 0.0.0.0`, then open `http://<this computer's IP>:8000` on the device (same Wi-Fi).
