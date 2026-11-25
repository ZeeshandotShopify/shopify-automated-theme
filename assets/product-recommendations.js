/**
 * Product Recommendations Component
 * Handles product recommendations on the main product page
 */
class ProductRecommendations extends HTMLElement {
  constructor() {
    super();
    this.abortController = null;
    this.swiperInstance = null;
  }

  connectedCallback() {
    const productId = this.dataset.productId;
    const sectionId = this.dataset.sectionId;
    const target = this.dataset.target;
    const limit = this.dataset.limit || 4;
    const intent = this.dataset.intent || "related";

    // Check if recommendations already rendered server-side
    const existingContainer = this.querySelector(`[class*="${target}"]`);

    if (existingContainer && existingContainer.innerHTML.trim().length > 0) {
      console.log("Server-rendered recommendations found, initializing Swiper");
      this.initializeSwiper(sectionId);
      return;
    }

    if (!productId) {
      console.error("Product ID is required for recommendations");
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
        this.initializeSwiper(sectionId);
      } else {
        console.log("No recommendations found for product:", productId);
        this.style.display = "none";

        this.dispatchEvent(
          new CustomEvent("recommendations:empty", {
            bubbles: true,
            detail: { productId },
          }),
        );
      }
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }

      console.error("Error fetching product recommendations:", error);
      this.style.display = "none";

      this.dispatchEvent(
        new CustomEvent("recommendations:error", {
          bubbles: true,
          detail: { error, productId },
        }),
      );
    }
  }

  initializeSwiper(sectionId) {
    requestAnimationFrame(() => {
      const swiperEl = this.querySelector(`#swiper-${sectionId}`);
      const prevButton = this.querySelector(".carousel-button-prev");
      const nextButton = this.querySelector(".carousel-button-next");
      const pagination = this.querySelector(".carousel-progressbar");

      if (!swiperEl) {
        console.warn("Swiper element not found");
        return;
      }

      if (this.swiperInstance) {
        this.swiperInstance.destroy(true, true);
      }

      this.swiperInstance = new Swiper(swiperEl, {
        slidesPerView: 1.3,
        spaceBetween: 16,
        navigation: {
          prevEl: prevButton,
          nextEl: nextButton,
        },
        pagination: {
          el: pagination,
          type: "progressbar",
        },
        breakpoints: {
          768: {
            slidesPerView: 2.3,
          },
          1024: {
            slidesPerView: 4,
            spaceBetween: 32,
          },
        },
      });
    });
  }
}

if (!customElements.get("product-recommendations")) {
  customElements.define("product-recommendations", ProductRecommendations);
}
