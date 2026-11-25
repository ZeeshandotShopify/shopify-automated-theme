# Recharge Widget — Quick View / Quick Add

A replication guide for **opening a product panel from a collection card** — a modal on desktop, a
bottom sheet on mobile — that carries the **Recharge subscription widget** inside it, so shoppers can
choose one-time or subscribe without leaving the collection.

The mechanism generalises to any Shopify **app block** (`shopify://apps/…`); Recharge is the worked
example because it is the one that has been built and verified. A panel containing only theme markup
is a much easier problem — see [Decide the route first](#decide-the-route-first).

> **The theme now ships a quick view.** `sections/quick-view.liquid`, `assets/quick-view.js` and
> `assets/quick-view.css` implement the **theme-markup-only** route — `?section_id=` fetch, one shell
> portalled to `<body>`, every variant option group, tokenised colours. The trigger lives in
> `snippets/product-card.liquid` behind `show_quick_view` (default `false`, on in
> `templates/collection.json`).
>
> Use that as the starting point. **Read this guide when the panel must carry a Shopify app block**
> — a subscription widget, a bundle builder, anything `shopify://apps/…`. That cannot be delivered by
> `?section_id=` at all (see [The one thing to know](#the-one-thing-to-know)), so it needs the
> alternate-template route described below, replacing the shipped section rather than extending it.

> **Scope of this doc:** how to fetch and portal a product panel into a collection page, and what
> the Shopify platform will and will not let you put inside it. The app-block question decides the
> whole architecture, so it comes first.
>
> Reference build: `log-club` theme — `sections/quick-view.liquid`,
> `templates/product.quick-view.json`, `assets/quick-view.js`. Verified end to end against a live
> Recharge install on Online Store 2.0.

**Working files sit in [`reference/`](./reference/)** — `quick-view.js`, `quick-view.liquid`,
`quick-view.css`, `product.quick-view.json`, copied verbatim from the verified build. Start from
those rather than retyping from the snippets below; the snippets exist to explain *why* each part is
shaped the way it is.

### If you are an agent implementing this

Work in this order and **stop at each gate**. Skipping a gate is how the silent wrong-price bug ships.

0. [**Ask for the design**](#step-0--ask-for-the-design) — do not start without it.
1. [Preflight](#preflight) — five checks. Any one can invalidate the whole approach.
2. [Decide the route](#decide-the-route-first).
3. [Implementation](#implementation) steps 1–7, in order.
4. [Verification](#verification-checklist) — assert, do not eyeball. The cart read-back is mandatory.

Read [The traps](#the-traps) before writing code, not after something breaks. Every one of them cost
real time on the reference build and none are guessable from Shopify's or the app's documentation.

---

## Step 0 — Ask for the design

**Ask the user before writing anything, and wait for an answer.** This panel has two independent
layouts and roughly forty exact values; none of them are inferable from the theme. Do not begin and
do not invent values.

Ask for **either**:

**A. Figma frames + a design spec** *(preferred)*

> Please send:
> 1. **Desktop** Figma link with `node-id` — the panel/modal
> 2. **Mobile** Figma link with `node-id` — the panel/sheet
> 3. **Desktop** Figma link with `node-id` — the product card showing the quick-view trigger
> 4. **Mobile** Figma link with `node-id` — the product card showing the trigger
> 5. A design spec, if you have one

Four node-ids, not two: the trigger lives on the card and the panel is its own frame, and they are
usually different frames in the file. A link without `node-id` is not usable — ask again.

Given Figma access, **extract the spec once, up front, and get the numbers confirmed** before writing
code. Re-reading Figma mid-build is how two elements end up measured from different frames. The
extracted spec — not the Figma file — is then the single source the build reads from, and anything it
does not carry is a question for the user rather than a judgement call.

**B. A design spec alone** *(when there is no Figma file)*

Perfectly workable, provided it carries the values in [What the spec must
contain](#what-the-spec-must-contain). Say plainly which values are missing and ask for them, rather
than guessing and reporting a match later.

### What the spec must contain

Per breakpoint, and the two breakpoints differ more than you expect:

| Group | Values needed |
|---|---|
| Panel | width × height (or max-width), corner radius, background, shadow, scrim colour **and opacity** |
| Layout | column split or stacking order, padding, gap between groups |
| Trigger | shape, size, position on the card (insets from the image box), fill, label text, and **whether it is hover-only or always visible** |
| Type | family, size, weight, line-height, letter-spacing, colour, transform — per text element |
| Buttons | size, radius, fill, label colour, exact copy (it often differs per breakpoint) |
| Media | how many images, and what happens when there are more or fewer |
| Present / absent | which elements exist on one breakpoint but not the other |

### Tell the user these three things when you ask

Say them upfront; each has caused rework.

1. **The purchase-option band is not yours to design.** Its wording, badge text and colours come from
   the app's own dashboard, not the theme. A frame showing `SUBSCRIBE & SAVE 10%` will render as
   whatever the app is configured to say (e.g. `Save up to 20%`). Confirm the design is only
   *indicative* there — or that they will change it in the app.
2. **Ask what happens with real data the frame does not show** — no reviews, no compare-at price, one
   image, sold out, a long title. Frames rarely draw these and the code must handle all of them.
3. **Fonts must exist in the theme.** If the spec names a family the theme does not load, say so and
   agree a substitute *before* building. Widths will then differ by a pixel or two, which is expected
   and not a defect.

### If the user cannot supply either

Stop and say so. Do not build a "reasonable default" panel — a quick view is a purchase surface, and
an invented one will be rejected on sight and rebuilt. Offer instead to build the mechanism (fetch,
portal, app-block binding, cart correctness) against a deliberately plain layout, clearly labelled as
placeholder, so the design can be applied later without redoing the hard part.

---

## Preflight

Run all five before writing anything. Each has a fail branch that changes the plan.

### 1. Does the store have native selling plans?

```bash
curl -s "https://<store-domain>/products/<any-handle>.js" \
  | python3 -c "import json,sys; p=json.load(sys.stdin); \
      print('variants:', len(p['variants']), '| options:', [o['name'] for o in p['options']]); \
      print('selling_plan_groups:', len(p.get('selling_plan_groups',[])))"
```

- **Groups > 0** → the app is on Shopify-native selling plans. `/cart/add` accepts `selling_plan`,
  and the cart read-back in [Verification](#verification-checklist) will work.
- **Groups = 0** → the app is not using native plans. This guide's cart assertions do not apply;
  confirm with the app how a subscription is attached before continuing.
- **Note the variant count.** If every product has one variant, the panel needs no variant picker —
  which is usually why the design has none. Do not add one "just in case".

### 2. Find the app block's UUID

```bash
grep -o 'shopify://apps/[^"]*' templates/product.json
```

Copy the whole string verbatim into the alternate template. It is portable JSON — you do **not** need
the theme editor to place an app block. No match means the app is an *embed*, not a *block*, and
this guide does not apply.

### 3. Does the theme have dialog and sheet primitives?

```bash
grep -rl "customElements.define(\"dialog-menu\"\|customElements.define('dialog-menu'" assets/
grep -rl "customElements.define(\"sheet-menu\"\|customElements.define('sheet-menu'"   assets/
```

- **Both present** → reuse them; you get overlay, Escape, focus trap and scroll lock free.
- **Missing** → you must supply your own. Budget for focus trapping and scroll locking; do not ship
  a modal without them.

Then check which directions the sheet CSS actually implements — the JS usually accepts four while
the CSS ships two:

```bash
grep -o 'data-direction="[a-z]*"' assets/sheet-menu.css | sort -u
```

### 4. Which section renders the collection grid, and is it template-scoped?

```bash
grep -rn "render 'product-card'" sections/ | cut -d: -f1 | sort -u
grep -n "enabled_on" sections/products.liquid
```

The toggle belongs on the **card block of the grid section**. If that section is already
`enabled_on: templates: ["collection"]`, the setting is template-scoped for free. Note every other
section in that list — they share the card snippet, so the new parameter **must** default to `false`.

### 5. Confirm nothing reads `form.action`

[Trap 3](#trap-3--the-app-steals-the-wrong-form-silent-wrong-price) masks card forms by rewriting
`action`. That is only safe if the theme ignores it:

```bash
grep -rn "action=\|\.action" assets/cart.js | grep -v "cart/add.js"
```

Expect the AJAX handler to POST to `/cart/add.js` explicitly and `<add-to-cart>` to resolve its form
at `connectedCallback`. **If anything reads `form.action` at submit time, do not use masking** — mask
by temporarily renaming the cards' `[name="id"]` inputs instead, which the app matches on too.

---

## The one thing to know

If the panel contains **only theme markup**, you have a free choice of delivery mechanism.

If the panel must contain a **Shopify app block** — a Recharge subscription widget, a bundle
builder, anything of the form `shopify://apps/…` — then you have exactly one route:

> **The app block must render server-side, from a JSON template, fetched over HTTP.**

Two platform rules force this, and neither has a workaround:

1. **`@app` blocks are not supported in statically rendered sections.** A section reached by
   `{% section 'quick-view' %}` can never contain one. It has to live in a template's JSON.
2. **The app's own bundle validates its config and refuses to run outside its block.** Reproducing
   the bootstrap by hand does not work — see [Trap 1](#trap-1--you-cannot-hand-mount-an-app-widget).

Everything else in this guide follows from that.

---

## Decide the route first

| The panel contains | Route | Cost |
|---|---|---|
| Theme markup only (title, price, gallery, variant picker, ATC) | Render the panel markup inline in the collection page, one hidden template per card, or fetch a section by `section_id` | Cheapest. No template needed. |
| **An app block** | **Alternate product template + full-page fetch** (this guide) | ~200 KB per first open, cached per handle |
| An app block, and you already know the product template's dynamic section id | Alternate template + `?section_id=` | Smaller payload, but see [Trap 2](#trap-2--section_id-needs-the-dynamic-id) |

**Do not** try to put a second quick-view section inside `templates/product.json`. Recharge (and most
subscription apps) allow **one widget per template**, so the PDP widget and the quick-view widget
would collide. A separate template sidesteps that entirely.

---

## Architecture

```
collection page
  └─ product card  ──(click)──►  <quick-view>            assets/quick-view.js
                                    │
                                    │ fetch /products/<handle>?view=quick-view
                                    ▼
                                 templates/product.quick-view.json
                                    └─ sections/quick-view.liquid
                                         ├─ #QuickViewRoot          ← the only thing extracted
                                         ├─ {% content_for 'blocks' %}  ← the app block
                                         └─ {% form 'product' %}        ← the app binds to this
                                    │
                                    │ inject → re-execute <script>s → re-upgrade the widget
                                    ▼
                                 <dialog-content>  (≥64rem)   portalled to <body>
                                 <sheet-content>   (<64rem)   portalled to <body>
```

The panel is portalled to `<body>` by the theme's existing dialog/sheet components, which is what
gives you the overlay, Escape handling, focus trap and scroll lock for free. Reuse them; do not
write a new modal.

---

## Files

| File | Role | Reference |
|---|---|---|
| `templates/product.<suffix>.json` | Alternate product template. Holds **one** section and the app block. Its only job is to be fetched. | [`reference/`](./reference/product.quick-view.json) |
| `sections/quick-view.liquid` | The panel. Declares `"blocks": [{"type": "@app"}]` and `enabled_on: templates: ["product"]`. Wraps everything in `#QuickViewRoot`. | [`reference/`](./reference/quick-view.liquid) |
| `assets/quick-view.js` | Fetch, inject, script re-execution, widget re-upgrade, form masking, submit guard. | [`reference/`](./reference/quick-view.js) |
| `assets/quick-view.css` | Panel styling plus the host shells (`dialog-content[data-size=…]`, `sheet-content[data-quick-view]`). | [`reference/`](./reference/quick-view.css) |
| `snippets/product-card.liquid` | The trigger, behind an opt-in flag defaulting to `false`. | — |
| `<grid section>.liquid` | Renders one `<quick-view>` host per page and passes the flag to the card. | — |

[`reference/README.md`](./reference/README.md) lists exactly what to change in each file when porting
to another theme, and which parts are load-bearing rather than cosmetic.

---

## The traps

Each of these cost real time on the reference build. None are guessable from documentation.

### Trap 1 — you cannot hand-mount an app widget

Reproducing the app block's bootstrap on a collection page **does not work**, even when it is
byte-identical. On the reference build we installed both
`<script id="SubscriptionWidgetConfig__shopify_settings">` and
`…__preview_config` copied verbatim from the PDP, plus the `type="module"` CDN bundle. Result:

- `customElements.get('recharge-subscription-widget')` → `true`
- `shadowRoot` attached
- **0 children, 0 height**
- console: `[Recharge Error] The config is not properly formatted and the widget is not loading correctly`

The bundle validates a private contract and gives up. Do not spend time here. Also note the bundle
is `type="module"` — a classic `<script>` tag never registers the element at all.

### Trap 2 — `section_id` needs the *dynamic* id

`/products/<handle>?section_id=main` returns **404**. The Section Rendering API wants the JSON
template's generated id, `template--<theme_template_id>__main`, which a collection page's Liquid has
no way to know. Themes that use this pattern always pass `section.id` from Liquid *on the page that
owns the section* (see `assets/variant-selector.js`), which is not available cross-template.

Fetch the whole alternate-template page instead and extract one element. It is ~200 KB, so cache the
parsed node per handle:

```js
if (this.cache.has(productUrl)) return this.cache.get(productUrl).cloneNode(true);
```

### Trap 3 — the app steals the wrong form (silent wrong price)

**This is the dangerous one.** Subscription widgets locate their target by scanning `document.forms`
for `form[action*="/cart/add"]` whose `[name="id"]` matches, then prepending a hidden `selling_plan`
input into it.

On a collection page **every product card is already such a form, for the same variant**. The widget
cannot tell the card's form from the panel's, so the selling plan can land on the card. The shopper
picks "Subscribe & Save", adds to cart, and is charged the **one-time** price. Nothing errors.

Mask the card forms while the panel is open:

```js
maskCardForms() {
  document.querySelectorAll("form[action]").forEach((form) => {
    if (form.classList.contains("quick-view__form")) return;
    const action = form.getAttribute("action");
    if (!action || !action.includes("/cart/add")) return;
    this.maskedForms.push([form, action]);
    form.setAttribute("action", "/cart/add--quick-view-masked");
  });
}
```

Safe because nothing in a Golden theme reads `form.action`: `assets/cart.js` posts to `/cart/add.js`
explicitly, and `<add-to-cart>` resolved its form during `connectedCallback` at page load, long
before any masking. **Verify both of those in the target theme before relying on it.**

Then add a guard so a failure is loud rather than expensive:

```js
// capture phase, so it runs before cart.js
onSubmitCapture(event) {
  const form = event.target;
  if (!form.classList?.contains("quick-view__form")) return;
  const widget = form.closest(".quick-view")?.querySelector(WIDGET_TAG);
  const sub = widget?.shadowRoot?.querySelector('input[name="purchaseOption"][value="subscription"]');
  if (!sub?.checked) return;                       // one-time needs no guard
  const plan = form.querySelector('input[name="selling_plan"]');
  if (plan && plan.value) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  this.showError(form.closest(".quick-view"));
}
```

### Trap 4 — injected `<script>`s never run, and modules run once

`innerHTML` / `replaceChildren` do not execute scripts. Re-create every one, **in document order**,
so config globals land before the module that reads them:

```js
container.querySelectorAll("script").forEach((original) => {
  const script = document.createElement("script");
  for (const a of original.attributes) script.setAttribute(a.name, a.value);
  if (!original.src) script.textContent = original.textContent;
  original.replaceWith(script);
});
```

A `type="module"` src evaluates **once per document**, so on the second open the bundle does not
re-run — while the config global has just been overwritten with the new product's data. The app's
documented remedy is to clone the element and replace it, which fires `connectedCallback` again:

```js
await customElements.whenDefined(WIDGET_TAG);      // race against a timeout
widget.replaceWith(widget.cloneNode(true));
```

Without this, opening product B after product A shows **A's prices on B's panel**.

Consequence: two instances now write to the same form on independent timers, so a one-shot cleanup
loses the race. Keep exactly one input with an observer:

```js
this.planObserver = new MutationObserver(() => {
  const inputs = form.querySelectorAll('input[name="selling_plan"]');
  for (let i = 0; i < inputs.length - 1; i += 1) inputs[i].remove();  // newest wins
});
this.planObserver.observe(container, { childList: true, subtree: true });
```

### Trap 5 — the sheet's content is not where you left it

`SheetMenu.init()` portals `sheet-content` to `<body>` **immediately**, so
`sheetMenu.querySelector("sheet-content")` returns `null`. `DialogMenu` portals on *open* and exposes
`content`. Use each element's own reference:

```js
getContainer(host, desktop) {
  if (desktop) return host.content || host.querySelector("dialog-content");
  return host.sheetContent || host.content || host.querySelector("sheet-content");
}
```

A document-wide `querySelector("sheet-content")` is wrong — the cart drawer and mobile menu also
park one on `<body>`.

---

## Implementation

Steps are ordered so each one is verifiable before the next depends on it. **Build the spike first**
— steps 1–3 plus a bare-bones panel — and prove the widget renders and binds correctly before
investing in layout. If the widget cannot bind, no amount of CSS matters.

Copy the four files from [`reference/`](./reference/) and adapt, rather than typing from the
snippets. The snippets below explain the reasoning; the reference files are the working code.

### 1. Alternate template

```json
{
  "sections": {
    "quick-view": {
      "type": "quick-view",
      "blocks": {
        "app_widget": {
          "type": "shopify://apps/<app>/blocks/<block>/<uuid>",
          "settings": {}
        }
      },
      "block_order": ["app_widget"],
      "settings": {}
    }
  },
  "order": ["quick-view"]
}
```

Copy the `type` string **verbatim** from `templates/product.json` — it carries the app's UUID and is
portable JSON. You do not need the theme editor to add it.

### 2. The section

```liquid
<div id="QuickViewRoot" class="quick-view">
  …media, title, price…

  <div class="quick-view__purchase-options">
    {% content_for 'blocks' %}
  </div>

  {% form 'product', product, id: form_id, class: 'quick-view__form' %}
    <input type="hidden" name="id" value="{{ variant.id }}">
    …quantity…
    <add-to-cart>
      <button type="submit" form="{{ form_id }}">…</button>
    </add-to-cart>
  {% endform %}
</div>

{% schema %}
{ "name": "…", "tag": "div",
  "enabled_on": { "templates": ["product"] },
  "blocks": [{ "type": "@app" }], "settings": [] }
{% endschema %}
```

`"tag": null` is a **section** schema error (blocks allow it, sections do not) — use `"div"`.

The form must carry a `name="id"` input; `{% form 'product' %}` does not add one.

> **Gate — the app block must survive the fetch.** Nothing below works until this passes:
>
> ```bash
> curl -s "http://127.0.0.1:<port>/products/<handle>?view=quick-view" -o /tmp/qv.html \
>   -w "http=%{http_code} bytes=%{size_download}\n"
> for m in QuickViewRoot '<recharge-subscription-widget' SubscriptionWidgetConfig \
>          subscription-widget.js shopify-app-block 'name="id"'; do
>   printf "  %-34s %s\n" "$m" "$(grep -c "$m" /tmp/qv.html)"
> done
> ```
>
> Every count must be ≥ 1. Then confirm they are **inside** `#QuickViewRoot`, because that element is
> all the JS extracts — if the config scripts sit outside it, the widget will never boot.

### 3. Noindex the template

It is a real, crawlable URL. In `snippets/meta-tags.liquid`:

```liquid
if template.suffix == 'quick-view'
  assign should_noindex = true
endif
```

### 4. Scope the app's CSS overrides

If the theme restyles the widget on the PDP, that stylesheet is almost certainly gated to
`template.name == 'product'`. Widen it, or the panel renders in the app's raw defaults:

```liquid
{%- if template.name == 'product' or template.name == 'collection' -%}
  {{ 'app-overrides.css' | asset_url | stylesheet_tag }}
{%- endif -%}
```

### 5. Trigger, opt-in

Put the flag on the **card block of the section that owns the grid**, not in theme settings. If that
section is already `enabled_on: templates: ["collection"]`, the setting is template-scoped for free.
Default the snippet parameter to `false` so the theme's other card consumers are untouched:

```liquid
assign show_quick_view = show_quick_view | default: false
```

### 6. Mobile bottom sheet

Golden's `sheet-menu.js` accepts four directions but `sheet-menu.css` historically implements only
`left` and `right`. Adding `bottom` is purely additive — the base rule pins all four edges and fixes
the height, so undo each:

```css
sheet-content[data-direction="bottom"] {
  top: auto; right: 0; bottom: 0; left: 0;
  width: 100%; height: auto;
  max-height: var(--sheet-menu-max-block-size, 90dvh);
  border-start-start-radius: var(--sheet-menu-radius, 16px);
  border-start-end-radius: var(--sheet-menu-radius, 16px);
  transform: translateY(100%);
}
sheet-content[data-direction="bottom"][data-state="open"] { transform: translateY(0); }
```

Style the host off an **attribute your JS sets**, not `:has(.quick-view)`. Set it before the content
lands so the cascade is settled when the open transition starts.

### 7. Hover belongs to pointer devices

Gate every hover affordance on the card, including ones already in the theme:

```css
@media (hover: hover) {
  .product-card:hover .secondary-image-container { opacity: 1; }
}
```

On touch, `:hover` sticks after a tap — an ungated image swap reads as a broken card. The desktop
trigger should be `display: none` below the breakpoint so it has no mobile state at all.

---

## Diagnosing a broken build

Symptom → cause → fix. Work down the table; the first four are the ones that actually bite.

| Symptom | Cause | Fix |
|---|---|---|
| Panel opens, purchase-option band is **empty**; console shows `The config is not properly formatted` | Scripts were injected but never executed, or the app block is outside `#QuickViewRoot` | Re-create every `<script>` in document order ([Trap 4](#trap-4--injected-scripts-never-run-and-modules-run-once)); confirm the block is inside the extracted element |
| Widget renders, but **product B shows product A's prices** | The `type="module"` bundle evaluated once; config was overwritten but nothing re-read it | `cloneNode(true)` + `replaceWith` after `customElements.whenDefined` |
| Subscribe selected, but the cart line is the **one-time price** | The app bound to a product card's form ([Trap 3](#trap-3--the-app-steals-the-wrong-form-silent-wrong-price)) | Mask card forms on open; add the submit guard so it fails loudly |
| Two `selling_plan` inputs in the form | Original **and** cloned widget both write, on independent timers | `MutationObserver` keeping the last |
| Sheet is `data-state="open"` but not visible | `sheetMenu.querySelector('sheet-content')` returned `null` — it was portalled to `<body>` at init ([Trap 5](#trap-5--the-sheets-content-is-not-where-you-left-it)) | Use `host.sheetContent` |
| Widget element never registers at all | The bundle was loaded as a classic script | It is `type="module"`; copy the attribute across when re-creating |
| Purchase-option cards render **unstyled** | The app's override stylesheet is gated to `template.name == 'product'` | Widen the gate to include `collection` |
| Icon renders at the wrong size and CSS will not override it | `snippets/icon.liquid` writes `#icon-<id> svg { width: var(--icon-size) }`. An id beats your class | Pass `icon_size:` to the snippet |
| Quantity stepper changes the wrong product | `assets/quantity-selector.js` resolves its form with a document-wide `querySelector` — the *first* product form. Fine on a PDP, wrong on a grid | Prefer `this.closest('form[action="/cart/add"]')` |
| Hover effect sticks on a phone | A `:hover` rule with no `(hover: hover)` gate | Gate every card hover affordance |
| Lazy images blank on open | The panel is visible the instant it is injected, so the first image is never below the fold | `loading: 'eager'` for the first image and the thumbnail |

### Two false trails — do not spend time on these

**A hidden browser pane freezes the animation clock.** Transitions never advance, so an element sits
at its *from* value with `getAnimations()[0].currentTime === 0` and
`document.visibilityState === "hidden"`. A correctly-positioned sheet will look permanently stuck
below the fold. Always disable transitions before measuring — which is correct capture hygiene
anyway:

```js
const kill = document.createElement('style');
kill.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
document.head.appendChild(kill);
```

**A hover-gated trigger measures 4px off.** The resting state carries `transform: translateY(0.25rem)`
for the fade-in. Measure the *hovered* state — that is the only one the design draws.

---

## Verification checklist

Do not sign this off on a screenshot. Assert these:

```js
// 1. widget actually rendered inside the panel
widget.shadowRoot.childElementCount > 0 && widget.getBoundingClientRect().height > 0

// 2. every card form masked, exactly one live
document.querySelectorAll('form[action="/cart/add--quick-view-masked"]').length   // = card count
document.querySelectorAll('form[action="/cart/add"]').length                      // = 1

// 3. the plan landed in the PANEL's form
[...form.querySelectorAll('input[name="selling_plan"]')].length === 1

// 4. product A then B re-reads config — prices must differ

// 5. forms restored on close
document.querySelectorAll('form[action="/cart/add--quick-view-masked"]').length === 0
```

Then the one that matters — add a subscription and read the cart back:

```js
const cart = await fetch('/cart.js').then(r => r.json());
cart.items[0].price                                        // discounted, not full
cart.items[0].selling_plan_allocation.selling_plan.name    // the chosen plan
```

If the price is the one-time price while the subscribe option was selected, Trap 3 is live.

---

## Known limits

- **First open costs a full page fetch** (~200 KB on the reference build). Cached per handle
  thereafter. If that matters, solve Trap 2 and switch to `?section_id=`.
- **The app's config is a private contract.** It can change in any app release. The failure mode is
  an empty panel band, so it is visible — but nothing warns you.
- **One widget per template** is an app-side rule. Adding a second quick-view section to
  `product.json` will appear to work and then misbehave.
- **App-block settings are merchant-managed.** Badge copy, labels and colours come from the app's
  dashboard, not the theme — so a Figma frame showing specific wording (e.g. `SUBSCRIBE & SAVE 10%`)
  will not match what renders (`Save up to 20%`). Confirm this with the client before building.
