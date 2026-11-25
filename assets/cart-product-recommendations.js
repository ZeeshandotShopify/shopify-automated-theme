/**
 * Cart Drawer Product Recommendations Component
 * Handles product recommendations in the cart drawer
 */
class CartProductRecommendations extends HTMLElement {
  constructor() {
    super();
    this.abortController = null;
    this.swiperInstance = null;
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

    // Setup cart drawer observer
    this.setupDrawerObserver();

    // Check if recommendations already rendered server-side
    const existingContainer = this.querySelector(`[class*="${target}"]`);

    if (existingContainer && existingContainer.innerHTML.trim().length > 0) {
      console.log("Server-rendered cart recommendations found, initializing Swiper");
      this.hasContent = true;
      this.initializeSwiper();
      this.updateActiveState();
      return;
    }

    if (!productId) {
      console.error("Product ID is required for cart recommendations");
      return;
    }

    this.fetchRecommendations(productId, sectionId, target, limit, intent);
  }

  disconnectedCallback() {
    if (this.abortController) {
      this.abortController.abort();
    }

    if (this.swiperInstance) {
      this.swiperInstance.destroy(true, true);
    }

    if (this.observer) {
      this.observer.disconnect();
    }
  }

  /**
   * Sets up MutationObserver to watch cart drawer state changes
   */
  setupDrawerObserver() {
    this.cartDrawer = document.querySelector(".cart-drawer-sheet-content");

    if (!this.cartDrawer) {
      console.warn("Cart drawer not found");
      return;
    }

    // Create observer to watch for data-state attribute changes
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.attributeName === "data-state") {
          this.updateActiveState();
        }
      });
    });

    // Start observing the cart drawer
    this.observer.observe(this.cartDrawer, {
      attributes: true,
      attributeFilter: ["data-state"],
    });

    // Check initial state immediately
    this.updateActiveState();
  }

  /**
   * Updates the active class based on drawer state and content availability
   */
  updateActiveState() {
    if (!this.cartDrawer) {
      return;
    }

    const isDrawerOpen = this.cartDrawer.getAttribute("data-state") === "open";

    // Only add active class if drawer is open AND we have content to show
    if (isDrawerOpen && this.hasContent) {
      this.classList.add("active");
    } else {
      this.classList.remove("active");
    }
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
        this.initializeSwiper();
        this.updateActiveState();
      } else {
        console.log("No cart recommendations found for product:", productId);
        this.hasContent = false;
        this.style.display = "none";
        this.updateActiveState();

        this.dispatchEvent(
          new CustomEvent("cart-recommendations:empty", {
            bubbles: true,
            detail: { productId },
          }),
        );
      }
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }

      console.error("Error fetching cart recommendations:", error);
      this.hasContent = false;
      this.style.display = "none";
      this.updateActiveState();

      this.dispatchEvent(
        new CustomEvent("cart-recommendations:error", {
          bubbles: true,
          detail: { error, productId },
        }),
      );
    }
  }

  initializeSwiper() {
    requestAnimationFrame(() => {
      const swiperEl = this.querySelector(".cart-product-recommendations-swiper");
      const scrollbar = this.querySelector(".swiper-scrollbar");

      if (!swiperEl) {
        console.warn("Cart swiper element not found");
        return;
      }

      if (this.swiperInstance) {
        this.swiperInstance.destroy(true, true);
      }

      this.swiperInstance = new Swiper(swiperEl, {
        loop: false,
        grabCursor: true,
        slidesPerView: "auto",
        spaceBetween: 32,
        freeMode: true,
        scrollbar: {
          el: scrollbar,
          draggable: true,
          hide: false,
        },
      });
    });
  }
}

if (!customElements.get("cart-product-recommendations")) {
  customElements.define("cart-product-recommendations", CartProductRecommendations);
}
