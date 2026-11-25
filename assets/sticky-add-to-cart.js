class StickyAddToCart extends HTMLElement {
  constructor() {
    super();
    this.buttonObserver = null;
    this.footerObserver = null;
    this.buttonHidden = false;
    this.footerVisible = false;
    this.handleVariantUpdate = this.handleVariantUpdate.bind(this);
  }

  connectedCallback() {
    // Move element to body to escape section stacking context
    document.body.appendChild(this);

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.init());
    } else {
      this.init();
    }

    // Keep the sticky button's availability in sync with the selected variant.
    document.addEventListener("variant:updated", this.handleVariantUpdate);
  }

  init() {
    const originalButton = document.querySelector('.pdp-atc button[type="submit"]');
    const footer = document.querySelector("#shopify-section-group-footer");

    if (!originalButton) {
      return;
    }

    // Watch original ATC button
    this.buttonObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          this.buttonHidden = !entry.isIntersecting;
          this.updateVisibility();
        });
      },
      {
        root: null,
        rootMargin: "0px",
        threshold: 0,
      },
    );
    this.buttonObserver.observe(originalButton);

    // Watch footer — hide sticky bar when footer is visible
    if (footer) {
      this.footerObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            this.footerVisible = entry.isIntersecting;
            this.updateVisibility();
          });
        },
        {
          root: null,
          rootMargin: "0px",
          threshold: 0,
        },
      );
      this.footerObserver.observe(footer);
    }
  }

  updateVisibility() {
    this.classList.toggle("visible", this.buttonHidden && !this.footerVisible);
  }

  // Sync the sticky Add-to-Cart button's disabled state + label with the newly
  // selected variant. Driven by the `variant:updated` event that
  // variant-selector.js dispatches, mirroring how the main button updates.
  handleVariantUpdate(event) {
    const variant = event.detail?.variant;
    const button = this.querySelector('button[type="submit"]');
    if (!variant || !button) return;

    button.disabled = !variant.available;

    const textEl = button.querySelector(".atc-button__text");
    if (textEl) {
      textEl.textContent = variant.available
        ? button.dataset.addLabel || textEl.textContent
        : button.dataset.soldOutLabel || textEl.textContent;
    }
  }

  disconnectedCallback() {
    if (this.buttonObserver) {
      this.buttonObserver.disconnect();
    }
    if (this.footerObserver) {
      this.footerObserver.disconnect();
    }
    document.removeEventListener("variant:updated", this.handleVariantUpdate);
  }
}

customElements.define("sticky-add-to-cart", StickyAddToCart);
