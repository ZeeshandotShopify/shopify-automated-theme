class QuantitySelector extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.localQuantityInput = this.querySelector("input[name='quantity']");
    this.minusButton = this.querySelector("[data-quantity-minus]");
    this.plusButton = this.querySelector("[data-quantity-plus]");

    // Get max quantity from data attribute
    this.maxQuantity = this.dataset.max;

    this.handleMinusClick = this.handleMinusClick.bind(this);
    this.handlePlusClick = this.handlePlusClick.bind(this);
    this.handleInputChange = this.handleInputChange.bind(this);

    this.minusButton.addEventListener("click", this.handleMinusClick);
    this.plusButton.addEventListener("click", this.handlePlusClick);
    this.localQuantityInput.addEventListener("input", this.handleInputChange);

    // Initialize the form quantity input
    this.syncToFormInput();
  }

  disconnectedCallback() {
    if (this.minusButton) {
      this.minusButton.removeEventListener("click", this.handleMinusClick);
    }
    if (this.plusButton) {
      this.plusButton.removeEventListener("click", this.handlePlusClick);
    }
    if (this.localQuantityInput) {
      this.localQuantityInput.removeEventListener(
        "input",
        this.handleInputChange,
      );
    }
  }

  // Helper method to get the form's quantity input dynamically
  getFormQuantityInput() {
    const productForm = document.querySelector("form[action='/cart/add']");
    if (!productForm) return null;

    // Get the quantity input that's NOT inside this component
    const formInputs = productForm.querySelectorAll("input[name='quantity']");
    for (const input of formInputs) {
      if (!this.contains(input)) {
        return input;
      }
    }
    return null;
  }

  // Sync the local input value to the form input
  syncToFormInput() {
    const formInput = this.getFormQuantityInput();
    if (formInput) {
      formInput.value = this.localQuantityInput.value;
    }
  }

  handleMinusClick() {
    if (parseInt(this.localQuantityInput.value) === 1) {
      return;
    }
    this.localQuantityInput.value = parseInt(this.localQuantityInput.value) - 1;
    this.syncToFormInput();
  }

  handlePlusClick() {
    if (
      parseInt(this.localQuantityInput.value) === parseInt(this.maxQuantity)
    ) {
      return;
    }
    this.localQuantityInput.value = parseInt(this.localQuantityInput.value) + 1;
    this.syncToFormInput();
  }

  handleInputChange() {
    let value = parseInt(this.localQuantityInput.value) || 1;

    // Enforce min/max bounds
    if (value < 1) value = 1;
    if (this.maxQuantity && value > parseInt(this.maxQuantity)) {
      value = parseInt(this.maxQuantity);
    }

    this.localQuantityInput.value = value;
    this.syncToFormInput();
  }
}

customElements.define("quantity-selector", QuantitySelector);
