/**
 * Image Comparison Slider Web Component
 * A light DOM web component for before/after image comparisons
 */
class ImageComparisonSlider extends HTMLElement {
  constructor() {
    super();

    // State
    this.position = 50;
    this.isDragging = false;
    this.reducedMotion = false;

    // Bound methods for event listeners
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleShopifyEvents = this.handleShopifyEvents.bind(this);
  }

  connectedCallback() {
    // Check for reduced motion preference
    this.reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // Cache DOM elements
    this.handle = this.querySelector(".comparison-slider__handle");
    this.afterContainer = this.querySelector(".comparison-slider__after");

    if (!this.handle) {
      console.warn("ImageComparisonSlider: Handle element not found");
      return;
    }

    // Initialize position
    this.updatePosition(this.position);

    // Bind event listeners
    this.bindEvents();

    // Listen for Shopify theme editor events
    this.bindShopifyEvents();
  }

  disconnectedCallback() {
    this.unbindEvents();
    this.unbindShopifyEvents();
  }

  bindEvents() {
    // Pointer events for unified mouse/touch handling
    this.handle.addEventListener("pointerdown", this.handlePointerDown);

    // Keyboard navigation
    this.handle.addEventListener("keydown", this.handleKeyDown);

    // Prevent default drag behavior on images
    this.querySelectorAll("img").forEach((img) => {
      img.addEventListener("dragstart", (e) => e.preventDefault());
    });
  }

  unbindEvents() {
    if (this.handle) {
      this.handle.removeEventListener("pointerdown", this.handlePointerDown);
      this.handle.removeEventListener("keydown", this.handleKeyDown);
    }

    // Clean up any lingering move/up listeners
    document.removeEventListener("pointermove", this.handlePointerMove);
    document.removeEventListener("pointerup", this.handlePointerUp);
  }

  bindShopifyEvents() {
    document.addEventListener("shopify:block:select", this.handleShopifyEvents);
    document.addEventListener("shopify:section:load", this.handleShopifyEvents);
    document.addEventListener(
      "shopify:section:reorder",
      this.handleShopifyEvents,
    );
  }

  unbindShopifyEvents() {
    document.removeEventListener(
      "shopify:block:select",
      this.handleShopifyEvents,
    );
    document.removeEventListener(
      "shopify:section:load",
      this.handleShopifyEvents,
    );
    document.removeEventListener(
      "shopify:section:reorder",
      this.handleShopifyEvents,
    );
  }

  handleShopifyEvents(event) {
    // Check if this event relates to our component
    const targetId = event.detail?.blockId || event.detail?.sectionId;
    if (targetId && this.id && this.id.includes(targetId)) {
      // Reinitialize the component
      this.handle = this.querySelector(".comparison-slider__handle");
      this.afterContainer = this.querySelector(".comparison-slider__after");
      this.position = 50;
      this.updatePosition(this.position);
    }
  }

  handlePointerDown(event) {
    // Only handle primary button (left click / touch)
    if (event.button !== 0) return;

    event.preventDefault();

    this.isDragging = true;
    this.setAttribute("data-dragging", "true");

    // Capture pointer for reliable tracking
    this.handle.setPointerCapture(event.pointerId);

    // Add move and up listeners
    document.addEventListener("pointermove", this.handlePointerMove);
    document.addEventListener("pointerup", this.handlePointerUp);
  }

  handlePointerMove(event) {
    if (!this.isDragging) return;

    event.preventDefault();

    // Calculate position relative to container
    const rect = this.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));

    this.updatePosition(percent);
  }

  handlePointerUp(event) {
    if (!this.isDragging) return;

    this.isDragging = false;
    this.removeAttribute("data-dragging");

    // Release pointer capture
    if (this.handle.hasPointerCapture(event.pointerId)) {
      this.handle.releasePointerCapture(event.pointerId);
    }

    // Remove move and up listeners
    document.removeEventListener("pointermove", this.handlePointerMove);
    document.removeEventListener("pointerup", this.handlePointerUp);
  }

  handleKeyDown(event) {
    const step = event.shiftKey ? 10 : 2; // Larger steps with shift key

    switch (event.key) {
      case "ArrowLeft":
      case "ArrowDown":
        event.preventDefault();
        this.updatePosition(Math.max(0, this.position - step));
        break;
      case "ArrowRight":
      case "ArrowUp":
        event.preventDefault();
        this.updatePosition(Math.min(100, this.position + step));
        break;
      case "Home":
        event.preventDefault();
        this.updatePosition(0);
        break;
      case "End":
        event.preventDefault();
        this.updatePosition(100);
        break;
    }
  }

  updatePosition(percent) {
    this.position = percent;

    // Update CSS custom property for smooth rendering
    this.style.setProperty("--slider-position", `${percent}%`);

    // Update ARIA value for accessibility
    if (this.handle) {
      this.handle.setAttribute("aria-valuenow", Math.round(percent));
    }
  }
}

// Register the custom element
if (!customElements.get("image-comparison-slider")) {
  customElements.define("image-comparison-slider", ImageComparisonSlider);
}
