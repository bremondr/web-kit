# web-kit

Reusable modules for static web apps: plain ES modules and CSS, with no dependencies, no build step and no server. Each module is one folder that a project copies, and each is released on its own with numbered versions.

| Module | What it does | Newest | Used by |
|---|---|---|---|
| [`feedback-kit/`](feedback-kit/) | "Send feedback": a GitHub issue filled in with what was on screen, plus a picture to draw on | see [releases](https://github.com/bremondr/web-kit/releases) | [Ultimate Playbook](https://github.com/bremondr/ultimate-playbook), [Protogames](https://github.com/bremondr/protogames) |
| [`git-store-kit/`](git-store-kit/) | An app's items as JSON files in GitHub repos, one file per item, every save a commit: public or private repos, tokens per repo, conflicts, history, offline copy | not released yet | planned: Ultimate Playbook (team drills), Protogames |

## How it works

- **A project keeps a plain copy of a released version** of each module it uses, for example `js/vendor/feedback-kit/`. It works offline and needs nothing at run time; the project's site build and service worker treat it like any other file.
- **`vendor.json`** at the project's root says which versions it has:
  ```json
  {"source": "bremondr/web-kit", "dir": "js/vendor", "modules": {"feedback-kit": "1.0.0"}}
  ```
- **A release is a tag** `<module>-v<major>.<minor>.<patch>`, with notes from the module's `CHANGELOG.md`.
- **`tools/update-vendor.mjs`** in the project (a copy of [`consumer/update-vendor.mjs`](consumer/update-vendor.mjs)) replaces a copy with a newer release. It stays within the same major version unless asked.
- **A daily workflow** in the project (a copy of [`consumer/update-vendor.yml`](consumer/update-vendor.yml)) runs it and opens a pull request when there's something new, with the changelog. The project's checks and previews run on that pull request, and nothing changes until someone merges it. With a token set up in web-kit, projects are told about a release at once instead of at their next daily check.

Copies are never edited in a project: change the module here, release it, and the projects update.

## Guides

- **[Starting a new project](docs/new-project.md):** a new static web app from the starter template, with pull request previews, vendored modules, the daily update, `CLAUDE.md`, a README and the checks from the first commit. It ends with a prompt that has Claude Code do it.
- **[Setting up a project](docs/setup-project.md):** an existing project, from nothing to automatic updates, step by step. It covers the commands, the `VENDOR_PR_TOKEN` token and how to name it, the settings, trying it out and troubleshooting, and [adding pull request previews](docs/setup-project.md#adding-previews-to-a-project). It ends with a prompt that has Claude Code do the setup.
- **[Maintaining web-kit](docs/maintaining.md):** releasing a module, telling projects at once (`WEB_KIT_DISPATCH_TOKEN`), adding a module, changing the consumer files, and all tokens at a glance.
- **Each module's README** says how to wire it into a project, for example [feedback-kit](feedback-kit/README.md#setting-it-up-in-a-project).

## Demo

[`demo/`](demo/) has one page per module, for trying it in a real browser without any project. The pages import each module straight from its folder, so they show the branch you are on, not a release.

**Online:** <https://bremondr.github.io/web-kit/demo/> shows `main`, published by GitHub Pages a minute or so after each merge. Every open pull request also gets a preview at `https://bremondr.github.io/web-kit/preview/pr-<number>/demo/`, linked by a bot comment on the pull request, so a branch can be tried on the iPad or a phone before it is merged. See [The demo online](docs/maintaining.md#the-demo-online).

**On your computer**, to try a branch: serve the repository's root and open the demo:

```sh
python3 -m http.server
```

Then go to <http://localhost:8000/demo/>. (Opened as a file, the browser won't load the modules.)

## Checks

```sh
node --test                    # every *.test.mjs
node tools/check-modules.mjs   # modules import only from themselves, and have a README and a changelog
node tools/check-demo.mjs      # the demo pages in headless Chromium, at iPad and phone sizes, light and dark
```

The demo check needs [Playwright](https://playwright.dev/) with Chromium (`npm install --no-save playwright && npx playwright install chromium`); it serves the repository itself. With `--screenshots <dir>` it also saves a picture of each page and of the open panel.

All three run on every pull request (`.github/workflows/test.yml`); the first two also run before every release (`.github/workflows/release.yml`) and before `main` is published (`.github/workflows/pages.yml`, from `site.json`).

## Files

| Path | What it is |
|---|---|
| `<module>/` | a module: its code, `README.md`, `CHANGELOG.md` and tests (projects don't get the tests) |
| `consumer/update-vendor.mjs` | the update script projects copy to `tools/` (plain Node 18+ and git), with its tests |
| `consumer/update-vendor.yml` | the update workflow projects copy to `.github/workflows/` |
| `consumer/build-site.mjs`, `consumer/preview-runtime.js` | the site build and the preview runtime projects copy to `tools/` (plain Node 18+ and git), with their tests; set up per project in `site.json` |
| `consumer/pages.yml` | the deploy workflow projects copy to `.github/workflows/pages.yml`: `main` and a preview per pull request on GitHub Pages |
| `consumer/CHANGELOG.md` | changes to the consumer files, and whether projects should copy them again |
| `template/` | the starter template for new projects (not a module); `tools/new-project.mjs` adds the consumer files to it |
| `consumers.json` | which projects use which modules, for the release notice |
| `demo/` | a page per module that imports it from its folder, and `index.html` linking them |
| `index.html`, `.nojekyll` | for GitHub Pages: the root sends visitors to `demo/`, and files are served as they are |
| `site.json` | what web-kit's own Pages site publishes (the demo and the modules) and the checks before it does |
| `docs/` | the guides above |
| `tools/check-modules.mjs`, `tools/check-demo.mjs`, `tools/release-notes.mjs` | the module check, the demo check, and the release notes from a changelog |
| `tools/new-project.mjs` | makes a new project's folder from `template/` and `consumer/` |
| `.github/workflows/` | `test.yml` (checks on pull requests), `release.yml` (a release from a tag), `pages.yml` (the demo and the previews, a copy of `consumer/pages.yml`) |
