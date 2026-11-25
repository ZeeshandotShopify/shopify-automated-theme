// Sheet Menu Web Component
class SheetMenu extends HTMLElement {
  constructor() {
    super();
    this.isOpen = false;
    this.direction = "right";
  }

  connectedCallback() {
    this.direction = this.getAttribute("data-direction") || "right";
    this.init();
  }

  init() {
    // Get component elements
    this.trigger = this.querySelector("sheet-trigger");
    this.content = this.querySelector("sheet-content");

    // Create overlay if it doesn't exist
    this.overlay = document.querySelector("sheet-overlay");
    if (!this.overlay) {
      this.overlay = document.createElement("sheet-overlay");
      document.body.appendChild(this.overlay);
    }

    // Set direction on content and move to body for correct stacking context
    if (this.content) {
      this.sheetContent = this.content; // Store reference for external access
      this.content.setAttribute("data-direction", this.direction);
      document.body.appendChild(this.content);
    }

    // Bind events
    this.bindEvents();
  }

  bindEvents() {
    // Trigger click
    if (this.trigger) {
      this.trigger.addEventListener("click", () => this.open());
    }

    // Use event delegation for close buttons instead of direct binding
    if (this.content) {
      this.content.addEventListener("click", (e) => {
        const closeButton = e.target.closest("sheet-close");
        if (closeButton) {
          this.close();
        }
      });
    }

    // Overlay click
    this.overlay.addEventListener("click", () => this.close());

    // Escape key
    this.handleEscape = (e) => {
      if (e.key === "Escape" && this.isOpen) {
        this.close();
      }
    };
    document.addEventListener("keydown", this.handleEscape);

    // Close sheet when any dialog opens (mutual closing)
    this.handleDialogOpen = () => {
      if (this.isOpen) {
        this.close();
      }
    };
    document.addEventListener("dialog-open", this.handleDialogOpen);
  }

  open() {
    // Hard-close fallback for non-upgraded dialogs
    const dialogContents = document.querySelectorAll("dialog-content[data-state='open']");
    dialogContents.forEach((dc) => dc.setAttribute("data-state", "closed"));
    const dialogOverlay = document.querySelector("dialog-overlay");
    if (dialogOverlay) {
      dialogOverlay.setAttribute("data-state", "closed");
    }
    document.body.removeAttribute("data-dialog-scroll-locked");

    this.isOpen = true;
    // Abandons a staged close that has not run yet (see `close`).
    this.closeToken = (this.closeToken || 0) + 1;

    // Set state attributes
    if (this.content) {
      this.content.removeAttribute("data-closing");
      this.content.setAttribute("data-state", "open");
    }
    this.overlay.setAttribute("data-state", "open");

    // Lock body scroll
    document.body.setAttribute("data-scroll-locked", "");

    // Set focus trap
    this.setupFocusTrap();

    // Dispatch custom event
    this.dispatchEvent(
      new CustomEvent("sheet-open", {
        bubbles: true,
        detail: { direction: this.direction },
      }),
    );
  }

  /**
   * A sheet may ask for a beat before it leaves, so that anything staged
   * BEHIND it gets to retract first — the cart drawer's recommendation rail
   * sits at its left edge and should tuck back under the drawer before the
   * drawer itself slides away. The rail sets `data-close-delay` on the CONTENT
   * from its own transition, so the two cannot drift apart — the content, not
   * this element, because <sheet-menu> portals its content into document.body
   * at init and nothing inside it can reach back up to the menu.
   *
   * `data-closing` on the content is the retract signal. A sheet that sets no
   * delay takes the immediate path and behaves exactly as it always has.
   */
  close({ immediate = false } = {}) {
    this.isOpen = false;

    const delay = immediate ? 0 : parseInt((this.content && this.content.dataset.closeDelay) || "", 10) || 0;
    const token = (this.closeToken || 0) + 1;
    this.closeToken = token;

    const finish = () => {
      // Re-opened while the exit was staged — that open owns the sheet now.
      if (this.closeToken !== token) return;

      // Remove state attributes
      if (this.content) {
        this.content.removeAttribute("data-closing");
        this.content.setAttribute("data-state", "closed");
      }
      this.overlay.setAttribute("data-state", "closed");

      // Unlock body scroll
      document.body.removeAttribute("data-scroll-locked");

      // Remove focus trap
      this.removeFocusTrap();

      // Dispatch custom event
      this.dispatchEvent(
        new CustomEvent("sheet-close", {
          bubbles: true,
          detail: { direction: this.direction },
        }),
      );
    };

    if (delay > 0 && this.content && this.content.getAttribute("data-state") === "open") {
      this.content.setAttribute("data-closing", "");
      window.setTimeout(finish, delay);
    } else {
      finish();
    }
  }

  setupFocusTrap() {
    if (!this.content) return;

    // Get all focusable elements
    const focusableElements = this.content.querySelectorAll(
      'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );

    if (focusableElements.length === 0) return;

    this.firstFocusable = focusableElements[0];
    this.lastFocusable = focusableElements[focusableElements.length - 1];

    // Focus first element
    this.firstFocusable.focus();

    // Trap focus
    this.handleTab = (e) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === this.firstFocusable) {
          e.preventDefault();
          this.lastFocusable.focus();
        }
      } else {
        if (document.activeElement === this.lastFocusable) {
          e.preventDefault();
          this.firstFocusable.focus();
        }
      }
    };

    document.addEventListener("keydown", this.handleTab);
  }

  removeFocusTrap() {
    if (this.handleTab) {
      document.removeEventListener("keydown", this.handleTab);
    }
  }

  disconnectedCallback() {
    // Ensure we clean up state (scroll locks, etc.) if removed while open.
    // Immediate: a detached sheet has nothing left to animate.
    if (this.isOpen) {
      this.close({ immediate: true });
    }

    // Clean up event listeners
    document.removeEventListener("keydown", this.handleEscape);
    if (this.handleTab) {
      document.removeEventListener("keydown", this.handleTab);
    }

    // Remove dialog-open listener for mutual closing
    if (this.handleDialogOpen) {
      document.removeEventListener("dialog-open", this.handleDialogOpen);
    }

    // Remove content if it was moved to body
    if (this.content && this.content.parentElement === document.body) {
      this.content.remove();
    }

    // Remove overlay if no other sheets exist
    const otherSheets = document.querySelectorAll("sheet-menu");
    if (otherSheets.length === 0 && this.overlay) {
      this.overlay.remove();
    }
  }
}

// Define custom elements
customElements.define("sheet-menu", SheetMenu);

// Optional: Define placeholder elements for semantic structure
[
  "sheet-trigger",
  "sheet-content",
  "sheet-close",
  "sheet-header",
  "sheet-title",
  "sheet-description",
  "sheet-footer",
  "sheet-separator",
  "sheet-overlay",
].forEach((tag) => {
  if (!customElements.get(tag)) {
    customElements.define(tag, class extends HTMLElement {});
  }
});
