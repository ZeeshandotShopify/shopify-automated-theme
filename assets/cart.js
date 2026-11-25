//! Upsell swiper initialization function
// function initializeUpsellSwiper() {
//   // Find the unique section wrapper
//   const section = document.querySelector("#cart-upsell");
//   if (!section) return;

//   // Find elements *within* this section
//   const upsellSwiperEl = section.querySelector(".upsell-swiper");

//   const paginationEl = section.querySelector(".swiper-pagination");

//   // Initialize Upsell Swiper (Main Driver)
//   const upsellSwiper = new Swiper(upsellSwiperEl, {
//     loop: true,
//     grabCursor: true,
//     pagination: {
//       el: paginationEl,
//       type: "bullets",
//       dynamicBullets: true,
//       dynamicMainBullets: 2, // number of bullets to show
//       clickable: true,
//     },
//   });
// }

class CustomCart extends HTMLElement {
  constructor() {
    super();

    this.sectionId = this.dataset.sectionId;
  }

  connectedCallback() {
    // Once the cart:rerender event is set up, we can call it from everywhere we want in the theme
    // just don't forget to append the correct data to the event so we can rerender the cart

    this.cartType = this.dataset.cartType || "drawer";

    document.addEventListener("cart:rerender", this.cartRerender.bind(this));
  }

  cartRerender(event) {
    if (!event.detail.sections) {
      console.error("No sections data available for rerender");
      return;
    }

    //! Cart
    const cartPlaceholder = document.createElement("div");
    let cartOriginalSection;
    let contentSelector;

    // Determine which section data to use based on cart type
    if (this.cartType === "page") {
      cartOriginalSection = event.detail.sections[this.sectionId] || event.detail.sections["cart"];
      contentSelector = ".cart-section";
    } else {
      cartOriginalSection = event.detail.sections["cart-drawer"];
      contentSelector = ".cart-drawer-sheet-content";
    }

    if (!cartOriginalSection) {
      console.error(`No section data found for cart type: ${this.cartType}`);
      return;
    }

    cartPlaceholder.innerHTML = cartOriginalSection;

    //! This is only necessary for the cart drawer, as the cart section is rendered within the custom-cart element.
    //! Find the cart drawer content - it might have been relocated to document.body by our sheet-menu custom web component, which moves the sheet-content to the body for improved overlay handling and positioning.
    let cartContent = this.querySelector(contentSelector);

    //! This is only necessary for the cart drawer, as the cart section is rendered within the custom-cart element.
    //! If not found within the custom-cart element, search the entire document.
    //! This accounts for our sheet-menu custom web component moving the sheet-content to document.body for better modal behavior.
    if (!cartContent) {
      cartContent = document.querySelector(contentSelector);
    }

    //! Our <sheet-menu> (the cart drawer) isn’t added to the DOM until it’s opened—this ensures it behaves like a modal. That means when you click the product’s Add to Cart button, the drawer element doesn’t yet exist in the DOM, so its content cannot be found or re-rendered.
    //! The code nevertheless retrieves and updates the <sheet-menu>’s content by accessing the sheetContent property of the sheet-menu custom element, which maintains an internal reference to the content element.
    //! This allows updates even before it's attached to the DOM, working because the custom element holds this reference independently of the DOM structure.
    if (!cartContent && this.cartType === "drawer") {
      const sheetMenu = this.querySelector("sheet-menu");
      if (sheetMenu && sheetMenu.sheetContent) {
        cartContent = sheetMenu.sheetContent;
      }
    }

    if (cartContent) {
      // Update the content
      const newContent = cartPlaceholder.querySelector(contentSelector);
      if (newContent) {
        cartContent.innerHTML = newContent.innerHTML;
      } else {
        console.error(`Could not find ${contentSelector} element in cartPlaceholder`);
        return;
      }
    } else {
      console.error(`Could not find ${contentSelector} element even via sheet-menu reference`);
    }

    // For drawer: Open the sheet menu if it exists
    if (this.cartType === "drawer") {
      const sheetMenu = this.querySelector("sheet-menu") || document.querySelector("sheet-menu");
      if (sheetMenu) {
        sheetMenu.open();
      }
    }

    //! Clear all loading states after rerender
    setTimeout(() => {
      this.clearAllLoadingStates();
    }, 100);

    //! Re-initialize upsell swiper after cart rerender
    // setTimeout(() => {
    //   initializeUpsellSwiper();
    // }, 100);

    //! Cart Icon
    const cartIconPlaceholder = document.createElement("div");
    const cartIconOriginalSection = event.detail.sections["cart-icon"];

    cartIconPlaceholder.innerHTML = cartIconOriginalSection;

    //! Search for cart icon globally in the document
    //! We perform a global search for the cart icon since it is not rendered within the custom-cart element on the cart section, ensuring updates across the entire page.
    const cartIconContent = document.querySelector(".cart-icon");

    if (cartIconContent) {
      // Update the content
      const newContent = cartIconPlaceholder.querySelector(".cart-icon");
      if (newContent) {
        cartIconContent.innerHTML = newContent.innerHTML;
      } else {
        console.error("Could not find .cart-icon element in cartIconPlaceholder");
        return;
      }
    } else {
      console.error("Could not find .cart-icon element");
      return;
    }
  }

  clearAllLoadingStates() {
    //! Remove loading classes from all cart actions
    const cartActions = this.querySelectorAll("cart-actions");
    cartActions.forEach((action) => {
      if (action.setLoadingState) {
        action.setLoadingState(false);
      }
    });

    //! Remove loading classes from price elements
    const priceElements = document.querySelectorAll(".price-loading");
    priceElements.forEach((element) => {
      element.classList.remove("price-loading");
    });
  }
}

customElements.define("custom-cart", CustomCart);

// Icon artwork per toast type. `error` is the original icon, so every existing
// caller — which passes no type at all — keeps its exact appearance.
const TOAST_ICONS = {
  error: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
  success: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="8.5 12.5 11 15 15.5 9.5"></polyline></svg>`,
  warning: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
  info: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="11" x2="12" y2="16"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
};

function showToast(message, type = "error") {
  const variant = TOAST_ICONS[type] ? type : "error";

  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast--${variant}`;
  toast.setAttribute("role", variant === "error" ? "alert" : "status");

  // Icon
  const icon = document.createElement("div");
  icon.className = "toast-icon";
  icon.innerHTML = TOAST_ICONS[variant];

  const text = document.createElement("div");
  text.textContent = message;

  toast.appendChild(icon);
  toast.appendChild(text);
  container.appendChild(toast);

  // Dismiss after the globally configured lifetime. The CSS custom property is
  // the single source of truth for the duration, so the setting moves both the
  // timer and anything CSS-side that needs it.
  const configured = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--toast-duration"), 10);
  const lifetime = Number.isFinite(configured) && configured > 0 ? configured : 3000;

  setTimeout(() => {
    toast.style.animation = "slideOut 0.3s forwards";
    toast.addEventListener("animationend", () => {
      toast.remove();
      if (container.children.length === 0) {
        container.remove();
      }
    });
  }, lifetime);
}

// class AtcButton extends HTMLElement {
//   constructor() {
//     super();

//     this.submitForm =
//       this.querySelector('form[action="/cart/add"]') ||
//       this.closest('form[action="/cart/add"]');
//     this.submitButton = null;
//     this.isLoading = false;
//     this.handleSubmit = this.handleSubmit.bind(this);
//   }

//   connectedCallback() {
//     if (this.submitForm) {
//       this.submitButton = this.submitForm.querySelector(
//         'button[type="submit"]'
//       );
//       this.submitForm.addEventListener("submit", this.handleSubmit);
//     }
//   }

//   disconnectedCallback() {
//     if (this.submitForm) {
//       this.submitForm.removeEventListener("submit", this.handleSubmit);
//     }
//   }

//   setLoadingState(loading) {
//     if (!this.submitButton) return;

//     this.isLoading = loading;

//     if (loading) {
//       this.submitButton.disabled = true;
//       this.submitButton.classList.add("loading");
//     } else {
//       this.submitButton.disabled = false;
//       this.submitButton.classList.remove("loading");
//     }
//   }

//   showError(message) {
//     showToast(message);
//   }

//   clearError() {
//     // Toast handles its own removal, but we can implement clearing if needed.
//     // For now, no-op as toasts auto-expire.
//   }

//   handleSubmit(event) {
//     event.preventDefault();
//     if (this.isLoading) return;
//     this.clearError();
//     this.setLoadingState(true);

//     // Gather basic item data
//     const variantInput = this.submitForm.querySelector('input[name="id"]');
//     const qtyInput = this.submitForm.querySelector('input[name="quantity"]');
//     const itemId = variantInput ? variantInput.value : null;
//     const quantity = qtyInput ? parseInt(qtyInput.value) : 1;

//     // Build item object
//     const itemData = { id: itemId, quantity: quantity };

//     // Collect all line-item properties from the form
//     const properties = {};
//     this.submitForm
//       .querySelectorAll('input[name^="properties["]')
//       .forEach((input) => {
//         const match = input.name.match(/properties\[(.+)\]/);
//         if (match) {
//           const propKey = match[1];
//           properties[propKey] = input.value;
//         }
//       });
//     if (Object.keys(properties).length) {
//       itemData.properties = properties;
//     }

//     // Prepare AJAX payload
//     const formData = {
//       items: [itemData],
//       sections: "cart-drawer,cart-icon",
//     };

//     // Submit to Shopify Ajax API
//     fetch(window.Shopify.routes.root + "cart/add.js", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(formData),
//     })
//       .then(async (response) => {
//         const data = await response.json();
//         if (!response.ok) {
//           // Handle error response (e.g., max quantity reached)
//           if (data && data.status === 422 && data.description) {
//             this.showError(data.description);
//           } else {
//             this.showError("An unexpected error occurred. Please try again.");
//           }
//           this.setLoadingState(false);
//           return;
//         }
//         // Success: trigger cart rerender (existing logic)
//         document.documentElement.dispatchEvent(
//           new CustomEvent("cart:rerender", { detail: data, bubbles: true })
//         );
//         this.setLoadingState(false);
//       })
//       .catch((error) => {
//         console.error("Error adding to cart:", error);
//         this.showError("An unexpected error occurred. Please try again.");
//         this.setLoadingState(false);
//       });
//   }
// }

// customElements.define("atc-button", AtcButton);

class AddToCart extends HTMLElement {
  constructor() {
    super();
    this.submitForm = null;
    this.submitButton = null;
    this.isLoading = false;
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  connectedCallback() {
    // Find the actual button inside this custom element
    this.submitButton = this.querySelector('button[type="submit"]');

    if (this.submitButton) {
      // Get the form ID from the button's form attribute
      const formId = this.submitButton.getAttribute("form");

      if (formId) {
        // Find the form anywhere in the document using the button's form attribute
        this.submitForm = document.getElementById(formId);
      } else {
        // Fallback: button is inside the form
        this.submitForm = this.closest('form[action="/cart/add"]');
      }

      if (this.submitForm) {
        // Listen for the SUBMIT event on the FORM
        this.submitForm.addEventListener("submit", this.handleSubmit);
      }
    }
  }

  disconnectedCallback() {
    if (this.submitForm) {
      this.submitForm.removeEventListener("submit", this.handleSubmit);
    }
  }

  setLoadingState(loading) {
    if (!this.submitButton) return;

    this.isLoading = loading;

    if (loading) {
      this.submitButton.disabled = true;
      this.submitButton.classList.add("loading");
    } else {
      this.submitButton.disabled = false;
      this.submitButton.classList.remove("loading");
    }
  }

  showError(message) {
    if (typeof showToast === "function") {
      showToast(message);
    } else {
      console.error(message);
      alert(message);
    }
  }

  clearError() {
    // No-op
  }

  handleSubmit(event) {
    event.preventDefault();

    // 1. THE FIX: Check if the form is already submitting
    // If 'data-submitting' exists, another button already triggered this. Stop here.
    if (this.submitForm.hasAttribute("data-submitting")) return;

    if (this.isLoading) return;
    this.clearError();
    this.setLoadingState(true);

    // 2. Lock the form immediately
    this.submitForm.setAttribute("data-submitting", "true");

    const formData = new FormData(this.submitForm);
    formData.append("sections", "cart-drawer,cart-icon");
    formData.append("sections_url", window.location.pathname);

    fetch(window.Shopify.routes.root + "cart/add.js", {
      method: "POST",
      body: formData,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          if (data && data.status === 422 && data.description) {
            this.showError(data.description);
          } else {
            this.showError("An unexpected error occurred.");
          }
        } else {
          document.documentElement.dispatchEvent(new CustomEvent("cart:rerender", { detail: data, bubbles: true }));
        }
      })
      .catch((error) => {
        console.error("Error adding to cart:", error);
        this.showError("An unexpected error occurred.");
      })
      .finally(() => {
        // 3. UNLOCK the form so it can be submitted again if needed
        this.submitForm.removeAttribute("data-submitting");
        this.setLoadingState(false);
      });
  }
}

customElements.define("add-to-cart", AddToCart);

class CartActions extends HTMLElement {
  constructor() {
    super();

    this.increaseQuantity = this.querySelector("[data-increase-quantity]");
    this.decreaseQuantity = this.querySelector("[data-decrease-quantity]");
    this.removeItem = this.querySelector("[data-cart-item-remove]");
    this.quantityInput = this.querySelector(".quantity-input");

    this.handleQuantityChange = this.handleQuantityChange.bind(this);
    this.isLoading = false;
  }

  connectedCallback() {
    if (this.increaseQuantity) this.increaseQuantity.addEventListener("click", this.handleQuantityChange);
    if (this.decreaseQuantity) this.decreaseQuantity.addEventListener("click", this.handleQuantityChange);
    if (this.removeItem) this.removeItem.addEventListener("click", this.handleQuantityChange);
  }

  disconnectedCallback() {
    if (this.increaseQuantity) this.increaseQuantity.removeEventListener("click", this.handleQuantityChange);
    if (this.decreaseQuantity) this.decreaseQuantity.removeEventListener("click", this.handleQuantityChange);
    if (this.removeItem) this.removeItem.removeEventListener("click", this.handleQuantityChange);
  }

  setLoadingState(loading, isRemoveAction = false) {
    this.isLoading = loading;

    //! Disable quantity buttons and input
    if (this.increaseQuantity) this.increaseQuantity.disabled = loading;
    if (this.decreaseQuantity) this.decreaseQuantity.disabled = loading;
    if (this.quantityInput) this.quantityInput.disabled = loading;

    //! Add loading class to container
    if (loading) {
      this.classList.add("loading");
    } else {
      this.classList.remove("loading");
    }

    //! For remove actions, only add shimmer to cart summary
    //! For quantity changes, add shimmer to both item price and cart summary
    if (!isRemoveAction) {
      //! Add shimmer to price elements in this cart item for quantity changes
      const cartItem = this.closest(".cart-drawer-item, .cart-item");
      if (cartItem) {
        const priceDetails = cartItem.querySelector(".cart-item-price-details, .cart-drawer-item__price");
        if (priceDetails) {
          if (loading) {
            priceDetails.classList.add("price-loading");
          } else {
            priceDetails.classList.remove("price-loading");
          }
        }
      }
    }

    //! Always add shimmer to cart summary totals for any action
    const cartSummaryTotals = document.querySelectorAll(".cart-summary-total");
    cartSummaryTotals.forEach((total) => {
      if (loading) {
        total.classList.add("price-loading");
      } else {
        total.classList.remove("price-loading");
      }
    });
  }

  showError(message) {
    if (typeof showToast === "function") {
      showToast(message);
    } else {
      console.error(message);
      alert(message);
    }
  }

  clearError() {
    // No-op
  }

  handleQuantityChange(event) {
    //! Prevent multiple submissions
    if (this.isLoading) return;

    this.clearError();

    const line = this.dataset.line;
    const quantity = event.currentTarget.dataset.quantity;

    if (!line || quantity == null) {
      console.error("Invalid line or quantity");
      return;
    }

    //! Determine if this is a remove action (quantity = 0)
    const isRemoveAction = parseInt(quantity) === 0;

    //! Set loading state with remove action flag
    this.setLoadingState(true, isRemoveAction);

    //! Get the cart type from the parent custom-cart element
    const customCart = this.closest("custom-cart");
    const cartType = customCart ? customCart.dataset.cartType || "drawer" : "drawer";

    //! Determine which sections to request
    let sections;
    if (cartType === "page") {
      sections = customCart ? `${customCart.dataset.sectionId},cart-icon` : "cart,cart-icon";
    } else {
      sections = "cart-drawer,cart-icon";
    }

    const formData = {
      line: line,
      quantity: quantity,
      sections: sections,
    };

    fetch(window.Shopify.routes.root + "cart/change.js", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          if (data && data.status === 422 && data.description) {
            this.showError(data.description);
          } else {
            this.showError("An unexpected error occurred.");
          }
          this.setLoadingState(false, isRemoveAction);
          return;
        }
        document.documentElement.dispatchEvent(
          new CustomEvent("cart:rerender", {
            detail: data,
            bubbles: true,
          }),
        );
      })
      .catch((error) => {
        console.error("Error updating cart:", error);
        this.showError("An unexpected error occurred.");
        //! Remove loading state on error
        this.setLoadingState(false, isRemoveAction);
      });
  }
}

customElements.define("cart-actions", CartActions);
