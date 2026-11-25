# Color Swatch Fallback (color-from-name)

A replication guide for making the **variant picker render real color circles on a store whose option
values have no swatches assigned in admin**. Use this when a client's color picker shows plain
squares with text labels instead of colored circles.

> **Scope of this doc:** a theme-side *fallback*. It resolves a color from the option value's **name**
> ("Black", "Cocoa Cream", "Studded/Chalk") when Shopify gives the theme no swatch data. The proper
> fix is always merchant-side — see [When NOT to apply this](#when-not-to-apply-this).
>
> Reference build: `silver-fox-sales` theme, commit `9abce7a`. File paths below are Golden's; the
> five shared files are byte-identical between Golden and its client themes, so the before/after
> snippets apply verbatim.

---

## The symptom and the cause

**Symptom.** The PDP color picker renders as bordered rectangles with the color name inside, not as
circles. Product-card swatches render as transparent holes (Golden) or all-black dots (themes whose
card CSS sets a `var(--swatch-value, #111111)` default).

**Cause.** Not CSS. Shopify only populates `value.swatch` when the merchant has assigned a color or
image to an option value in admin (Products → Options → the value → swatch). Stores that were bulk-
imported, or migrated from another platform, almost never have this set — the option value is just
the string `"Black"`. `snippets/product-variant-options.liquid` then takes its `else` branch:

```liquid
{%- if picker_type == 'swatch' -%}
  {%- if swatch_value -%}
    {% render 'swatch-input', ... %}   ← never reached
  {%- else -%}
    {% render 'pill-input', ... %}     ← the square + label you're looking at
  {%- endif -%}
```

**Confirm before building anything.** A store with real swatch data has a different bug; don't apply
this fix to it.

```bash
curl -s "https://<store-domain>/products/<handle>.js" | python3 -m json.tool | head -40
```

If the product's `options` are plain string arrays and the rendered HTML has zero
`class="swatch"` spans, the swatch data is missing and this guide applies.

### When NOT to apply this

- **The client can assign swatches in admin.** That is exact, merchant-controlled, and makes this
  fallback dead code. Prefer it for small catalogs, or for the top-selling products.
- **Option values aren't colors.** Catalogs using `Set1`…`Set10`, `Picture color`, or romanized
  Chinese names (`Jiuhong`, `Naihuang`) resolve poorly. Measure first — see
  [Step 8](#step-8--measure-coverage-against-the-real-catalog).

---

## What gets touched

| # | File | Change |
|---|---|---|
| 1 | `snippets/color-from-name.liquid` | **New.** The name → hex resolver. |
| 2 | `snippets/swatch.liquid` | Accept a `fallback_color` param. |
| 3 | `snippets/swatch-input.liquid` | Pass `fallback_color` through. |
| 4 | `snippets/product-variant-options.liquid` | New `color_fallback` param; resolve before dropping to a pill. |
| 5 | `snippets/pdp-variant-selector.liquid` | Opt in for color options + all-or-nothing guard. |
| 6 | `snippets/product-card.liquid` | Same fallback for card swatches + a neutral "unknown" chip. |
| 7 | *any theme-specific snippet with an inlined swatch loop* | Same treatment. Find them with grep. |

Steps 1–5 are the variant picker and are the minimum. Steps 6–7 keep card swatches consistent.

---

## Step 1 — Create `snippets/color-from-name.liquid`

The resolver. It outputs a hex string, or **nothing** when the name is unknown — that empty output is
the signal every caller uses to decide whether to keep its text chip.

Matching order: the whole name with spaces stripped (so `off white` hits `offwhite`), then each word
**from last to first**, because the last word usually carries the hue (`Dark Indigo` → indigo,
`Cocoa Cream` → cream). `/`, `-` and `_` are normalized to spaces.

```liquid
{% doc %}
  Resolves a CSS color from a product option value name.

  Shopify only exposes `value.swatch` when the merchant has assigned a color or
  image to the option value in admin. This store's color options are plain text
  ("Black", "Cocoa Cream", "Studded/Chalk"), so the swatch drop is blank and the
  variant picker degrades to text chips. This snippet is the fallback: it maps a
  known color word to a hex value and outputs NOTHING when the name is unknown,
  so callers can detect the miss and keep their text chip.

  Matching is case-insensitive and works on compound names: the whole name is
  tried first (spaces removed, so "off white" matches `offwhite`), then each
  word from last to first, since the last word usually carries the hue
  ("Dark Indigo" -> indigo, "Cocoa Cream" -> cream). `/`, `-` and `_` are
  treated as word separators.

  @param {string} name - The option value name to resolve.

  @example
  {%- capture swatch_color %}{% render 'color-from-name', name: value %}{% endcapture -%}
{% enddoc %}

{%- liquid
  assign color_map = 'black:#000000,white:#ffffff,ivory:#fffff0,cream:#fffdd0,offwhite:#faf9f6,ecru:#c2b280,beige:#f5f5dc,nude:#e3bc9a,sand:#dcc9a6,taupe:#b8a99a,stone:#d9d2c5,linen:#faf0e6,oatmeal:#d9cfc1,champagne:#f7e7ce,grey:#808080,gray:#808080,silver:#c0c0c0,silvery:#c0c0c0,charcoal:#36454f,slate:#708090,graphite:#41424c,gunmetal:#2a3439,brown:#8b4513,chocolate:#3f2210,cocoa:#875c47,coffee:#4b3621,espresso:#3b2f2f,mocha:#3c280d,chestnut:#954535,camel:#c19a6b,tan:#d2b48c,khaki:#c3b091,caramel:#af6e4d,bronze:#cd7f32,copper:#b87333,rust:#b7410e,terracotta:#e2725b,mahogany:#c04000,walnut:#5c5248,red:#ff0000,crimson:#dc143c,scarlet:#ff2400,cherry:#d2042d,ruby:#9b111e,burgundy:#800020,maroon:#800000,wine:#722f37,brick:#9c3d33,coral:#ff7f50,salmon:#fa8072,rose:#ff007f,blush:#de5d83,pink:#ffc0cb,fuchsia:#ff00ff,magenta:#ff00ff,orange:#ffa500,peach:#ffe5b4,apricot:#fbceb1,amber:#ffbf00,tangerine:#f28500,yellow:#ffff00,gold:#ffd700,golden:#ffd700,mustard:#ffdb58,lemon:#fff700,green:#008000,olive:#808000,sage:#bcb88a,mint:#98ff98,emerald:#50c878,forest:#228b22,lime:#bfff00,teal:#008080,turquoise:#40e0d0,aqua:#00ffff,cyan:#00ffff,blue:#0000ff,navy:#000080,indigo:#4b0082,denim:#1560bd,cobalt:#0047ab,royal:#4169e1,sky:#87ceeb,azure:#007fff,sapphire:#0f52ba,periwinkle:#ccccff,purple:#800080,violet:#7f00ff,lavender:#e6e6fa,lilac:#c8a2c8,plum:#8e4585,mauve:#e0b0ff,aubergine:#3d1c34,chalk:#f2f0e6,carbon:#333333,bone:#e3dac9,pearl:#eae0c8,natural:#e8ddc7,wheat:#f5deb3,honey:#eb9605,cognac:#9a463d,clay:#b66a50,mushroom:#bdaea1,ash:#b2beb5,pewter:#8f9695,ink:#1b1b2f,midnight:#191970,army:#4b5320,jade:#00a86b,seafoam:#9fe2bf,berry:#7b1e3a,grape:#6f2da8'

  assign normalized = name | downcase | replace: '/', ' ' | replace: '-', ' ' | replace: '_', ' ' | strip
  assign resolved = ''

  assign candidates = normalized | replace: ' ', '' | split: '~'
  assign words = normalized | split: ' ' | reverse
  assign candidates = candidates | concat: words
  assign pairs = color_map | split: ','

  for candidate in candidates
    if resolved != ''
      break
    endif

    for pair in pairs
      assign key = pair | split: ':' | first
      if key == candidate
        assign resolved = pair | split: ':' | last
        break
      endif
    endfor
  endfor

  echo resolved
-%}
```

**Map constraints, in order of how easily they bite:**

- The map is comma-delimited and colon-separated, so **a value may contain neither `,` nor `:`**. No
  `rgb(…)`, no `linear-gradient(…)`, no multi-stop values. Hex only.
- Keys must be **single tokens with no spaces** — the whole-name candidate strips spaces, so a
  two-word entry is written `offwhite`, not `off white`.
- Keys are matched with `==`, not `contains`. Add plurals/variants explicitly (`grey` **and** `gray`).
- The `split: '~'` on line 3 of the candidate build is just "wrap a string in a 1-item array" —
  `~` is a character that cannot appear in a normalized value.

Two accuracy limits worth stating to the client up front:

- **Modifiers are dropped.** `Dark Indigo` → plain indigo.
- **Compound names may pick the wrong half.** `Cocoa Cream` → cream, not a cocoa-cream tone.

---

## Step 2 — `snippets/swatch.liquid`

Accept an optional `fallback_color` and use it as the last resort, *after* image and admin color.

```diff
   Accepts:
   - swatch: {Object} a swatch object
+  - fallback_color: {String} (optional) CSS color used when the swatch drop
+    carries no color or image — see snippets/color-from-name.liquid
```

```diff
   elsif swatch.color
     assign swatch_value = 'rgb(' | append: swatch.color.rgb | append: ')'
+  elsif fallback_color != blank
+    assign swatch_value = fallback_color
   endif
```

Nothing else changes: `swatch_value` being set is already what flips the markup from
`.swatch--unavailable` to a painted `.swatch`.

---

## Step 3 — `snippets/swatch-input.liquid`

Pure pass-through.

```diff
   - swatch: {SwatchDrop} the swatch drop
+  - fallback_color: {String} CSS color used when the swatch drop has no color/image (optional)
```

```diff
-  {% render 'swatch', swatch: swatch %}
+  {% render 'swatch', swatch: swatch, fallback_color: fallback_color %}
```

---

## Step 4 — `snippets/product-variant-options.liquid`

This is where a value stops falling through to `pill-input`. The fallback is **opt-in** via a new
`color_fallback` param so non-color options (Size, Style, Teams) are never affected.

```diff
   @param {string} [product_form_id] - Product form id passed through to child inputs.
+  @param {boolean} [color_fallback] - When true, an option value with no swatch
+    assigned in admin resolves its color from its name (see color-from-name).
```

Resolve once per value, before the existing `liquid` block:

```diff
   {%- for value in option.values -%}
+    {%- capture name_color -%}
+      {%- if color_fallback -%}{%- render 'color-from-name', name: value -%}{%- endif -%}
+    {%- endcapture -%}
+    {%- assign name_color = name_color | strip -%}
+
     {%- liquid
       if value.swatch.image
```

Insert it as the last branch of the resolution chain:

```diff
       elsif value.swatch.color
         assign swatch_value = 'rgb(' | append: value.swatch.color.rgb | append: ')'
+      elsif name_color != blank
+        assign swatch_value = name_color
       else
         assign swatch_value = null
       endif
```

And hand it to the input:

```diff
           swatch: value.swatch,
+          fallback_color: name_color,
           product_form_id: product_form_id,
```

> **Why `capture` + `strip`.** A snippet cannot return a value; `capture` around `render` is the only
> way to get one back. `strip` is defensive — a stray newline in the snippet would otherwise make
> `name_color != blank` true for an unresolved name.

---

## Step 5 — `snippets/pdp-variant-selector.liquid`

Two edits: opt in, and guard against a half-resolved option.

**5a. Opt in** — in the `{%- when 'swatch' -%}` branch:

```diff
                 {% render 'product-variant-options',
                   option: option,
                   picker_type: 'swatch',
+                  color_fallback: true,
                   product_form_id: product_form_id
                 %}
```

**5b. The all-or-nothing guard.** Without it, an option like `Black / Cocoa Cream / Studded-Chalk /
Jiuhong` renders three circles and one text chip in the same row, which looks broken. Demote the
whole option to text chips unless **every** value resolves.

Place this immediately after the `is_color_option` / `current_picker` assignment block and **before**
the `option_label` comment, closing the open `{%- liquid` first:

```liquid
          comment
            This store's option values carry no admin-assigned swatch, so the
            circles are resolved from the value names instead. All or nothing:
            if even one value can't be resolved the whole option falls back to
            text chips, rather than rendering a mixed row of circles and chips.
          endcomment
        -%}

        {%- if is_color_option and current_picker == 'swatch' -%}
          {%- liquid
            assign all_values_resolve = true
            for value in option.values
              if value.swatch.color or value.swatch.image
                continue
              endif
              capture resolved_color
                render 'color-from-name', name: value
              endcapture
              assign resolved_color = resolved_color | strip
              if resolved_color == blank
                assign all_values_resolve = false
                break
              endif
            endfor

            unless all_values_resolve
              assign current_picker = 'button'
              assign current_shape = option_shape
            endunless
          -%}
        {%- endif -%}

        {%- liquid
          comment
            Figma 41:452 labels the colour group ...
```

The `continue` matters: a value that *does* have an admin swatch must not be sent through the name
resolver, or a mixed-data option would be demoted for no reason.

> **Liquid gotcha.** `capture`/`endcapture` and `render` are legal inside a `{%- liquid -%}` tag; a
> bare `{% render %}` tag is not. Keep the guard inside one `liquid` block as written.

---

## Step 6 — `snippets/product-card.liquid`

Card swatches are an inlined loop, not the `swatch-input` chain, so they need their own edit.

```diff
                   {%- liquid
                     assign swatch_bg = null
```

becomes:

```diff
+                  {%- capture name_color -%}
+                    {%- render 'color-from-name', name: value -%}
+                  {%- endcapture -%}
                   {%- liquid
+                    assign name_color = name_color | strip
                     assign swatch_bg = null
```

```diff
                     elsif value.swatch.color
                       assign swatch_bg = 'rgb(' | append: value.swatch.color.rgb | append: ')'
+                    elsif name_color != blank
+                      assign swatch_bg = name_color
                     endif
```

Mark the misses so they don't render as an invisible hole (Golden's `.product-swatch div` sets
`background: var(--swatch-value)` with no fallback):

```diff
                   <button
                     type="button"
-                    class="product-swatch{% if value.selected %} product-swatch--active{% endif %}"
+                    class="product-swatch{% if swatch_bg == null %} product-swatch--unknown{% endif %}{% if value.selected %} product-swatch--active{% endif %}"
```

And in the `{% stylesheet %}` block, above `.product-swatch--active div`:

```css
  /* Unresolvable value name — neutral chip instead of a transparent hole. */
  .product-swatch--unknown div {
    background: #f1efec;
    box-shadow: inset 0 0 0 1px rgba(var(--color-foreground-rgb), 0.25);
  }
```

> Note the card grid has **no** all-or-nothing guard, on purpose. A card row is small and decorative;
> demoting it has no chip layout to fall back to.

---

## Step 7 — Any theme-specific snippet with an inlined swatch loop

Client themes add their own product-card variants (Silver Fox has
`snippets/pdp-complete-the-look.liquid`). Find every remaining site:

```bash
grep -rln "value.swatch" snippets blocks sections
```

Apply the Step 6 treatment to each. Watch for card CSS that defaults the custom property:

```css
background: var(--swatch-value, #111111);   /* ← paints every unresolved value solid black */
```

That default is worse than a hole — it silently lies. Add the `--unknown` class and a neutral
background as in Step 6.

---

## Step 8 — Measure coverage against the real catalog

Do this **before** promising a result. The metric that matters is *options that render as circles*,
not values resolved, because of the Step 5b guard.

```bash
python3 - <<'PY'
import json, re, urllib.request

DOMAIN = "<store-domain>"          # e.g. silverfoxsales.com
MAP    = "snippets/color-from-name.liquid"

cmap = dict(p.split(':') for p in
            re.search(r"assign color_map = '([^']+)'", open(MAP).read()).group(1).split(','))

def resolve(n):
    norm = re.sub(r'\s+', ' ', n.lower().replace('/', ' ').replace('-', ' ').replace('_', ' ')).strip()
    for c in [norm.replace(' ', '')] + list(reversed(norm.split(' '))):
        if c in cmap:
            return cmap[c]

opts, misses, page = [], {}, 1
while True:
    products = json.load(urllib.request.urlopen(
        f"https://{DOMAIN}/products.json?limit=250&page={page}"))['products']
    if not products:
        break
    for p in products:
        for o in p['options']:
            if re.search(r'colou?r', o['name'], re.I):
                opts.append(all(resolve(v) for v in o['values']))
                for v in o['values']:
                    if not resolve(v):
                        misses[v] = misses.get(v, 0) + 1
    page += 1

print(f"options rendering as circles: {sum(opts)}/{len(opts)} = {100*sum(opts)//len(opts)}%")
print("\ntop unresolved values (candidates for the map):")
for v, c in sorted(misses.items(), key=lambda kv: -kv[1])[:30]:
    print(f"  {c:>3}x  {v}")
PY
```

**Reference result (Silver Fox Sales, 500 products):** 684 distinct color values across 178 color
options → 316/684 values (46%), 715/1094 by usage (65%), **122/178 options = 68% render as circles.**
Treat ~65–70% as a realistic ceiling for an imported catalog; the residue is genuinely not colors.

Feed the printed miss list back into the map — that's how `chalk` and `carbon` got added on the
reference build.

---

## Verification

Run the theme locally and assert on computed styles, not screenshots alone.

```bash
shopify theme dev --store <store>.myshopify.com --port 9292
```

**1. A product whose values all resolve** — expect painted circles:

```bash
curl -s "http://127.0.0.1:9292/products/<handle>" -o /tmp/v.html
python3 -c "
import re; h=open('/tmp/v.html').read()
print('circles:', re.findall(r'--swatch--background: ([^;\"]*)', h))
print('pills:  ', len(re.findall(r'pill-input__label', h)))"
```

**2. A product with an unresolvable value** — expect `circles: []` and a non-zero pill count, proving
the Step 5b guard fires.

**3. Computed styles in the browser** (size, radius, and that the selected ring survived):

```js
[...document.querySelectorAll('.product-form__input--swatch .swatch')]
  .map(s => ({ bg: getComputedStyle(s).backgroundColor,
               r:  getComputedStyle(s).borderRadius,
               w:  s.getBoundingClientRect().width }))
```

Reference build returned `#000000 / #fffdd0 / #f2f0e6 / #333333`, all `28px`, all `50%`.

**4. Card swatches** — `grep -c 'class="product-swatch' page.html`. Note this returns 0 when the
theme's card settings have `show_color_variants` off, which is not a failure.

**5. Sold-out values** still draw their diagonal strike-through — the `.swatch-input__input.visually-disabled`
rules key off the input, not the swatch color, so the fallback doesn't disturb them.

---

## Rollback

Delete `snippets/color-from-name.liquid` and revert the six edits. Every change is additive — an
`elsif` branch, a param, one CSS rule — so reverting restores the previous text-chip behavior exactly.
Safe to remove the day the client assigns real swatches in admin.

---

## Reference commit

`silver-fox-sales` `9abce7a` — *feat(swatches): resolve colors from option value names*
(7 files, +135/−3).
