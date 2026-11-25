/**
 * Dropdown Menu Web Components
 * A comprehensive, accessible dropdown menu system built with Web Components
 *
 * @version 2.0.0
 * @author Shopify Theme Development
 * @license MIT
 */

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const CONSTANTS = {
  ANIMATION_DURATION: 200,
  MARGIN: 8,
  OFFSET: 4,
  EVENTS: {
    OPEN: "dropdown-menu:open",
    CLOSE: "dropdown-menu:close",
  },
  ARIA: {
    EXPANDED: "aria-expanded",
    HAS_POPUP: "aria-haspopup",
    ROLE: "role",
  },
  DATA_ATTRS: {
    STATE: "data-state",
  },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Utility functions for dropdown positioning and calculations
 */
const DropdownUtils = {
  /**
   * Calculate optimal positioning for dropdown content
   * @param {DOMRect} triggerRect - Trigger element bounding rectangle
   * @param {DOMRect} contentRect - Content element bounding rectangle
   * @returns {Object} Position and transform origin values
   */
  calculatePosition(triggerRect, contentRect) {
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    let left = triggerRect.left;
    let top = triggerRect.bottom + CONSTANTS.OFFSET;
    let transformOrigin = "top left";

    // Horizontal positioning
    if (left + contentRect.width > viewport.width - CONSTANTS.MARGIN) {
      left = triggerRect.right - contentRect.width;
      transformOrigin = "top right";
    }

    // Vertical positioning: keep the dropdown inside the viewport, flipping
    // above the trigger when there is more room there, and capping its height
    // so it never runs off-screen (the page stays scrollable while open).
    const spaceBelow = viewport.height - triggerRect.bottom - CONSTANTS.OFFSET - CONSTANTS.MARGIN;
    const spaceAbove = triggerRect.top - CONSTANTS.OFFSET - CONSTANTS.MARGIN;
    let maxHeight = spaceBelow;

    if (contentRect.height > spaceBelow && spaceAbove > spaceBelow) {
      maxHeight = spaceAbove;
      top = triggerRect.top - Math.min(contentRect.height, maxHeight) - CONSTANTS.OFFSET;
      transformOrigin = transformOrigin.replace("top", "bottom");
    }

    maxHeight = Math.max(maxHeight, 0);

    // Ensure minimum margins
    left = Math.max(CONSTANTS.MARGIN, Math.min(left, viewport.width - contentRect.width - CONSTANTS.MARGIN));
    top = Math.max(CONSTANTS.MARGIN, top);

    return {
      left: `${left}px`,
      top: `${top}px`,
      maxHeight: `${maxHeight}px`,
      transformOrigin,
    };
  },

  /**
   * Check if any dropdown is currently open
   * @returns {boolean} True if any dropdown is open
   */
  hasAnyOpenDropdown() {
    return [...document.querySelectorAll("dropdown-menu")].some((menu) => menu.isOpen);
  },
};

// ============================================================================
// TEMPLATES
// ============================================================================

const Templates = {
  menu: createTemplate("<slot></slot>"),
  trigger: createTemplate("<slot></slot>"),
  content: createTemplate("<slot></slot>"),
  item: createTemplate("<slot></slot>"),
  separator: createTemplate(""),
};

/**
 * Helper function to create templates
 * @param {string} html - HTML string for template
 * @returns {HTMLTemplateElement} Created template
 */
function createTemplate(html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template;
}

// ============================================================================
// BASE COMPONENT CLASS
// ============================================================================

/**
 * Base class for dropdown components with common functionality
 */
class BaseDropdownElement extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  /**
   * Append template to shadow DOM
   * @param {HTMLTemplateElement} template - Template to append
   */
  appendTemplate(template) {
    this.shadowRoot.append(template.content.cloneNode(true));
  }
}

// ============================================================================
// DROPDOWN MENU COMPONENT
// ============================================================================

/**
 * Main dropdown menu component that orchestrates the entire dropdown system
 *
 * Features:
 * - Keyboard navigation (Arrow keys, Escape, Enter/Space)
 * - Click outside to close
 * - Smart positioning (prevents viewport overflow)
 * - Accessibility compliant (ARIA attributes, focus management)
 * - Repositions on scroll/resize (page scrolling stays enabled)
 * - Custom events for open/close states
 */
class DropdownMenu extends BaseDropdownElement {
  constructor() {
    super();
    this.appendTemplate(Templates.menu);

    this.isOpen = false;
    this.elements = {
      trigger: null,
      content: null,
      items: [],
    };

    // Bind event handlers to maintain context
    this._handlers = {
      triggerClick: this._onTriggerClick.bind(this),
      documentClick: this._onDocumentClick.bind(this),
      keyDown: this._onKeyDown.bind(this),
      itemClick: this._onItemClick.bind(this),
    };
  }

  connectedCallback() {
    this._initializeElements();
    this._validateStructure();
    this._setupEventListeners();
  }

  disconnectedCallback() {
    this._cleanup();
  }

  /**
   * Initialize component elements
   * @private
   */
  _initializeElements() {
    this.elements.trigger = this.querySelector("dropdown-menu-trigger");
    this.elements.content = this.querySelector("dropdown-menu-content");
    this.elements.items = Array.from(this.querySelectorAll("dropdown-menu-item"));

    if (this.elements.content) {
      this.elements.content.setAttribute("tabindex", "-1");
      this.elements.content.remove();
    }
  }

  /**
   * Validate required structure
   * @private
   */
  _validateStructure() {
    if (!this.elements.trigger || !this.elements.content) {
      console.warn("<dropdown-menu> requires both <dropdown-menu-trigger> and <dropdown-menu-content> children");
      return false;
    }
    return true;
  }

  /**
   * Setup event listeners
   * @private
   */
  _setupEventListeners() {
    if (!this._validateStructure()) return;

    this.elements.trigger.addEventListener("click", this._handlers.triggerClick);
    document.addEventListener("click", this._handlers.documentClick);
    this.addEventListener("keydown", this._handlers.keyDown);
    this.elements.content?.addEventListener("keydown", this._handlers.keyDown);
    this.elements.items.forEach((item) => {
      item.addEventListener("click", this._handlers.itemClick);
    });
  }

  /**
   * Cleanup event listeners
   * @private
   */
  _cleanup() {
    this._unbindRepositionListeners();

    if (this.elements.content?.parentNode) {
      this.elements.content.remove();
    }

    this.elements.trigger?.removeEventListener("click", this._handlers.triggerClick);
    document.removeEventListener("click", this._handlers.documentClick);
    this.removeEventListener("keydown", this._handlers.keyDown);
    this.elements.content?.removeEventListener("keydown", this._handlers.keyDown);
    this.elements.items.forEach((item) => {
      item.removeEventListener("click", this._handlers.itemClick);
    });
  }

  /**
   * Toggle dropdown open/closed state
   */
  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  /**
   * Open the dropdown menu
   */
  open() {
    if (this.isOpen || !this._validateStructure()) return;

    this.isOpen = true;
    this._updateAriaAttributes();
    this._positionContent();
    this._bindRepositionListeners();

    // Ensure all items are initially not focusable
    this.elements.items.forEach((item) => {
      item.setAttribute("tabindex", "-1");
    });

    this._focusFirstItem();
    this._dispatchEvent(CONSTANTS.EVENTS.OPEN);
  }

  /**
   * Close the dropdown menu
   */
  close() {
    if (!this.isOpen) return;

    this.isOpen = false;
    this._updateAriaAttributes();
    this.elements.content.setAttribute(CONSTANTS.DATA_ATTRS.STATE, "closed");

    if (this.elements.content.parentNode === document.body) {
      this.elements.content.remove();
    }

    this._unbindRepositionListeners();
    this._dispatchEvent(CONSTANTS.EVENTS.CLOSE);
  }

  /**
   * Update ARIA attributes for accessibility
   * @private
   */
  _updateAriaAttributes() {
    this.elements.trigger?.setAttribute(CONSTANTS.ARIA.EXPANDED, String(this.isOpen));
  }

  /**
   * Position the dropdown content intelligently
   * @private
   */
  _positionContent() {
    if (!this.elements.content || !this.elements.trigger) return;

    const content = this.elements.content;

    if (content.parentNode !== document.body) {
      document.body.appendChild(content);
    }

    // Render before measuring, and measure the natural height so the flip
    // and max-height decisions aren't based on a previous cap.
    content.setAttribute(CONSTANTS.DATA_ATTRS.STATE, "open");
    content.style.maxHeight = "";

    const position = DropdownUtils.calculatePosition(
      this.elements.trigger.getBoundingClientRect(),
      content.getBoundingClientRect(),
    );

    Object.assign(content.style, position);
  }

  /**
   * Keep the dropdown anchored to its trigger while the page scrolls or resizes.
   * The page is never scroll-locked, so the content below stays reachable.
   * @private
   */
  _bindRepositionListeners() {
    if (!this._handlers.reposition) {
      this._handlers.reposition = () => this._positionContent();
    }

    window.addEventListener("scroll", this._handlers.reposition, true);
    window.addEventListener("resize", this._handlers.reposition);
  }

  /**
   * Stop tracking scroll/resize once the dropdown is closed
   * @private
   */
  _unbindRepositionListeners() {
    if (!this._handlers.reposition) return;

    window.removeEventListener("scroll", this._handlers.reposition, true);
    window.removeEventListener("resize", this._handlers.reposition);
  }

  /**
   * Focus the first menu item
   * @private
   */
  _focusFirstItem() {
    if (this.elements.items.length > 0) {
      const firstItem = this.elements.items[0];
      firstItem.setAttribute("tabindex", "0");
      firstItem.focus();
    }
  }

  /**
   * Dispatch custom events
   * @param {string} eventName - Event name to dispatch
   * @private
   */
  _dispatchEvent(eventName) {
    this.dispatchEvent(
      new CustomEvent(eventName, {
        bubbles: true,
        detail: { dropdown: this },
      }),
    );
  }

  // Event Handlers
  _onTriggerClick(e) {
    this.toggle();
  }

  _onDocumentClick(e) {
    if (this.isOpen && !this.contains(e.target) && !this.elements.content?.contains(e.target)) {
      this.close();
    }
  }

  _onItemClick(e) {
    this.close();
  }

  _onKeyDown(e) {
    if (!this.isOpen) return;

    const currentIndex = this.elements.items.indexOf(document.activeElement);

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        this.close();
        this.elements.trigger?.focus();
        break;

      case "ArrowDown":
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % this.elements.items.length;
        this._focusItem(nextIndex);
        break;

      case "ArrowUp":
        e.preventDefault();
        const prevIndex = currentIndex <= 0 ? this.elements.items.length - 1 : currentIndex - 1;
        this._focusItem(prevIndex);
        break;

      case "Home":
        e.preventDefault();
        this._focusItem(0);
        break;

      case "End":
        e.preventDefault();
        this._focusItem(this.elements.items.length - 1);
        break;

      case "Enter":
      case " ":
        e.preventDefault();
        if (currentIndex >= 0) {
          this.elements.items[currentIndex].click();
        }
        break;
    }
  }

  /**
   * Focus a specific menu item
   * @param {number} index - Index of item to focus
   * @private
   */
  _focusItem(index) {
    if (index >= 0 && index < this.elements.items.length) {
      // Reset all items to not focusable
      this.elements.items.forEach((item) => {
        item.setAttribute("tabindex", "-1");
      });

      // Make the target item focusable and focus it
      const targetItem = this.elements.items[index];
      targetItem.setAttribute("tabindex", "0");
      targetItem.focus();
    }
  }
}

// ============================================================================
// DROPDOWN TRIGGER COMPONENT
// ============================================================================

/**
 * Dropdown trigger component that opens/closes the menu
 * Provides accessibility attributes and keyboard support
 */
class DropdownMenuTrigger extends BaseDropdownElement {
  constructor() {
    super();
    this.appendTemplate(Templates.trigger);
    this._setupAccessibility();
  }

  _setupAccessibility() {
    this.setAttribute(CONSTANTS.ARIA.HAS_POPUP, "menu");
    this.setAttribute(CONSTANTS.ARIA.ROLE, "button");
    this.setAttribute("tabindex", "0");
  }
}

// ============================================================================
// DROPDOWN CONTENT COMPONENT
// ============================================================================

/**
 * Dropdown content container that holds menu items
 * Manages visual state and positioning context
 */
class DropdownMenuContent extends BaseDropdownElement {
  constructor() {
    super();
    this.appendTemplate(Templates.content);
    this._setupAttributes();
  }

  _setupAttributes() {
    this.setAttribute(CONSTANTS.ARIA.ROLE, "menu");
    this.setAttribute(CONSTANTS.DATA_ATTRS.STATE, "closed");
  }
}

// ============================================================================
// DROPDOWN ITEM COMPONENT
// ============================================================================

/**
 * Individual dropdown menu item
 * Provides proper ARIA attributes and focus management
 */
class DropdownMenuItem extends BaseDropdownElement {
  constructor() {
    super();
    this.appendTemplate(Templates.item);
    this._setupAttributes();
  }

  _setupAttributes() {
    this.setAttribute(CONSTANTS.ARIA.ROLE, "menuitem");
    this.setAttribute("tabindex", "-1");
  }
}

// ============================================================================
// DROPDOWN SEPARATOR COMPONENT
// ============================================================================

/**
 * Visual separator between menu items
 * Provides proper ARIA role for accessibility
 */
class DropdownMenuSeparator extends BaseDropdownElement {
  constructor() {
    super();
    this.appendTemplate(Templates.separator);
    this.setAttribute(CONSTANTS.ARIA.ROLE, "separator");
  }
}

// ============================================================================
// COMPONENT REGISTRATION
// ============================================================================

// Register all components
customElements.define("dropdown-menu", DropdownMenu);
customElements.define("dropdown-menu-trigger", DropdownMenuTrigger);
customElements.define("dropdown-menu-content", DropdownMenuContent);
customElements.define("dropdown-menu-item", DropdownMenuItem);
customElements.define("dropdown-menu-separator", DropdownMenuSeparator);

// ============================================================================
// USAGE DOCUMENTATION
// ============================================================================

/**
 * USAGE EXAMPLES
 *
 * Basic dropdown:
 * <dropdown-menu>
 *   <dropdown-menu-trigger>
 *     <button>Menu</button>
 *   </dropdown-menu-trigger>
 *   <dropdown-menu-content>
 *     <dropdown-menu-item><a href="/profile">Profile</a></dropdown-menu-item>
 *     <dropdown-menu-item><a href="/settings">Settings</a></dropdown-menu-item>
 *     <dropdown-menu-separator></dropdown-menu-separator>
 *     <dropdown-menu-item><button onclick="logout()">Logout</button></dropdown-menu-item>
 *   </dropdown-menu-content>
 * </dropdown-menu>
 *
 * EVENT LISTENING:
 * document.addEventListener('dropdown-menu:open', (e) => {
 *   console.log('Dropdown opened:', e.detail.dropdown);
 * });
 *
 * document.addEventListener('dropdown-menu:close', (e) => {
 *   console.log('Dropdown closed:', e.detail.dropdown);
 * });
 *
 * PROGRAMMATIC CONTROL:
 * const dropdown = document.querySelector('dropdown-menu');
 * dropdown.open();   // Open
 * dropdown.close();  // Close
 * dropdown.toggle(); // Toggle
 *
 * IMPROVEMENTS IN THIS REFACTOR:
 * 1. Modular architecture with clear separation of concerns
 * 2. Centralized constants and configuration
 * 3. Utility functions for shared logic
 * 4. Base component class for common functionality
 * 5. Improved naming conventions and organization
 * 6. Better error handling and validation
 * 7. Enhanced documentation with JSDoc
 * 8. Consistent coding patterns and structure
 * 9. Performance optimizations
 * 10. Easier maintenance and extensibility
 */

/**
 * USAGE EXAMPLE
 *
 * Here's how you would use these components in your HTML:
 *
 * <dropdown-menu>
 *   <dropdown-menu-trigger>
 *     <button>Open Menu</button>
 *   </dropdown-menu-trigger>
 *
 *   <dropdown-menu-content>
 *     <dropdown-menu-item>
 *       <a href="/profile">Profile</a>
 *     </dropdown-menu-item>
 *     <dropdown-menu-item>
 *       <a href="/settings">Settings</a>
 *     </dropdown-menu-item>
 *     <dropdown-menu-separator></dropdown-menu-separator>
 *     <dropdown-menu-item>
 *       <button onclick="logout()">Logout</button>
 *     </dropdown-menu-item>
 *   </dropdown-menu-content>
 * </dropdown-menu>
 *
 * LISTENING TO EVENTS (like React callbacks):
 *
 * document.addEventListener('dropdown-menu:open', (e) => {
 *   console.log('Dropdown opened:', e.detail.dropdown);
 * });
 *
 * document.addEventListener('dropdown-menu:close', (e) => {
 *   console.log('Dropdown closed:', e.detail.dropdown);
 * });
 *
 * PROGRAMMATIC CONTROL:
 *
 * const dropdown = document.querySelector('dropdown-menu');
 * dropdown.open();   // Open the dropdown
 * dropdown.close();  // Close the dropdown
 * dropdown.toggle(); // Toggle open/closed state
 *
 * CODE IMPROVEMENTS MADE:
 *
 * 1. Added comprehensive JSDoc documentation
 * 2. Improved state management with _updateAriaExpanded() helper
 * 3. Added null-safe operators (?.) for better error handling
 * 4. Better separation of concerns in open/close methods
 * 5. Consistent state updates before DOM manipulation
 *
 * BEST PRACTICES FOR NEXT.JS DEVELOPERS:
 *
 * 1. Web Components vs React Components:
 *    - Web Components are framework-agnostic (work anywhere)
 *    - React Components are framework-specific but more powerful
 *    - Use Web Components for reusable UI that needs to work across frameworks
 *
 * 2. When to use Web Components in Next.js:
 *    - Third-party widgets that need to work in multiple frameworks
 *    - Legacy code integration
 *    - Micro-frontend architectures
 *    - Design system components shared across different tech stacks
 *
 * 3. Integration with Next.js:
 *    - Import this file in your _app.js or specific pages
 *    - Use the components in your JSX like regular HTML elements
 *    - Handle events with standard DOM event listeners
 *    - Style with global CSS (Shadow DOM isolates styles)
 *
 * 4. Performance Considerations:
 *    - Web Components have slightly more overhead than React components
 *    - Shadow DOM can impact CSS-in-JS solutions
 *    - Consider React components for most Next.js use cases
 *    - Use Web Components when you need true framework independence
 */
