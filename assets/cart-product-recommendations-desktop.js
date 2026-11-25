/**
 * The cart drawer's desktop recommendation rail.
 *
 * SEQUENCING. The rail is parked behind the drawer at its left edge and walks
 * out from under it, so the two must never move at once:
 *
 *   opening   drawer slides in   → rail slides out from behind it
 *   closing   rail tucks back    → drawer slides away
 *
 * Both durations are read back from the elements' own computed transitions
 * rather than restated here, and the close half is arranged by putting a
 * `data-close-delay` of exactly one rail-length on the drawer content, which
 * <sheet-menu> honours — so the CSS stays the single source of truth.
 */

/** Beat between one panel finishing and the next starting. */
const CART_RAIL_STAGGER = 60;

/** Fallbacks, used only if a computed duration cannot be read. */
const CART_RAIL_FALLBACK = { drawer: 300, rail: 500 };

/**
 * First duration of a computed `transition-duration` list, in milliseconds.
 *
 * A genuine `0s` — which is what `transition: none` under reduced motion
 * reports — has to come back as 0, not as the fallback, or the drawer would
 * hold its exit for a beat that never happens.
 */
function firstDurationMs(element, fallback) {
  const raw = getComputedStyle(element).transitionDuration.split(",")[0].trim();
  const value = parseFloat(raw);
  if (!Number.isFinite(value)) return fallback;
  return raw.endsWith("ms") ? value : value * 1000;
}

class CartProductRecommendationsDesktop extends HTMLElement {
  constructor() {
    super();
    this.abortController = null;
    this.observer = null;
    this.cartDrawer = null;
    this.hasContent = false;
  }

  connectedCallback() {
    const productId = this.dataset.productId;
    const sectionId = this.dataset.sectionId;
    const target = this.dataset.target;
    const limit = this.dataset.limit || 4;
    const intent = this.dataset.intent || "related";

    this.setupDrawerObserver();

    const existingContainer = target ? this.querySelector(`[class*="${target}"]`) : null;

    if (existingContainer && existingContainer.innerHTML.trim().length > 0) {
      this.hasContent = true;
      this.updateActiveState();
      return;
    }

    if (!productId || !sectionId || !target) {
      this.hasContent = false;
      this.style.display = "none";
      this.updateActiveState();
      return;
    }

    this.fetchRecommendations(productId, sectionId, target, limit, intent);
  }

  disconnectedCallback() {
    if (this.abortController) {
      this.abortController.abort();
    }

    if (this.observer) {
      this.observer.disconnect();
    }

    window.clearTimeout(this.revealTimer);
    this.syncCloseDelay(false);
  }

  setupDrawerObserver() {
    this.cartDrawer = document.querySelector(".cart-drawer-sheet-content");

    if (!this.cartDrawer) {
      return;
    }

    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          (mutation.attributeName === "data-state" || mutation.attributeName === "data-closing")
        ) {
          this.updateActiveState();
        }
      });
    });

    this.observer.observe(this.cartDrawer, {
      attributes: true,
      attributeFilter: ["data-state", "data-closing"],
    });

    this.updateActiveState();
  }

  /** Milliseconds the rail itself takes to travel. */
  get railDuration() {
    return firstDurationMs(this, CART_RAIL_FALLBACK.rail);
  }

  /**
   * Hands the sheet the beat it should hold before leaving — one rail-length,
   * so the rail is back under the drawer before the drawer moves. Cleared
   * whenever the rail is not actually in play (no recommendations came back,
   * or the breakpoint has hidden it), which returns the drawer to closing the
   * instant it is asked to.
   */
  syncCloseDelay(inPlay) {
    if (!this.cartDrawer) return;

    if (inPlay) {
      this.cartDrawer.dataset.closeDelay = String(this.railDuration);
    } else {
      delete this.cartDrawer.dataset.closeDelay;
    }
  }

  updateActiveState() {
    if (!this.cartDrawer) {
      return;
    }

    window.clearTimeout(this.revealTimer);

    // Below 64rem the rail is display:none and the in-flow carousel is used
    // instead, so nothing should be staged and the drawer closes immediately.
    const visible = this.hasContent && getComputedStyle(this).display !== "none";
    this.syncCloseDelay(visible);

    // `data-closing` is the sheet telling us it is about to leave: retract now,
    // and it will wait for us.
    const isDrawerOpen =
      this.cartDrawer.getAttribute("data-state") === "open" && !this.cartDrawer.hasAttribute("data-closing");

    if (!isDrawerOpen || !visible) {
      this.classList.remove("active");
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.classList.add("active");
      return;
    }

    // The drawer goes first; the rail waits out its slide plus a beat.
    const wait = firstDurationMs(this.cartDrawer, CART_RAIL_FALLBACK.drawer) + CART_RAIL_STAGGER;
    this.revealTimer = window.setTimeout(() => this.classList.add("active"), wait);
  }

  async fetchRecommendations(productId, sectionId, target, limit, intent) {
    this.abortController = new AbortController();

    try {
      const url = `${window.Shopify.routes.root}recommendations/products?product_id=${productId}&limit=${limit}&section_id=${sectionId}&intent=${intent}`;

      const response = await fetch(url, {
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const text = await response.text();
      const html = new DOMParser().parseFromString(text, "text/html");

      const recommendations = html.querySelector(`.${target}`);

      if (recommendations && recommendations.innerHTML.trim().length > 0) {
        this.innerHTML = recommendations.innerHTML;
        this.hasContent = true;
        this.style.display = "";
        this.updateActiveState();
      } else {
        this.hasContent = false;
        this.style.display = "none";
        this.updateActiveState();

        this.dispatchEvent(
          new CustomEvent("cart-recommendations-desktop:empty", {
            bubbles: true,
            detail: { productId },
          }),
        );
      }
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }

      this.hasContent = false;
      this.style.display = "none";
      this.updateActiveState();

      this.dispatchEvent(
        new CustomEvent("cart-recommendations-desktop:error", {
          bubbles: true,
          detail: { error, productId },
        }),
      );
    }
  }
}

if (!customElements.get("cart-product-recommendations-desktop")) {
  customElements.define("cart-product-recommendations-desktop", CartProductRecommendationsDesktop);
}
