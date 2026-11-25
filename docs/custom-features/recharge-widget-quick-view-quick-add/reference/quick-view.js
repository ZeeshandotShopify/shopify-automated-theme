/**
 * Quick view.
 *
 * Fetches `/products/<handle>?view=quick-view` (the alternate product template
 * in templates/product.quick-view.json), extracts `#QuickViewRoot`, and portals
 * it into the theme's own dialog (desktop) or sheet (mobile) so it inherits the
 * existing overlay, Escape handling, focus trap and scroll lock.
 *
 * The Recharge subscription widget rides along inside that markup as an @app
 * block. Three things are needed to make it work in a fetched, portalled panel,
 * and all three are handled below:
 *
 *   1. Scripts injected via innerHTML never execute, so every <script> in the
 *      fetched subtree is re-created (config blocks first, then the CDN module).
 *   2. A `type="module"` src evaluates once per document, so on the second open
 *      the bundle does not re-run. Recharge's documented remedy is to clone the
 *      custom element and replace it, which fires connectedCallback again and
 *      makes it re-read the (now overwritten) global config.
 *   3. The widget locates its target by scanning document.forms for an action
 *      containing /cart/add whose [name="id"] matches. Every product card on a
 *      collection page is exactly such a form for exactly the same variant, so
 *      the card forms are masked while the panel is open. Without this the
 *      hidden selling_plan input can land on a card's form and the shopper is
 *      charged the one-time price for a subscription.
 */

const WIDGET_TAG = "recharge-subscription-widget";
const WIDGET_DEFINE_TIMEOUT = 6000;
const MASKED_ACTION = "/cart/add--quick-view-masked";
const DESKTOP_QUERY = "(min-width: 64rem)";

class QuickView extends HTMLElement {
  constructor() {
    super();
    this.cache = new Map();
    this.maskedForms = [];
    this.activeHost = null;
    this.isOpen = false;
    this.onTriggerClick = this.onTriggerClick.bind(this);
    this.onCartRerender = this.onCartRerender.bind(this);
    this.onSubmitCapture = this.onSubmitCapture.bind(this);
  }

  connectedCallback() {
    this.dialog = this.querySelector("dialog-menu");
    this.sheet = this.querySelector("sheet-menu");

    // Triggers live inside product cards, which re-render on filter/paginate,
    // so they are handled by delegation rather than bound individually.
    document.addEventListener("click", this.onTriggerClick);
    document.documentElement.addEventListener("cart:rerender", this.onCartRerender);
    document.addEventListener("submit", this.onSubmitCapture, true);
  }

  disconnectedCallback() {
    document.removeEventListener("click", this.onTriggerClick);
    document.documentElement.removeEventListener("cart:rerender", this.onCartRerender);
    document.removeEventListener("submit", this.onSubmitCapture, true);
    this.unmaskCardForms();
  }

  /* ----------------------------------------------------------------- open */

  onTriggerClick(event) {
    const trigger = event.target.closest("[data-quick-view-trigger]");
    if (!trigger) {
      if (event.target.closest("[data-quick-view-close]")) this.close();
      return;
    }
    event.preventDefault();
    const url = trigger.getAttribute("data-product-url");
    if (url) this.open(url, trigger);
  }

  isDesktop() {
    return window.matchMedia(DESKTOP_QUERY).matches;
  }

  /**
   * Both hosts portal their content to <body>, so it is not reliably a child of
   * the host when this runs — SheetMenu moves it during init, DialogMenu on
   * open. Each keeps its own reference, which is what makes the right element
   * findable; the descendant query is only a fallback for a host that has not
   * upgraded yet. A document-wide query would be wrong here, because the cart
   * drawer and mobile menu also park a <sheet-content> on <body>.
   */
  getContainer(host, desktop) {
    if (desktop) return host.content || host.querySelector("dialog-content");
    return host.sheetContent || host.content || host.querySelector("sheet-content");
  }

  async open(productUrl, trigger) {
    const desktop = this.isDesktop();
    const host = desktop ? this.dialog : this.sheet;
    if (!host) return;

    const container = this.getContainer(host, desktop);
    if (!container) return;

    this.activeHost = host;
    this.activeTrigger = trigger || null;
    this.activeContainer = container;
    // Set before any content lands, so the panel's host styles are already in
    // the cascade when the open transition starts.
    container.setAttribute("data-quick-view", "");
    container.replaceChildren(this.buildSpinner());
    container.setAttribute("data-quick-view-state", "loading");

    // Mask before opening: the widget starts hunting for a form as soon as it
    // upgrades, and the panel is only injected after this point.
    this.maskCardForms();
    // Scopes the Figma scrim (0.66) to this panel; the shared sheet-overlay is
    // also used by the cart drawer and mobile menu, which keep their own 0.5.
    document.body.setAttribute("data-quick-view-open", "");
    host.open();
    this.isOpen = true;

    let markup;
    try {
      markup = await this.fetchPanel(productUrl);
    } catch (error) {
      console.error("[quick-view] fetch failed", error);
      container.setAttribute("data-quick-view-state", "error");
      container.replaceChildren(
        this.buildMessage(this.getAttribute("data-error-text") || "Could not load this product."),
      );
      return;
    }

    // The shopper may have closed the panel while the fetch was in flight.
    if (!this.isOpen) return;

    container.replaceChildren(markup);
    container.setAttribute("data-quick-view-state", "ready");

    this.reexecuteScripts(container);
    await this.refreshRechargeWidget(container);
  }

  async fetchPanel(productUrl) {
    if (this.cache.has(productUrl)) {
      return this.cache.get(productUrl).cloneNode(true);
    }

    const separator = productUrl.includes("?") ? "&" : "?";
    const response = await fetch(`${productUrl}${separator}view=quick-view`, {
      headers: { "X-Requested-With": "XMLHttpRequest" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const doc = new DOMParser().parseFromString(await response.text(), "text/html");
    const root = doc.getElementById("QuickViewRoot");
    if (!root) throw new Error("#QuickViewRoot missing from response");

    this.cache.set(productUrl, root.cloneNode(true));
    return root;
  }

  buildSpinner() {
    const wrapper = document.createElement("div");
    wrapper.className = "quick-view__loading";
    const spinner = document.createElement("div");
    spinner.className = "loader";
    wrapper.appendChild(spinner);
    return wrapper;
  }

  buildMessage(text) {
    const wrapper = document.createElement("div");
    wrapper.className = "quick-view__loading";
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    wrapper.appendChild(paragraph);
    return wrapper;
  }

  /* -------------------------------------------------------------- recharge */

  /**
   * Re-create every <script> in the injected subtree, in document order, so the
   * Recharge config globals are installed before the module that reads them.
   */
  reexecuteScripts(container) {
    container.querySelectorAll("script").forEach((original) => {
      const script = document.createElement("script");
      for (const attribute of original.attributes) {
        script.setAttribute(attribute.name, attribute.value);
      }
      if (!original.src) script.textContent = original.textContent;
      original.replaceWith(script);
    });
  }

  /**
   * Force the widget to re-upgrade so it re-reads the config the scripts above
   * just overwrote. Without this, opening product B after product A leaves B
   * showing A's prices.
   */
  async refreshRechargeWidget(container) {
    const widget = container.querySelector(WIDGET_TAG);
    if (!widget) return;

    try {
      await this.whenDefined(WIDGET_TAG, WIDGET_DEFINE_TIMEOUT);
    } catch {
      console.warn(`[quick-view] <${WIDGET_TAG}> was not defined in time`);
      return;
    }

    this.watchSellingPlanInputs(container);
    widget.replaceWith(widget.cloneNode(true));
  }

  /**
   * Keep exactly one selling_plan input in the form.
   *
   * Two widget instances end up writing to the same form: the original, which
   * upgrades by itself the moment the module finishes loading, and the clone
   * above. Clearing once is not enough — each polls on its own timer and the
   * detached original still resolves the live form through document.forms, so a
   * duplicate can appear at any point after the clear. An observer is timing
   * independent where a one-shot cleanup is not.
   *
   * Duplicates matter: FormData serialises every input of that name, so the
   * POST body would carry selling_plan twice.
   */
  watchSellingPlanInputs(container) {
    this.stopWatchingSellingPlanInputs();

    const dedupe = () => {
      const form = container.querySelector("form.quick-view__form");
      if (!form) return;
      const inputs = form.querySelectorAll('input[name="selling_plan"]');
      // The newest input carries the current selection, so keep the last.
      for (let index = 0; index < inputs.length - 1; index += 1) {
        inputs[index].remove();
      }
    };

    this.planObserver = new MutationObserver(dedupe);
    this.planObserver.observe(container, { childList: true, subtree: true });
    dedupe();
  }

  stopWatchingSellingPlanInputs() {
    if (this.planObserver) {
      this.planObserver.disconnect();
      this.planObserver = null;
    }
  }

  whenDefined(tag, timeout) {
    return Promise.race([
      customElements.whenDefined(tag),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeout)),
    ]);
  }

  /* ----------------------------------------------------------- form masking */

  /**
   * Product cards are `{% form 'product' %}` elements posting to /cart/add for
   * the same variant as the panel, so Recharge cannot tell them apart. Masking
   * the action hides them from its scan.
   *
   * Safe because nothing in the theme reads form.action: cart.js posts to
   * `/cart/add.js` explicitly, and `<add-to-cart>` resolved its form during
   * connectedCallback at page load, long before any masking happens.
   */
  maskCardForms() {
    this.unmaskCardForms();
    document.querySelectorAll("form[action]").forEach((form) => {
      if (form.classList.contains("quick-view__form")) return;
      const action = form.getAttribute("action");
      if (!action || !action.includes("/cart/add")) return;
      this.maskedForms.push([form, action]);
      form.setAttribute("action", MASKED_ACTION);
    });
  }

  unmaskCardForms() {
    this.maskedForms.forEach(([form, action]) => form.setAttribute("action", action));
    this.maskedForms = [];
  }

  /* ----------------------------------------------------------------- guard */

  /**
   * Fail loudly rather than charge the wrong price.
   *
   * If the shopper chose a subscription but no selling_plan input reached this
   * form, the POST would silently buy the product at its one-time price. Block
   * it instead. One-time needs no guard: an absent selling_plan is correct.
   *
   * Capture phase, so this runs before the listener cart.js attached.
   */
  onSubmitCapture(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (!form.classList.contains("quick-view__form")) return;

    const panel = form.closest(".quick-view");
    const widget = panel && panel.querySelector(WIDGET_TAG);
    if (!widget || !widget.shadowRoot) return;

    const subscription = widget.shadowRoot.querySelector('input[name="purchaseOption"][value="subscription"]');
    if (!subscription || !subscription.checked) return;

    // A replaced widget can leave a stale duplicate behind; both carry the same
    // value, but two inputs of one name would be serialised twice.
    const planInputs = form.querySelectorAll('input[name="selling_plan"]');
    planInputs.forEach((input, index) => {
      if (index < planInputs.length - 1) input.remove();
    });

    const plan = form.querySelector('input[name="selling_plan"]');
    if (plan && plan.value) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    this.showError(panel);
  }

  showError(panel) {
    const target = panel && panel.querySelector("[data-quick-view-error]");
    if (!target) return;
    target.textContent =
      this.getAttribute("data-subscription-error") ||
      "Sorry, the subscription could not be applied. Please open the product page to subscribe.";
    target.hidden = false;
  }

  /* ---------------------------------------------------------------- close */

  onCartRerender() {
    // Adding to cart opens the cart drawer; the panel should not sit behind it.
    if (this.isOpen) this.close();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    if (this.activeHost && typeof this.activeHost.close === "function") {
      this.activeHost.close();
    }
    this.stopWatchingSellingPlanInputs();
    this.unmaskCardForms();
    document.body.removeAttribute("data-quick-view-open");
    if (this.activeTrigger && document.contains(this.activeTrigger)) {
      this.activeTrigger.focus();
    }
    this.activeHost = null;
    this.activeTrigger = null;
  }
}

customElements.define("quick-view", QuickView);
