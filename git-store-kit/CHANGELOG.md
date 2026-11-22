# Changes to git-store-kit

Each version is released as the tag `git-store-kit-vX.Y.Z`. A new major version (the first number) means a project using the kit may need changes; the notes say which.

## 1.0.0 (unreleased)

- First release.
- `createGitStore`: an app's items as JSON files in GitHub repos, one file per item (`<folder>/<id>.json`), every save a commit.
  - Sources followed from links (`#param=short-name` or `owner/repo`), several at once, checked against GitHub's name rules.
  - Public repos read without a token; private repos with one. Only changed files are fetched. Without a token they come from `raw.githubusercontent.com`, checked against git's hash.
  - The last good copy of each source is kept in IndexedDB and shown offline or when GitHub's limit is used up.
  - `save`, `remove` and `open`, with conflicts when the file changed meanwhile (`GitStoreConflict`, settled with `resolve`: overwrite, keep theirs, or save a copy).
  - History: `history`, `version`, `restore`.
  - Tokens per repo in local storage, sent only in the `Authorization` header to `api.github.com`.
- `createPanel`: the sources and their tokens, the conflict question, and an item's history. Themed with `--gs-*` custom properties.
- `createFakeGitHub`: a GitHub in memory, for tests and demos.
