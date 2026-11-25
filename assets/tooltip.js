class CustomTooltip extends HTMLElement {
  constructor() {
    super();

    this.tooltipEl = null;
    this.isVisible = false;
    this.showTooltip = this.showTooltip.bind(this);
    this.hideTooltip = this.hideTooltip.bind(this);
    this.toggleTooltip = this.toggleTooltip.bind(this);
  }

  connectedCallback() {
    const fullTitle = this.dataset.fullTitle;
    const maxLength = parseInt(this.dataset.maxLength, 10) || 25;

    // Check if tooltip is needed
    if (!fullTitle || fullTitle.length <= maxLength) {
      return;
    }

    // Add event listeners for tooltip behavior
    this.addEventListener("mouseenter", this.showTooltip);
    this.addEventListener("mouseleave", this.hideTooltip);
    this.addEventListener("click", this.toggleTooltip);

    // Add cursor pointer to indicate interactivity
    this.style.cursor = "pointer";
  }

  disconnectedCallback() {
    this.removeEventListener("mouseenter", this.showTooltip);
    this.removeEventListener("mouseleave", this.hideTooltip);
    this.removeEventListener("click", this.toggleTooltip);
    this.hideTooltip();
  }

  showTooltip(event) {
    // Don't show if already visible
    if (this.isVisible) {
      return;
    }

    // Always create a fresh tooltip
    if (this.tooltipEl && this.tooltipEl.parentNode) {
      this.tooltipEl.parentNode.removeChild(this.tooltipEl);
    }

    this.createTooltip();
    this.positionTooltip();
    this.isVisible = true;
  }

  hideTooltip() {
    if (this.tooltipEl && this.tooltipEl.parentNode) {
      this.tooltipEl.parentNode.removeChild(this.tooltipEl);
    }
    this.tooltipEl = null;
    this.isVisible = false;
  }

  toggleTooltip() {
    if (this.isVisible) {
      this.hideTooltip();
    } else {
      this.showTooltip();
    }
  }

  createTooltip() {
    this.tooltipEl = document.createElement("div");
    this.tooltipEl.className = "tooltip";
    this.tooltipEl.textContent = this.dataset.fullTitle;

    // Add basic styling if no CSS is defined
    if (!document.querySelector("style[data-tooltip-styles]")) {
      this.addDefaultStyles();
    }

    document.body.appendChild(this.tooltipEl);
  }

  positionTooltip() {
    if (!this.tooltipEl) return;

    const rect = this.getBoundingClientRect();
    const tooltipRect = this.tooltipEl.getBoundingClientRect();

    // Position above the element by default
    let top = rect.top + window.pageYOffset - tooltipRect.height - 8;
    let left =
      rect.left + window.pageXOffset + rect.width / 2 - tooltipRect.width / 2;

    // Adjust if tooltip goes off-screen
    const viewportWidth = window.innerWidth;
    const margin = 8;

    if (left < margin) {
      left = margin;
    } else if (left + tooltipRect.width > viewportWidth - margin) {
      left = viewportWidth - tooltipRect.width - margin;
    }

    // If tooltip goes above viewport, show it below instead
    if (top < margin) {
      top = rect.bottom + window.pageYOffset + 8;
      this.tooltipEl.classList.add("tooltip-below");
    } else {
      this.tooltipEl.classList.remove("tooltip-below");
    }

    this.tooltipEl.style.position = "absolute";
    this.tooltipEl.style.top = `${top}px`;
    this.tooltipEl.style.left = `${left}px`;
    this.tooltipEl.style.zIndex = "10002";
  }

  addDefaultStyles() {
    const style = document.createElement("style");
    style.setAttribute("data-tooltip-styles", "");
    style.textContent = `
      .tooltip {
        background-color: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 14px;
        line-height: 1.4;
        max-width: 300px;
        word-wrap: break-word;
        opacity: 1;
        pointer-events: none;
        transition: opacity 0.2s ease-in-out;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        z-index: 10002;
      }
      
      .tooltip:after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 5px solid transparent;
        border-top-color: rgba(0, 0, 0, 0.9);
      }
      
      .tooltip.tooltip-below:after {
        top: -10px;
        border-top-color: transparent;
        border-bottom-color: rgba(0, 0, 0, 0.9);
      }
    `;
    document.head.appendChild(style);
  }
}

customElements.define("custom-tooltip", CustomTooltip);
