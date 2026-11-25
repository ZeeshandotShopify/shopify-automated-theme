// // Dialog Menu Web Component
// class DialogMenu extends HTMLElement {
//   constructor() {
//     super();
//     this.isOpen = false;
//     this.size = 'default';
//     this.originalParent = null;
//     this.originalNextSibling = null;
//   }

//   connectedCallback() {
//     this.size = this.getAttribute('data-size') || 'default';
//     this.init();
//   }

//   init() {
//     // Get component elements
//     this.trigger = this.querySelector('dialog-trigger');
//     this.content = this.querySelector('dialog-content');
//     this.closeButtons = this.querySelectorAll('dialog-close');

//     // Store original position for restoration
//     if (this.content) {
//       this.originalParent = this.content.parentElement;
//       this.originalNextSibling = this.content.nextSibling;
//     }

//     // Create overlay if it doesn't exist
//     this.overlay = document.querySelector('dialog-overlay');
//     if (!this.overlay) {
//       this.overlay = document.createElement('dialog-overlay');
//       document.body.appendChild(this.overlay);
//     }

//     // Set size on content
//     if (this.content) {
//       this.content.setAttribute('data-size', this.size);
//     }

//     // Bind events
//     this.bindEvents();
//   }

//   bindEvents() {
//     // Trigger click
//     if (this.trigger) {
//       const triggerBtn = this.trigger.querySelector('button, a, [role="button"]');
//       if (triggerBtn) {
//         triggerBtn.addEventListener('click', (e) => {
//           e.preventDefault();
//           this.open();
//         });
//       } else {
//         this.trigger.addEventListener('click', (e) => {
//           e.preventDefault();
//           this.open();
//         });
//       }
//     }

//     // Close button clicks
//     this.closeButtons.forEach(btn => {
//       btn.addEventListener('click', () => this.close());
//     });

//     // Overlay click (close on click outside)
//     this.overlay.addEventListener('click', (e) => {
//       if (e.target === this.overlay) {
//         this.close();
//       }
//     });

//     // Escape key
//     this.handleEscape = (e) => {
//       if (e.key === 'Escape' && this.isOpen) {
//         this.close();
//       }
//     };
//     document.addEventListener('keydown', this.handleEscape);
//   }

//   open() {
//     this.isOpen = true;

//     // Portal: Move content to body (outside any parent containers)
//     if (this.content && this.content.parentElement !== document.body) {
//       document.body.appendChild(this.content);
//     }

//     // Set state attributes
//     if (this.content) {
//       this.content.setAttribute('data-state', 'open');
//     }
//     this.overlay.setAttribute('data-state', 'open');

//     // Lock body scroll
//     document.body.setAttribute('data-dialog-scroll-locked', '');

//     // Set focus trap after animation
//     setTimeout(() => {
//       this.setupFocusTrap();
//     }, 50);

//     // Dispatch custom event
//     this.dispatchEvent(new CustomEvent('dialog-open', {
//       bubbles: true,
//       detail: { size: this.size }
//     }));
//   }

//   close() {
//     if (!this.isOpen) return;

//     this.isOpen = false;

//     // Set state to closed (triggers exit animation)
//     if (this.content) {
//       this.content.setAttribute('data-state', 'closed');
//     }
//     this.overlay.setAttribute('data-state', 'closed');

//     // Wait for animation to complete before cleanup
//     setTimeout(() => {
//       // Restore content to original position
//       if (this.content && this.originalParent) {
//         if (this.originalNextSibling) {
//           this.originalParent.insertBefore(this.content, this.originalNextSibling);
//         } else {
//           this.originalParent.appendChild(this.content);
//         }
//       }

//       // Unlock body scroll
//       document.body.removeAttribute('data-dialog-scroll-locked');

//       // Remove focus trap
//       this.removeFocusTrap();

//       // Return focus to trigger
//       if (this.trigger) {
//         const triggerBtn = this.trigger.querySelector('button, a, [role="button"]');
//         if (triggerBtn) {
//           triggerBtn.focus();
//         }
//       }
//     }, 200); // Match CSS transition duration

//     // Dispatch custom event
//     this.dispatchEvent(new CustomEvent('dialog-close', {
//       bubbles: true,
//       detail: { size: this.size }
//     }));
//   }

//   setupFocusTrap() {
//     if (!this.content) return;

//     // Get all focusable elements
//     const focusableElements = this.content.querySelectorAll(
//       'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
//     );

//     if (focusableElements.length === 0) {
//       // If no focusable elements, focus the content itself
//       this.content.setAttribute('tabindex', '-1');
//       this.content.focus();
//       return;
//     }

//     this.firstFocusable = focusableElements[0];
//     this.lastFocusable = focusableElements[focusableElements.length - 1];

//     // Focus first element (or close button if available)
//     const closeBtn = this.content.querySelector('dialog-close');
//     if (closeBtn) {
//       closeBtn.focus();
//     } else {
//       this.firstFocusable.focus();
//     }

//     // Trap focus
//     this.handleTab = (e) => {
//       if (!this.isOpen || e.key !== 'Tab') return;

//       const focusables = Array.from(this.content.querySelectorAll(
//         'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
//       ));

//       if (focusables.length === 0) return;

//       const firstEl = focusables[0];
//       const lastEl = focusables[focusables.length - 1];

//       if (e.shiftKey) {
//         if (document.activeElement === firstEl) {
//           e.preventDefault();
//           lastEl.focus();
//         }
//       } else {
//         if (document.activeElement === lastEl) {
//           e.preventDefault();
//           firstEl.focus();
//         }
//       }
//     };

//     document.addEventListener('keydown', this.handleTab);
//   }

//   removeFocusTrap() {
//     if (this.handleTab) {
//       document.removeEventListener('keydown', this.handleTab);
//     }
//   }

//   disconnectedCallback() {
//     // Clean up event listeners
//     document.removeEventListener('keydown', this.handleEscape);
//     if (this.handleTab) {
//       document.removeEventListener('keydown', this.handleTab);
//     }

//     // Remove overlay if no other dialogs exist
//     const otherDialogs = document.querySelectorAll('dialog-menu');
//     if (otherDialogs.length === 0 && this.overlay) {
//       this.overlay.remove();
//     }
//   }
// }

// // Define custom elements
// customElements.define('dialog-menu', DialogMenu);

// // Optional: Define placeholder elements for semantic structure
// ['dialog-trigger', 'dialog-content', 'dialog-close', 'dialog-header',
//  'dialog-title', 'dialog-description', 'dialog-footer', 'dialog-overlay'].forEach(tag => {
//   if (!customElements.get(tag)) {
//     customElements.define(tag, class extends HTMLElement {});
//   }
// });

// Dialog Menu Web Component
class DialogMenu extends HTMLElement {
  constructor() {
    super();
    this.isOpen = false;
    this.size = "default";
    this.originalParent = null;
    this.originalNextSibling = null;
  }

  connectedCallback() {
    this.size = this.getAttribute("data-size") || "default";
    this.init();
  }

  init() {
    // Get component elements
    this.trigger = this.querySelector("dialog-trigger");
    this.content = this.querySelector("dialog-content");
    this.closeButtons = this.querySelectorAll("dialog-close");

    // Store original position for restoration
    if (this.content) {
      this.originalParent = this.content.parentElement;
      this.originalNextSibling = this.content.nextSibling;
    }

    // Create overlay if it doesn't exist
    this.overlay = document.querySelector("dialog-overlay");
    if (!this.overlay) {
      this.overlay = document.createElement("dialog-overlay");
      document.body.appendChild(this.overlay);
    }

    // Set size on content
    if (this.content) {
      this.content.setAttribute("data-size", this.size);
    }

    // Bind events
    this.bindEvents();
  }

  bindEvents() {
    // Trigger click
    if (this.trigger) {
      const triggerBtn = this.trigger.querySelector(
        'button, a, [role="button"]',
      );
      if (triggerBtn) {
        triggerBtn.addEventListener("click", (e) => {
          e.preventDefault();
          this.open();
        });
      } else {
        this.trigger.addEventListener("click", (e) => {
          e.preventDefault();
          this.open();
        });
      }
    }

    // Close button clicks
    this.closeButtons.forEach((btn) => {
      btn.addEventListener("click", () => this.close());
    });

    // Overlay click (close on click outside)
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });

    // Escape key
    this.handleEscape = (e) => {
      if (e.key === "Escape" && this.isOpen) {
        this.close();
      }
    };
    document.addEventListener("keydown", this.handleEscape);

    // Close dialog when any sheet opens (mutual closing)
    this.handleSheetOpen = () => {
      if (this.isOpen) {
        this.close();
      }
    };
    document.addEventListener("sheet-open", this.handleSheetOpen);
  }

  open() {
    this.isOpen = true;

    // Portal: Move content to body (outside any parent containers)
    if (this.content && this.content.parentElement !== document.body) {
      document.body.appendChild(this.content);
    }

    // Set state attributes
    if (this.content) {
      this.content.setAttribute("data-state", "open");
    }
    this.overlay.setAttribute("data-state", "open");

    // Lock body scroll
    document.body.setAttribute("data-dialog-scroll-locked", "");

    // Set focus trap after animation
    setTimeout(() => {
      this.setupFocusTrap();
    }, 50);

    // Dispatch custom event
    this.dispatchEvent(
      new CustomEvent("dialog-open", {
        bubbles: true,
        detail: { size: this.size },
      }),
    );
  }

  close() {
    if (!this.isOpen) return;

    this.isOpen = false;

    // Set state to closed (triggers exit animation)
    if (this.content) {
      this.content.setAttribute("data-state", "closed");
    }
    this.overlay.setAttribute("data-state", "closed");

    // Wait for animation to complete before cleanup
    setTimeout(() => {
      // Restore content to original position
      if (this.content && this.originalParent) {
        if (this.originalNextSibling) {
          this.originalParent.insertBefore(
            this.content,
            this.originalNextSibling,
          );
        } else {
          this.originalParent.appendChild(this.content);
        }
      }

      // Unlock body scroll
      document.body.removeAttribute("data-dialog-scroll-locked");

      // Remove focus trap
      this.removeFocusTrap();

      // Return focus to trigger
      if (this.trigger) {
        const triggerBtn = this.trigger.querySelector(
          'button, a, [role="button"]',
        );
        if (triggerBtn) {
          triggerBtn.focus();
        }
      }
    }, 200); // Match CSS transition duration

    // Dispatch custom event
    this.dispatchEvent(
      new CustomEvent("dialog-close", {
        bubbles: true,
        detail: { size: this.size },
      }),
    );
  }

  setupFocusTrap() {
    if (!this.content) return;

    // Get all focusable elements
    const focusableElements = this.content.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );

    if (focusableElements.length === 0) {
      // If no focusable elements, focus the content itself
      this.content.setAttribute("tabindex", "-1");
      this.content.focus();
      return;
    }

    this.firstFocusable = focusableElements[0];
    this.lastFocusable = focusableElements[focusableElements.length - 1];

    // Focus first element (or close button if available)
    const closeBtn = this.content.querySelector("dialog-close");
    if (closeBtn) {
      closeBtn.focus();
    } else {
      this.firstFocusable.focus();
    }

    // Trap focus
    this.handleTab = (e) => {
      if (!this.isOpen || e.key !== "Tab") return;

      const focusables = Array.from(
        this.content.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );

      if (focusables.length === 0) return;

      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
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
    // Clean up event listeners
    document.removeEventListener("keydown", this.handleEscape);
    if (this.handleTab) {
      document.removeEventListener("keydown", this.handleTab);
    }

    // Remove sheet-open listener for mutual closing
    if (this.handleSheetOpen) {
      document.removeEventListener("sheet-open", this.handleSheetOpen);
    }

    // Remove overlay if no other dialogs exist
    const otherDialogs = document.querySelectorAll("dialog-menu");
    if (otherDialogs.length === 0 && this.overlay) {
      this.overlay.remove();
    }
  }
}

// Define custom elements
customElements.define("dialog-menu", DialogMenu);

// Optional: Define placeholder elements for semantic structure
[
  "dialog-trigger",
  "dialog-content",
  "dialog-close",
  "dialog-header",
  "dialog-title",
  "dialog-description",
  "dialog-footer",
  "dialog-overlay",
].forEach((tag) => {
  if (!customElements.get(tag)) {
    customElements.define(tag, class extends HTMLElement {});
  }
});
