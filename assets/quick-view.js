/**
 * ============================================================================
 * QUICK VIEW
 * ============================================================================
 *
 * <quick-view-trigger> sits in each product card behind the card's
 * `show_quick_view` setting. Clicking it fetches sections/quick-view.liquid
 * through the Section Rendering API and shows it in ONE shell appended to
 * document.body.
 *
 * Why a custom element and one shared shell:
 *  - assets/filters.js replaces `#ProductList.innerHTML` on every filter, sort
 *    and page change. A delegated document listener would survive that, but so
 *    does a custom element — and the element re-upgrades on insertion, so the
 *    trigger needs no re-binding step. The shell lives in document.body, well
 *    outside the node filters.js replaces.
 *  - Rendering the panel inline in every card would put one full product modal
 *    per grid item into the page. The fetch trades a round trip on first open
 *    for a grid that stays light.
 *
 * The shell borrows the theme's overlay conventions (`data-state`,
 * `body[data-scroll-locked]`, the `dialog-open` mutual-close event) without
 * reusing <sheet-menu>/<dialog-menu>, both of which portal their content into
 * document.body at init.
 *
 * THEME MARKUP ONLY. `?section_id=` cannot deliver a Shopify app block — `@app`
 * blocks do not render in statically-reachable sections — so a panel that must
 * carry a subscription or bundle widget needs an alternate product template and
 * a full-page fetch instead. See
 * docs/custom-features/recharge-widget-quick-view-quick-add/README.md.
 *
 * SEQUENCING (desktop). The panel is a side drawer with the gallery parked
 * behind it; the two move one after the other, never together:
 *
 *   open    `data-state="open"`   drawer slides in
 *           `data-gallery="open"` gallery slides out from under it
 *   close   drop `data-gallery`   gallery slides back under the drawer
 *           `data-state="closed"` drawer slides out
 *
 * The delay is held here rather than in a CSS `transition-delay` because the
 * two directions want opposite orders, and a delay declared on the element
 * applies to both. Durations are read back from the stylesheet's custom
 * properties so the two files cannot drift.
 */

const QV_DESKTOP_QUERY = "(width >= 64rem)";

/** Beat between one panel finishing and the next starting. */
const QV_STAGGER = 60;

/** Fallbacks for the durations declared in assets/quick-view.css. */
const QV_FALLBACK = { drawer: 300, gallery: 300 };

class QuickView {
  constructor() {
    this.shell = null;
    this.panel = null;
    this.scrim = null;
    this.isOpen = false;
    this.lastTrigger = null;
    this.variants = [];
    this.currentVariant = null;
    this.requestToken = 0;
    // Guards the staged open/close timers: every stage checks that it still
    // belongs to the sequence that scheduled it, so re-opening mid-close never
    // gets torn down by the close it interrupted.
    this.sequence = 0;
    this.timers = [];

    this.onKeydown = this.onKeydown.bind(this);
    this.onPanelChange = this.onPanelChange.bind(this);
    this.onPanelClick = this.onPanelClick.bind(this);
    this.onCartRerender = this.onCartRerender.bind(this);
  }

  /** Build the shell once, lazily, on first open. */
  ensureShell() {
    if (this.shell) return;

    this.shell = document.createElement("div");
    this.shell.className = "qv-shell";
    this.shell.setAttribute("data-state", "closed");
    this.shell.hidden = true;

    this.scrim = document.createElement("div");
    this.scrim.className = "qv-scrim";
    this.scrim.addEventListener("click", () => this.close());

    this.panel = document.createElement("div");
    this.panel.className = "qv-panel";
    this.panel.setAttribute("role", "dialog");
    this.panel.setAttribute("aria-modal", "true");
    this.panel.setAttribute("tabindex", "-1");

    this.shell.append(this.scrim, this.panel);
    document.body.appendChild(this.shell);

    this.panel.addEventListener("change", this.onPanelChange);
    this.panel.addEventListener("click", this.onPanelClick);
  }

  /* ------------------------------------------------------------- transitions */

  get isDesktop() {
    return window.matchMedia(QV_DESKTOP_QUERY).matches;
  }

  get prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /** Reads a duration custom property off the shell, in milliseconds. */
  duration(name, fallback) {
    if (this.prefersReducedMotion) return 0;
    const raw = getComputedStyle(this.shell).getPropertyValue(`--qv-${name}-duration`).trim();
    if (raw.endsWith("ms")) return parseFloat(raw) || fallback;
    if (raw.endsWith("s")) return (parseFloat(raw) || fallback / 1000) * 1000;
    return fallback;
  }

  after(delay, callback) {
    const token = this.sequence;
    this.timers.push(
      window.setTimeout(() => {
        if (this.sequence === token) callback();
      }, delay),
    );
  }

  clearTimers() {
    this.timers.forEach(window.clearTimeout);
    this.timers = [];
  }

  /* -------------------------------------------------------------------- open */

  async open(url, trigger, loadingLabel) {
    this.ensureShell();
    this.clearTimers();
    this.sequence++;
    this.lastTrigger = trigger || null;

    // Close any open sheet (cart drawer, filters, mobile menu) first — the same
    // event <dialog-menu> uses, which <sheet-menu> already listens for.
    document.dispatchEvent(new CustomEvent("dialog-open", { bubbles: true }));

    const loading = document.createElement("div");
    loading.className = "qv-panel__loading";
    loading.textContent = loadingLabel || "";
    this.panel.replaceChildren(loading);
    this.shell.removeAttribute("data-gallery");
    this.shell.hidden = false;
    // Flush styles so the transition has a start value to run from. A
    // requestAnimationFrame would do the same on a visible tab but never fires
    // on a backgrounded one, which would leave the panel stuck closed.
    void this.shell.offsetWidth;
    this.shell.setAttribute("data-state", "open");
    this.isOpen = true;
    this.openedAt = performance.now();

    document.body.setAttribute("data-scroll-locked", "");
    document.addEventListener("keydown", this.onKeydown);
    document.documentElement.addEventListener("cart:rerender", this.onCartRerender);

    const token = ++this.requestToken;
    const separator = url.includes("?") ? "&" : "?";

    try {
      const response = await fetch(`${url}${separator}section_id=quick-view`);
      if (!response.ok) throw new Error(`Quick view request failed: ${response.status}`);
      const text = await response.text();

      // Another trigger was clicked while this was in flight — drop the stale one.
      if (token !== this.requestToken || !this.isOpen) return;

      const doc = new DOMParser().parseFromString(text, "text/html");
      const content = doc.querySelector("quick-view-panel");
      if (!content) throw new Error("Quick view section returned no panel");

      this.panel.replaceChildren(document.importNode(content, true));
      this.afterRender();
    } catch (error) {
      console.error(error);
      if (token === this.requestToken) {
        // Nothing useful to show — send the shopper to the product page instead.
        window.location.href = url;
      }
    }
  }

  afterRender() {
    this.root = this.panel.querySelector("quick-view-panel");
    if (!this.root) return;

    const data = this.root.querySelector("[data-qv-variants]");
    this.variants = data ? JSON.parse(data.textContent) : [];

    const title = this.root.querySelector(".qv__title");
    if (title) {
      this.panel.setAttribute("aria-label", title.textContent.trim());
    }

    this.readSelection();
    this.setupFocusTrap();
    this.revealGallery();
  }

  /**
   * Second stage of the open: the gallery leaves its hiding place under the
   * drawer once the drawer itself has arrived. A slow fetch has already spent
   * part of that time, so only the remainder is waited out — the gallery never
   * moves first, and never stalls behind a drawer that settled long ago.
   */
  revealGallery() {
    const show = () => this.shell.setAttribute("data-gallery", "open");

    // The attribute is the "content is out" state, not a desktop-only flag:
    // the bottom sheet has no gallery slide, but setting it anyway means a
    // phone rotated to desktop width finds the gallery already revealed
    // rather than stranded under the drawer with nothing left to trigger it.
    if (this.prefersReducedMotion || !this.isDesktop) {
      show();
      return;
    }

    // Establish the start value for the transition on the freshly inserted
    // element before the attribute that changes it lands.
    void this.panel.offsetWidth;

    const elapsed = performance.now() - this.openedAt;
    const drawer = this.duration("drawer", QV_FALLBACK.drawer);
    this.after(Math.max(QV_STAGGER, drawer + QV_STAGGER - elapsed), show);
  }

  /* ---------------------------------------------------------------- events */

  onPanelClick(event) {
    if (event.target.closest("[data-qv-close]")) {
      event.preventDefault();
      this.close();
      return;
    }

    const minus = event.target.closest("[data-qv-quantity-minus]");
    const plus = event.target.closest("[data-qv-quantity-plus]");
    if (minus || plus) {
      event.preventDefault();
      this.stepQuantity(plus ? 1 : -1);
    }
  }

  onPanelChange(event) {
    if (!event.target.matches('input[type="radio"], select')) return;
    this.readSelection();
  }

  onKeydown(event) {
    if (event.key === "Escape" && this.isOpen) {
      event.stopPropagation();
      this.close();
    }
  }

  /** cart.js fires this after a successful add; the cart drawer is about to
   *  open, so the quick view steps out of its way. */
  onCartRerender() {
    if (this.isOpen) this.close();
  }

  /* ------------------------------------------------------------- selection */

  readSelection() {
    if (!this.root) return;

    const groups = this.root.querySelectorAll("[data-qv-option]");
    const selected = Array.from(groups, (group) => {
      const radio = group.querySelector('input[type="radio"]:checked');
      if (radio) return radio.value;
      const select = group.querySelector("select");
      return select ? select.value : null;
    }).filter((value) => value !== null);

    // A product with no options has exactly one variant.
    this.currentVariant = groups.length
      ? this.variants.find(
          (variant) =>
            variant.options.length === selected.length &&
            variant.options.every((option, index) => option === selected[index]),
        )
      : this.variants[0];

    this.renderSelection(groups);
  }

  renderSelection(groups) {
    // Figma 2383:150 puts the chosen value beside the option name.
    groups.forEach((group) => {
      const label = group.querySelector("[data-qv-option-value]");
      if (!label) return;
      const checked = group.querySelector('input[type="radio"]:checked');
      const select = group.querySelector("select");
      label.textContent = checked ? checked.value : select ? select.value : "";
    });

    if (!this.currentVariant) return;

    const idInput = this.root.querySelector("[data-qv-variant-id]");
    if (idInput) idInput.value = this.currentVariant.id;

    const price = this.root.querySelector("[data-qv-price]");
    if (price) {
      price.innerHTML = this.currentVariant.compare_at_price
        ? `<span class="qv__price-current">${this.currentVariant.price}</span><s class="qv__price-compare">${this.currentVariant.compare_at_price}</s>`
        : `<span class="qv__price-current">${this.currentVariant.price}</span>`;
    }

    const button = this.root.querySelector('add-to-cart button[type="submit"]');
    if (button) {
      button.disabled = !this.currentVariant.available;
      const text = button.querySelector(".atc-button__text");
      if (text) {
        text.textContent = this.currentVariant.available
          ? button.dataset.addLabel || text.textContent
          : button.dataset.soldOutLabel || text.textContent;
      }
    }

    if (this.currentVariant.media_id) {
      const target = this.root.querySelector(`[data-qv-media-id="${this.currentVariant.media_id}"]`);
      const media = this.root.querySelector(".qv__media");
      if (target && media) media.prepend(target);
    }
  }

  stepQuantity(delta) {
    const input = this.root?.querySelector(".qv__quantity-input");
    if (!input) return;
    const next = Math.max(1, (parseInt(input.value, 10) || 1) + delta);
    input.value = next;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /* ----------------------------------------------------------------- focus */

  setupFocusTrap() {
    const focusable = this.panel.querySelectorAll(
      'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );

    const close = this.panel.querySelector("[data-qv-close]");
    (close || focusable[0] || this.panel).focus();

    this.first = focusable[0];
    this.last = focusable[focusable.length - 1];

    this.handleTab = (event) => {
      if (event.key !== "Tab" || !this.first) return;
      if (event.shiftKey && document.activeElement === this.first) {
        event.preventDefault();
        this.last.focus();
      } else if (!event.shiftKey && document.activeElement === this.last) {
        event.preventDefault();
        this.first.focus();
      }
    };

    document.addEventListener("keydown", this.handleTab);
  }

  /* ----------------------------------------------------------------- close */

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.requestToken++;
    this.clearTimers();
    this.sequence++;

    document.body.removeAttribute("data-scroll-locked");
    document.removeEventListener("keydown", this.onKeydown);
    document.documentElement.removeEventListener("cart:rerender", this.onCartRerender);
    if (this.handleTab) document.removeEventListener("keydown", this.handleTab);

    const drawer = this.duration("drawer", QV_FALLBACK.drawer);

    // Hide and empty once the exit has run, so <add-to-cart> and the option
    // inputs are disconnected rather than left bound to a hidden tree.
    const finish = () => {
      if (this.isOpen) return;
      this.shell.hidden = true;
      this.shell.removeAttribute("data-gallery");
      this.panel.replaceChildren();
      this.root = null;
    };

    const closeDrawer = () => {
      this.shell.setAttribute("data-state", "closed");
      if (drawer) this.after(drawer, finish);
      else finish();
    };

    // The gallery goes back under the drawer before the drawer leaves — the
    // open sequence, run backwards. Nothing to stage when it never came out.
    const gallery = this.isDesktop ? this.duration("gallery", QV_FALLBACK.gallery) : 0;
    if (gallery && this.shell.hasAttribute("data-gallery")) {
      this.shell.removeAttribute("data-gallery");
      this.after(gallery, closeDrawer);
    } else {
      this.shell.removeAttribute("data-gallery");
      closeDrawer();
    }

    // Return focus to the card control that opened it.
    if (this.lastTrigger && document.contains(this.lastTrigger)) {
      this.lastTrigger.focus();
    }
    this.lastTrigger = null;
  }
}

const quickView = new QuickView();

class QuickViewTrigger extends HTMLElement {
  connectedCallback() {
    this.button = this.querySelector("button");
    if (!this.button) return;
    this.onClick = this.onClick.bind(this);
    this.button.addEventListener("click", this.onClick);
  }

  disconnectedCallback() {
    if (this.button) this.button.removeEventListener("click", this.onClick);
  }

  onClick(event) {
    event.preventDefault();
    const url = this.dataset.productUrl;
    if (!url) return;
    quickView.open(url, this.button, this.dataset.loadingLabel);
  }
}

customElements.define("quick-view-trigger", QuickViewTrigger);

if (!customElements.get("quick-view-panel")) {
  customElements.define("quick-view-panel", class extends HTMLElement {});
}
