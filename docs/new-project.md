# Starting a new project from the template

A new static web app can start with everything Ultimate Playbook and Protogames had to set up by hand: a preview of every pull request, vendored web-kit modules with a daily update, a `CLAUDE.md` and a README, and the checks in CI. For a project that already exists, see [setup-project.md](setup-project.md) instead (modules) and its [Adding previews](setup-project.md#adding-previews-to-a-project) section.

**What you need:** Node 18 or newer, git, and the [GitHub CLI](https://cli.github.com/) (`gh`), signed in. The commands are for a Unix shell; in PowerShell, run the `git` and `gh` lines one at a time instead of joining them with `&&`.

**To have Claude Code do it:** open a session in an empty folder and paste the prompt at the end of this page. The steps that need your GitHub account (the token and secret) stay with you; Claude lists them for you.

## What the new project gets

| Path | What it is | From |
|---|---|---|
| `index.html`, `css/app.css`, `js/main.js`, `js/tally.js` | a tiny app (a tally saved in the browser) to replace with the real one | `template/` |
| `tests/tally.test.mjs` | a `node --test` test of the logic | `template/` |
| `CLAUDE.md`, `README.md` | skeletons in the projects' style: ground rules, checks, workflow, previews, feedback issues | `template/` |
| `site.json` | what Pages publishes, the checks before publishing, the Feedback link on previews | `template/` |
| `vendor.json` | no modules yet; `js/vendor/` is where they go | `template/` |
| `package.json` | only `{"type": "module"}`: Node then runs the project's `.js` files as ES modules in tests, without the `MODULE_TYPELESS_PACKAGE_JSON` warning. It is not for packages, and the site build doesn't publish it. Add `scripts` to it if you want `npm test`, but keep `"type"`. | `template/` |
| `.github/workflows/test.yml` | `node --test` and `update-vendor.mjs --verify` on every pull request | `template/` |
| `.nojekyll`, `.gitignore` | files served as they are; the build's output not committed | `template/` |
| `tools/build-site.mjs`, `tools/preview-runtime.js`, `.github/workflows/pages.yml` | the site and the previews | `consumer/` |
| `tools/update-vendor.mjs`, `.github/workflows/update-vendor.yml` | module updates | `consumer/` |
| `.claude/skills/localize/` | a Claude Code skill for translating the app (Czech first): the texts in one keyed file, tests that none is missing or left untranslated, checks for longer words at iPad and phone sizes, and a review of every text by the owner on a claude.ai page | web-kit's `.claude/skills/` |

The template keeps no copies of the consumer files: `tools/new-project.mjs` takes them from `consumer/` when it makes the project, so they are always the newest. (A test fails if a copy appears in `template/`.) The same goes for the skills: they are copied from web-kit's own `.claude/skills/`, which sessions working on web-kit use too. The site build never publishes `.claude/`. `{{TITLE}}`, `{{REPO}}` and `{{PAGES_URL}}` in the template are filled in.

## 1. Make the project folder

```sh
git clone --depth 1 https://github.com/bremondr/web-kit.git
node web-kit/tools/new-project.mjs my-app --repo <owner>/my-app --title "My App"
```

The folder must not exist yet, or be empty. Try it:

```sh
cd my-app
node --test
python3 -m http.server
```

and open <http://localhost:8000/>. The web-kit clone isn't needed any more.

## 2. Create the repository

```sh
git init -b main
git add -A
git commit -m "Start from web-kit's template"
gh repo create <owner>/my-app --public --source . --push
```

Pages on a free account needs a public repository. Then let GitHub delete branches once they are merged:

```sh
gh api repos/<owner>/my-app -X PATCH -F delete_branch_on_merge=true
```

## 3. Publish with GitHub Pages, from Actions

```sh
gh api repos/<owner>/my-app/pages -X POST -f build_type=workflow
gh workflow run pages.yml --repo <owner>/my-app
```

(If Pages is already on, change its source instead: `gh api repos/<owner>/my-app/pages -X PUT -f build_type=workflow`. On the website: Settings, Pages, Source: "GitHub Actions".)

The "Deploy site" run checks `main` (`site.json`'s `checks`), builds the site and publishes it at `https://<owner>.github.io/my-app/`. From then on, every push to `main` publishes it, and every pull request from this repository gets a preview at `.../preview/pr-<number>/` with a bot comment linking it. A custom domain, if you set one under Settings, Pages, is used by the links by itself; no `CNAME` file is needed.

## 4. Labels

The badge on a preview has a Feedback link that opens an issue with the `feedback` label:

```sh
gh label create feedback --repo <owner>/my-app --color d4c5f9 --description "Sent from the app"
```

## 5. The token for module updates: `VENDOR_PR_TOKEN`

As in [setup-project.md, step 6](setup-project.md#6-give-the-workflow-a-token-vendor_pr_token): a fine-grained token named `my-app: vendor update PRs`, with Contents and Pull requests read and write on this repository only, then:

```sh
gh secret set VENDOR_PR_TOKEN --repo <owner>/my-app
```

Without it, update pull requests get no checks or preview by themselves.

## 6. Take modules

When the app needs a module, follow [setup-project.md](setup-project.md) steps 3 to 5 (`node tools/update-vendor.mjs feedback-kit@<version>`, wiring it in, the note in README and CLAUDE.md; the note is already there) and step 7 (add the project to `consumers.json` in web-kit).

## 7. Try a preview

Open a pull request with any change. Within a minute or two the bot comments **Preview:** with the link. The preview has a small badge in the bottom-right corner (its commit, the pull request, the live site, all previews, Feedback), and a count saved there doesn't change the live app's. Closing the pull request removes the preview.

## `site.json`

All of it is optional; the comment at the top of `tools/build-site.mjs` has every option.

| Option | What it does | Default |
|---|---|---|
| `name` | the title of the list of previews | none |
| `root` | the site's folder in the repository | `.` |
| `paths` | what is published, inside `root` | everything except tools, tests, docs, `*.md`, `*.test.mjs`, `site.json`, `vendor.json`, `.github/` |
| `exclude` | more to leave out: `*.psd`, `/notes/` (a folder at the root), `drafts/` (a folder anywhere) | none |
| `pages` | pages every version must have, checked for files they load that are missing; the preview link points at the first | `["index.html"]` |
| `serviceWorker` | the live one gets `VERSION` and `APP_FILES` filled in from what is published; previews get one that does nothing | none |
| `dropFromPreviews` | `<script>` tags to remove from previews, by part of the tag (analytics) | none |
| `checks` | commands that must pass on `main` before anything is published | `["node --test"]` |
| `maxPreviews` | the newest this many previews are published | `20` |
| `feedback` | `{"labels": [...], "event": "..."}`: a Feedback link on the badge; it first sends the page a cancelable event, so the app's own feedback panel can open instead | none |
| `previewSections` | `[{"label": "outside-source", "title": "...", "note": "..."}]`: pull requests with this GitHub label are listed in a section of their own on the list of previews, after the others (`note` is optional). Needs the current `pages.yml` too, which passes the labels on | none |
| `global` | another name for `window.SITE_PREVIEW`, the preview's description; needed when the project's code reads it (its `storagePrefix`, for example) under a name of its own | none |
| `commentMarker`, `commentNote` | the bot comment's hidden marker and its text | `<!-- site-preview -->` |

The workflow and the build always run as they are on `main`: a change to `site.json` shows in previews only once it is merged.

## A prompt for Claude Code

Paste this into a Claude Code session opened in an empty folder, with the name filled in:

```text
Start a new static web app, <owner>/<name>, called "<title>", from bremondr/web-kit's starter template,
following https://github.com/bremondr/web-kit/blob/main/docs/new-project.md.

Read first: web-kit's README.md and docs/new-project.md, and template/CLAUDE.md for how the project will be
worked on.

1. Clone web-kit (git clone --depth 1 https://github.com/bremondr/web-kit.git) next to this folder, and run
   node web-kit/tools/new-project.mjs <name> --repo <owner>/<name> --title "<title>".
2. In the new folder, run node --test and node tools/build-site.mjs --run-checks. Build the site locally from a
   test branch with one small change (a previews.json naming that branch as pull request 1), and check that
   _site/ has the app at its root and preview/pr-1/ with the change and preview-runtime.js.
3. Fill in the two placeholders in README.md and CLAUDE.md (what the app is, for whom, which devices come
   first) from what I tell you about the app, or leave them as comments if I haven't.
4. Create the repository and push (docs/new-project.md, step 2), turn on Pages from Actions and run the
   deploy (step 3), create the feedback label (step 4), and turn on deleting merged branches. If you can't
   run gh with my account, give me the exact commands instead.
5. Open a pull request with one small, visible change, and check that the bot comments a working preview
   link. Show me screenshots of the preview at iPad (1180 × 820, 820 × 1180) and phone (390 × 844) sizes, in
   light and dark mode.

Don't edit tools/build-site.mjs, tools/preview-runtime.js, tools/update-vendor.mjs or the two workflows that
come from web-kit: what differs for this project goes in site.json and vendor.json. If one of them needs a
change, describe it for an issue in bremondr/web-kit and tell me.

At the end, give me the exact commands and settings for what I do myself:
- the VENDOR_PR_TOKEN token and secret (step 5);
- anything from steps 2 to 4 you couldn't do.
```
