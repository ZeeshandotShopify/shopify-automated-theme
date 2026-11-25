let accordionUid = 0;

class AccordionItem extends HTMLElement {
  connectedCallback() {
    if (this._initialized) return;

    this._trigger = this.querySelector("accordion-trigger");
    this._content = this.querySelector("accordion-content");
    if (!this._trigger || !this._content) return;

    // Generate unique IDs for ARIA linking
    const id = ++accordionUid;
    const triggerId = this._trigger.id || `accordion-trigger-${id}`;
    const contentId = this._content.id || `accordion-content-${id}`;
    this._trigger.id = triggerId;
    this._content.id = contentId;

    // ARIA on trigger
    this._trigger.setAttribute("role", "button");
    this._trigger.setAttribute("tabindex", "0");
    this._trigger.setAttribute("aria-expanded", "false");
    this._trigger.setAttribute("aria-controls", contentId);

    // ARIA on content
    this._content.setAttribute("role", "region");
    this._content.setAttribute("aria-labelledby", triggerId);

    // Append icon SVG
    this._appendIcon();

    // Initial state
    if (this.hasAttribute("default-open")) {
      this.setAttribute("data-state", "open");
      this._trigger.setAttribute("aria-expanded", "true");
      this._content.style.height = "auto";
    } else {
      this.setAttribute("data-state", "closed");
    }

    // Bind events
    this._onTransitionEnd = this._handleTransitionEnd.bind(this);
    this._content.addEventListener("transitionend", this._onTransitionEnd);

    this._trigger.addEventListener("click", () => this._toggle());
    this._trigger.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this._toggle();
      }
    });

    this._initialized = true;
  }

  _appendIcon() {
    const type = this.getAttribute("icon") || "chevron";
    let svg;

    if (type === "plus") {
      svg = `<svg class="accordion-icon icon-plus" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line class="horizontal" x1="4" y1="12" x2="20" y2="12"/>
        <line class="vertical" x1="12" y1="4" x2="12" y2="20"/>
      </svg>`;
    } else {
      svg = `<svg class="accordion-icon icon-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.9999 13.1714L16.9497 8.22168L18.3639 9.63589L11.9999 15.9999L5.63599 9.63589L7.0502 8.22168L11.9999 13.1714Z"/>
      </svg>`;
    }

    this._trigger.insertAdjacentHTML("beforeend", svg);
  }

  _toggle() {
    if (this.getAttribute("data-state") === "open") {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    const content = this._content;
    if (!content) return;

    this.setAttribute("data-state", "open");
    this._trigger.setAttribute("aria-expanded", "true");

    // Capture current height (may be mid-transition)
    const from = getComputedStyle(content).height;

    // Measure target height
    content.style.height = "auto";
    const to = content.scrollHeight + "px";

    // Set starting height and force reflow
    content.style.height = from;
    content.offsetHeight;

    // Transition to target
    content.style.height = to;

    this.dispatchEvent(new CustomEvent("accordion-open", { bubbles: true }));
  }

  close() {
    const content = this._content;
    if (!content) return;

    this.setAttribute("data-state", "closed");
    this._trigger.setAttribute("aria-expanded", "false");

    // Capture current height (may be mid-transition or auto)
    const from = getComputedStyle(content).height;

    // Set explicit starting height and force reflow
    content.style.height = from;
    content.offsetHeight;

    // Transition to 0
    content.style.height = "0px";

    this.dispatchEvent(new CustomEvent("accordion-close", { bubbles: true }));
  }

  _handleTransitionEnd(e) {
    if (e.target !== this._content || e.propertyName !== "height") return;

    // After opening, switch to auto so content can reflow naturally
    if (this.getAttribute("data-state") === "open") {
      this._content.style.height = "auto";
    }
  }
}

customElements.define("accordion-item", AccordionItem);
customElements.define("accordion-trigger", class extends HTMLElement {});
customElements.define("accordion-content", class extends HTMLElement {});
