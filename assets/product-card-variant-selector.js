class ProductCardVariantSelector extends HTMLElement {
  constructor() {
    super();
    this.handleSwatchClick = this.onSwatchClick.bind(this);
    this.handleSizeClick = this.onSizeClick.bind(this);
  }

  connectedCallback() {
    try {
      var jsonEl = this.querySelector(".product-card-variants");
      if (!jsonEl) return;
      this.variantData = JSON.parse(jsonEl.textContent);
    } catch (e) {
      console.error(
        "ProductCardVariantSelector: Failed to parse variant JSON",
        e,
      );
      return;
    }

    this.card = this.closest(".product-card");
    if (!this.card) return;

    // Color swatches
    this.swatches = this.querySelectorAll(".product-swatch");
    this.swatches.forEach(
      function (swatch) {
        swatch.addEventListener("click", this.handleSwatchClick);
      }.bind(this),
    );

    // Size buttons (rendered inside .product-image-container, outside this element)
    this.sizeButtons = this.card.querySelectorAll(".product-size-btn");
    this.sizeButtons.forEach(
      function (btn) {
        btn.addEventListener("click", this.handleSizeClick);
      }.bind(this),
    );
  }

  disconnectedCallback() {
    if (this.swatches) {
      this.swatches.forEach(
        function (swatch) {
          swatch.removeEventListener("click", this.handleSwatchClick);
        }.bind(this),
      );
    }
    if (this.sizeButtons) {
      this.sizeButtons.forEach(
        function (btn) {
          btn.removeEventListener("click", this.handleSizeClick);
        }.bind(this),
      );
    }
  }

  /**
   * Find the best matching variant given optional color and size values.
   * Prefers available variants; falls back to unavailable if needed.
   */
  findVariant(colorValue, colorPosition, sizeValue, sizePosition) {
    var colorKey = colorPosition ? "option" + colorPosition : null;
    var sizeKey = sizePosition ? "option" + sizePosition : null;

    // Try to find an available variant matching both options
    var variant = this.variantData.find(function (v) {
      var colorMatch = !colorKey || v[colorKey] === colorValue;
      var sizeMatch = !sizeKey || v[sizeKey] === sizeValue;
      return colorMatch && sizeMatch && v.available;
    });

    // Fallback: match both options but unavailable
    if (!variant) {
      variant = this.variantData.find(function (v) {
        var colorMatch = !colorKey || v[colorKey] === colorValue;
        var sizeMatch = !sizeKey || v[sizeKey] === sizeValue;
        return colorMatch && sizeMatch;
      });
    }

    return variant || null;
  }

  /**
   * Get the currently selected color value from the active swatch.
   */
  getSelectedColor() {
    var activeSwatch = this.querySelector(".product-swatch--active");
    if (activeSwatch) {
      return activeSwatch.dataset.colorValue;
    }
    return null;
  }

  /**
   * Get the color option position from the swatches container.
   */
  getColorPosition() {
    var swatchContainer = this.querySelector(".product-swatches");
    if (swatchContainer) {
      return parseInt(swatchContainer.dataset.optionPosition, 10);
    }
    return null;
  }

  /**
   * Get the currently selected size value from the active size button.
   */
  getSelectedSize() {
    if (!this.card) return null;
    var activeSize = this.card.querySelector(".product-size-btn--active");
    if (activeSize) {
      return activeSize.dataset.sizeValue;
    }
    return null;
  }

  /**
   * Get the size option position from the size selector container.
   */
  getSizePosition() {
    if (!this.card) return null;
    var sizeContainer = this.card.querySelector("[data-size-selector]");
    if (sizeContainer) {
      return parseInt(sizeContainer.dataset.sizeOptionPosition, 10);
    }
    return null;
  }

  onSwatchClick(e) {
    e.preventDefault();
    e.stopPropagation();

    if (!this.card) return;

    var colorValue = e.currentTarget.dataset.colorValue;
    var colorPosition = this.getColorPosition();
    var sizeValue = this.getSelectedSize();
    var sizePosition = this.getSizePosition();

    var variant = this.findVariant(
      colorValue,
      colorPosition,
      sizeValue,
      sizePosition,
    );
    if (!variant) return;

    // Update active swatch
    this.swatches.forEach(function (s) {
      s.classList.remove("product-swatch--active");
    });
    e.currentTarget.classList.add("product-swatch--active");

    this.updateCard(variant);
  }

  onSizeClick(e) {
    e.preventDefault();
    e.stopPropagation();

    if (!this.card) return;

    var sizeValue = e.currentTarget.dataset.sizeValue;
    var sizePosition = this.getSizePosition();
    var colorValue = this.getSelectedColor();
    var colorPosition = this.getColorPosition();

    var variant = this.findVariant(
      colorValue,
      colorPosition,
      sizeValue,
      sizePosition,
    );
    if (!variant) return;

    // Update active size button
    this.sizeButtons.forEach(function (s) {
      s.classList.remove("product-size-btn--active");
    });
    e.currentTarget.classList.add("product-size-btn--active");

    this.updateCard(variant);
  }

  /**
   * Apply the selected variant to all card elements (image, price, URLs, ATC, etc.)
   */
  updateCard(variant) {
    var card = this.card;

    // 1. Update variant ID hidden input
    var variantInput = card.querySelector('input[name="id"]');
    if (variantInput) variantInput.value = variant.id;

    // 2. Update product URLs
    var imageLink = card.querySelector(".product-card__image-link");
    var titleLink = card.querySelector(".product-card__title-link");
    if (imageLink) {
      var baseUrl = imageLink.dataset.baseUrl;
      var variantUrl = baseUrl + "?variant=" + variant.id;
      imageLink.href = variantUrl;
      if (titleLink) titleLink.href = variantUrl;
    }

    // 3. Update primary image
    if (variant.featured_image) {
      var img = card.querySelector(
        ".product-image-container img.responsive-image",
      );
      if (img) {
        img.src = variant.featured_image.src;
        img.setAttribute("data-src", variant.featured_image.data_src);
        img.setAttribute("data-srcset", variant.featured_image.srcset);
        img.setAttribute("alt", variant.featured_image.alt);
        img.setAttribute("width", variant.featured_image.width);
        img.setAttribute("height", variant.featured_image.height);
        // Re-trigger lazysizes
        img.classList.remove("lazyloaded");
        img.classList.add("lazyload");
      }
    }

    // 4. Update sold-out state
    var overlay = card.querySelector("[data-sold-out-overlay]");
    var badge = card.querySelector("[data-sold-out-badge]");
    if (overlay) overlay.style.display = variant.available ? "none" : "";
    if (badge) badge.style.display = variant.available ? "none" : "";

    // 5. Update price
    var priceContainer = card.querySelector("[data-price-container]");
    if (priceContainer) {
      var html = "";
      if (variant.compare_at_price_formatted) {
        html += '<div class="product-price-container-content">';
        html +=
          '<span class="product-price" style="color: var(--color-price-foreground); font-weight: 500;">' +
          variant.price_formatted +
          "</span>";
        html +=
          '<s class="compare-at-price">' +
          variant.compare_at_price_formatted +
          "</s>";
        html += "</div>";
      } else {
        html += '<div class="product-price-container-content">';
        html +=
          '<span class="product-price">' + variant.price_formatted + "</span>";
        html += "</div>";
      }

      var showPromo = priceContainer.dataset.showPromo === "true";
      if (showPromo && variant.discount_percentage > 0) {
        html +=
          '<div class="product-discounted-promo"><span>' +
          variant.discount_percentage +
          "% off</span></div>";
      } else if (showPromo) {
        html += '<div class="product-discounted-promo"></div>';
      }

      priceContainer.innerHTML = html;
    }

    // 6. Update add-to-cart button
    var atcButton = card.querySelector("add-to-cart button");
    if (atcButton) {
      var atcText = atcButton.querySelector(".atc-button__text");
      if (variant.available) {
        atcButton.disabled = false;
        if (atcText) atcText.textContent = "ADD TO CART";
      } else {
        atcButton.disabled = true;
        if (atcText) atcText.textContent = "SOLD OUT";
      }
    }
  }
}

customElements.define(
  "product-card-variant-selector",
  ProductCardVariantSelector,
);
