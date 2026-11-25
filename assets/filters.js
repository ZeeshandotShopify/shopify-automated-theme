import { rerenderSection } from "./utils.js";

if (!customElements.get("pagination-nav")) {
  customElements.define(
    "pagination-nav",
    class Pagination extends HTMLElement {
      constructor() {
        super();

        this.paginationNavButtons = this.querySelectorAll(
          "[data-pagination-nav-button]",
        );

        this.paginationNavTargetId = this.dataset.paginationNavTargetId;

        /*
         * This sectionId is retrieved from the dataset attribute of the pagination-nav element.
         * It is set in the pagination-nav.liquid snippet using Liquid templating,
         * specifically with data-section-id="{{ section.id }}".
         *
         * The sectionId is crucial for identifying the specific Shopify section to update
         * during pagination. It allows us to construct the correct DOM ID for rerendering
         * only that section's content, enabling partial page updates for better performance
         * and user experience in collection pages.
         *
         * We need this dynamic sectionId to make the pagination-nav custom element reusable
         * across different section liquid files. By dynamically retrieving the section.id
         * in any section liquid, we can rerender the entire corresponding section without
         * hardcoding IDs, promoting modularity and flexibility in theme development.
         */
        this.sectionId = this.dataset.sectionId;
      }

      connectedCallback() {
        this.setInitialActivePage();
        this.paginationNavButtons.forEach((button) => {
          button.addEventListener(
            "click",
            this.handlePaginationNavButtons.bind(this),
          );

          button.setAttribute("role", "button");
          button.setAttribute("tabindex", "0");
        });
      }

      disconnectedCallback() {
        this.paginationNavButtons.forEach((button) => {
          button.removeEventListener("click", this.handlePaginationNavButtons);
        });
      }

      setInitialActivePage() {
        const currentUrl = new URL(window.location.href);
        const currentPage = currentUrl.searchParams.get("page") || "1";

        this.paginationNavButtons.forEach((button) => {
          let buttonPage;

          if (button.dataset.href) {
            buttonPage =
              new URL(
                button.dataset.href,
                window.location.origin,
              ).searchParams.get("page") || "1";
          } else {
            buttonPage = button.textContent.trim();
          }

          if (buttonPage === currentPage) {
            button.classList.add("active");
            button.setAttribute("aria-current", "page");
          } else {
            button.classList.remove("active");
            button.removeAttribute("aria-current");
          }
        });
      }

      handlePaginationNavButtons(event) {
        event.preventDefault();

        // 1. Get the button that was clicked
        const button = event.currentTarget;

        // 2. Get the page url value from the button
        const href = button.dataset.href;

        // 3. Create URL
        const url = new URL(href, window.location.href);

        // 2. Get the page number from the button
        const pageNumber = url.searchParams.get("page");

        // 3. Remove the active class from all pagination buttons
        this.paginationNavButtons.forEach((btn) => {
          btn.classList.remove("active");
          btn.removeAttribute("aria-current");
        });

        // 4. Add the active class to the clicked button
        button.classList.add("active");
        button.setAttribute("aria-current", "page");

        // 5. Update the history state
        this.updateHistoryWithoutSectionId(pageNumber);

        // 6. Build the fetch URL with section_id parameter
        const fetchUrl = this.buildFetchUrlWithSectionId(pageNumber);

        // 7. Rerender the section using the rerenderSection function
        // We fetch the url from fetchUrl (e.g. https://shopify.com/collection/all?page=2&section_id=collection_id) and rerender the section using the rerenderSection function
        rerenderSection(fetchUrl, this.paginationNavTargetId, "elementId");

        // 8. Scroll user to the top of the product/content list
        this.scrollToTop();
      }

      scrollToTop() {
        // Attempts to find the list container to scroll to
        // const targetElement = document.getElementById(this.paginationNavTargetId);

        // if (targetElement) {
        //   const elementPosition = targetElement.getBoundingClientRect().top + window.scrollY;
        //   // Offset allows for sticky headers (adjust 100 as needed)
        //   const offsetPosition = elementPosition - 100;

        //   window.scrollTo({
        //     top: offsetPosition,
        //     behavior: "smooth"
        //   });
        // } else {
        //   // Fallback: scroll to top of window if target ID is invalid
        //   window.scrollTo({ top: 0, behavior: "smooth" });
        // }

        // Scroll to top of page by default
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

      updateHistoryWithoutSectionId(pageNumber) {
        const currentUrl = new URL(window.location.href);

        this.updateSearchParams(currentUrl, pageNumber);

        history.pushState(null, "", currentUrl.toString());
      }

      buildFetchUrlWithSectionId(pageNumber) {
        if (!this.sectionId) {
          throw new Error("Missing required sectionId");
        }

        /**
         * URL CONSTRUCTION FOR SECTION RERENDERING:
         * Builds a fetch URL that includes both sorting parameters and section identification
         * for Shopify's section rendering system.
         *
         * PROCESS FLOW:
         * 1. Clone current page URL to preserve existing parameters and context
         * 2. Apply sort parameter updates while maintaining other query parameters
         * 3. Append section_id for targeted section rerendering capability
         * 4. Generate final fetch URL for AJAX section updates
         *
         * URL STRUCTURE EXAMPLE:
         * Input:  https://shop.com/collections/all?page=2
         * Output: https://shop.com/collections/all?page=2&sort_by=price-ascending&section_id=collection-123
         *
         * SHOPIFY INTEGRATION:
         * The section_id parameter enables Shopify's built-in section rendering endpoint,
         * allowing partial page updates without full page reloads for better performance.
         */
        const currentUrl = new URL(window.location.href);

        // Apply sorting parameters while preserving existing query state
        this.updateSearchParams(currentUrl, pageNumber);

        // Enable section-specific rendering for targeted DOM updates
        currentUrl.searchParams.set("section_id", this.sectionId);

        // Return complete fetch URL for section rerendering request
        return currentUrl.toString();
      }

      updateSearchParams(currentUrl, pageNumber) {
        const searchParams = currentUrl.searchParams;

        if (pageNumber === "1") {
          // Remove page parameter for page 1 (cleaner URLs)
          searchParams.delete("page");
        } else {
          searchParams.set("page", pageNumber);
        }
      }
    },
  );
}

if (!customElements.get("dynamic-filters")) {
  /**
   * Response cache – stores { html, url } pairs so toggling
   * the same filter twice skips the network on the second request.
   */
  const filterData = [];

  customElements.define(
    "dynamic-filters",
    class FacetFiltersForm extends HTMLElement {
      constructor() {
        super();

        this.filterTargetId = this.dataset.filterTargetId;
        this.sectionId = this.dataset.sectionId;

        this.lastTriggeredInput = null;
        this.debouncedRender = this.debounce(() => this.onFilterChange(), 800);
      }

      /* ── lifecycle ─────────────────────────────────── */

      connectedCallback() {
        this.onInputChange = this.onInputChange.bind(this);

        // Attach input listener directly to each filter form.
        // Direct attachment survives sheet-menu.js moving the mobile
        // form to document.body — the listener travels with the form.
        this.desktopForm = document.getElementById("FacetFiltersForm");
        this.mobileForm = document.getElementById("FacetFiltersFormMobile");
        if (this.desktopForm)
          this.desktopForm.addEventListener("input", this.onInputChange);
        if (this.mobileForm)
          this.mobileForm.addEventListener("input", this.onInputChange);

        this.handleSortClick = this.handleSortClick.bind(this);
        this.addEventListener("click", this.handleSortClick);

        this.handleActiveFilterClick = this.handleActiveFilterClick.bind(this);
        document.addEventListener("click", this.handleActiveFilterClick);

        this.handlePopState = this.handlePopState.bind(this);
        window.addEventListener("popstate", this.handlePopState);
      }

      disconnectedCallback() {
        if (this.desktopForm)
          this.desktopForm.removeEventListener("input", this.onInputChange);
        if (this.mobileForm)
          this.mobileForm.removeEventListener("input", this.onInputChange);
        this.removeEventListener("click", this.handleSortClick);
        document.removeEventListener("click", this.handleActiveFilterClick);
        window.removeEventListener("popstate", this.handlePopState);
      }

      /* ── helpers ────────────────────────────────────── */

      debounce(fn, delay) {
        let timer;
        return (...args) => {
          clearTimeout(timer);
          timer = setTimeout(() => fn(...args), delay);
        };
      }

      /* ── event handlers ────────────────────────────── */

      /** Fires on every input change – track trigger, debounce fetch. */
      onInputChange(event) {
        this.lastTriggeredInput = event.target;
        this.debouncedRender();
      }

      /** Event delegation for sort option clicks. */
      handleSortClick(event) {
        const sortButton = event.target.closest("[data-sort-option]");
        if (!sortButton) return;

        const hiddenInput = document.getElementById("SortByHidden");
        if (hiddenInput) hiddenInput.value = sortButton.dataset.sortValue;

        const details = sortButton.closest("details");
        if (details) details.removeAttribute("open");

        this.lastTriggeredInput = null;
        this.onFilterChange();
      }

      /** After debounce settles – build params & fetch. */
      onFilterChange() {
        const searchParams = this.buildSearchParams();
        this.renderPage(searchParams);
      }

      /** Event-delegation for active-filter badge clicks. */
      handleActiveFilterClick(event) {
        const link = event.target.closest("[data-active-filter-remove]");
        if (!link) return;

        event.preventDefault();
        this.lastTriggeredInput = null;
        const url = new URL(link.href, window.location.origin);
        const searchParams = url.searchParams;
        searchParams.delete("section_id");

        // Preserve current sort
        const currentSort = new URL(window.location.href).searchParams.get(
          "sort_by",
        );
        if (currentSort && !searchParams.has("sort_by")) {
          searchParams.set("sort_by", currentSort);
        }

        this.renderPage(searchParams);
      }

      /** Browser back / forward. */
      handlePopState() {
        this.lastTriggeredInput = null;
        const searchParams = new URL(window.location.href).searchParams;
        searchParams.delete("section_id");
        this.renderPage(searchParams, false);
      }

      /* ── param building ────────────────────────────── */

      buildSearchParams() {
        const params = new URLSearchParams();
        const seen = new Set();

        // Determine which filter form the user interacted with (Dawn pattern)
        const triggerForm = this.lastTriggeredInput?.closest("form");
        const filterForm =
          triggerForm?.id === "FacetFiltersFormMobile"
            ? triggerForm
            : document.getElementById("FacetFiltersForm");

        // Collect filter inputs
        if (filterForm) this.collectInputs(filterForm, params, seen);

        // Collect sort input from its own form
        const sortForm = document.getElementById("FacetSortForm");
        if (sortForm) this.collectInputs(sortForm, params, seen);

        // Always reset to page 1
        params.delete("page");

        return params;
      }

      /** Gather checked/filled inputs from a container into params. */
      collectInputs(container, params, seen) {
        container.querySelectorAll("input").forEach((input) => {
          if (!input.name) return;

          const key = `${input.name}=${input.value}`;
          if (seen.has(key)) return;
          seen.add(key);

          if (input.type === "checkbox" || input.type === "radio") {
            if (input.checked) {
              params.append(input.name, input.value);
            }
          } else if (input.value !== "") {
            params.append(input.name, input.value);
          }
        });
      }

      /* ── render pipeline ───────────────────────────── */

      renderPage(searchParams, updateHistory = true) {
        const browserUrl = this.buildBrowserUrl(searchParams);

        // Build fetch URL with section_id
        const fetchParams = new URLSearchParams(searchParams);
        fetchParams.set("section_id", this.sectionId);
        const fetchUrl = `${window.location.pathname}?${fetchParams.toString()}`;

        // Cache hit → render immediately
        const cached = filterData.find((entry) => entry.url === fetchUrl);
        if (cached) {
          this.renderFromHTML(cached.html);
          if (updateHistory) this.updateURLHash(browserUrl);
          return;
        }

        // Show loading state
        const productList = document.getElementById(this.filterTargetId);
        if (productList) productList.classList.add("loading");

        fetch(fetchUrl)
          .then((response) => response.text())
          .then((html) => {
            filterData.push({ html, url: fetchUrl });
            this.renderFromHTML(html);
            if (updateHistory) this.updateURLHash(browserUrl);
          })
          .catch((error) =>
            console.error("Error fetching filter results:", error),
          )
          .finally(() => {
            if (productList) productList.classList.remove("loading");
          });
      }

      buildBrowserUrl(searchParams) {
        const qs = searchParams.toString();
        return qs
          ? `${window.location.pathname}?${qs}`
          : window.location.pathname;
      }

      updateURLHash(url) {
        history.pushState({ url }, "", url);
      }

      /* ── DOM updaters ──────────────────────────────── */

      renderFromHTML(html) {
        const parsed = new DOMParser().parseFromString(html, "text/html");
        this.renderProductGrid(parsed);
        this.renderActiveFilters(parsed);
        this.renderFilters(parsed);
        this.renderSort(parsed);
      }

      /** Replace product grid + pagination. */
      renderProductGrid(doc) {
        const newNode = doc.getElementById(this.filterTargetId);
        const liveNode = document.getElementById(this.filterTargetId);
        if (newNode && liveNode) {
          liveNode.innerHTML = newNode.innerHTML;
        }
      }

      /** Replace active-filter badges. */
      renderActiveFilters(doc) {
        const newNode = doc.getElementById("ActiveFiltersContainer");
        const liveNode = document.getElementById("ActiveFiltersContainer");
        if (newNode && liveNode) {
          liveNode.innerHTML = newNode.innerHTML;
        }
      }

      /** Replace sort container from server HTML. */
      renderSort(doc) {
        const newSort = doc.getElementById("SortContainer");
        const liveSort = document.getElementById("SortContainer");
        if (newSort && liveSort) liveSort.innerHTML = newSort.innerHTML;
      }

      /**
       * Dawn-style filter rendering:
       * - Triggering filter: only update .filter-content (preserves open state)
       * - Other filters: full innerHTML replacement
       */
      renderFilters(doc) {
        const newFilters = doc.querySelectorAll(
          "#FacetFiltersForm .js-filter, #FacetFiltersFormMobile .js-filter",
        );

        // Identify which filter the user just interacted with
        const triggerFilter = this.lastTriggeredInput?.closest(".js-filter");

        newFilters.forEach((newFilter) => {
          const liveFilter = document.getElementById(newFilter.id);
          if (!liveFilter) return;

          if (triggerFilter && liveFilter.id === triggerFilter.id) {
            // Triggering filter: only update counts (preserve open state + interaction)
            this.renderCounts(newFilter, liveFilter);
          } else {
            // Other filters: replace the whole element so connectedCallback()
            // fires on the new node, re-initializing icons and event listeners.
            const replacement = newFilter.cloneNode(true);
            liveFilter.replaceWith(replacement);
          }
        });
      }

      /**
       * Update only the .filter-content inside the triggering filter
       * so the <details> open state and summary are preserved.
       */
      renderCounts(source, target) {
        const newContent = source.querySelector(".filter-content");
        const liveContent = target.querySelector(".filter-content");
        if (newContent && liveContent) {
          liveContent.innerHTML = newContent.innerHTML;
        }
      }
    },
  );
}
