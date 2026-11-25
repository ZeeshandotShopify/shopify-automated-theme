# Shopify Theme Validation — Consolidated Setup (v2, canonical)

> **This is the single source of truth** for local validation on the `golden` theme. It consolidates and
> supersedes the three earlier working docs (`docs/shopify-precommit-validation-plan.md`,
> `docs/theme-validation.md`, `docs/shopify-theme-validation-setup.md`), which remain in place for history.
> `docs/` is gitignored, so this file is local-only — it is **not** synced to Shopify or propagated to client repos.
>
> It merges the best decisions from those three docs **and** fills the validation gap discovered in the two
> Figma-build skills (`shopify-add-section-or-preset-from-figma`, `shopify-build-section-or-block-from-figma`):
> three deterministic, push-breaking checks that `shopify theme check` does **not** catch.

---

## 1. The model: two layers

There is **no single Shopify-specific hook tool**. Validation is always two layers:

| Layer | Tool | Role |
|---|---|---|
| **Validator** (the brains) | **Shopify Theme Check** (`shopify theme check`) | Full validation of Liquid **and** template/section JSON |
| **Runner** (plumbing) | **Husky** + **lint-staged** | Generic — only decides *when* the validator fires (here: local `pre-commit`) |

We point Husky at `shopify theme check` (whole-theme) + Prettier (per-staged-file) + a small custom guard for the
three rules Theme Check misses. The only first-party "managed" pieces are the CLI, the Shopify Liquid VS Code
extension (live, as-you-type), and `shopify/theme-check-action@v2` (CI on PRs — not used here).

---

## 2. What Theme Check validates — and its verified blind spot

Theme Check (TypeScript `@shopify/theme-check-node`, bundled in the Shopify CLI; the Ruby gem is deprecated)
understands Liquid + JSON together. At `theme-check:all` it covers Liquid/JSON syntax, `{% schema %}` shape,
`t:` translation keys, undefined objects, deprecated tags/filters, unused snippets, missing templates,
block-type existence (`JSONMissingBlock`), preset/default key validity (`ValidSettingsKey`), schema-name length
(`ValidSchemaName`), and performance (`AssetSize*`, `RemoteAsset`, parser-blocking JS).

### ⚠️ Verified gap (checked against authoritative Shopify sources, 2026)

Three rules that break a push are enforced **only at Shopify's save/sync layer** and are **not** in Theme Check
at any config level — confirmed against the complete 64-check list (`checks/index.txt`), the `ValidSchema`
source + tests, and Shopify's published JSON meta-schemas (`Shopify/theme-liquid-docs`):

| Rule | Why Theme Check misses it | Failure at push |
|---|---|---|
| `paragraph` setting `content` **> 500 chars** | No `maxLength` encoded in the published setting schema | `FileSaveError: ... content is too long (max 500 characters)` — file rejected |
| Any setting with **`"default": ""`** | No non-blank constraint on `default` in the meta-schema | `FileSaveError: ... default can't be blank` — file rejected |
| `order` / `block_order` key **orphaned** from `sections` / `blocks` | No check validates `order` ↔ `sections`; nearest (`JSONMissingBlock`) only flags missing block *types* | Shopify's GitHub bot **silently rolls back** the JSON reference |

Corroboration: `ValidSchema` is JSON-*syntax* only ("Identifies invalid JSON in `{% schema %}` tags"; its test
fails on a trailing comma, passes valid JSON). A 2026 field report reproduced the `default can't be blank`
rejection after Theme Check passed. **Shopify CLI Issue #4187** is the smoking gun: a file passed theme check,
was pushed, then "silently failed" server-side — Shopify confirmed this as known behaviour.

**Therefore** the setup adds a tiny custom guard (`scripts/validate-schema.mjs`) for exactly these three rules and
nothing else — `theme-check:all` already owns the rest, so there is no duplication.

---

## 3. The unified validation map (one picture, no redundancy)

Each validation is enforced in exactly **one** place:

| Validation | Enforced by | In commit hook? |
|---|---|---|
| Code formatting | Prettier (via lint-staged, staged files) | ✅ |
| Liquid + JSON syntax, `{% schema %}` shape | Theme Check `:all` | ✅ |
| `t:` keys, unused snippets, missing templates, undefined objects, deprecated tags/filters | Theme Check `:all` | ✅ |
| Block-type existence, preset/default keys, schema-name length | Theme Check `:all` | ✅ |
| Performance (`AssetSize*`, `RemoteAsset`, parser-blocking) | Theme Check `:all` | ✅ (slow — see §7) |
| **`paragraph` > 500 chars** | **`scripts/validate-schema.mjs`** | ✅ |
| **empty-string `default`** | **`scripts/validate-schema.mjs`** | ✅ |
| **`order` / `block_order` orphan refs** | **`scripts/validate-schema.mjs`** | ✅ |
| Block↔parent + locales registration, metafield render-type, visual parity, coverage, post-deploy rollback | the two Figma-build skills (MCP / human) | ❌ (build-time, not automatable in a hook) |

---

## 4. Finalized decisions

| Decision | Choice | Note |
|---|---|---|
| Runner | **Husky v9** + **lint-staged** | `prepare: husky` auto-activates on `npm install` |
| Validator | Theme Check **`extends: theme-check:all`** | full strict, no check exclusions |
| Fail-level | **`--fail-level=info`** | strictest — blocks on errors **+** warnings **+** info (verified: CLI 4.1.0 accepts `crash\|error\|suggestion\|style\|warning\|info`, default `error`) |
| Formatter | Prettier v3 + `@shopify/prettier-plugin-liquid` | per-staged-file via lint-staged |
| Gap guard | `scripts/validate-schema.mjs` (dependency-free Node) | the 3 rules Theme Check misses (§2) |
| Where it runs | **Local `pre-commit` only — no CI** | editor-originated commits aren't validated (§7) |
| Scope | Committed into `golden` → every "Use this template" clone inherits it | a fresh clone needs only `npm install` |
| gitignore | **un-ignore & commit** `package.json`, `package-lock.json`, `.prettierrc`, `.prettierignore`, `scripts/` | Husky's config lives in `package.json`; the gap script lives in `scripts/` |

Verified dependency versions (from a clean install this session): `husky ^9.1.7`, `lint-staged ^17.0.7`,
`prettier ^3.8.3`, `@shopify/prettier-plugin-liquid ^1.10.2`. `@shopify/cli` stays **global** (SOP).

---

## 5. Full step-by-step setup

> Run from the theme root. Windows note: Husky hooks execute under Git-for-Windows `sh`; `node`, `npx`, and the
> global `shopify` resolve inside it. Committed: `package.json`, `package-lock.json`, `.husky/`, `scripts/validate-schema.mjs`, `.theme-check.yml`,
> `.prettierrc`, `.prettierignore`, `README.md`. Local-only (gitignored): this doc, `node_modules/`.

### Step 0 — Prerequisites
```sh
node -v          # Node 18+ (Husky/Prettier need it; the gap script is dependency-free Node)
npm -v
shopify version  # @shopify/cli installed globally — verified 4.1.0 this session
```
If `shopify` is missing: `npm i -g @shopify/cli`.

### Step 1 — Un-ignore tooling files in `.gitignore`
Remove these **5 lines** so the setup can be committed and propagate to client clones:
```diff
- package.json
- package-lock.json
- .prettierrc
- .prettierignore
- scripts
```
Keep ignoring: `node_modules`, `docs`, `videos`, `shopify.theme.toml`, `AGENTS.md`, `README-WITH-OPTION-B.md`. (`scripts/` is now committed — it holds the gap-check script.)

### Step 2 — Create `package.json`
```json
{
  "name": "golden-theme",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "prepare": "husky",
    "format": "prettier --write .",
    "check": "shopify theme check",
    "check:schema": "node scripts/validate-schema.mjs"
  },
  "lint-staged": {
    "*.{liquid,json,css,js}": "prettier --write"
  }
}
```

### Step 3 — Install dev dependencies
```sh
npm install -D husky lint-staged prettier @shopify/prettier-plugin-liquid
```
Creates `package-lock.json` + `node_modules/` and runs `prepare: husky` (creates `.husky/_/`, sets `core.hooksPath`).

### Step 4 — Initialize Husky (then overwrite its sample)
```sh
npx husky init
```
Creates a sample `.husky/pre-commit` (just `npm test`) — replaced in Step 8. Confirm:
```sh
git config core.hooksPath   # → .husky/_
```

### Step 5 — Create `.prettierrc`
```json
{
  "plugins": ["@shopify/prettier-plugin-liquid"],
  "printWidth": 120,
  "tabWidth": 2,
  "singleQuote": false
}
```

### Step 6 — Augment `.prettierignore` (already exists locally with `assets/lazysizes.min.js`)
```
assets/lazysizes.min.js
assets/*.min.js
config/settings_data.json
node_modules
```
> `config/settings_data.json` is rewritten by the Shopify editor — Prettier skips it (Theme Check still validates it).

### Step 7 — Create `.theme-check.yml`
```yaml
extends: theme-check:all
ignore:
  - node_modules/**
# Escape valve if commits get too slow (RemoteAsset/AssetSize* over 150+ assets — see §7).
# Disable specific noisy checks here, tuned from the first `npm run check` baseline —
# do NOT loosen --fail-level. e.g.:
#   AssetSizeCSS: { enabled: false }
#   RemoteAsset:  { enabled: false }
```
> `ignore: node_modules/**` is a *path* scope (don't lint dependencies), not a check exclusion — it doesn't weaken the gate.

### Step 8 — Create the gap-check script `scripts/validate-schema.mjs`
Dependency-free Node (guaranteed present because Husky requires Node → propagation-safe). It lives in `scripts/` — un-ignored in Step 1 so it's committed and propagates to clones. Scope = exactly the
three rules from §2; it re-implements nothing `theme-check:all` already does. **This script was tested
(see §6): it correctly caught a 670-char paragraph, an empty-string default, and an orphaned `order` reference,
and reports `OK` on the current clean theme.**
```js
// scripts/validate-schema.mjs
// Three Shopify save/sync rules that `shopify theme check` does NOT catch (verified 2026, see §2):
//   1. paragraph setting `content` > 500 chars  -> FileSaveError at push
//   2. setting with "default": ""                -> "default can't be blank" at push
//   3. order/block_order keys missing from sections/blocks -> silent rollback by Shopify's bot
//
// Scope is exactly these three rules. It re-implements nothing theme-check:all already does
// (block-type existence, settings-key validity, JSON syntax). Dependency-free Node.
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const PARAGRAPH_MAX = 500;
const problems = [];

const list = (dir, test) =>
  existsSync(dir) ? readdirSync(dir).filter(test).map((f) => `${dir}/${f}`) : [];
const liquid = (dir) => list(dir, (f) => f.endsWith('.liquid'));

// Match {% schema %} OR the trimmed {%- schema -%} form — a naive indexOf would skip the latter.
const extractSchema = (src) => {
  const m = src.match(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/);
  return m ? m[1] : null;
};

// Recursively collect violations for checks 1 & 2.
function walkSchema(node, out) {
  if (Array.isArray(node)) {
    for (const item of node) walkSchema(item, out);
    return;
  }
  if (node && typeof node === 'object') {
    if (node.type === 'paragraph' && typeof node.content === 'string' && node.content.length > PARAGRAPH_MAX)
      out.push({ rule: 'paragraph', len: node.content.length });
    if (Object.prototype.hasOwnProperty.call(node, 'default') && node.default === '')
      out.push({ rule: 'default', id: node.id });
    for (const value of Object.values(node)) walkSchema(value, out);
  }
}

// Checks 1 & 2 — every {% schema %} in sections + blocks
for (const file of [...liquid('sections'), ...liquid('blocks')]) {
  const raw = extractSchema(readFileSync(file, 'utf8'));
  if (!raw) continue;
  let schema;
  try {
    schema = JSON.parse(raw);
  } catch {
    continue; // ValidSchema/ValidJSON owns syntax
  }
  const out = [];
  walkSchema(schema, out);
  for (const v of out) {
    if (v.rule === 'paragraph')
      problems.push(
        `${file}: paragraph content is ${v.len} chars (max ${PARAGRAPH_MAX}) — split into multiple paragraphs.`,
      );
    if (v.rule === 'default')
      problems.push(`${file}: setting id="${v.id}" has "default": "" — omit the default key entirely.`);
  }
}

// Check 3 — order/sections + block_order/blocks orphans in JSON templates
for (const file of [
  ...list('templates', (f) => f.endsWith('.json')),
  ...list('sections', (f) => f.endsWith('-group.json')),
]) {
  const src = readFileSync(file, 'utf8');
  let obj;
  try {
    obj = JSON.parse(src.slice(src.indexOf('{'))); // strip any leading // comment
  } catch {
    continue; // JSONSyntaxError owns syntax
  }
  if (!obj || typeof obj !== 'object') continue;
  const sections = obj.sections ?? {};
  for (const key of obj.order ?? [])
    if (!(key in sections)) problems.push(`${file}: "order" references "${key}" missing from "sections".`);
  for (const [sid, section] of Object.entries(sections)) {
    const blocks = section?.blocks ?? {};
    for (const key of section?.block_order ?? [])
      if (!(key in blocks))
        problems.push(`${file}: section "${sid}" block_order references "${key}" missing from its blocks.`);
  }
}

if (problems.length) {
  console.error('✗ Theme schema/JSON guard failed:\n' + problems.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log('✓ Theme schema/JSON guard: OK');
```

### Step 9 — Write the hook `.husky/pre-commit` (overwrite the sample)
Fast checks first, slow lint last; the Shopify-CLI guard prints a friendly message if the CLI is absent.
Husky v9 hooks are plain shell — no `#!/usr/bin/env sh` / `husky.sh` boilerplate.
```sh
npx lint-staged                            # 1) format staged files, re-stage
node scripts/validate-schema.mjs || exit 1   # 2) fast deterministic guards (paragraph / default / orphans)
if command -v shopify >/dev/null 2>&1; then # 3) whole-theme lint (slow; needs full root)
  shopify theme check --fail-level=info
else
  echo "⚠  Shopify CLI not found (npm i -g @shopify/cli). Gap guards + Prettier ran; Theme Check skipped."
fi
```

### Step 10 — (Already resolved) the fail-level token
`shopify theme check --help` on CLI 4.1.0 lists `--fail-level=crash|error|suggestion|style|warning|info`
(default `error`, "Minimum severity for exit with error code"). **`info`** is the lowest/strictest threshold —
it fails the commit if Theme Check emits anything at all. Used in Step 9. (`error` is the safe fallback if a
future CLI changes the vocabulary.)

### Step 11 — One-time baseline cleanup (before relying on the gate)
The theme has never been linted; a strict whole-theme check will flag pre-existing offenses.
```sh
shopify theme check --auto-correct        # auto-fix correctable offenses
npm run format                            # Prettier over the whole theme...
# ...commit that on its own:  git commit -m "style: prettier baseline"
npm run check                             # see remaining offenses
```
For remaining noise: fix it, add an `ignore:` glob, or disable the specific check in `.theme-check.yml`
(tune from this baseline — do **not** loosen `--fail-level`). Only then rely on the hook day-to-day.

### Step 12 — Update `README.md`
Add a "Local validation" note near the clone / Git-workflow steps:
- After cloning a client repo, run **`npm install` once** → triggers `prepare: husky`, activating the hook.
- Requires the Shopify CLI (`shopify theme check`).
- Emergency bypass: `git commit --no-verify` (or `HUSKY=0 git commit ...`).
- Local-only limitation: Shopify-editor-originated commits aren't validated.

---

## 6. Verification (end-to-end)

1. **Activation:** `npm install` → `git config core.hooksPath` returns `.husky/_`. *(Verified this session.)*
2. **Gap — paragraph:** a `paragraph` setting with > 500-char `content` → `npm run check:schema` FAILs; commit aborts. *(Verified: 670-char content flagged; a 463-char near-miss correctly passed, confirming the strict `> 500` boundary.)*
3. **Gap — empty default:** `"default": ""` on a setting → script FAILs; commit aborts. *(Verified.)*
4. **Gap — orphan:** an `order` entry with no matching `sections` key → script FAILs. *(Verified: orphan `"ghost"` flagged.)*
5. **Clean theme passes:** with no violations the script prints `✓ ... OK` (exit 0). *(Verified against current theme: 35 sections, 35 blocks, 15 templates, 2 `*-group.json`.)*
6. **Theme Check gate:** an unclosed `{% if %}` or invalid template JSON → commit aborted by Step 3 of the hook.
7. **Prettier:** stage a messy `.liquid` → commit → auto-formatted + re-staged → succeeds.
8. **CLI-missing guard:** take `shopify` off PATH → hook prints the warning, still runs gap script + Prettier.
9. **Bypass:** `git commit --no-verify` skips the hook.
10. **Propagation:** `git status` shows `package.json`, `.husky/`, `scripts/validate-schema.mjs`, `.theme-check.yml`, `.prettierrc`, `.prettierignore` tracked; a fresh clone needs only `npm install`.
11. **On-demand:** `npm run check` (full lint), `npm run check:schema` (gap guards), `npm run format`.
12. **Windows (Win 11):** confirm the hook runs under Git-for-Windows bash and `node`/`npx`/global `shopify` resolve inside it.

---

## 7. Known risks

1. **Full-strict performance (top risk).** `theme-check:all` at `--fail-level=info` with **no exclusions** runs
   `RemoteAsset` (network reachability) + `AssetSize*` over 150+ assets — measured at **20+ min** per run in the
   Figma-build skills. Every commit pays this. Mitigation (documented, not auto-applied): tune `.theme-check.yml`
   from the first baseline; if intolerable, disable `RemoteAsset`/`AssetSize*` via the commented block (Step 7).
2. **Day-one friction.** A strict whole-theme check blocks commits on *any* pre-existing offense. Step 11's
   baseline is mandatory before relying on the gate.
3. **Local-only scope.** Commits pushed back from the Shopify editor originate on Shopify's servers; local hooks
   can't run on them. A GitHub Actions mirror (`shopify/theme-check-action@v2`) is the only fix — deferred.
4. **Node assumption** for the gap script: chosen over Python because Husky already requires Node → guaranteed in every clone, dependency-free, propagation-safe.
5. **`@shopify/prettier-plugin-liquid` repo archived** (June 2024) but the npm package is live under `Shopify/theme-tools`; name unchanged.
6. **Out of scope (stays in the skills):** metafield render-type matching, block/parent + locales registration,
   visual/coverage/post-deploy checks. This doc *maps* them (§3); it does not duplicate them.

---

## Appendix — what this consolidates

- `docs/shopify-precommit-validation-plan.md` — earliest draft (targets the wrong project, `koora-honey`); `theme-check:recommended`; unresolved fail-level; included the CLI-missing guard (kept here).
- `docs/theme-validation.md` — working doc; `:recommended` with a note to switch to `:all`; fail-level table; unified lint-staged glob (kept here).
- `docs/shopify-theme-validation-setup.md` — finalized 2026-05-31; `theme-check:all`; strictest fail-level; gitignore + README edits; propagation model.

This v2 keeps the strongest pieces of each, pins the verified `--fail-level=info`, and adds the tested
`scripts/validate-schema.mjs` guard for the three save/sync rules Theme Check cannot catch.
