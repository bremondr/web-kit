# Maintaining web-kit

How to release a module, tell projects about it, add a module, and change what projects copy. For setting up a project that uses the modules, see [setup-project.md](setup-project.md); for starting a new one, [new-project.md](new-project.md).

## Releasing a module

1. Make the change on a branch, with tests for logic that runs in Node (`<module>/*.test.mjs`). Try what runs in a browser on the module's demo page (`demo/<module>.html`, see [Trying modules in the demo](#trying-modules-in-the-demo)), and update the page if what the module shows or does changed.
2. At the top of the module's `CHANGELOG.md`, add a section for the new version:
   ```markdown
   ## 1.1.0 (2026-12-01)

   - What changed, in plain words.
   ```
   Choose the version by what a project has to do:
   - **Patch** (1.0.0 → 1.0.1): a fix; nothing to do.
   - **Minor** (1.0.0 → 1.1.0): something new; nothing to do unless the project wants it.
   - **Major** (1.0.0 → 2.0.0): a project must change something. The changelog says exactly what.

   Projects take patch and minor versions by themselves, and major versions only when asked.
3. Update the module's README if its interface changed, and the modules table in the main README if needed.
4. Open a pull request. The tests and the module check run on it; merge when they pass.
5. Tag the merged commit on `main`. From a clone:
   ```sh
   git switch main
   git pull
   git tag feedback-kit-v1.1.0
   git push origin feedback-kit-v1.1.0
   ```
   Or without a clone, tagging the newest commit of `main`:
   ```sh
   gh api repos/bremondr/web-kit/git/refs -f ref=refs/tags/feedback-kit-v1.1.0 -f sha=$(gh api repos/bremondr/web-kit/commits/main --jq .sha)
   ```
   (`$( … )` works in PowerShell too.)

The tag starts `.github/workflows/release.yml`. It:
- runs the tests and the module check;
- takes the notes from the changelog, and stops if there is no section for that version;
- creates the GitHub Release, or, if you already made one on GitHub's website, gives it those notes;
- tells the projects that use the module, when the notice token is set up (below).

Projects then get an update pull request within a day, or within minutes with the notice.

**A Claude Code cloud session can't push tags**: its git proxy refuses them. Claude prepares everything and gives you the `gh api` command above; you run it.

**A release that went wrong** (bad notes, broken code): don't move or delete the tag, since projects may already have it. Fix it on `main` and release the next patch version.

## Telling projects about a release at once

Without this, each project's daily check finds a new release within a day. To tell them as soon as the release is out:

1. Create a fine-grained token at <https://github.com/settings/personal-access-tokens/new>:
   - **Token name:** `web-kit: release notices`
   - **Description:** `Used by web-kit's .github/workflows/release.yml (secret WEB_KIT_DISPATCH_TOKEN) to start "Update vendored modules" in the projects listed in consumers.json.`
   - **Expiration:** up to a year; note the date. When it expires, notices stop; the daily check keeps working.
   - **Repository access:** Only select repositories, and pick every project in `consumers.json`.
   - **Permissions:** Contents: Read and write. GitHub requires this permission to start a workflow in another repository with a `repository_dispatch` event; the workflow there decides what happens.
2. Store it in web-kit:
   ```sh
   gh secret set WEB_KIT_DISPATCH_TOKEN --repo bremondr/web-kit
   ```
3. When a new project starts using a module, add it to `consumers.json` **and** to the token's repository access.

If a project can't be reached, the release still succeeds and the run shows a warning for that project.

## Adding a module

1. A new top-level folder, named for what it does (`share-kit`, `qr-kit`, …), with:
   - the code: plain ES modules and CSS, importing only from inside the folder;
   - `README.md`: what it does, how a project sets it up and uses it, and its limits (see `feedback-kit/README.md`);
   - `CHANGELOG.md`, starting with the version you'll release first;
   - tests (`*.test.mjs`) for logic that runs in Node.
2. A demo page, `demo/<module>.html`, that imports the module from `../<module>/` and shows what it does with something worth looking at. Link it from `demo/index.html`, and add checks for it to `tools/check-demo.mjs`.
3. Add a row to the modules table in the main README.
4. Merge, then release (above). Then set up the projects that will use it ([setup-project.md](setup-project.md), steps 3 to 5 and 7).

`tools/check-modules.mjs` treats every top-level folder with JavaScript in it as a module, except `tools/`, `consumer/`, `demo/` and `template/`.

## Trying modules in the demo

Browser code is tried in `demo/`, not in a project: each page imports its module straight from the repository, so it always runs the branch you are on.

1. From the repository's root, run `python3 -m http.server` (or any static server) and open <http://localhost:8000/demo/>.
2. Look at the page at iPad sizes (1180 × 820 and 820 × 1180) and phone size (390 × 844), in light and dark mode. The browser's device toolbar does this; on a real iPad, open the computer's address on the same network.
3. Run `node tools/check-demo.mjs`. It drives every demo page in headless Chromium at those sizes and in both modes: no errors, nothing wider than the screen, and each module's own steps (for feedback-kit: the panel opens with the right picture, a stroke can be drawn and undone, the issue link is filled in; for git-store-kit, against a fake GitHub in the page: tokens, publishing, conflicts, history, the working folder and offline). It needs Playwright with Chromium:
   ```sh
   npm install --no-save playwright
   npx playwright install chromium
   ```
   `--screenshots <dir>` saves a picture of each page and the open panel. On a pull request, CI runs it in Chromium and in WebKit (Safari's engine) and keeps those pictures as `demo-screenshots-chromium` and `demo-screenshots-webkit` on the run's summary page.

The feedback-kit page sends its issues to this repository with the `demo` label. Create the label once:
```sh
gh label create demo --repo bremondr/web-kit --color c5def5 --description "Sent from a demo page"
```

### The demo online

GitHub Pages publishes `main` at <https://bremondr.github.io/web-kit/demo/>, and every open pull request from this repository as a preview at `https://bremondr.github.io/web-kit/preview/pr-<number>/demo/`, a minute or so after each push. A bot comments the preview's link on the pull request, so a branch can be tried on the iPad before it is merged; the list of previews is at <https://bremondr.github.io/web-kit/preview/>. A preview has a small badge (its commit, the pull request, the same page on `main`), keeps its own saved data (tokens, the offline copy) apart from `main`'s and the other previews', and disappears when its pull request is closed or merged. Pull requests from forks get no preview, because every version shares one origin.

web-kit publishes itself with the same files projects copy for their previews (see [Adding previews to a project](setup-project.md#adding-previews-to-a-project)):

- `.github/workflows/pages.yml` ("Deploy site") is `consumer/pages.yml` with `SITE_TOOLS: consumer`, so it runs `consumer/build-site.mjs` and `consumer/preview-runtime.js` as they are, with no second copies. `tools/new-project.test.mjs` fails if the two workflows differ in anything else: change `consumer/pages.yml`, then copy it over.
- `site.json` says what differs for web-kit: the start page is `demo/index.html`, `consumer/`, `template/` and `consumers.json` aren't published (nor, as for every project, tools, docs, tests, Markdown and `.github/`), and `node --test` and `node tools/check-modules.mjs` must pass on `main` before anything is published. The demo check isn't run there (it needs browsers); it runs on every pull request in `test.yml`.
- `index.html` at the root sends visitors to `demo/`; the pages import the modules from `../<module>/`, which is published too.

The workflow runs as it is on `main`, also for pull requests (`pull_request_target`; a pull request's files are only copied out of git, never run), so a change to it, to the build or to `site.json` shows in previews once it is merged.

**The Pages setting** (only the owner can change it): Settings, Pages, Source must be "GitHub Actions". To switch from "Deploy from a branch", then publish:
```sh
gh api repos/bremondr/web-kit/pages -X PUT -f build_type=workflow
gh workflow run pages.yml --repo bremondr/web-kit
```
To turn Pages on again after it has been turned off:
```sh
gh api repos/bremondr/web-kit/pages -X POST -f build_type=workflow
```
`gh api repos/bremondr/web-kit/pages --jq .build_type` says which it is (`workflow` or `legacy`).

Only when a change depends on how a project uses a module is it worth also trying it in that project: copy the branch's module folder over the project's vendored copy locally, run that project's checks, and don't commit the copy there.

## Changing what projects copy

The files in `consumer/` are copied into each project; they don't update themselves:

| File | In a project | What it does |
|---|---|---|
| `update-vendor.mjs` | `tools/update-vendor.mjs` | takes a module's release |
| `update-vendor.yml` | `.github/workflows/update-vendor.yml` | the daily update pull request |
| `build-site.mjs` | `tools/build-site.mjs` | builds the Pages site: `main` and a preview per pull request |
| `preview-runtime.js` | `tools/preview-runtime.js` | a preview's own storage and badge |
| `pages.yml` | `.github/workflows/pages.yml` | checks `main`, builds, publishes, comments the preview links |

When you change them:

1. Keep what projects already have working: `vendor.json`'s and `site.json`'s formats, the scripts' options, and what a missing option means. An old copy and a new one should behave the same for projects that don't recopy. What differs between projects goes in `site.json` (or `vendor.json`), never in edits to a copy.
2. Add tests for what runs in Node (`consumer/*.test.mjs`), and try a change to the preview runtime in a browser: build web-kit's own site with a fake pull request (see [setup-project.md](setup-project.md#adding-previews-to-a-project), step 4) and open the preview at iPad and phone sizes.
3. Add an entry at the top of [`consumer/CHANGELOG.md`](../consumer/CHANGELOG.md): the date, what changed, and whether projects should copy the files again.
4. If `pages.yml` changed, copy it over `.github/workflows/pages.yml` (keeping `SITE_TOOLS: consumer`).
5. After merging, copy the files into each project in `consumers.json` ([setup-project.md](setup-project.md), step 1, or step 1 of Adding previews), each with its own pull request.

New projects get the newest consumer files by themselves: `tools/new-project.mjs` copies them from `consumer/` together with the starter template in `template/` ([new-project.md](new-project.md)). The template has no copies of its own. When a change makes something in the template wrong (its `site.json`, `CLAUDE.md` or `README.md`), update the template in the same pull request.

## Tokens and secrets at a glance

| Secret | Where | Token name | Permissions | What stops when it expires |
|---|---|---|---|---|
| `VENDOR_PR_TOKEN` | each project | `<project>: vendor update PRs` | that project: Contents, Pull requests (read and write) | update pull requests (the run fails) |
| `WEB_KIT_DISPATCH_TOKEN` | web-kit | `web-kit: release notices` | every project in `consumers.json`: Contents (read and write) | instant notices (the daily check still works) |
| `VENDOR_GIT_TOKEN` | each project, only if web-kit is private | `<project>: read web-kit` | web-kit: Contents (read) | all updates |

GitHub emails you before a token expires. Make a new one with the same name and settings, and set the secret again with `gh secret set`.
