# Judge.me Reviews Integration

A replication guide for **rendering Judge.me review content in a theme's own markup** — a custom
review section, carousel or widget that looks nothing like Judge.me's stock output. Use this when a
client on the Judge.me reviews app hands you a custom review-card design.

> **Scope of this doc:** what Judge.me does and does not expose to a Shopify theme, how to find that
> out **on the client's own store in about five minutes**, and which of four build routes the answer
> leaves you. It is a *feasibility* guide first and an implementation guide second.
>
> It deliberately carries **no design values** — no frames, no node-ids, no spacing tables. The
> design is an input, supplied per build at [Step 0](#step-0--ask-for-the-design). Everything else
> here is true regardless of what the cards look like.
>
> Reference build: `crowning-jewels` theme — `sections/gw-judgeme-reviews.liquid`,
> `assets/gw-judgeme-reviews.js`, `assets/section-gw-judgeme-reviews.min.css`. Verified against a
> live Judge.me install (1,176 reviews) on Online Store 2.0.

### If you are an agent implementing this

Work in this order and **stop at each gate**.

0. [**Ask for the design**](#step-0--ask-for-the-design) — do not start without it.
1. [**Probe the store**](#step-1--probe-the-store-before-you-plan) — five minutes, and it decides the
   architecture. Do not plan from this document's tables alone; Judge.me's exposure varies by install.
2. [Decide the route](#four-routes-and-how-to-choose) — take it to the user, with the trade-offs.
3. [Implementation](#implementation).
4. [Verification](#verification) — measure geometry, not computed styles. The distinction is not
   pedantic; see [the traps](#the-traps).

Read [The traps](#the-traps) before writing code. Every one cost real time on the reference build.

---

## Step 0 — Ask for the design

**Ask the user before writing anything, and wait for an answer.** A review card carries roughly eight
distinct elements and two independent layouts; none are inferable from the theme. Do not invent values.

Ask for **either**:

**A. Figma frames + a design spec** *(preferred)*

> Please send:
> 1. **Desktop** Figma link with `node-id` — the reviews section
> 2. **Mobile** Figma link with `node-id` — the reviews section
> 3. A design spec, if you have one

A link without `node-id` is not usable — ask again. If the carousel's arrows, dots or scroll
indicator live in a separate frame or component, ask for those node-ids too.

Given Figma access, **extract the spec once, up front, and get the numbers confirmed** before writing
code. Re-reading Figma mid-build is how two elements end up measured from different frames. The
extracted spec — not the Figma file — is then the single source the build reads from, and anything it
does not carry is a question for the user rather than a judgement call.

**B. A design spec alone** *(when there is no Figma file)*

Workable, provided it carries the values in [What the spec must
contain](#what-the-spec-must-contain). Say plainly which values are missing and ask for them, rather
than guessing and reporting a match later.

### What the spec must contain

Per breakpoint, and the two usually differ more than expected:

| Group | Values needed |
|---|---|
| Section | frame width, padding, gap between top-level groups, background |
| Header | layout (row vs stack), heading type, any attribution lockup, where the carousel controls sit |
| Card | width, height behaviour, padding, background, radius, gap between internal groups |
| Track | gap between cards, how many are visible, **whether the next card peeks and where it is clipped** |
| Card contents | which of the eight fields appear, in what order and grouping, with exact gaps |
| Type | family, size, weight, line-height, letter-spacing, colour, transform — per text element |
| Media | image box size, fit, radius; whether it is the product photo or the reviewer's photo |
| Controls | arrows / dots / progress bar per breakpoint, sizes, and their hover + disabled states |
| Present / absent | which elements exist on one breakpoint but not the other |

### Settle these with the client before building

Each has caused rework.

1. **Which reviews surface.** A store with a thousand reviews and a design showing four needs a rule:
   newest first, 5-star only, photo-only, featured-only, per-product. The design will not tell you —
   ask. This also decides whether you need a route that can filter at all.
2. **Product photo or reviewer photo.** These are different fields and not every route exposes both.
   A card drawn with a clean product shot cannot be fed reviewer snapshots.
3. **What renders before the fetch resolves**, if the route is client-side. Decide between a skeleton
   at exact card metrics, server-rendered fallback cards, or reserving height — and tell the client
   that client-side review text is invisible to search engines.
4. **Star artwork.** If the design shows only full stars, ask whether half and empty states are
   needed. They are, the moment the rule is not "5-star only".
5. **Fonts must exist in the theme.** If the spec names a family the theme does not load, agree a
   substitute *before* building.

### If the user cannot supply either

Stop and say so. Offer to build the mechanism — data plumbing, carousel behaviour, the empty-state
split — against a deliberately plain layout, clearly labelled as placeholder, so the design can be
applied later without redoing the hard part.

---

## The one thing to know

**Judge.me does expose full review content to Liquid.** This is the opposite of Loox, and the opposite
of what most developers assume. Review bodies, titles, ratings and product references are all readable
server-side, free, with no API key.

But — and this is the whole problem — **no single Liquid surface carries every field a review card
normally draws.** The structured source is missing the reviewer's name and the date. The source that
has the name and date is missing the product link and image. And their review ids are in **different
namespaces**, so you cannot join them.

So the question is never "can we read reviews?" It is **"which fields does this design need, and is
there one surface that carries all of them?"** Usually there is not, and the answer is the widget API.

---

## What Judge.me actually exposes

Verify per store — see [Step 1](#step-1--probe-the-store-before-you-plan). Reference-build results:

### `product_review` metaobjects — structured, server-rendered, free

Judge.me syncs reviews into Shopify's standard `product_review` metaobject. Iterable from Liquid.

| Field | Access | Reference build |
|---|---|---|
| Rating | `r.rating.value.rating` / `.scale_max` | ✅ `5.0` / `5.0` |
| Review title | `r.title` | ✅ |
| Review body | `r.body` | ✅ full text |
| Product | `r.product.value.title` / `.url` / `.featured_image` | ✅ — title, link **and** product image |
| Source | `r.source` | ✅ `"email"` |
| **Reviewer name** | `r.author` is a `customer_reference` | ❌ **blank** — storefront Liquid gates customer PII |
| **Date** | — | ❌ **no date field on the definition** |
| **Verified badge** | — | ❌ no field |

```liquid
{% for r in shop.metaobjects.product_review.values limit: 12 %}
  {{ r.rating.value.rating }} — {{ r.title }} — {{ r.product.value.title }}
{% endfor %}
```

Two Liquid facts worth knowing: a filter is **not** allowed inside `[]`, so a handle lookup must be
assigned first; and the metaobject drop is **not** iterable field-by-field — you must name each key.

```liquid
{%- assign handle = 'review-' | append: uuid -%}
{%- assign mo = shop.metaobjects.product_review[handle] -%}
```

### `shop.metafields.judgeme.*` — server-rendered HTML, free

| Key | Holds |
|---|---|
| `all_reviews_count` / `all_reviews_rating` | Aggregates. Plain numbers — **use these regardless of route** |
| `shop_reviews_count` / `shop_reviews_rating` | Shop-review aggregates |
| `featured_carousel` | The curated Featured set as rendered HTML |
| `all_reviews_0…N` | The all-reviews page as rendered HTML, chunked |
| `all_reviews_header`, `reviews_tab`, `popup_widget`, `verified_badge`, `medals` | Other widgets' HTML |
| `settings` | The `jdgmSettings` JS blob — widget config, not review data |

`featured_carousel` parses reliably on stable class hooks:

| Field | Hook | Reference build |
|---|---|---|
| Reviewer name | `__reviewer-name` | ✅ |
| Verified badge | `jdgm-rev__buyer-badge` present/absent | ✅ |
| Stars | count `jdgm--on` | ✅ — **÷2, there is a duplicate hidden rating div** |
| Review title | `__review-title` | ✅ |
| Review body | `__review-body` | ✅ |
| Date | `data-time='MM/DD/YYYY'` | ✅ |
| **Product title** | `__product-title` | ⚠️ held the **shop name** — these were shop reviews, not product reviews |
| **Product link** | — | ❌ no `<a>` in the item at all |
| **Product image** | `__image-wrapper` | ❌ **empty** — Judge.me's own JS fills it client-side |

### Widget API — JSON, needs the public token

`GET https://api.judge.me/api/v1/widgets/all_reviews_page`
`?api_token={public}&shop_domain={shop}.myshopify.com&json_request=true&per_page=50&page=1`

CORS-clean from the storefront. Returns `{ reviews[], total_pages, current_page }`. Every field:

| Card element | JSON field |
|---|---|
| Reviewer name | `reviewer_name` (full name; `reviewer_initial`, `is_anonymous_reviewer` also present) |
| Verified badge | `verified_buyer` |
| Stars | `rating` |
| Date | `created_at` (ISO — format client-side) |
| Review title / body | `title` / `body` / `body_html` |
| Product name + link | `product_title` + `product_url` (relative — same-origin) or `product_url_with_utm` |
| Product image | `product_pictures_url` / `product_variant_image_url` |
| Reviewer photo | `pictures_urls[]` |
| Filtering | `is_shop_review`, `pinned`, `transparency_badges[]`, `location` |

Also on the same host: `widgets/all_reviews_count`, `widgets/featured_carousel`.

**Not reachable from the storefront:** `api/v1/reviews` and `api/v1/reviews/count` — the private
endpoints. They fail CORS. Those need a server-side proxy and a **private** token, which must never
appear in theme code.

---

## The namespace trap

The obvious clever idea — parse `featured_carousel` for name and date, then join to the metaobject by
review id for the product image — **does not work.**

```
featured_carousel   data-review-id='8e1c3dcb-e6e3-4919-9674-f2d6440a373b'
metaobject handle   review-004dacb4-8374-4319-bd37-3b5b4b827ee2
```

Judge.me's own review ids and the ids Shopify minted for the metaobjects are different namespaces.
Handle lookup returns nothing. Confirm it yourself on the client's store before building on a join —
it takes one probe — but expect it to fail.

---

## Step 1 — Probe the store before you plan

Judge.me's exposure differs per install: plan tier, which widgets are enabled, whether reviews are
product- or shop-scoped, whether the metaobject sync is on. **Do not plan from the tables above.**

The Admin API route needs an OAuth app install on the client's store, which is the client's call. The
cheap route is a throwaway snippet rendered through `shopify theme dev`, which runs against a
**disposable dev theme** — the live storefront is never touched.

**Breadcrumb it first**, then revert on every exit. Write down every file you touch and the original
markup verbatim before you change it; a session that dies mid-probe otherwise leaves the client's
working tree modified.

```liquid
{%- comment -%} snippets/vh-tmp-jm-probe.liquid — DELETE AFTER READING {%- endcomment -%}
<pre id="jm-probe" style="white-space:pre-wrap;font:12px monospace;background:#fff;color:#000;padding:16px;border:4px solid red">
metaobject count: {{ shop.metaobjects.product_review.values.size }}
{% assign keys = "rating,title,body,author,product,source,created_at,verified" | split: "," %}
{% for r in shop.metaobjects.product_review.values limit: 2 %}
=== {{ r.system.handle }} ===
{% for k in keys %}{% assign f = r[k] %}{% if f != blank %}  [{{ k }}] {{ f.type }} :: {{ f.value | json | truncate: 200 }}
{% endif %}{% endfor %}
  rating={{ r.rating.value.rating }} product={{ r.product.value.title }} img={{ r.product.value.featured_image | image_url: width: 136 }}
{% endfor %}

aggregates: count={{ shop.metafields.judgeme.all_reviews_count }} rating={{ shop.metafields.judgeme.all_reviews_rating }}
featured items: {{ shop.metafields.judgeme.featured_carousel | split: "data-review-id='" | size | minus: 1 }}

all judgeme shop metafields:
{% for f in shop.metafields.judgeme %}  {{ f[0] }} ({{ f[1] | size }} chars)
{% endfor %}
</pre>
```

Render it, read it in the browser, then **delete the snippet and revert the include**. Prove the
revert: `grep -r` your sentinel over the theme returns nothing, and no temp asset remains.

To see exactly which fields a carousel item carries, dump one item raw and list its classes:

```liquid
{% assign items = shop.metafields.judgeme.featured_carousel | split: "data-review-id='" %}
<textarea style="width:100%;height:300px">{{ items[1] | slice: 0, 4500 | escape }}</textarea>
```

**Test the API token from the browser console** on the dev theme, before planning around it:

```js
const T='<public token>', S='<shop>.myshopify.com';
const r = await fetch(`https://api.judge.me/api/v1/widgets/all_reviews_page?api_token=${T}&shop_domain=${S}&json_request=true&per_page=3`);
console.log((await r.json()).reviews[0]);
```

### What to walk away knowing

- Does the `product_review` metaobject exist, and how many entries?
- Which metaobject fields are actually populated — specifically **name** and **date**?
- Does `featured_carousel` hold product reviews or shop reviews?
- How many featured reviews exist?
- Do the review-id namespaces match? (Expect no.)
- Does the client have the **public** token, and does the API return JSON?

---

## Four routes, and how to choose

| # | Route | All card fields | Needs | Server-rendered / SEO | Updates |
|---|---|---|---|---|---|
| 1 | **Widget API into your own markup** | ✅ | Public token | ❌ client-side | Automatic |
| 2 | **Metaobjects into your own markup** | ⚠️ no name, date, verified | Nothing | ✅ | Automatic |
| 3 | **Curated editor blocks + live aggregate** | ✅ | Nothing | ✅ | Manual |
| 4 | **Restyle Judge.me's own widget** | n/a | Nothing | ✅ | Automatic |

**Route 1** is the only one that is both automatic and carries every field. The reference build took
it. Cost: cards paint after JS, so they are invisible to Google and can flash in on slow connections.

**Route 2** is the most durable code — structured fields, nothing to parse, nothing to break. Take it
when the design can drop the reviewer name, date and verified badge, or when the client will accept
them as editor-entered per card (a hybrid that still renders all eight fields server-side).

**Route 3** matches any design exactly and costs nothing, but someone maintains it by hand. Always
pair it with the live aggregate from `all_reviews_count` / `all_reviews_rating` so the headline number
stays true even when the cards are static.

**Route 4** is not this guide — Judge.me's widget markup is in your DOM (unlike Loox, there is no
iframe, so CSS **can** reach it), but you are skinning their layout, not building yours. That is the
`shopify-app-restyle` job. Note the section's own CSS precedent: check whether the theme's
`custom.css` already overrides `jdgm-` classes before adding a second override layer.

> **Build routes 1, 2 and 3 as the same section.** Identical markup, identical CSS — only the data
> source differs. Shipping route 3 first then costs nothing if the token arrives later.

---

## Implementation

Route 1, as built. Adapt the naming to the agency prefix in play (`gw-` on the reference build).

| File | Role |
|---|---|
| `sections/<prefix>-judgeme-reviews.liquid` | Section chrome, header, card skeleton, schema |
| `assets/section-<prefix>-judgeme-reviews.min.css` | BEM styles, one file per section |
| `assets/<prefix>-judgeme-reviews.js` | Custom element: fetch, render, carousel |
| `templates/<target>.json` | Section instance + placement |

### Split the work server / client

Render **server-side**: section wrapper, header, attribution lockup, and a **card skeleton at the
exact card metrics**. Render **client-side**: the cards themselves. The skeleton is what makes the
swap cost zero layout shift — it is not a placeholder and must never read as one to a merchant.

### The custom element

Register through the theme's own web-component registry rather than a bare `<script>`, so the module
is de-duped across instances. On the reference (Theme Envy) that is
`window.wetheme.webcomponentRegistry` plus a `<safe-load-scripts>` wrapper; check the host theme's
convention before assuming.

Page the API until enough qualifying reviews are found — one page is not guaranteed to fill the track
once a filter is applied:

```js
async collect() {
  const out = [];
  for (let page = 1; page <= MAX_PAGES && out.length < this.limit; page += 1) {
    const data = await this.api('all_reviews_page', { json_request:'true', per_page:'50', page:String(page) });
    out.push(...(data.reviews || []).filter(r =>
      r.rating === 5 && !r.is_shop_review && r.product_pictures_url && r.product_url && (r.body||'').trim()));
    if (page >= (data.total_pages || 1)) break;
  }
  return out.slice(0, this.limit);
}
```

**Sanitise `body_html`.** It is customer-authored. Allowlist the inline tags the design needs, strip
every attribute, and escape every other field:

```js
const sanitizeBody = (html) => {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const allowed = new Set(['P','BR','EM','STRONG','I','B']);
  const walk = (node) => [...node.children].forEach((el) => {
    walk(el);
    if (!allowed.has(el.tagName)) el.replaceWith(...el.childNodes);
    else [...el.attributes].forEach(a => el.removeAttribute(a.name));
  });
  walk(doc.body);
  [...doc.body.querySelectorAll('p')].forEach(p => {
    if (!p.textContent.replace(/[\s​]/g,'')) p.remove();   // Judge.me emits trailing empty <p>
  });
  return doc.body.innerHTML;
};
```

### Schema and the token

Put the token in a **text setting**, not hardcoded, so the client can rotate it without a deploy.
Settings worth exposing: token, shop domain, review count, heading, attribution label + logo
`image_picker`, and the card/type colours as section-scoped custom properties.

> **Tell the user where the token lands.** A setting's value is written into `templates/*.json`,
> which **is committed**. The public token is designed for storefront embedding so this is not a
> credential leak — but it does enter git history, and rotating it later means another commit. Offer
> to leave it in `settings_data.json` only.

### The empty state

Required settings are the token and shop domain. Blank — or a fetch that yields nothing — should give
a **placeholder in the theme editor** and **no markup at all** on the live site.

Put the stylesheet `<link>` and the scoped `<style>` **inside** the render guard, not on line 1.
Otherwise the "renders nothing" branch still leaves several hundred bytes inside the section wrapper.

```liquid
{%- if has_token or request.design_mode -%}
  {{ 'section-<prefix>-judgeme-reviews.min.css' | asset_url | stylesheet_tag }}
  <style>#shopify-section-{{ section.id }} { --jmr-bg: {{ s.bg }}; }</style>
{%- endif -%}
```

### Icons

Stars, verified badges and arrows repeat 20+ times per card set and need `currentColor`. **Inline
them as SVG in the JS/Liquid**, not as `image_picker` uploads. Say so explicitly in the handover:
inlined icons are theme code and the client cannot swap them in the editor. A brand logo in the
header is the opposite case — that stays an uploadable `image_picker`.

---

## The traps

**A custom element defaults to `display:inline`.** This is the single most expensive one. A section
whose root is `<my-element class="...">` will silently drop its own padding and let the inner wrapper
overflow its padding box — while `getComputedStyle` cheerfully reports `padding: 96px 48px`, because
the declaration is there and only the *layout* is wrong. Always declare
`display:block; box-sizing:border-box` on the element. And verify geometry, not computed styles.

**A scroll container adds font ascent under its cards.** A flex `overflow-x:auto` track measured ~4.5px
taller than its tallest child, with no scrollbar gutter. `line-height:0` does not fix it; `font-size:0`
on the track does. Safe as long as every descendant sets its own size.

**Figma clips the track at the frame edge, not the content box.** The peeking next card is almost
always drawn overflowing the section's own side padding. Constrain the track to the content box and
you get a sliver where the design shows a third of a card. Bleed the viewport right by the padding and
give the track a matching `padding-right` so the last card still rests against a gutter at the end of
the scroll.

**Nested gaps stack.** A `row-gap` on a group plus a `margin-top` on one of its children renders the
sum. If the design groups stars-and-date tightly inside a looser stack, build that grouping in the
DOM — do not try to express it with one gap and a margin.

**Mirror the design's grouping at every breakpoint.** A wrapper that only becomes a flex column inside
the desktop media query collapses its gap to zero on mobile, because as a plain block it has no gap at
all. Make the stack the base and let the media query flip only the axis alignment.

**`loading="lazy"` plus `decoding="async"` breaks automated captures.** Images report `complete` and
`naturalWidth > 0` yet paint as empty boxes in a clipped screenshot. Await `img.decode()` before
capturing. Eager-load the first row in production anyway — those cards are in view at first paint.

**Count `jdgm--on` carefully.** Each carousel item renders its star block twice, once hidden. Halve it
or scope the count to the first block.

**Judge.me's "product title" may be the shop name.** Shop reviews have no product. Filter on
`is_shop_review` (API) or accept that those cards cannot carry a product link.

**Shopify JSON files carry a comment banner.** Every `templates/*.json` opens with a `/* … */` block,
so a plain JSON parser fails. Strip it to read, re-attach to write, and round-trip the untouched file
first to confirm your serializer matches the existing formatting.

**Compare Theme Check counts, do not read them absolutely.** A client theme can carry a four-figure
baseline of pre-existing offenses. Assert that *your* files add zero:

```bash
shopify theme check --fail-level error --output json | python3 -c "
import json,sys; d=json.load(sys.stdin)
print('mine:', len([o for f in d for o in f.get('offenses',[]) if '<your-file>' in f.get('path','')]))"
```

---

## Verification

**Measure rendered geometry, not declared CSS.** Computed styles pass while the layout is broken —
that is exactly how the `display:inline` trap survives a review. Assert positions relative to the
section box:

```js
const S = document.querySelector('.<block>'), sb = S.getBoundingClientRect();
const R = s => { const b = document.querySelector(s).getBoundingClientRect();
  return { l:+(b.left-sb.left).toFixed(1), t:+(b.top-sb.top).toFixed(1),
           w:+b.width.toFixed(1), h:+b.height.toFixed(1) }; };
const cards = [...document.querySelectorAll('.<block>__card')]
  .slice(0,4).map(c => +(c.getBoundingClientRect().left - sb.left).toFixed(1));
```

Check, at both breakpoints:

- **Left gutter and right gutter** equal the spec's section padding.
- **Card pitch** — the x deltas — equals card width + track gap, and is constant.
- **Track right edge** sits where the design clips it (frame edge, usually).
- **Track height** equals card height. A difference means the font-ascent trap.
- **Section height** reconciles arithmetically: `top pad + header + gap + card + bottom pad`.
- **Every internal gap** the spec names, measured as the delta between adjacent boxes.
- Note the viewport width will be short by the scrollbar (~15px) — expect `1425`, not `1440`.

Then exercise the data path, not just the happy render:

- **Both halves of the empty state.** Blank the required setting: the editor shows the placeholder,
  the preview URL emits **zero bytes** inside the section wrapper. Check the byte count, not the eye.
- **Card-height variance.** Real reviews are far longer and shorter than the mock's. Confirm the
  equalisation rule the client agreed to.
- **A review missing an optional field** — no product photo, no title, anonymous reviewer.

Expect two categories of residual mismatch, and report them as such rather than chasing them:
card height driven by real content length, and sub-pixel type differences where the design implies a
line-height the spec never states.

---

## Rollback

Delete the three new files and remove the section instance from the template JSON. Every change is
additive — a new section, its own stylesheet, its own module — so nothing else in the theme is
touched. The Judge.me app's own files are never modified by this build; if the client later drops the
custom section, their stock widgets are untouched and still work.

---

## Reference build

`crowning-jewels` — `7dc9377` *feat(judgeme-reviews): add live review carousel* (4 files, +591/−1) and
`c5bf0be` *fix(judgeme-reviews): correct layout geometry* (+19/−5).

Built route 1 after probing ruled out routes 2 and 3: the metaobjects (1,165 entries) carried the
product but not the reviewer name or date, `featured_carousel` carried the name and date but no
product link and an empty image wrapper, and the two id namespaces did not match. The client supplied
the public token, which unlocked every field in one source.

The second commit is worth reading as a cautionary tale — the whole geometry pass in
[Verification](#verification) exists because the first one shipped with computed styles matching and
the layout wrong.
