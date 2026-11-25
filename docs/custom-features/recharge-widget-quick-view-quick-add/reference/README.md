# Reference files

Copied verbatim from the verified `log-club` build. Start from these; the parent
[README](../README.md) explains *why* each part is shaped the way it is.

| File | Copy to | Portable as-is? |
|---|---|---|
| `quick-view.js` | `assets/quick-view.js` | Yes, after the constants at the top |
| `quick-view.liquid` | `sections/quick-view.liquid` | Markup is design-specific — keep the structure, restyle the content |
| `quick-view.css` | `assets/quick-view.css` | No — these are one design's values |
| `product.quick-view.json` | `templates/product.quick-view.json` | Only the app-block UUID changes |

---

## What to change when porting

### `product.quick-view.json`

Replace the app-block `type` with the one from the target theme:

```bash
grep -o 'shopify://apps/[^"]*' templates/product.json
```

That string carries the app's UUID and is specific to the app **and** the store's install.

### `quick-view.js`

Everything configurable is in the constants at the top:

```js
const WIDGET_TAG = "recharge-subscription-widget";   // the app's custom element
const WIDGET_DEFINE_TIMEOUT = 6000;                  // how long to wait for its bundle
const MASKED_ACTION = "/cart/add--quick-view-masked";
const DESKTOP_QUERY = "(min-width: 64rem)";          // must match the CSS breakpoint
```

Then check three assumptions against the target theme:

1. **`getContainer()`** assumes `DialogMenu` exposes `content` and `SheetMenu` exposes
   `sheetContent`. Confirm those property names — they are Golden's, not a standard.
2. **`maskCardForms()`** assumes nothing reads `form.action`. Verify per the parent README's
   [Preflight step 5](../README.md#5-confirm-nothing-reads-formaction).
3. **`onSubmitCapture()`** reads the app's radio as
   `input[name="purchaseOption"][value="subscription"]` inside the widget's shadow root. A different
   app, or a Recharge major version, may name it differently — inspect before trusting it. If the
   selector no longer matches, the guard silently stops guarding, so assert it in testing.

The class is otherwise app-agnostic: fetch, inject, re-execute scripts, re-upgrade a custom element,
mask forms, guard submit.

### `quick-view.liquid`

Keep these load-bearing pieces; restyle everything else freely:

- `id="QuickViewRoot"` — the extraction handle. The JS takes this element and nothing else, so the
  app block and its config scripts **must** be inside it.
- `{% content_for 'blocks' %}` — where the app block renders.
- `{% form 'product' %}` with an explicit `<input type="hidden" name="id">`. `{% form %}` does not
  add one, and the app matches on it.
- `class="quick-view__form"` — how the JS tells the panel's form from a card's when masking.
- `<add-to-cart>` wrapping the submit button — the theme's AJAX contract. Without it the form does a
  full page POST and navigates away.
- `[data-quick-view-close]` on the close button — handled by delegation.
- `"blocks": [{ "type": "@app" }]` and `"tag": "div"` in the schema.

### `quick-view.css`

Treat as an example, not a starting point — every value here is one design's. Two rules **are**
mechanism rather than style, and should carry across:

```css
/* The base dialog ships a 1px border, which eats 2px of a fixed-width panel. */
dialog-content[data-size="quick-view"] { border: none; }

/* Keyed off an attribute the JS sets, NOT :has(.quick-view) — see parent README. */
sheet-content[data-quick-view] { … }
```

---

## Not included

The trigger markup lives in `snippets/product-card.liquid` and the host element in the grid section,
because both are theme-specific. The parent README covers them in Implementation steps 5–7.
