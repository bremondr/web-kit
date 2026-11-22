# Setting up a project to use web-kit modules

This takes a project from nothing to automatic updates: it keeps a plain copy of a released module, and a daily workflow opens a pull request when there is a new release. Ultimate Playbook was set up this way; its files are a working example ([`vendor.json`](https://github.com/bremondr/ultimate-playbook/blob/main/vendor.json), [`tools/update-vendor.mjs`](https://github.com/bremondr/ultimate-playbook/blob/main/tools/update-vendor.mjs), [`.github/workflows/update-vendor.yml`](https://github.com/bremondr/ultimate-playbook/blob/main/.github/workflows/update-vendor.yml)).

For a new project, start from the template instead ([new-project.md](new-project.md)): it comes with all of this, and with pull request previews. To add previews to a project that has none, see [Adding previews to a project](#adding-previews-to-a-project).

**What you need:** the project on GitHub; Node 18 or newer and git on your computer; the [GitHub CLI](https://cli.github.com/) (`gh`), signed in. The commands work in PowerShell and in a Unix shell unless a step shows both.

**To have Claude Code do it:** open a session in the project and paste the prompt at the end of this page. The steps that need your GitHub account (the label, the token and secret, the setting) stay with you; Claude lists them for you.

## 1. Copy the update script and the workflow

From the project's root, in a Unix shell:

```sh
mkdir -p tools .github/workflows
curl -fsSL https://raw.githubusercontent.com/bremondr/web-kit/main/consumer/update-vendor.mjs -o tools/update-vendor.mjs
curl -fsSL https://raw.githubusercontent.com/bremondr/web-kit/main/consumer/update-vendor.yml -o .github/workflows/update-vendor.yml
```

In PowerShell (`curl.exe` comes with Windows 10 and later; plain `curl` there is something else):

```powershell
New-Item -ItemType Directory -Force tools, .github/workflows | Out-Null
curl.exe -fsSL https://raw.githubusercontent.com/bremondr/web-kit/main/consumer/update-vendor.mjs -o tools/update-vendor.mjs
curl.exe -fsSL https://raw.githubusercontent.com/bremondr/web-kit/main/consumer/update-vendor.yml -o .github/workflows/update-vendor.yml
```

The workflow uses the default branch, Node 22 and `ubuntu-latest`; nothing in it needs changing for a usual project.

## 2. Say where the copies go: `vendor.json`

At the project's root:

```json
{
  "source": "bremondr/web-kit",
  "dir": "js/vendor",
  "modules": {}
}
```

`dir` is where each module's folder goes. Put it inside what the site publishes, next to the project's own scripts, so the modules are served like any other file.

## 3. Take a module

Check the module's newest version on the [releases page](https://github.com/bremondr/web-kit/releases), then:

```sh
node tools/update-vendor.mjs feedback-kit@1.0.0
```

This copies `feedback-kit/` at that release into `js/vendor/feedback-kit/` (without its tests) and writes the version into `vendor.json`. `node tools/update-vendor.mjs --verify` confirms the copy is exactly the release.

## 4. Wire it in

Follow the module's README: its "Setting it up in a project" ([feedback-kit](../feedback-kit/README.md#setting-it-up-in-a-project), [git-store-kit](../git-store-kit/README.md#setting-it-up-in-a-project), which also needs a data repo, tokens, and GitHub's hosts in the page's Content-Security-Policy). Keep the project's own code that uses the module outside the vendored folder, so updates can replace that folder whole.

If the project has a **service worker with a list of files** to keep offline, add the module's files to it. If it also caches web fonts, read the module's notes on offline use.

Optionally, guard the copies in the project's own checks: no file in `js/vendor/<module>/` should import from outside that folder. Ultimate Playbook's [`tools/check-imports.mjs`](https://github.com/bremondr/ultimate-playbook/blob/main/tools/check-imports.mjs) does this.

## 5. Tell the project's docs and Claude

So nobody edits the copies by hand, add something like this to the project's README and CLAUDE.md:

```markdown
`js/vendor/` holds copies of modules released in [bremondr/web-kit](https://github.com/bremondr/web-kit), at the
versions in `vendor.json`. Don't edit them here: change the module in web-kit, release it, then run
`node tools/update-vendor.mjs` (or wait for the daily "Update vendored modules" pull request).
```

## 6. Give the workflow a token: `VENDOR_PR_TOKEN`

The workflow opens a pull request for each update. With the workflow's own token, GitHub doesn't run other workflows (tests, previews) for that pull request, and by default doesn't let it open pull requests at all. So give it a token of its own:

1. Create a fine-grained token at <https://github.com/settings/personal-access-tokens/new>:
   - **Token name:** `<project>: vendor update PRs`, for example `ultimate-playbook: vendor update PRs`
   - **Description:** `Used by .github/workflows/update-vendor.yml (secret VENDOR_PR_TOKEN) to push the vendor-update branch and open pull requests. Contents and Pull requests read/write, <project> only.`
   - **Expiration:** as long as you're comfortable with, at most a year. Note the date: when it expires, update pull requests fail until you renew it.
   - **Repository access:** Only select repositories, and pick just this project.
   - **Permissions:** Contents: Read and write; Pull requests: Read and write.
2. Store it in the project (this prompts you to paste it):
   ```sh
   gh secret set VENDOR_PR_TOKEN --repo <owner>/<project>
   gh secret list --repo <owner>/<project>
   ```

Use one token per project, so each one reaches only its own repository.

**Without a token:** turn on Settings, Actions, General, "Allow GitHub Actions to create and approve pull requests". Update pull requests then open, but their checks start only after you close and reopen them.

**If web-kit is ever made private**, also add a `VENDOR_GIT_TOKEN` secret: a fine-grained token with Contents: Read on web-kit.

## 7. Register the project in web-kit

Add the project and the modules it uses to [`consumers.json`](../consumers.json) in web-kit:

```json
{
  "bremondr/ultimate-playbook": ["feedback-kit"],
  "<owner>/<project>": ["feedback-kit"]
}
```

This list is for the release notice (see [maintaining](maintaining.md#telling-projects-about-a-release-at-once)). Without the notice, the daily check finds new releases anyway; the list then just records who uses what.

## 8. Merge, then try the workflow

Commit everything (the vendored folder too), open a pull request, and merge it. Scheduled and by-hand workflows run from the default branch, so they only work after the merge. Then:

```sh
gh workflow run update-vendor.yml --repo <owner>/<project>
gh run list --workflow update-vendor.yml --repo <owner>/<project> --limit 1
```

It should succeed with "Everything is up to date". Its first step signs in with `VENDOR_PR_TOKEN`, so a success also means the token works. The pull request part runs for real at the module's next release: within a day, an "Update feedback-kit to …" pull request appears, with the changelog and the project's checks.

## Updating by hand

```sh
node tools/update-vendor.mjs --check               # is there anything new?
node tools/update-vendor.mjs                       # newest releases with the same major version
node tools/update-vendor.mjs --major               # also new major versions (read their changelog)
node tools/update-vendor.mjs feedback-kit@1.2.0    # a given version, also an older one
node tools/update-vendor.mjs --verify              # are the copies exactly their releases?
```

## Taking a new major version

A new major version (2.0.0 after 1.x) means the project has to change something, so the daily workflow doesn't take it: its log only says the version exists. The release notes, from the module's changelog, end with "What to change in a project". To have Claude Code do it, open a session in the project and paste this, with the module and version filled in:

```text
Update <module> in this project to <version> from bremondr/web-kit. It's a major version, so it needs changes
here as well as the new copy.

Read first:
- the release notes, especially "What to change in a project":
  https://github.com/bremondr/web-kit/releases/tag/<module>-v<version>
- the module's README at that version:
  https://github.com/bremondr/web-kit/blob/<module>-v<version>/<module>/README.md
- the module's demo page at that version, a short, complete example of the new interface:
  https://github.com/bremondr/web-kit/blob/<module>-v<version>/demo/<module>.js
  (live, showing main, at https://bremondr.github.io/web-kit/demo/)

If the project doesn't use the module yet (it isn't in vendor.json), stop and tell me: that is a setup, not an
update (see the prompt at the end of web-kit's docs/setup-project.md).

Then:
1. Run node tools/update-vendor.mjs <module>@<version>, then node tools/update-vendor.mjs --verify. Don't edit the
   vendored copy.
2. Make every change "What to change in a project" lists, in the project's own files outside the vendored folder:
   new files in the service worker's list, new or renamed options, anything removed. Where it asks for a choice,
   say what you chose and why.
3. Update anything in README.md or CLAUDE.md that the new version makes wrong.
4. Run the project's checks. Then try it in a browser at iPad (1180 × 820, 820 × 1180), phone (390 × 844) and
   desktop (1440 × 900) sizes, in light and dark mode, on each kind of page the app has, and show me screenshots.
5. Open a pull request that lists what changed and anything that looked wrong.

If something needs a change in the module, don't work around it here: describe it for an issue in
bremondr/web-kit and tell me.
```

For feedback-kit 2.0.0 (whole-page picture, own screenshot, screen capture), "What to change" covers: `page.js` in the service worker's list, `page: {fonts}` and `area`, a `pictureLabel` for the app's own `picture` (or removing it), and `data-fk-skip`.

## Adding previews to a project

web-kit also has the files for publishing a project with GitHub Pages: `main` at the root, and every open pull request from the repository as a preview at `/preview/pr-<number>/`, with a bot comment linking it. A preview keeps its own browser storage (separate from the live site and the other previews), has a small badge, doesn't work offline, and disappears when its pull request is closed. A new project made from the [template](new-project.md) has them from the start; this is how an existing project switches to them, for example from its own copy of the same idea (as Ultimate Playbook and Protogames have).

**1. Copy the three files.** From the project's root, in a Unix shell (in PowerShell, `curl.exe` as in step 1):

```sh
mkdir -p tools .github/workflows
curl -fsSL https://raw.githubusercontent.com/bremondr/web-kit/main/consumer/build-site.mjs -o tools/build-site.mjs
curl -fsSL https://raw.githubusercontent.com/bremondr/web-kit/main/consumer/preview-runtime.js -o tools/preview-runtime.js
curl -fsSL https://raw.githubusercontent.com/bremondr/web-kit/main/consumer/pages.yml -o .github/workflows/pages.yml
```

If the project already has a deploy workflow (`.github/workflows/pages.yml` or another that publishes Pages) and its own build script and runtime, the copies replace them: delete the old ones and their tests in the same pull request. If the scripts must live somewhere other than `tools/`, change `SITE_TOOLS` at the top of the workflow; nothing else in the three files changes.

**2. Say what differs in `site.json`**, at the project's root. Every option is described at the top of `tools/build-site.mjs` and in [new-project.md](new-project.md#sitejson); without a `site.json`, everything but tools, tests, docs and Markdown is published, `index.html` must exist, and `node --test` must pass. For Ultimate Playbook, keeping what it has now (its service worker, its checks, the Feedback link that opens its own panel, `window.PLAYBOOK_PREVIEW`, and its existing bot comments):

```json
{
  "name": "Ultimate Playbook",
  "paths": ["index.html", "manifest.webmanifest", "sw.js", "css", "js", "icons"],
  "serviceWorker": "sw.js",
  "checks": ["node --test", "node tools/check-imports.mjs"],
  "feedback": {"labels": ["feedback"], "event": "playbook:feedback"},
  "global": "PLAYBOOK_PREVIEW",
  "commentMarker": "<!-- playbook-preview -->",
  "commentNote": "It keeps its own saved drills, separate from the live app, and doesn't work offline. It is removed when this pull request is closed or merged."
}
```

For Protogames (landing page at the root, the editor in `app/`, no analytics in previews):

```json
{
  "name": "Protogames",
  "paths": ["index.html", "landing.js", "app"],
  "pages": ["index.html", "app/index.html"],
  "dropFromPreviews": ["simpleanalyticscdn"],
  "checks": ["npm test"],
  "commentMarker": "<!-- protogames-preview -->"
}
```

Keep `commentMarker` the same as the old workflow's, so the bot updates the comments already on open pull requests instead of adding new ones. A service worker named in `serviceWorker` must have `const VERSION = '…';` and a `const APP_FILES = [ … ];` list (closing `];` on a line of its own): the build fills both in from what is published, so nobody bumps them by hand.

**3. Ignore the build's output** in `.gitignore`: `_site/`, `previews.json`, `build-summary.json`.

**4. Try it locally.** The build reads every version from git, so commit first:

```sh
node tools/build-site.mjs --run-checks
echo '[{"number": 1, "title": "Try", "ref": "HEAD"}]' > previews.json
node tools/build-site.mjs --out _site --main HEAD --previews previews.json --repo <owner>/<project>
python3 -m http.server 8000 --directory _site
```

`http://localhost:8000/` is the live site and `http://localhost:8000/preview/pr-1/` the preview, with its badge.

**5. Pages from Actions.** If Pages still deploys from a branch, switch it (Settings, Pages, Source: "GitHub Actions"):

```sh
gh api repos/<owner>/<project>/pages -X PUT -f build_type=workflow
```

**6. Merge, then check.** The workflow runs as it is on `main` (it uses `pull_request_target`, so a pull request's own files are never run), so the pull request that adds it gets no preview itself. After the merge, the push to `main` publishes the site; run it by hand with `gh workflow run pages.yml --repo <owner>/<project>` if it didn't. Open pull requests then get their comment, and every new one gets a preview.

Don't edit the copies; take new ones when [`consumer/CHANGELOG.md`](../consumer/CHANGELOG.md) says to.

## When web-kit's consumer files change

The consumer files (`update-vendor.mjs` and `update-vendor.yml`, and for previews `build-site.mjs`, `preview-runtime.js` and `pages.yml`) change rarely. When they do, [`consumer/CHANGELOG.md`](../consumer/CHANGELOG.md) says what changed and whether projects should copy them again (step 1, or step 1 of Adding previews).

## Troubleshooting

| What you see | Why, and what to do |
|---|---|
| The update run fails at "Open or update the pull request" with "GitHub Actions is not permitted to create or approve pull requests" | No `VENDOR_PR_TOKEN`, and the setting is off. Add the token (step 6). |
| The update run fails at checkout, or with 401/403 when pushing | The token expired or lacks a permission. Make a new one (step 6) and set the secret again. |
| An update pull request has no checks or preview | It was opened with the workflow's own token. Close and reopen it, and add `VENDOR_PR_TOKEN`. |
| "feedback-kit: 2.0.0 is a new major version" in the log, and no pull request | New major versions aren't taken by themselves. See [Taking a new major version](#taking-a-new-major-version). |
| `--verify` says a file differs | Someone edited the copy. Move the change into web-kit (or drop it), then run `node tools/update-vendor.mjs <module>@<version>` to restore the copy. |
| "No vendor.json here" | Run the script from the project's root. |

## A prompt for Claude Code

Paste this into a Claude Code session opened in the project. It is written for feedback-kit; for another module, change the name and the module-specific lines (marked "feedback-kit:").

```text
Set this project up to use feedback-kit from bremondr/web-kit, at its newest release
(https://github.com/bremondr/web-kit/releases), following
https://github.com/bremondr/web-kit/blob/main/docs/setup-project.md.

Read first: web-kit's README.md, docs/setup-project.md, and the module's README (feedback-kit:
feedback-kit/README.md, "Using it", "The pictures" and "Setting it up in a project"). Each module has a demo page
that is a short, complete example of using it (feedback-kit: demo/feedback-kit.js and demo/feedback-kit.html in
web-kit, live at https://bremondr.github.io/web-kit/demo/feedback-kit.html).

Do steps 1 to 5 of the setup guide:
- copy consumer/update-vendor.mjs to tools/ and consumer/update-vendor.yml to .github/workflows/;
- write vendor.json, with "dir" inside what the site publishes, next to the project's own scripts;
- take the module with: node tools/update-vendor.mjs <module>@<newest version>, then check it with
  node tools/update-vendor.mjs --verify;
- wire it in as its README says, with the project's own code outside the vendored folder. feedback-kit: link its
  CSS and set the --fk-* colours and fonts to the project's own. Write one feedback file of the project's own, with
  repo and labels, page: {fonts} with the web fonts the page uses (and area, if the whole scrollable page is more
  useful than what is on screen), and describe with what is on screen. Add a "Reopen" section with a link back to
  this view (with a fallback) if the app can make one. If one part of the app is what people will point at (a
  chart, a field), add it as picture with a pictureLabel. Give data-fk-skip to anything that shouldn't be in the
  picture. Add a "Send feedback" button that calls feedback.open() from the tap;
- add all of the module's files to the service worker's list, if there is one;
- add the note about vendored copies to README.md and CLAUDE.md (feedback-kit: and the "Working from the issues"
  note to CLAUDE.md).

Then run the project's checks. Try it in a browser at iPad (1180 × 820, 820 × 1180), phone (390 × 844) and
desktop (1440 × 900) sizes, in light and dark mode, show me screenshots, and open a pull request.

Don't edit the vendored copy. If the module needs a change, tell me instead of working around it here.

At the end, give me the exact commands and settings for what I do myself:
- feedback-kit: the label its issues get (gh label create);
- the VENDOR_PR_TOKEN token and secret (step 6);
- the line for consumers.json in web-kit (step 7);
- trying the update workflow after the merge (step 8).
```
