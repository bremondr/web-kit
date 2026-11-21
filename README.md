# web-kit

Reusable modules for static web apps: plain ES modules and CSS, with no dependencies, no build step and no server. Each module is one folder that a project copies, and each is released on its own with numbered versions.

| Module | What it does | Used by |
|---|---|---|
| [`feedback-kit/`](feedback-kit/) | "Send feedback": a GitHub issue filled in with what was on screen, plus a picture to draw on | [Ultimate Playbook](https://github.com/bremondr/ultimate-playbook) |

## How a project uses a module

The project keeps a **plain copy** of a released version, so it works offline and needs nothing at run time. Its site build and service worker treat the copy like any other file. A file at the project's root says which versions it has:

```json
{
  "source": "bremondr/web-kit",
  "dir": "js/vendor",
  "modules": {"feedback-kit": "1.0.0"}
}
```

So `js/vendor/feedback-kit/` holds feedback-kit 1.0.0. Don't edit the copy in the project: change the module here, release it, and update the project.

### Setting up a project (once)

1. Copy `consumer/update-vendor.mjs` to the project's `tools/`, and `consumer/update-vendor.yml` to its `.github/workflows/`.
2. Write a `vendor.json` as above, with an empty `"modules": {}`, and take the first version:
   ```sh
   node tools/update-vendor.mjs feedback-kit@1.0.0
   ```
3. Add the project and the modules it uses to [`consumers.json`](consumers.json).
4. Recommended: give the project a `VENDOR_PR_TOKEN` secret, so the update pull requests get the project's checks and previews. The top of `update-vendor.yml` says what token is needed. Without one, also allow "Allow GitHub Actions to create and approve pull requests" in the project's Settings, Actions, General.

### Updating

- **By itself:** the project's "Update vendored modules" workflow looks for new releases every day, and at once if web-kit tells it (see Releasing). It opens a pull request (branch `vendor-update`) with the new copy and the changelog. Nothing changes until someone merges it.
- **By hand**, from the project's root:
  ```sh
  node tools/update-vendor.mjs --check                # what's new
  node tools/update-vendor.mjs                        # newest releases, same major version
  node tools/update-vendor.mjs --major                # also new major versions
  node tools/update-vendor.mjs feedback-kit@1.2.0     # a given version
  node tools/update-vendor.mjs --verify               # are the copies exactly their releases?
  ```

A new **major** version (the first number) means the project may need changes. The script moves to one only when asked with `--major` or an explicit version, and the pull request says so.

## Releasing a module

1. Change the module, with tests where the logic runs in Node (`<module>/*.test.mjs`; projects don't get the tests).
2. Add a section at the top of the module's `CHANGELOG.md`: `## 1.1.0 (date)`, with what changed and, for a new major version, what a project has to change.
3. Merge to `main`, then tag and push:
   ```sh
   git tag feedback-kit-v1.1.0
   git push origin feedback-kit-v1.1.0
   ```
   `.github/workflows/release.yml` runs the tests, checks that the changelog has the version, and makes a GitHub Release. With a `WEB_KIT_DISPATCH_TOKEN` secret it also tells the projects in `consumers.json` at once; otherwise they find it on their next daily check.

## Adding a module

A new top-level folder with its `README.md` (what it does, how to use it), a `CHANGELOG.md`, and tests. It may import only from itself: `tools/check-modules.mjs` checks that. Add it to the table above.

## Checks

```sh
node --test                    # every *.test.mjs
node tools/check-modules.mjs   # modules import only from themselves, and have a README and a changelog
```

Both run on every pull request (`.github/workflows/test.yml`) and before every release.

## Files

| Path | What it is |
|---|---|
| `<module>/` | a module: its code, `README.md`, `CHANGELOG.md` and tests |
| `consumer/update-vendor.mjs` | the update script projects copy to `tools/` (plain Node 18+ and git), with its tests |
| `consumer/update-vendor.yml` | the workflow projects copy to `.github/workflows/` |
| `consumers.json` | which projects use which modules, for the release notice |
| `tools/check-modules.mjs`, `tools/release-notes.mjs` | the module check, and the release notes from a changelog |
