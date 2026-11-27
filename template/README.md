# {{TITLE}}

<!-- What the app does, for whom, in two or three sentences. -->
A static web app: plain HTML, CSS and ES modules, with no build step and no packages. Try it at {{PAGES_URL}}.

## Running it

Serve the folder and open it in a browser:

```sh
python3 -m http.server
```

Then go to <http://localhost:8000/>. (Opened as a file, the browser won't load the modules.)

## How the code is laid out

| Path | What it is |
|---|---|
| `index.html`, `css/app.css` | the page and its styles (colours as tokens, light and dark) |
| `js/main.js` | wires the page up |
| `js/tally.js` | the logic, with no DOM, so it runs in Node too |
| `js/vendor/` | copies of [web-kit](https://github.com/bremondr/web-kit) modules, at the versions in `vendor.json` |
| `tests/` | `node --test` tests |
| `site.json` | what GitHub Pages publishes, and the checks that must pass first |
| `tools/`, `.github/workflows/` | the site build, previews, module updates and screenshots for pull requests (copies of web-kit's consumer files) |
| branch `pr-screenshots` | only pictures for pull request descriptions, a folder per pull request (`tools/pr-screenshots.mjs`); never merged |

## Checks

```sh
node --test
```

They run on every pull request (`.github/workflows/test.yml`), and on `main` before it is published.

## Publishing and previews

`main` is published by GitHub Pages at {{PAGES_URL}} (`.github/workflows/pages.yml`, with `tools/build-site.mjs`). Every open pull request from this repository is published as a preview at `{{PAGES_URL}}preview/pr-<number>/`, and a bot comments the link on the pull request. A preview has a small badge, keeps its own saved data (separate from the live app and from other previews), doesn't work offline, and disappears when the pull request is closed or merged. The list of previews is at `{{PAGES_URL}}preview/`.

What is published, and the checks that must pass on `main` first, are in `site.json`; see the comment at the top of `tools/build-site.mjs` for every option. To build the same folder locally:

```sh
echo '[{"number": 1, "title": "Try", "ref": "my-branch"}]' > previews.json
node tools/build-site.mjs --out _site --main main --previews previews.json --repo {{REPO}}
python3 -m http.server 8000 --directory _site
```

## Modules from web-kit

`js/vendor/` holds copies of modules released in [bremondr/web-kit](https://github.com/bremondr/web-kit), at the versions in `vendor.json`. Don't edit them here: change the module in web-kit, release it, then run `node tools/update-vendor.mjs` (or wait for the daily "Update vendored modules" pull request). To take a module, see [web-kit's setup guide](https://github.com/bremondr/web-kit/blob/main/docs/setup-project.md), steps 3 to 5.

## Feedback

Feedback arrives as GitHub issues with the `feedback` label.
