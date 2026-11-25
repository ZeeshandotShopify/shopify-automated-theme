/**
 * ============================================================================
 * CollectionTabs Web Component - Self-Initializing Swiper Version
 * ============================================================================
 *
 * PURPOSE:
 * This custom web component creates a tabbed interface for displaying different
 * product collections. It handles BOTH Swiper initialization AND tab filtering.
 *
 * WHAT IT DOES:
 * 1. Initializes Swiper carousel when the component loads
 * 2. Caches all product slides from all collections
 * 3. Filters slides to show only products from the active collection
 * 4. Updates UI when users click different tabs
 *
 * HTML STRUCTURE EXAMPLE:
 * <collection-tabs data-target="collection-tabs-swiper-123">
 *   <button data-collection="necklaces" class="active">Necklaces</button>
 *   <button data-collection="earrings">Earrings</button>
 *   <button data-collection="rings">Rings</button>
 * </collection-tabs>
 *
 * <div id="collection-tabs-swiper-123" class="swiper">
 *   <div class="swiper-wrapper">
 *     <div class="swiper-slide" data-collection="necklaces">Product 1</div>
 *     <div class="swiper-slide" data-collection="necklaces">Product 2</div>
 *     <div class="swiper-slide" data-collection="earrings">Product 3</div>
 *     <div class="swiper-slide" data-collection="rings">Product 4</div>
 *   </div>
 * </div>
 *
 * ============================================================================
 */

if (!customElements.get("collection-tabs")) {
  class CollectionTabs extends HTMLElement {
    /**
     * ========================================================================
     * CONSTRUCTOR
     * ========================================================================
     *
     * Runs automatically when a new instance is created.
     * Example: When the browser encounters <collection-tabs> in the HTML
     *
     * What happens:
     * - Creates empty array to store slide copies
     * - Sets Swiper instance to null (not ready yet)
     *
     * Example state after constructor:
     * {
     *   allSlides: [],
     *   swiperInstance: null
     * }
     */
    constructor() {
      super();

      /**
       * Storage for all product slides from all collections
       * After caching, this will contain cloned DOM elements
       *
       * Example after caching:
       * [
       *   <div class="swiper-slide" data-collection="necklaces">Necklace 1</div>,
       *   <div class="swiper-slide" data-collection="necklaces">Necklace 2</div>,
       *   <div class="swiper-slide" data-collection="earrings">Earring 1</div>,
       *   ... (32 total slides)
       * ]
       */
      this.allSlides = [];

      /**
       * Reference to the Swiper carousel instance
       * After initialization, this will be a Swiper object with methods like:
       * - slideTo(), update(), removeAllSlides(), appendSlide(), etc.
       *
       * Example after initialization:
       * Swiper {
       *   params: { slidesPerView: 1.3, spaceBetween: 16, ... },
       *   slides: [32 slide elements],
       *   activeIndex: 0,
       *   update: function(),
       *   slideTo: function(index, speed),
       *   ...
       * }
       */
      this.swiperInstance = null;
    }

    /**
     * ========================================================================
     * CONNECTEDCALLBACK - Component Lifecycle Method
     * ========================================================================
     *
     * Runs automatically when this custom element is added to the DOM.
     * Similar to componentDidMount() in React or mounted() in Vue.
     *
     * FLOW:
     * 1. Check if DOM is still loading
     * 2. If loading → wait for DOMContentLoaded event
     * 3. If ready → initialize immediately
     *
     * Example scenarios:
     *
     * Scenario A (DOM still loading):
     * document.readyState = 'loading' → wait for event → then initialize()
     *
     * Scenario B (DOM already loaded):
     * document.readyState = 'interactive' or 'complete' → initialize() immediately
     */
    connectedCallback() {
      // console.log('🔌 Collection tabs component connected to DOM');

      /**
       * Check DOM readiness
       *
       * document.readyState values:
       * - 'loading'    → HTML is still being parsed
       * - 'interactive' → HTML parsed, but resources (images, etc.) still loading
       * - 'complete'   → Everything fully loaded
       *
       * Example:
       * If readyState = 'loading', we need to wait
       * If readyState = 'interactive' or 'complete', we're good to go
       */
      if (document.readyState === "loading") {
        // console.log('⏳ DOM still loading, waiting for DOMContentLoaded...');
        document.addEventListener("DOMContentLoaded", () => this.initialize());
      } else {
        // console.log('✅ DOM ready, initializing immediately');
        this.initialize();
      }
    }

    /**
     * ========================================================================
     * INITIALIZE - Main Setup Method
     * ========================================================================
     *
     * This is where all the magic happens. Sets up the entire component.
     *
     * EXECUTION FLOW:
     * Step 1: Find all tab buttons
     * Step 2: Find related DOM elements (header, slider)
     * Step 3: Initialize Swiper carousel
     * Step 4: Cache all slides
     * Step 5: Run initial filter
     * Step 6: Attach button click handlers
     * Step 7: Setup Shopify theme editor support
     *
     * Example execution with 3 tabs and 32 products:
     *
     * Step 1: Found 3 buttons → [button, button, button]
     * Step 2: Found slider → <div id="collection-tabs-swiper-123">
     * Step 3: Swiper initialized → swiperInstance = Swiper {...}
     * Step 4: Cached 32 slides → allSlides = [32 slide elements]
     * Step 5: Filtered to show "necklaces" → 8 slides visible
     * Step 6: Attached 3 click handlers
     * Step 7: Theme editor ready
     */
    initialize() {
      // console.log('🚀 Starting initialization...');

      /**
       * ====================================================================
       * STEP 1: Find all tab buttons inside this component
       * ====================================================================
       *
       * querySelectorAll returns a NodeList, we convert it to Array for easier manipulation
       *
       * Example HTML:
       * <collection-tabs>
       *   <button data-collection="necklaces" class="active">Necklaces</button>
       *   <button data-collection="earrings">Earrings</button>
       *   <button data-collection="rings">Rings</button>
       * </collection-tabs>
       *
       * Result:
       * buttons = [
       *   <button data-collection="necklaces" class="active">,
       *   <button data-collection="earrings">,
       *   <button data-collection="rings">
       * ]
       * Length: 3
       */
      const buttons = Array.from(this.querySelectorAll("button"));
      // console.log('📍 Found', buttons.length, 'tab buttons');

      /**
       * ====================================================================
       * STEP 2: Find the header element (contains "Shop All" links)
       * ====================================================================
       *
       * .closest() walks up the DOM tree to find the nearest matching ancestor
       *
       * DOM structure:
       * <div class="collection-tabs-header">        ← We want this
       *   <div class="collection-tabs-header-top">
       *     <h2>Our Collections</h2>
       *     <div class="collection-tabs-link-desktop">
       *       <a href="/necklaces">Shop All Necklaces</a>  ← Links to sync
       *       <a href="/earrings">Shop All Earrings</a>
       *     </div>
       *   </div>
       *   <collection-tabs>                         ← We are here
       *     <button>...</button>
       *   </collection-tabs>
       * </div>
       *
       * Result:
       * collectionTabsHeader = <div class="collection-tabs-header">...</div>
       * or null if not found
       */
      const collectionTabsHeader = this.closest(".collection-tabs-header");
      // console.log('📍 Found header element:', collectionTabsHeader ? 'Yes' : 'No');

      /**
       * ====================================================================
       * STEP 3: Get the target Swiper element ID
       * ====================================================================
       *
       * HTML example:
       * <collection-tabs data-target="collection-tabs-swiper-template--12345">
       *
       * this.dataset.target extracts the value of data-target attribute
       *
       * Result:
       * this.target = "collection-tabs-swiper-template--12345"
       */
      this.target = this.dataset.target;
      // console.log('🎯 Target Swiper ID:', this.target);

      /**
       * ====================================================================
       * STEP 4: Find the Swiper carousel element
       * ====================================================================
       *
       * Using getElementById to find the carousel container
       *
       * Example HTML:
       * <div id="collection-tabs-swiper-template--12345" class="swiper">
       *   <div class="swiper-wrapper">
       *     <div class="swiper-slide" data-collection="necklaces">...</div>
       *     <div class="swiper-slide" data-collection="necklaces">...</div>
       *     <div class="swiper-slide" data-collection="earrings">...</div>
       *     ... (32 total slides)
       *   </div>
       *   <div class="swiper-pagination"></div>
       * </div>
       *
       * Result:
       * sliderElement = <div id="collection-tabs-swiper-template--12345" class="swiper">
       */
      const sliderElement = document.getElementById(this.target);

      /**
       * Safety check: Exit if Swiper element doesn't exist
       * This prevents errors if the HTML structure is incorrect
       *
       * Possible reasons for failure:
       * - Typo in data-target attribute
       * - Swiper element hasn't been rendered yet
       * - Element was removed from DOM
       */
      if (!sliderElement) {
        console.error("❌ Swiper element not found with ID:", this.target);
        console.error(
          "💡 Check that data-target matches the Swiper element ID",
        );
        return;
      }
      // console.log('✅ Found Swiper element');

      /**
       * ====================================================================
       * STEP 5: Get Swiper configuration
       * ====================================================================
       *
       * Calls getSwiperConfig() which returns an object with Swiper settings
       *
       * Example configuration returned:
       * {
       *   slidesPerView: 1.3,           ← Show 1.3 slides on mobile
       *   spaceBetween: 16,              ← 16px gap between slides
       *   navigation: {
       *     prevEl: <button class="swiper-prev">,
       *     nextEl: <button class="swiper-next">
       *   },
       *   pagination: {
       *     el: <div class="swiper-pagination">,
       *     type: "progressbar"
       *   },
       *   breakpoints: {
       *     1024: {                      ← At 1024px and above
       *       slidesPerView: 4,          ← Show 4 slides
       *       spaceBetween: 32           ← 32px gap
       *     }
       *   }
       * }
       */
      const config = this.getSwiperConfig(sliderElement);
      // console.log('⚙️ Swiper config:', config);

      /**
       * ====================================================================
       * STEP 6: Initialize Swiper carousel
       * ====================================================================
       *
       * Creates a new Swiper instance and attaches it to the slider element
       *
       * Before initialization:
       * sliderElement.swiper = undefined
       * this.swiperInstance = null
       *
       * After initialization:
       * sliderElement.swiper = Swiper { params, slides, activeIndex, ... }
       * this.swiperInstance = Swiper { params, slides, activeIndex, ... }
       *
       * The Swiper constructor:
       * 1. Parses the HTML structure
       * 2. Sets up navigation buttons
       * 3. Sets up pagination
       * 4. Applies responsive breakpoints
       * 5. Makes slides draggable
       * 6. Attaches itself to sliderElement.swiper property
       *
       * Example result:
       * this.swiperInstance = {
       *   params: { slidesPerView: 1.3, ... },
       *   slides: [32 HTMLElements],
       *   activeIndex: 0,
       *   previousIndex: 0,
       *   width: 375,                    ← Container width in pixels
       *   slideTo: function(index, speed),
       *   update: function(),
       *   removeAllSlides: function(),
       *   appendSlide: function(slides),
       *   ... (many more methods and properties)
       * }
       */
      this.swiperInstance = new Swiper(sliderElement, config);
      // console.log('✅ Swiper initialized successfully');
      // console.log('📊 Total slides in Swiper:', this.swiperInstance.slides.length);

      /**
       * ====================================================================
       * STEP 7: Cache all slides in memory
       * ====================================================================
       *
       * Calls cacheSlides() which creates clones of all slides
       *
       * Why we need this:
       * When we filter, Swiper removes slides from the DOM. If we don't have
       * copies, we can't switch back to other collections.
       *
       * Before caching:
       * this.allSlides = []
       *
       * After caching:
       * this.allSlides = [32 cloned slide elements]
       *
       * Example:
       * Original slides in Swiper: 32
       * - 12 from "necklaces" collection
       * - 8 from "earrings" collection
       * - 12 from "rings" collection
       *
       * After caching, all 32 are stored in this.allSlides as clones
       */
      this.cacheSlides();

      /**
       * ====================================================================
       * STEP 8: Run initial filter
       * ====================================================================
       *
       * Show products from the first active tab on page load
       *
       * Flow:
       * 1. Find the button with class "active" (set by Liquid template)
       * 2. Get its data-collection attribute value
       * 3. Filter Swiper to show only products from that collection
       *
       * Example:
       * Active button: <button data-collection="necklaces" class="active">
       *
       * Before filtering:
       * Swiper shows all 32 slides (necklaces + earrings + rings)
       *
       * After filtering:
       * Swiper shows only 12 necklace slides
       *
       * Visual representation:
       * Before: [N1, N2, N3, E1, E2, R1, R2, ...]  (32 slides)
       * After:  [N1, N2, N3, N4, N5, ...]          (12 necklace slides)
       */
      const activeBtn = this.querySelector("button.active");
      if (activeBtn && activeBtn.dataset.collection) {
        // console.log('🎨 Running initial filter for collection:', activeBtn.dataset.collection);
        this.filterSwiper(activeBtn.dataset.collection);
      } else {
        console.log("ℹ️ No active tab found, showing all slides");
      }

      /**
       * ====================================================================
       * STEP 9: Attach click handlers to buttons
       * ====================================================================
       *
       * Add event listeners to each tab button so users can switch collections
       *
       * For each button (3 total in this example):
       * 1. Attach click event listener
       * 2. When clicked:
       *    - Prevent default behavior
       *    - Update button states (mark clicked button as active)
       *    - Update "Shop All" link states
       *    - Filter Swiper to show only products from clicked collection
       *
       * Example flow when user clicks "Earrings" button:
       *
       * User clicks: <button data-collection="earrings">Earrings</button>
       *
       * Step 1: preventDefault() → Stops any default link/form behavior
       * Step 2: toggleButtons() → Removes 'active' from all buttons, adds to clicked button
       *   Before: [<button class="active">, <button>, <button>]  ← Necklaces active
       *   After:  [<button>, <button class="active">, <button>]  ← Earrings active
       *
       * Step 3: toggleLinks() → Updates "Shop All" links
       *   Before: "Shop All Necklaces" is highlighted
       *   After:  "Shop All Earrings" is highlighted
       *
       * Step 4: filterSwiper('earrings') → Shows only earring products
       *   Before: 12 necklace slides visible
       *   After:  8 earring slides visible
       *
       * Console output for this click:
       * "👆 Button clicked: earrings"
       * "🔍 Filtering for: earrings"
       * "📦 Matching slides: 8"
       * "✅ Filter complete"
       */
      buttons.forEach((button, i) => {
        button.addEventListener("click", (event) => {
          // Prevent default button behavior (form submission, navigation)
          event.preventDefault();

          // console.log('👆 Button clicked:', button.dataset.collection);

          /**
           * Update button active states
           *
           * Example with 3 buttons, clicking index 1 (Earrings):
           *
           * Before:
           * buttons[0] → <button class="active">Necklaces</button>
           * buttons[1] → <button>Earrings</button>
           * buttons[2] → <button>Rings</button>
           *
           * After toggleButtons(buttons, 1):
           * buttons[0] → <button>Necklaces</button>
           * buttons[1] → <button class="active">Earrings</button>
           * buttons[2] → <button>Rings</button>
           */
          this.toggleButtons(buttons, i);

          /**
           * Update "Shop All" link states
           *
           * If collectionTabsHeader exists and contains links:
           *
           * Before:
           * links[0] → <a class="active">Shop All Necklaces</a>
           * links[1] → <a>Shop All Earrings</a>
           * links[2] → <a>Shop All Rings</a>
           *
           * After toggleLinks(links, 1):
           * links[0] → <a>Shop All Necklaces</a>
           * links[1] → <a class="active">Shop All Earrings</a>
           * links[2] → <a>Shop All Rings</a>
           */
          if (collectionTabsHeader) {
            const linkGroups = collectionTabsHeader.querySelectorAll(
              ".collection-tabs-links",
            );

            linkGroups.forEach((group) => {
              const links = group.querySelectorAll(
                ".collection-tabs-linked-to-tab",
              );
              this.toggleLinks(links, i);
            });
          }

          /**
           * Filter Swiper to show clicked collection
           *
           * Example: button.dataset.collection = "earrings"
           *
           * filterSwiper() will:
           * 1. Remove all current slides from Swiper
           * 2. Filter this.allSlides to find only earring products
           * 3. Add back only the earring slides
           * 4. Update Swiper
           * 5. Jump to first slide
           *
           * Result: Carousel now shows only 8 earring products
           */
          if (button.dataset.collection) {
            this.filterSwiper(button.dataset.collection);
          }
        });
      });

      // console.log('✅ Click handlers attached to', buttons.length, 'buttons');

      /**
       * ====================================================================
       * STEP 10: Shopify Theme Editor Support
       * ====================================================================
       *
       * When a merchant customizes their theme in Shopify admin, they can
       * click blocks in the editor sidebar. This makes the corresponding tab
       * activate in the live preview.
       *
       * How it works:
       * 1. Check if we're in Shopify's design mode (theme editor)
       * 2. Listen for 'shopify:block:select' event
       * 3. When a block is clicked in editor, find matching button
       * 4. Programmatically click that button
       *
       * Example flow:
       *
       * Merchant clicks "Earrings" block in editor sidebar
       * ↓
       * Shopify fires: shopify:block:select event
       * ↓
       * event.target = <button data-collection="earrings">
       * ↓
       * Find button index in buttons array: index = 1
       * ↓
       * Trigger click: buttons[1].dispatchEvent(new Event('click'))
       * ↓
       * Button click handler runs → Earrings tab becomes active
       *
       * Result: Merchant sees the theme preview update to show earrings
       */
      if (window.Shopify?.designMode) {
        // console.log('🎨 Shopify design mode detected - enabling editor support');

        this.addEventListener("shopify:block:select", (event) => {
          // console.log('📝 Block selected in theme editor:', event.target);

          // Find which button corresponds to the selected block
          const index = buttons.indexOf(event.target);

          if (index !== -1) {
            // console.log('🎯 Triggering click on button', index);
            // Programmatically click the button to activate the tab
            buttons[index].dispatchEvent(new Event("click"));
          } else {
            console.warn(
              "⚠️ Could not find matching button for selected block",
            );
          }
        });
      }

      // console.log('🎉 Initialization complete!');
    }

    /**
     * ========================================================================
     * GETSWIPERCONFIG - Build Swiper Configuration Object
     * ========================================================================
     *
     * PURPOSE:
     * Creates the configuration object that controls how Swiper behaves.
     * Can be customized via data attributes on the slider element.
     *
     * @param {HTMLElement} sliderElement - The Swiper container element
     * @returns {Object} Swiper configuration object
     *
     * FLOW:
     * 1. Find parent section and navigation elements
     * 2. Create default configuration
     * 3. Check for custom data attributes
     * 4. Override defaults if custom values exist
     * 5. Return final configuration
     *
     * EXAMPLE INPUT:
     * sliderElement = <div
     *   id="collection-tabs-swiper-123"
     *   class="swiper"
     *   data-slides-mobile="2"
     *   data-slides-desktop="5"
     * >
     *
     * EXAMPLE OUTPUT:
     * {
     *   slidesPerView: 2,              ← Overridden by data-slides-mobile
     *   spaceBetween: 16,
     *   navigation: {
     *     prevEl: <button class="swiper-prev">,
     *     nextEl: <button class="swiper-next">
     *   },
     *   pagination: {
     *     el: <div class="swiper-pagination">,
     *     type: "progressbar"
     *   },
     *   breakpoints: {
     *     1024: {
     *       slidesPerView: 5,          ← Overridden by data-slides-desktop
     *       spaceBetween: 32
     *     }
     *   }
     * }
     */
    getSwiperConfig(sliderElement) {
      // console.log('⚙️ Building Swiper configuration...');

      /**
       * Find the parent section wrapper
       * This contains the navigation buttons and pagination
       *
       * Example DOM:
       * <div class="collection-tabs-wrapper">        ← section (we want this)
       *   <div class="collection-tabs-inner">
       *     <button class="swiper-prev">←</button>    ← prevButton
       *     <button class="swiper-next">→</button>    ← nextButton
       *     <div class="swiper">                      ← sliderElement (we are here)
       *       <div class="swiper-pagination"></div>   ← paginationEl
       *     </div>
       *   </div>
       * </div>
       */
      const section = sliderElement.closest(".collection-tabs-wrapper");
      const prevButton = section.querySelector(".collection-tabs-swiper-prev");
      const nextButton = section.querySelector(".collection-tabs-swiper-next");
      const paginationEl = section.querySelector(".swiper-pagination");

      // console.log('📍 Navigation elements found:');
      // console.log('  - Previous button:', prevButton ? 'Yes' : 'No');
      // console.log('  - Next button:', nextButton ? 'Yes' : 'No');
      // console.log('  - Pagination:', paginationEl ? 'Yes' : 'No');

      /**
       * Default Swiper configuration
       *
       * slidesPerView: 1.3
       * - Shows 1 full slide + 30% of next slide on mobile
       * - Creates peek effect to indicate more content
       *
       * spaceBetween: 16
       * - 16px gap between slides on mobile
       *
       * navigation:
       * - prevEl: Previous button element (←)
       * - nextEl: Next button element (→)
       * - Swiper will enable/disable these automatically
       *
       * pagination:
       * - el: Pagination container element
       * - type: "progressbar" shows a horizontal bar indicating position
       *   Alternative types: "bullets", "fraction"
       *
       * breakpoints:
       * - 768: Configuration for tablet screens 768px and wider
       * - slidesPerView: 2.3 (show 2 full slides plus a peek of the next)
       * - 1024: Configuration for screens 1024px and wider (desktop)
       * - slidesPerView: 4 (show 4 full slides)
       * - spaceBetween: 32 (32px gap)
       */
      const config = {
        slidesPerView: 1.3,
        spaceBetween: 16,
        navigation: {
          prevEl: prevButton,
          nextEl: nextButton,
        },
        pagination: {
          el: paginationEl,
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
      };

      /**
       * ====================================================================
       * Optional Customization via Data Attributes
       * ====================================================================
       *
       * Merchants can customize Swiper settings per section using data attributes
       *
       * HTML Example:
       * <div
       *   id="collection-tabs-swiper-123"
       *   class="swiper"
       *   data-slides-mobile="2"      ← Show 2 slides on mobile
       *   data-slides-desktop="5"     ← Show 5 slides on desktop
       *   data-space-mobile="8"       ← 8px gap on mobile
       *   data-space-desktop="24"     ← 24px gap on desktop
       * >
       *
       * Override Example:
       *
       * Default config:
       * { slidesPerView: 1.3, spaceBetween: 16 }
       *
       * With data-slides-mobile="2" and data-space-mobile="8":
       * { slidesPerView: 2, spaceBetween: 8 }
       *
       * This allows different sections to have different layouts without
       * modifying JavaScript.
       */

      // Override mobile slides per view
      if (sliderElement.dataset.slidesMobile) {
        const value = parseFloat(sliderElement.dataset.slidesMobile);
        config.slidesPerView = value;
        // console.log('🔧 Custom mobile slides:', value);
      }

      // Override desktop slides per view
      if (sliderElement.dataset.slidesDesktop) {
        const value = parseInt(sliderElement.dataset.slidesDesktop);
        config.breakpoints[1024].slidesPerView = value;
        // console.log('🔧 Custom desktop slides:', value);
      }

      // Override mobile spacing
      if (sliderElement.dataset.spaceMobile) {
        const value = parseInt(sliderElement.dataset.spaceMobile);
        config.spaceBetween = value;
        // console.log('🔧 Custom mobile spacing:', value + 'px');
      }

      // Override desktop spacing
      if (sliderElement.dataset.spaceDesktop) {
        const value = parseInt(sliderElement.dataset.spaceDesktop);
        config.breakpoints[1024].spaceBetween = value;
        // console.log('🔧 Custom desktop spacing:', value + 'px');
      }

      // console.log('✅ Final configuration:', config);
      return config;
    }

    /**
     * ========================================================================
     * CACHESLIDES - Store Copies of All Slides
     * ========================================================================
     *
     * PURPOSE:
     * Creates clones of all product slides and stores them in memory.
     * This is essential for tab filtering to work.
     *
     * WHY WE NEED THIS:
     * When we filter Swiper, it removes slides from the DOM. Without copies,
     * we can't switch back to other collections because the data is gone.
     *
     * FLOW:
     * 1. Check if Swiper instance exists
     * 2. Check if Swiper has slides
     * 3. Loop through each slide
     * 4. Clone each slide (deep copy with all children)
     * 5. Store clones in this.allSlides array
     *
     * EXAMPLE:
     *
     * Swiper contains 32 slides total:
     * - Slides 0-11:  Necklaces (12 products)
     * - Slides 12-19: Earrings (8 products)
     * - Slides 20-31: Rings (12 products)
     *
     * Before caching:
     * this.allSlides = []
     *
     * During caching (loop iteration 0):
     * Original slide: <div class="swiper-slide" data-collection="necklaces">
     *                   <div class="product-card">
     *                     <img src="necklace1.jpg">
     *                     <h3>Gold Necklace</h3>
     *                     <p>$99.00</p>
     *                   </div>
     *                 </div>
     *
     * Clone created: <div class="swiper-slide" data-collection="necklaces">
     *                  <div class="product-card">
     *                    <img src="necklace1.jpg">
     *                    <h3>Gold Necklace</h3>
     *                    <p>$99.00</p>
     *                  </div>
     *                </div>
     * (Exact copy with all nested elements)
     *
     * After caching all 32 slides:
     * this.allSlides = [
     *   <div data-collection="necklaces">Product 1</div>,
     *   <div data-collection="necklaces">Product 2</div>,
     *   ...
     *   <div data-collection="earrings">Product 13</div>,
     *   ...
     *   <div data-collection="rings">Product 21</div>,
     *   ...
     * ] (32 total clones)
     *
     * Memory usage: ~100-200KB depending on product card complexity
     */
    cacheSlides() {
      console.log("💾 Caching slides...");

      /**
       * Safety check #1: Swiper instance exists
       */
      if (!this.swiperInstance) {
        console.error("❌ Cannot cache slides - Swiper instance not available");
        return;
      }

      /**
       * Safety check #2: Swiper has slides
       */
      if (!this.swiperInstance.slides) {
        console.error("❌ Cannot cache slides - No slides found in Swiper");
        return;
      }

      /**
       * Log the number of slides found
       *
       * Example output:
       * "📊 Found 32 slides to cache"
       */
      // console.log('📊 Found', this.swiperInstance.slides.length, 'slides to cache');

      /**
       * Clone every slide and store in memory
       *
       * Array.from() converts the NodeList to a regular Array
       * .map() transforms each slide by cloning it
       *
       * cloneNode(true) creates a deep clone:
       * - true parameter = clone all children too
       * - false parameter = clone only the element, not children
       *
       * Example transformation:
       * Input: [HTMLElement, HTMLElement, HTMLElement, ...]
       * Output: [ClonedHTMLElement, ClonedHTMLElement, ClonedHTMLElement, ...]
       *
       * Each clone is completely independent:
       * - Changes to original don't affect clone
       * - Changes to clone don't affect original
       * - Event listeners are NOT cloned (need to be re-attached if needed)
       */
      this.allSlides = Array.from(this.swiperInstance.slides).map((slide) => {
        // Create deep clone of slide and all its children
        const clone = slide.cloneNode(true);
        return clone;
      });

      /**
       * Log success with breakdown by collection
       *
       * Example output:
       * "✅ Cached 32 slides successfully"
       * "  - necklaces: 12 slides"
       * "  - earrings: 8 slides"
       * "  - rings: 12 slides"
       */
      // console.log('✅ Cached', this.allSlides.length, 'slides successfully');

      // Optional: Log breakdown by collection
      const collectionCounts = {};
      this.allSlides.forEach((slide) => {
        const collection = slide.dataset.collection;
        collectionCounts[collection] = (collectionCounts[collection] || 0) + 1;
      });

      // console.log('📊 Slides by collection:');
      Object.entries(collectionCounts).forEach(([collection, count]) => {
        // console.log(`  - ${collection}: ${count} slides`);
      });
    }

    /**
     * ========================================================================
     * TOGGLEBUTTONS - Update Button Active States
     * ========================================================================
     *
     * PURPOSE:
     * Ensures only the clicked button appears active by managing CSS classes.
     *
     * @param {Array} buttons - Array of all tab button elements
     * @param {Number} index - Index of the button that was clicked
     *
     * FLOW:
     * 1. Remove 'active' class from all buttons (reset)
     * 2. Add 'active' class to the clicked button
     *
     * EXAMPLE:
     *
     * Initial state (Necklaces active):
     * buttons[0] → <button class="collection-tab active">Necklaces</button>
     * buttons[1] → <button class="collection-tab">Earrings</button>
     * buttons[2] → <button class="collection-tab">Rings</button>
     *
     * User clicks Earrings button (index 1)
     * ↓
     * Call: toggleButtons(buttons, 1)
     * ↓
     * Step 1: Remove 'active' from all
     * buttons[0] → <button class="collection-tab">Necklaces</button>
     * buttons[1] → <button class="collection-tab">Earrings</button>
     * buttons[2] → <button class="collection-tab">Rings</button>
     * ↓
     * Step 2: Add 'active' to index 1
     * buttons[0] → <button class="collection-tab">Necklaces</button>
     * buttons[1] → <button class="collection-tab active">Earrings</button> ✓
     * buttons[2] → <button class="collection-tab">Rings</button>
     *
     * CSS effects:
     * - Active button gets opacity: 1 (fully visible)
     * - Active button gets animated underline
     * - Inactive buttons get opacity: 0.25 (faded)
     */
    toggleButtons(buttons, index) {
      // console.log('🔄 Updating button states (activating index', index + ')');

      /**
       * Remove 'active' class from all buttons
       *
       * forEach loops through every button in the array
       * classList.remove('active') removes the class if it exists
       * (Does nothing if class doesn't exist, no error thrown)
       */
      buttons.forEach((button) => button.classList.remove("active"));

      /**
       * Add 'active' class to clicked button
       *
       * Example: If index = 1
       * buttons[1].classList.add('active')
       * Result: <button class="collection-tab active">Earrings</button>
       */
      buttons[index].classList.add("active");

      // console.log('✅ Button', index, 'is now active');
    }

    /**
     * ========================================================================
     * TOGGLELINKS - Update "Shop All" Link Active States
     * ========================================================================
     *
     * PURPOSE:
     * Syncs the "Shop All [Collection]" links with the active tab.
     * When a tab is clicked, the corresponding link is highlighted.
     *
     * @param {NodeList} links - All "Shop All" link elements
     * @param {Number} index - Index of the link to activate
     *
     * FLOW:
     * 1. Check if links exist
     * 2. Remove 'active' class from all links
     * 3. Add 'active' class to the link at the specified index
     *
     * EXAMPLE:
     *
     * Initial state:
     * links[0] → <a class="collection-tabs-linked-to-tab active" href="/necklaces">
     *              Shop All Necklaces
     *            </a>
     * links[1] → <a class="collection-tabs-linked-to-tab" href="/earrings">
     *              Shop All Earrings
     *            </a>
     * links[2] → <a class="collection-tabs-linked-to-tab" href="/rings">
     *              Shop All Rings
     *            </a>
     *
     * User clicks Earrings tab (index 1)
     * ↓
     * Call: toggleLinks(links, 1)
     * ↓
     * After execution:
     * links[0] → <a class="collection-tabs-linked-to-tab" href="/necklaces">
     *              Shop All Necklaces
     *            </a>
     * links[1] → <a class="collection-tabs-linked-to-tab active" href="/earrings">
     *              Shop All Earrings  ← Now highlighted
     *            </a>
     * links[2] → <a class="collection-tabs-linked-to-tab" href="/rings">
     *              Shop All Rings
     *            </a>
     *
     * CSS effects:
     * - Active link: display: block, animated underline
     * - Inactive links: display: none
     *
     * This creates a smooth user experience where the link updates
     * automatically when tabs change.
     */
    toggleLinks(links, index) {
      /**
       * Safety check: Ensure links exist and has at least one element
       *
       * Optional chaining (?.) returns undefined if links is null/undefined
       * Without this, links.length would throw error if links is null
       *
       * Possible reasons links might not exist:
       * - Header element not found
       * - Links not rendered in template
       * - Different HTML structure
       */
      if (links?.length) {
        // console.log('🔄 Updating link states (activating index', index + ')');

        // Remove 'active' from all links
        links.forEach((link) => link.classList.remove("active"));

        // Add 'active' to the link at specified index (when index is valid)
        if (links[index]) {
          links[index].classList.add("active");
        }

        // console.log('✅ Link', index, 'is now active');
      } else {
        console.log("ℹ️ No links to update");
      }
    }

    /**
     * ========================================================================
     * FILTERSWIPER - Show Only Products from Specific Collection
     * ========================================================================
     *
     * PURPOSE:
     * Filters the Swiper carousel to display only products from the selected
     * collection. This is the core functionality of the tab system.
     *
     * @param {String} handle - Collection handle (e.g., "necklaces", "earrings")
     *
     * FLOW:
     * 1. Validate Swiper instance exists
     * 2. Validate cached slides exist
     * 3. Filter cached slides by collection handle
     * 4. Validate at least one slide matches
     * 5. Remove all current slides from Swiper
     * 6. Add back only matching slides
     * 7. Update Swiper's internal state
     * 8. Jump to first slide
     *
     * DETAILED EXAMPLE:
     *
     * Initial state:
     * - Swiper showing: 12 necklace products
     * - this.allSlides has: 32 total products (12 necklaces, 8 earrings, 12 rings)
     * - User clicks: "Earrings" button
     *
     * ↓
     *
     * Call: filterSwiper('earrings')
     *
     * ↓
     *
     * Step 1: Validation checks
     * ✓ Swiper instance exists
     * ✓ 32 cached slides available
     *
     * ↓
     *
     * Step 2: Filter for 'earrings'
     * Loop through this.allSlides (32 items):
     *   Slide 0:  data-collection="necklaces" ✗ (filtered out)
     *   Slide 1:  data-collection="necklaces" ✗ (filtered out)
     *   ...
     *   Slide 12: data-collection="earrings" ✓ (kept)
     *   Slide 13: data-collection="earrings" ✓ (kept)
     *   Slide 14: data-collection="earrings" ✓ (kept)
     *   ...
     *   Slide 19: data-collection="earrings" ✓ (kept)
     *   Slide 20: data-collection="rings" ✗ (filtered out)
     *   ...
     *
     * Result: matchingSlides = [8 earring slides]
     *
     * ↓
     *
     * Step 3: Remove all current slides
     * Before: Swiper has 12 necklace slides
     * removeAllSlides() is called
     * After: Swiper has 0 slides (empty carousel)
     *
     * ↓
     *
     * Step 4: Add matching slides
     * appendSlide(matchingSlides) adds the 8 earring slides
     * Swiper now has 8 slides
     *
     * ↓
     *
     * Step 5: Update Swiper
     * update() recalculates:
     * - Total slide count: 8
     * - Pagination: "1 / 8" instead of "1 / 12"
     * - Navigation buttons: Enabled (8 slides > 4 per view)
     * - Slide widths and positions
     *
     * ↓
     *
     * Step 6: Jump to first slide
     * slideTo(0, 0) instantly moves to first earring product
     * (0 speed = no animation, instant)
     *
     * ↓
     *
     * Final result:
     * User sees: 8 earring products in the carousel
     * Pagination shows: "1 / 8"
     * Active tab: "Earrings"
     * Active link: "Shop All Earrings"
     *
     * Performance: ~5-10ms for filtering operation
     */
    filterSwiper(handle) {
      console.log("🔍 Filtering for collection:", handle);

      /**
       * ====================================================================
       * VALIDATION CHECKS
       * ====================================================================
       *
       * Ensure all prerequisites are met before filtering
       */

      /**
       * Check #1: Swiper instance exists
       *
       * Possible failure reasons:
       * - Swiper initialization failed
       * - Component was disconnected
       * - Swiper was destroyed
       *
       * Example error scenario:
       * User clicks tab before Swiper finishes initializing
       * → this.swiperInstance is still null
       * → Cannot filter without Swiper
       * → Exit early with error message
       */
      if (!this.swiperInstance) {
        console.error(
          "❌ Swiper instance not available - cannot filter slides",
        );
        console.error("💡 This usually means Swiper hasn't initialized yet");
        return;
      }

      /**
       * Check #2: Cached slides exist
       *
       * Possible failure reasons:
       * - cacheSlides() never ran
       * - cacheSlides() failed
       * - Component was disconnected and slides were cleared
       *
       * Example error scenario:
       * Swiper initialized but cacheSlides() threw an error
       * → this.allSlides is empty []
       * → Cannot filter without source data
       * → Exit early with error message
       */
      if (!this.allSlides.length) {
        console.error("❌ No cached slides available - cannot filter");
        console.error(
          "💡 This usually means cacheSlides() didn't run or failed",
        );
        return;
      }

      // console.log('✓ Validation passed - proceeding with filter');
      // console.log('📊 Total cached slides:', this.allSlides.length);

      /**
       * ====================================================================
       * FILTER SLIDES BY COLLECTION
       * ====================================================================
       *
       * Use Array.filter() to find slides matching the collection handle
       *
       * How .filter() works:
       * 1. Loops through every item in this.allSlides
       * 2. Runs the test function for each item
       * 3. If test returns true → keep item
       * 4. If test returns false → discard item
       * 5. Returns new array with only kept items
       *
       * Example with handle = "earrings":
       *
       * this.allSlides = [
       *   <div data-collection="necklaces">, ← Test: "necklaces" === "earrings" → false → ✗
       *   <div data-collection="necklaces">, ← Test: "necklaces" === "earrings" → false → ✗
       *   <div data-collection="earrings">,  ← Test: "earrings" === "earrings" → true → ✓
       *   <div data-collection="earrings">,  ← Test: "earrings" === "earrings" → true → ✓
       *   <div data-collection="rings">,     ← Test: "rings" === "earrings" → false → ✗
       *   ...
       * ]
       *
       * matchingSlides = [
       *   <div data-collection="earrings">,
       *   <div data-collection="earrings">,
       *   ... (8 total)
       * ]
       */
      const matchingSlides = this.allSlides.filter(
        (slide) => slide.dataset.collection === handle,
      );

      // console.log('📦 Found', matchingSlides.length, 'matching slides');

      /**
       * Check #3: At least one slide matches
       *
       * Possible reasons for no matches:
       * - Collection has no products
       * - Collection handle typo (e.g., "earings" vs "earrings")
       * - Products not loaded properly
       * - Slides missing data-collection attribute
       *
       * Example error scenario:
       * User clicks tab for empty collection
       * → matchingSlides.length = 0
       * → Cannot show empty carousel
       * → Exit early with warning message
       *
       * UI behavior:
       * - Keep showing current collection
       * - Tab becomes active but content doesn't change
       * - User sees previous collection's products
       */
      if (matchingSlides.length === 0) {
        console.warn(`⚠️ No slides found for collection: ${handle}`);
        console.warn(
          "💡 Check if this collection has products and data-collection attributes are correct",
        );
        return;
      }

      /**
       * ====================================================================
       * UPDATE SWIPER CAROUSEL
       * ====================================================================
       *
       * Four-step process to swap slides:
       * 1. Clear carousel
       * 2. Add new slides
       * 3. Recalculate
       * 4. Reset position
       */

      /**
       * Step 1: Remove all current slides
       *
       * Before:
       * Swiper DOM:
       * <div class="swiper-wrapper">
       *   <div class="swiper-slide">Necklace 1</div>
       *   <div class="swiper-slide">Necklace 2</div>
       *   ... (12 necklace slides)
       * </div>
       *
       * removeAllSlides() is called
       *
       * After:
       * Swiper DOM:
       * <div class="swiper-wrapper">
       *   <!-- Empty! -->
       * </div>
       *
       * Internal state:
       * - slides.length: 0
       * - activeIndex: 0
       * - Carousel is empty but functional
       */
      // console.log('🗑️ Removing all current slides...');
      this.swiperInstance.removeAllSlides();
      // console.log('✓ Carousel cleared');

      /**
       * Step 2: Add filtered slides back
       *
       * appendSlide() accepts an array of slide elements and adds them to Swiper
       *
       * Before:
       * Swiper wrapper is empty
       *
       * appendSlide(matchingSlides) is called with 8 earring slides
       *
       * After:
       * Swiper DOM:
       * <div class="swiper-wrapper">
       *   <div class="swiper-slide" data-collection="earrings">Earring 1</div>
       *   <div class="swiper-slide" data-collection="earrings">Earring 2</div>
       *   <div class="swiper-slide" data-collection="earrings">Earring 3</div>
       *   ... (8 earring slides total)
       * </div>
       *
       * Internal state:
       * - slides.length: 8
       * - Each slide gets Swiper classes and properties
       */
      // console.log('➕ Adding', matchingSlides.length, 'filtered slides...');
      this.swiperInstance.appendSlide(matchingSlides);
      // console.log('✓ Slides added');

      /**
       * Step 3: Update Swiper's internal state
       *
       * update() recalculates everything Swiper needs to function:
       *
       * 1. Slide dimensions and positions
       *    Before: Calculated for 12 slides
       *    After: Recalculated for 8 slides
       *
       * 2. Pagination
       *    Before: "1 / 12"
       *    After: "1 / 8"
       *
       * 3. Navigation buttons
       *    Desktop (4 slides per view):
       *    - Previous button: Disabled (at beginning)
       *    - Next button: Enabled (8 slides > 4 per view)
       *
       * 4. Responsive breakpoints
       *    Mobile (1.3 slides per view): Next button enabled
       *    Desktop (4 slides per view): Next button enabled
       *
       * 5. Touch/drag boundaries
       *    Prevents dragging beyond first/last slide
       *
       * 6. Progress indicator
       *    Updates progress bar to reflect new total
       *
       * Performance: ~2-5ms for typical carousels
       */
      // console.log('🔄 Updating Swiper state...');
      this.swiperInstance.update();
      // console.log('✓ Swiper updated');

      /**
       * Step 4: Jump to first slide
       *
       * slideTo(index, speed, runCallbacks)
       * - index: 0 (first slide)
       * - speed: 0 (instant, no animation)
       * - runCallbacks: undefined (default behavior)
       *
       * Why index 0?
       * User expects to see the start of the collection when switching tabs
       *
       * Why speed 0?
       * Instant transition feels snappier and more responsive
       * Animation would slow down tab switching
       *
       * Before:
       * - activeIndex: could be any value (e.g., 5)
       * - User might be viewing 6th slide
       *
       * After:
       * - activeIndex: 0
       * - User sees first earring product
       *
       * Visual effect:
       * Carousel instantly shows first slide of new collection
       * No animation, feels immediate
       *
       * Alternative approach (with animation):
       * this.swiperInstance.slideTo(0, 300);
       * Would animate to first slide over 300ms
       */
      // console.log('⏮️ Jumping to first slide...');
      this.swiperInstance.slideTo(0, 0);
      // console.log('✓ Positioned at slide 0');

      // console.log('✅ Filter complete - now showing', matchingSlides.length, handle, 'products');
    }

    /**
     * ========================================================================
     * DISCONNECTEDCALLBACK - Component Cleanup
     * ========================================================================
     *
     * Lifecycle method that runs when this custom element is removed from the DOM.
     * Similar to componentWillUnmount() in React or beforeDestroy() in Vue.
     *
     * PURPOSE:
     * Clean up resources to prevent memory leaks and ensure proper disposal.
     *
     * WHEN THIS RUNS:
     * - User navigates to a different page
     * - Section is removed in theme editor
     * - JavaScript calls element.remove()
     * - Parent element is removed
     *
     * WHAT GETS CLEANED:
     * 1. Swiper instance (destroyed completely)
     * 2. Cached slides array (emptied)
     *
     * EXAMPLE SCENARIO:
     *
     * Initial state:
     * - this.swiperInstance = Swiper { ... } (active)
     * - this.allSlides = [32 cached slide elements]
     * - Memory usage: ~200KB
     *
     * User navigates away or section is removed
     * ↓
     * disconnectedCallback() is automatically called by browser
     * ↓
     *
     * Step 1: Check if Swiper exists
     * if (this.swiperInstance) → true
     *
     * Step 2: Destroy Swiper
     * destroy(deleteInstance, cleanStyles)
     * - deleteInstance: true → Remove swiper instance from DOM element
     * - cleanStyles: true → Remove inline styles Swiper added
     *
     * Before destroy:
     * <div class="swiper" style="...Swiper styles...">
     *   element.swiper = Swiper instance
     * </div>
     *
     * After destroy:
     * <div class="swiper">
     *   element.swiper = undefined
     * </div>
     *
     * Step 3: Clear reference
     * this.swiperInstance = null
     *
     * Step 4: Empty cached slides
     * this.allSlides = []
     *
     * Final state:
     * - this.swiperInstance = null
     * - this.allSlides = []
     * - Memory freed: ~200KB
     * - Component ready for garbage collection
     *
     * WHY THIS MATTERS:
     *
     * Without cleanup:
     * - Swiper instance stays in memory → memory leak
     * - Event listeners stay attached → can cause bugs
     * - Cached slides stay in memory → wasted memory
     * - Multiple navigations → multiple Swiper instances accumulate
     *
     * With cleanup:
     * - Everything properly disposed
     * - Memory freed for other use
     * - No lingering event listeners
     * - Clean slate for next page
     */
    disconnectedCallback() {
      // console.log('🔌 Collection tabs component disconnected from DOM');
      // console.log('🧹 Starting cleanup...');

      /**
       * Destroy Swiper instance if it exists
       *
       * destroy() does the following:
       * 1. Removes all event listeners (touch, click, resize, etc.)
       * 2. Stops all animations
       * 3. Removes inline styles from slides
       * 4. Removes swiper instance from DOM element
       * 5. Cleans up timers and intervals
       * 6. Removes swiper-specific classes
       *
       * Parameters:
       * - deleteInstance (true): Removes element.swiper property
       * - cleanStyles (true): Removes all inline styles Swiper added
       */
      if (this.swiperInstance) {
        // console.log('🗑️ Destroying Swiper instance...');
        this.swiperInstance.destroy(true, true);
        this.swiperInstance = null;
        // console.log('✓ Swiper destroyed');
      }

      /**
       * Clear cached slides array
       *
       * Setting to empty array allows garbage collector to free memory
       * occupied by the 32 cloned slide elements
       *
       * Before:
       * this.allSlides.length = 32
       * Memory: ~200KB
       *
       * After:
       * this.allSlides.length = 0
       * Memory: 0KB (freed)
       */
      // console.log('🗑️ Clearing cached slides...');
      this.allSlides = [];
      // console.log('✓ Cache cleared');

      // console.log('✅ Cleanup complete - component ready for garbage collection');
    }
  }

  /**
   * ==========================================================================
   * REGISTER CUSTOM ELEMENT
   * ==========================================================================
   *
   * Register the class as a custom HTML element so it can be used in markup.
   *
   * After this line executes:
   * - <collection-tabs> becomes a valid HTML tag
   * - Browser knows to use CollectionTabs class for this element
   * - Component lifecycle methods (constructor, connectedCallback, etc.) will run automatically
   *
   * Example usage in HTML:
   * <collection-tabs data-target="collection-tabs-swiper-123">
   *   <button data-collection="necklaces">Necklaces</button>
   * </collection-tabs>
   *
   * When browser encounters this:
   * 1. Checks if 'collection-tabs' is defined → Yes
   * 2. Creates new instance: new CollectionTabs()
   * 3. Runs constructor()
   * 4. Adds element to DOM
   * 5. Runs connectedCallback()
   * 6. Initializes component
   */
  customElements.define("collection-tabs", CollectionTabs);
  // console.log('✅ collection-tabs custom element registered');
}
