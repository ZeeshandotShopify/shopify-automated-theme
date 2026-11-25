# Loox Reviews Integration

A replication guide for **rendering Loox review content in a theme's own markup**. Use this when a
client on the Loox reviews app hands you a custom review-card design and you need to know, on day
one, whether that design is buildable at all.

> **Scope of this doc:** what Loox does and does not expose to a Shopify theme, and how that decides
> which of three build routes you take. It is a *feasibility* guide first and an implementation guide
> second — the answer is often "not on this client's plan", and that is worth knowing before any
> Liquid is written.
>
> Reference build: `kaiola` theme, `sections/featured-reviews.liquid`. Verified against a live Loox
> install on Shopify Online Store 2.0.
>
> A presentation copy of this guide, with copyable support-message templates, sits beside this file
> as [`loox-reachability-map.html`](./loox-reachability-map.html) — open it in a browser.

---

## The one thing to know

Loox gives a theme **aggregate numbers** for free, and **individual review content** only through a
paid-tier API. Every Loox widget that renders review content does so inside a **cross-origin
iframe**, so none of it can be restyled with CSS — not with `!important`, not with a scoped
override, not at all.

So when a client hands you a custom review-card design, the question is never "how do we style the
widget?" It is **"which Loox plan are they on?"**

---

## What Loox actually exposes

| Data | Where it lives | Reachable | Notes |
|---|---|---|---|
| Store-wide rating & count | `shop.metafields.loox.global_stats` | **Free** | String, `"4.8,436"`. Split on the comma. Updates live. |
| Per-product average | `product.metafields.loox.avg_rating` | **Free** | App-owned. Also mirrored to Shopify's standard `reviews.rating`. |
| Per-product review count | `product.metafields.loox.num_reviews` | **Free** | Mirrored to `reviews.rating_count`. |
| Reviewer name | Storefront API · `reviewer.name` | **Paid tier** | Not in any metafield. |
| Review text | Storefront API · `body` | **Paid tier** | Not in any metafield. |
| Per-review rating | Storefront API · `rating` | **Paid tier** | Not in any metafield. |
| Product name / URL / image | Storefront API · `product` | **Paid tier** | Returns the *product* image, not the review photo. |
| Review photo | Storefront API · `media[].url` | **Paid tier** | Only where the reviewer attached one. |
| Anything inside a Loox widget | `loox.io` iframe | **Never** | Cross-origin. No CSS or DOM reach, on any plan. |

Loox support confirmed the paid-tier rows directly: *"That data isn't available through Shopify
metafields."*

### Reading the free aggregate

```liquid
{%- liquid
  assign loox_stats = shop.metafields.loox['global_stats']
  if loox_stats != blank
    assign loox_parts = loox_stats | split: ','
    assign loox_score = loox_parts[0] | strip
    assign loox_count = loox_parts[1] | strip
  endif
-%}
```

This is worth wiring even on the free plan — a live store-wide rating in a section header costs
nothing and is genuinely automatic.

---

## The iframe wall

This is the fact that kills most "just restyle the widget" plans.

| Renders in your DOM — styleable | Renders in an iframe — sealed |
|---|---|
| Star rating widget (`.loox-rating`) | Reviews widget (`#looxReviews`) |
| Trust badge (`.loox-trust-badge-widget`) | Cards carousel |
| | Testimonial carousel |
| | Gallery carousel |

**How to check in ten seconds.** Open the client's live product page, inspect the reviews block, and
look for an `<iframe>`. If the review content sits inside one, its appearance is fixed.

### The carousel's entire styling surface

The v2 carousels are configured by `data-*` attributes on a `.loox-v2-carousel-container` div, which
the Loox script turns into iframe query parameters. This list is exhaustive — if a design needs
anything not on it, the widget cannot deliver it:

```
slideType · maxWidth · borderRadius · itemsPerView · mobileItemsPerView · imageRatio
maxNumberOfCharacters · desktopFontSize · mobileFontSize · reviewerNameColor · textColor
itemBackgroundColor · starsColor · starsBackgroundColor · arrows[backgroundColor]
arrows[iconColor] · arrows[hideOnMobile] · shadow · border[active] · border[width]
border[color] · pagination[active] · pagination[dotColor] · pagination[selectedDotColor]
autoplay[active] · autoplay[duration] · quoteMarkIcon · quotesIconColor · productIds
```

Colours and sizes only. **No control over card layout, element order, or which fields appear.** Two
further limits: the Cards and Gallery carousels hide text-only reviews entirely, and they show the
*customer's* photo, never the product image — which is what most custom designs actually ask for.

---

## Three routes, and how to choose

| # | Route | Needs | Design fidelity | Updates |
|---|---|---|---|---|
| 1 | **Storefront API into your own markup** | Convert or Unlimited | Full | Automatic |
| 2 | **Drop in the Loox widget** | Any plan | Low | Automatic |
| 3 | **Curated cards in the theme editor** | Any plan | Full | Manual |

**Route 1** is the only one that is both automatic and pixel-accurate. The API returns the product's
name, URL and image, so cards showing a product photo work exactly as drawn.

**Route 2** is a sound choice when the client has no strong design, or as an interim.

**Route 3** matches the design exactly and costs nothing, but someone maintains it by hand. Pair it
with the live aggregate badge so at least the headline number stays true.

> **Build routes 1 and 3 as the same section.** Identical markup, identical CSS — only the data
> source differs. A plan upgrade then becomes a change of data source, not a rebuild, and shipping
> route 3 first costs nothing if the client later upgrades.

---

## Getting API access

The Storefront API base URL is:

```
https://storefront-api.loox.io/storefront/v1/store/{publicStoreId}/product-reviews
```

No API key — it is public, CORS-gated by domain, and safe to call from the browser. (The separate
**Merchant API** requires a secret key and must never appear in theme code.)

Ask Loox support for the `publicStoreId` and confirmation the plan includes API access. Both message
templates — one for an unknown or legacy plan, one for a client already on Convert or Unlimited —
are in [`loox-reachability-map.html`](./loox-reachability-map.html) with copy buttons.

### Field mapping, once the API is on

| Card element | API field | Note |
|---|---|---|
| Reviewer name | `reviewer.name` | Storefront API abbreviates it — "John D." — as it strips personal data. |
| Review text | `body` | Clamp in CSS; reviews vary wildly in length. |
| Star rating | `rating` | Integer 1–5. |
| Product name, link, photo | `product` | Carries name, URL *and* image — the product shot, not the review photo. |
| Customer photo | `media[].url` | Absent on text-only reviews. Always design a fallback. |
| Date, verified badge | `date`, `verified` | Also returned. |

### Two things to settle with the client before building

**Which reviews surface.** A store with hundreds of reviews and a design showing four needs a rule:
newest first, 5-star only, photo-only, or per-product. The design will not tell you — ask.

**What renders before the fetch resolves.** A client-side fetch means the cards are empty on first
paint. Decide between a skeleton, a small set of server-rendered fallback cards, or reserving the
height — and remember review text fetched client-side is invisible to search engines.

---

## Gotchas worth carrying forward

**Loox's own reply will describe aggregates as "reviews."** First-line support answers "can we render
review content?" with "yes — Loox stores a copy of each product's reviews in metafields", then lists
`reviews.rating` and `reviews.rating_count`. Those are a score and a count. Quote the specific fields
you need back at them; the second reply is usually accurate.

**A 401 that ignores the store id means entitlement, not a typo.** Send a deliberately invalid store
id. If it returns the same 401 as your real one, the request is being rejected before the id is read
— so the problem is plan access, not the identifier. Do this before asking support; it turns a vague
question into a specific one.

**Figma star icons often export upside-down.** Figma applies `scaleY(-1)` at the node, which the
exported path does not carry. Paste it verbatim and the star renders with two points up. Check the
geometry: a correct five-point star has one vertex at the top. Wrap the path in
`transform="matrix(1 0 0 -1 0 H)"`.

**Swiper's auto margins cancel flex stretching.** The `.swiper` class sets
`margin-left: auto; margin-right: auto`. Inside a flex column, an auto cross-axis margin stops the
item stretching, so it collapses to its content width and overflows the page. Pin
`margin-inline-start: 0` when using a negative end margin for a full-bleed rail.

**Shopify range settings cap at 101 steps.** `(max - min) / step` must be 101 or fewer, or the theme
fails to upload. Theme Check does not catch it — only the upload does. Also confirm the default is
divisible by the step, or it silently snaps.

**Shopify JSON files carry a comment banner.** Every `templates/*.json` and `locales/*.json` opens
with a `/* ... */` block, so a plain JSON parser fails. Strip it to read, re-attach it to write.
Round-trip the untouched file first to confirm your serializer matches the existing formatting —
otherwise a one-line edit reformats thousands.

---

## Reference build

`kaiola` theme — `sections/featured-reviews.liquid`, built route 3 with the header badge on the free
live aggregate. Structured so the card rail can be swapped to route 1 without touching the markup or
CSS.

Client was on **Scale (Legacy)**, which does not include API access — the section ships with curated
cards until that plan question is resolved.
