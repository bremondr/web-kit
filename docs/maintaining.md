# Maintaining web-kit

How to release a module, tell projects about it, add a module, and change what projects copy. For setting up a project that uses the modules, see [setup-project.md](setup-project.md).

## Releasing a module

1. Make the change on a branch, with tests for logic that runs in Node (`<module>/*.test.mjs`).
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
2. Add a row to the modules table in the main README.
3. Merge, then release (above). Then set up the projects that will use it ([setup-project.md](setup-project.md), steps 3 to 5 and 7).

`tools/check-modules.mjs` treats every top-level folder with JavaScript in it as a module, except `tools/` and `consumer/`.

## Changing what projects copy

`consumer/update-vendor.mjs` and `consumer/update-vendor.yml` are copied into each project; they don't update themselves. When you change them:

1. Keep `vendor.json`'s format and the script's options working, so an old copy and a new one behave the same for projects that don't recopy.
2. Add an entry at the top of [`consumer/CHANGELOG.md`](../consumer/CHANGELOG.md): the date, what changed, and whether projects should copy the files again.
3. After merging, copy the files into each project in `consumers.json` ([setup-project.md](setup-project.md), step 1), each with its own pull request.

## Tokens and secrets at a glance

| Secret | Where | Token name | Permissions | What stops when it expires |
|---|---|---|---|---|
| `VENDOR_PR_TOKEN` | each project | `<project>: vendor update PRs` | that project: Contents, Pull requests (read and write) | update pull requests (the run fails) |
| `WEB_KIT_DISPATCH_TOKEN` | web-kit | `web-kit: release notices` | every project in `consumers.json`: Contents (read and write) | instant notices (the daily check still works) |
| `VENDOR_GIT_TOKEN` | each project, only if web-kit is private | `<project>: read web-kit` | web-kit: Contents (read) | all updates |

GitHub emails you before a token expires. Make a new one with the same name and settings, and set the secret again with `gh secret set`.
