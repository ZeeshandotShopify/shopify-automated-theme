class ProductHotspots extends HTMLElement {
  constructor() {
    super();
    this.container = null;
    this.hotspots = [];
    this.resizeObserver = null;
    this.handleResize = this.handleResize.bind(this);
  }

  connectedCallback() {
    this.container = this.dataset.target;
    this.hotspots = Array.from(this.querySelectorAll(".hotspot-point"));

    if (this.container && this.hotspots.length > 0) {
      this.initializeHotspots();
      this.setupResizeObserver();
    }
  }

  disconnectedCallback() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    window.removeEventListener("resize", this.handleResize);
  }

  initializeHotspots() {
    // Initial positioning check
    this.adjustCardPositions();
  }

  setupResizeObserver() {
    // Use ResizeObserver for better performance
    if ("ResizeObserver" in window) {
      this.resizeObserver = new ResizeObserver(() => {
        this.adjustCardPositions();
      });
      this.resizeObserver.observe(this.container);
    } else {
      // Fallback to window resize event
      window.addEventListener("resize", this.handleResize);
    }
  }

  handleResize() {
    // Debounce for performance
    clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => {
      this.adjustCardPositions();
    }, 150);
  }

  adjustCardPositions() {
    if (!this.container) return;

    const containerRect = this.container.getBoundingClientRect();

    this.hotspots.forEach((hotspot) => {
      const card = hotspot.querySelector(".hotspot-card");
      if (!card) return;

      const hotspotRect = hotspot.getBoundingClientRect();
      const cardWidth = card.offsetWidth;
      const margin = 20;

      // Determine optimal position based on available space
      let position = hotspot.getAttribute("data-position-x");

      // Check if current position would cause overflow
      if (position === "left") {
        if (hotspotRect.right + cardWidth + margin > containerRect.right) {
          position = "right";
        }
      } else if (position === "right") {
        if (hotspotRect.left - cardWidth - margin < containerRect.left) {
          position = "left";
        }
      }

      // For center position, check if we have enough space below
      if (position === "center") {
        const spaceRight = containerRect.right - hotspotRect.left;
        const spaceLeft = hotspotRect.left - containerRect.left;

        // If not enough horizontal space, position above/below
        if (spaceRight < cardWidth / 2 || spaceLeft < cardWidth / 2) {
          position = spaceRight > spaceLeft ? "left" : "right";
        }
      }

      hotspot.setAttribute("data-position-x", position);
    });
  }
}

if ("customElements" in window) {
  customElements.define("product-hotspots", ProductHotspots);
}
