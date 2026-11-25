/**
 * ============================================================================
 * VARIANT SELECTOR - Custom Web Component for Shopify Product Variants
 * ============================================================================
 *
 * This component handles product variant selection (colors, sizes, etc.) and
 * updates the page dynamically without a full reload.
 *
 * Supports multiple picker types:
 * - Radio buttons (swatch and pill/button styles)
 * - Dropdown select elements
 *
 * FLOW:
 * 1. User selects a variant option (radio button or dropdown)
 * 2. Component collects selected options
 * 3. Finds matching variant from product data
 * 4. Updates URL, form input, and page content
 */

class VariantSelector extends HTMLElement {
  /**
   * CONSTRUCTOR
   * ----------------------------------------------------------------------------
   * Called when the <variant-selector> element is created.
   *
   * - super() calls the parent HTMLElement constructor
   * - Binds the event handler to maintain proper 'this' context
   */
  constructor() {
    super();
    // Bind the handler once so we can properly remove it later
    this.handleChange = this.onVariantChange.bind(this);
  }

  /**
   * CONNECTED CALLBACK - Lifecycle Method
   * ----------------------------------------------------------------------------
   * Called automatically when the element is added to the DOM.
   * This is the proper place to attach event listeners.
   *
   * Web Components Best Practice:
   * - connectedCallback: Add listeners, initialize
   * - disconnectedCallback: Remove listeners, cleanup
   *
   * This ensures:
   * - No memory leaks
   * - Proper cleanup if element is removed and re-added
   * - Event listeners work after innerHTML replacements
   */
  connectedCallback() {
    this.addEventListener("change", this.handleChange);
  }

  /**
   * DISCONNECTED CALLBACK - Lifecycle Cleanup
   * ----------------------------------------------------------------------------
   * Called automatically when the element is removed from the DOM.
   * Removes event listeners to prevent memory leaks.
   *
   * Why this matters:
   * - If element is removed but listener stays, memory leak occurs
   * - Prevents duplicate listeners if element is re-added
   * - Good practice for all custom elements
   */
  disconnectedCallback() {
    this.removeEventListener("change", this.handleChange);
  }

  /**
   * ON VARIANT CHANGE - Main Controller
   * ----------------------------------------------------------------------------
   * Triggered when user selects a different variant option.
   * Orchestrates the entire variant selection process.
   *
   * This works for both radio inputs and select dropdowns since both
   * trigger 'change' events that bubble up to the variant-selector element.
   *
   * Steps:
   * 1. Collect selected options (e.g., ["Red", "Large"])
   * 2. Find which variant matches those options
   * 3. Update browser URL with variant parameter
   * 4. Update hidden form input for cart submission
   * 5. Toggle Add-to-Cart button state (available / sold out)
   * 6. Update media gallery to show variant image
   * 7. Surgically update variant-dependent regions (price, installments, picker)
   * 8. Dispatch custom event for other components to react
   */
  onVariantChange(event) {
    this.updateOptions(); // Get selected options
    this.updateMasterId(); // Find matching variant

    if (!this.currentVariant) {
      console.log("No variant found");
      return;
    }

    console.log("Selected variant:", this.currentVariant);
    this.updateURL(); // Update browser URL
    this.updateVariantInput(); // Update hidden form input
    this.updateBuyButton(); // Toggle Add-to-Cart disabled/label (instant, no fetch)
    this.updateMedia(); // Update gallery to show variant image
    this.updateProductInfo(); // Fetch + surgically update variant-dependent regions

    // Dispatch custom event for other components to listen to
    // Other components can listen: document.addEventListener('variant:updated', ...)
    this.dispatchVariantUpdatedEvent();
  }

  /**
   * UPDATE OPTIONS - Collect Selected Values (UPDATED for Dropdown Support)
   * ----------------------------------------------------------------------------
   * Finds all selected variant options and extracts their values.
   * Supports both radio inputs and select dropdowns.
   *
   * Process:
   * 1. Find all option containers (.product-form__input) in order
   * 2. For each container, check if it contains radio inputs or a select
   * 3. Extract the selected value from whichever input type is present
   * 4. Build options array maintaining the correct order
   *
   * Example:
   * If user selects "Red" (from radio buttons) and "Large" (from dropdown):
   * this.options = ["Red", "Large"]
   *
   * Structure:
   * - Radio: <input type="radio" name="Color-1" value="Red" checked>
   * - Select: <select><option value="Large" selected>Large</option></select>
   *
   * Why this approach:
   * - Maintains correct option order (Color, Size, Material, etc.)
   * - Works regardless of which options use radio vs dropdown
   * - Handles mixed picker types in the same product
   */
  updateOptions() {
    const optionContainers = this.querySelectorAll(".product-form__input");

    this.options = Array.from(optionContainers, (container) => {
      // Check if it's a radio input option (swatch or button picker)
      const radioInput = container.querySelector('input[type="radio"]:checked');
      if (radioInput) {
        return radioInput.value;
      }

      // Check if it's a select dropdown option
      const selectInput = container.querySelector("select");
      if (selectInput) {
        return selectInput.value;
      }

      // Shouldn't reach here, but return null as fallback
      return null;
    }).filter((value) => value !== null);

    console.log("Selected options:", this.options);
  }

  /**
   * UPDATE MASTER ID - Find the Matching Variant
   * ----------------------------------------------------------------------------
   * Searches through all product variants to find one that matches
   * the currently selected options.
   *
   * How it works:
   * 1. Gets all variants from JSON (e.g., 20 variants total)
   * 2. For each variant, compares its options with selected options
   * 3. Returns the variant where ALL options match
   *
   * Example:
   * Available variants:
   *   { id: 123, options: ["Red", "Small"], price: "$20" }
   *   { id: 456, options: ["Red", "Large"], price: "$25" }  ← MATCH!
   *   { id: 789, options: ["Blue", "Large"], price: "$25" }
   *
   * Selected: ["Red", "Large"]
   * Result: this.currentVariant = { id: 456, options: ["Red", "Large"], ... }
   *
   * The logic:
   * - Maps each variant option to check if it equals selected option at same index
   * - If ANY option doesn't match, includes(false) returns true
   * - We use ! (NOT) to find variants where NO options are false (all match)
   */
  updateMasterId() {
    this.currentVariant = this.getVariantData().find((variant) => {
      return !variant.options
        .map((option, index) => {
          return this.options[index] === option;
        })
        .includes(false);
    });
  }

  /**
   * UPDATE URL - Update Browser Address Bar
   * ----------------------------------------------------------------------------
   * Changes the URL to include the selected variant ID without reloading the page.
   *
   * Before: /products/t-shirt
   * After:  /products/t-shirt?variant=456
   *
   * Benefits:
   * - Users can bookmark/share specific variant URLs
   * - Back/forward buttons work correctly
   * - SEO friendly
   *
   * window.history.replaceState:
   * - First param: state object (empty here)
   * - Second param: title (empty, unused)
   * - Third param: new URL
   */
  updateURL() {
    if (!this.currentVariant) return;
    window.history.replaceState({}, "", `${this.dataset.productUrl}?variant=${this.currentVariant.id}`);
  }

  /**
   * UPDATE VARIANT INPUT - Update Form Hidden Input
   * ----------------------------------------------------------------------------
   * Updates the hidden input field inside the product form so when the form
   * submits, it adds the correct variant to the cart.
   *
   * Structure:
   * <form id="product-form-123" action="/cart/add">
   *   <input name="id" value="variant-id">  ← We update this
   *   <input name="quantity" value="1">
   * </form>
   *
   * <add-to-cart>
   *   <button form="product-form-123">Add to Cart</button>
   * </add-to-cart>
   *
   * Steps:
   * 1. Find the parent product form (variant-selector is inside it)
   * 2. Find the hidden input with name="id"
   * 3. Update its value to the new variant ID
   * 4. Dispatch change event (in case other scripts listen to it)
   *
   * Before: <input name="id" value="123">
   * After:  <input name="id" value="456">
   */
  updateVariantInput() {
    if (!this.currentVariant) return;

    // Find the product form - the variant-selector is inside it
    const productForm = this.closest('form[action*="/cart/add"]');

    if (!productForm) {
      console.warn("Product form not found");
      return;
    }

    // Find the hidden input directly in the form (not nested in add-to-cart)
    const variantInput = productForm.querySelector('input[name="id"]');

    if (variantInput) {
      variantInput.value = this.currentVariant.id;
      // Dispatch change event in case other scripts are listening
      variantInput.dispatchEvent(new Event("change", { bubbles: true }));
      console.log("Variant input updated to:", this.currentVariant.id);
    } else {
      console.warn('Variant input with name="id" not found in form');
    }
  }

  /**
   * UPDATE BUY BUTTON - Toggle Add-to-Cart State In Place
   * ----------------------------------------------------------------------------
   * Mirrors Dawn's toggleSubmitButton: flips the EXISTING button's `disabled`
   * state and label based on the selected variant's availability WITHOUT
   * replacing any DOM. Reads the labels from the button's own data attributes
   * (set in snippets/add-to-cart.liquid). Runs synchronously for instant
   * feedback (no network wait). The sticky bar updates itself by listening to
   * the `variant:updated` event.
   */
  updateBuyButton() {
    if (!this.currentVariant) return;

    const button = document.querySelector('.pdp-atc button[type="submit"]');
    if (!button) return;

    const available = this.currentVariant.available;
    button.disabled = !available;

    const textEl = button.querySelector(".atc-button__text");
    if (textEl) {
      textEl.textContent = available
        ? button.dataset.addLabel || textEl.textContent
        : button.dataset.soldOutLabel || textEl.textContent;
    }
  }

  /**
   * UPDATE MEDIA - Switch Gallery to Variant Image
   * ----------------------------------------------------------------------------
   * When a variant is selected, this updates the Swiper gallery to show
   * the image associated with that variant (if it has one).
   *
   * Process:
   * 1. Check if variant has a featured_media (variant image)
   * 2. Find the media gallery element by ID
   * 3. Find the slide with matching media ID using data-media-id attribute
   * 4. Get the slide index
   * 5. Use Swiper's slideTo() to transition to that image
   * 6. Both main and thumbnail swipers update automatically (thumbs is linked)
   *
   * Example:
   * User selects "Red" variant → Gallery smoothly fades to red product image
   *
   * How it works with Swiper:
   * - Each slide has data-media-id="{{ media.id }}"
   * - Variant has featured_media.id that matches one of the slides
   * - We find the slide index and call slideTo(index)
   * - Swiper handles the smooth transition
   * - Thumbnail swiper syncs automatically via thumbs option
   */
  updateMedia() {
    // Exit if variant has no image
    if (!this.currentVariant) return;
    if (!this.currentVariant.featured_media) return;

    const sectionId = this.dataset.sectionId;
    const mediaGallery = document.getElementById(`MediaGallery-${sectionId}`);
    if (!mediaGallery) return;

    // Find the slide that matches the variant's media ID
    const targetSlide = mediaGallery.querySelector(
      `.pdp-gallery-carousel__swiper--main [data-media-id="${this.currentVariant.featured_media.id}"]`,
    );
    if (!targetSlide) return;

    // Get all slides to find the index
    const allSlides = mediaGallery.querySelectorAll(".pdp-gallery-carousel__swiper--main .swiper-slide");
    const slideIndex = Array.from(allSlides).indexOf(targetSlide);

    if (slideIndex === -1) return;

    // Access the Swiper instance (stored globally with section ID)
    const swiperInstance = window[`swiperMain_${sectionId}`];
    if (swiperInstance) {
      // Slide to the variant image
      // The thumbnail swiper will automatically sync
      swiperInstance.slideTo(slideIndex);
      console.log(`Gallery updated to variant image at slide ${slideIndex}`);
    } else {
      console.warn("Swiper instance not found for section:", sectionId);
    }
  }

  /**
   * UPDATE PRODUCT INFO - Fetch & Surgically Update Variant-Dependent Regions
   * ----------------------------------------------------------------------------
   * Fetches the product page for the new variant and updates ONLY the regions
   * that depend on the variant. We do NOT replace the whole #ProductInfo
   * container, because that destroys Shopify @app block mounts (their JS runs
   * once on load and never re-initializes), making app widgets disappear.
   *
   * What we touch (mirrors Dawn's targeted updates):
   * - Price blocks          -> [id^="price-"]                   (innerHTML swap)
   * - Shop Pay installments -> .pdp-shop-pay-installments-wrapper (innerHTML swap)
   * - The picker, IN PLACE  -> this.innerHTML (refresh option availability /
   *   selection without removing <variant-selector>, so its change listener
   *   survives). Focus is restored to the just-changed option.
   *
   * Everything else (@app blocks, title, description, accordions, media) is left
   * untouched. The Add-to-Cart button is handled in updateBuyButton().
   *
   * Race guard: if the user changes variant again mid-fetch, bail so only the
   * latest selection wins.
   */
  updateProductInfo() {
    const requestedVariantId = this.currentVariant.id;
    const sectionId = this.dataset.sectionId;

    fetch(`${this.dataset.productUrl}?variant=${requestedVariantId}&section_id=${sectionId}`)
      .then((response) => response.text())
      .then((responseText) => {
        // Bail if the user moved on to another variant while fetching.
        if (this.currentVariant.id !== requestedVariantId) return;

        const html = new DOMParser().parseFromString(responseText, "text/html");
        const newProductInfo = html.getElementById(`ProductInfo-${sectionId}`);
        const currentProductInfo = document.getElementById(`ProductInfo-${sectionId}`);
        if (!newProductInfo || !currentProductInfo) return;

        // Copy innerHTML for variant-dependent regions only, paired BY INDEX.
        // Index-pairing is safe because both renders are the same section/blocks
        // in the same order (only ?variant= differs), so it needs no block ids.
        const swap = (selector) => {
          const sources = newProductInfo.querySelectorAll(selector);
          const targets = currentProductInfo.querySelectorAll(selector);
          sources.forEach((source, i) => {
            if (targets[i]) targets[i].innerHTML = source.innerHTML;
          });
        };

        swap('[id^="price-"]');
        swap(".pdp-shop-pay-installments-wrapper");

        // Refresh the picker IN PLACE so option availability / selection update
        // without removing <variant-selector> (its change listener survives and
        // @app blocks are never touched). Restore focus to the changed option.
        const newSelector = newProductInfo.querySelector("variant-selector");
        if (newSelector) {
          const activeId = document.activeElement?.closest?.("[data-option-value-id]")?.dataset.optionValueId;
          this.innerHTML = newSelector.innerHTML;
          if (activeId) {
            this.querySelector(`[data-option-value-id="${activeId}"]`)?.focus();
          }
        }
      })
      .catch((error) => {
        console.error("Error fetching product info:", error);
      });
  }

  /**
   * DISPATCH VARIANT UPDATED EVENT - Custom Event
   * ----------------------------------------------------------------------------
   * Dispatches a custom event that other components can listen to.
   * This allows other parts of your application to react to variant changes.
   *
   * Event details include:
   * - variantId: The selected variant's ID
   * - variant: The full variant object
   * - sectionId: The section ID for context
   *
   * Usage in other components:
   * ```javascript
   * document.addEventListener('variant:updated', (event) => {
   *   console.log('New variant selected:', event.detail.variantId);
   *   // Update other UI elements, analytics, etc.
   * });
   * ```
   *
   * Common use cases:
   * - Update related product recommendations
   * - Trigger analytics tracking
   * - Update size guides or fitting information
   * - Refresh dynamic pricing calculators
   * - Update quantity limits based on inventory
   */
  dispatchVariantUpdatedEvent() {
    const customEvent = new CustomEvent("variant:updated", {
      bubbles: true,
      detail: {
        variantId: this.currentVariant.id,
        variant: this.currentVariant,
        sectionId: this.dataset.sectionId,
      },
    });

    document.dispatchEvent(customEvent);
    console.log("Variant updated event dispatched:", this.currentVariant.id);
  }

  /**
   * GET VARIANT DATA - Load Product Variants from JSON
   * ----------------------------------------------------------------------------
   * Reads and caches the variant data from the JSON script tag.
   *
   * The Liquid template renders:
   * <script type="application/json">
   *   [
   *     { "id": 123, "options": ["Red", "Small"], "price": 2000, "available": true },
   *     { "id": 456, "options": ["Red", "Large"], "price": 2500, "available": true },
   *     ...
   *   ]
   * </script>
   *
   * This method:
   * 1. Checks if data is already cached (prevents re-parsing)
   * 2. Finds the script tag with type="application/json"
   * 3. Parses the JSON string into JavaScript array
   * 4. Caches it in this.variantData
   * 5. Returns the array
   *
   * Caching: Once parsed, we store it so subsequent calls don't
   * need to query the DOM and parse JSON again.
   */
  getVariantData() {
    // Return cached data if already loaded
    if (this.variantData) return this.variantData;

    // Find the JSON script tag
    const variantScript = this.querySelector('[type="application/json"]');
    if (!variantScript) {
      console.error("Variant data script not found");
      return [];
    }

    // Parse JSON and cache it
    this.variantData = JSON.parse(variantScript.textContent);
    return this.variantData;
  }
}

/**
 * REGISTER CUSTOM ELEMENT
 * ----------------------------------------------------------------------------
 * Tells the browser to use this VariantSelector class whenever it encounters
 * a <variant-selector> tag in the HTML.
 *
 * After this line, you can use:
 * <variant-selector data-product-url="/products/example">
 *   <!-- variant options here (radio or select) -->
 * </variant-selector>
 */
customElements.define("variant-selector", VariantSelector);
