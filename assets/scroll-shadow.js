class ScrollShadow extends HTMLElement {
  constructor() {
    super();
    this.handleScroll = this.handleScroll.bind(this);
  }

  connectedCallback() {
    this.addEventListener("scroll", this.handleScroll);
    setTimeout(() => this.updateFades(), 0);

    this.observer = new ResizeObserver(() => this.updateFades());
    this.observer.observe(this);
  }

  disconnectedCallback() {
    this.removeEventListener("scroll", this.handleScroll);
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  handleScroll() {
    this.updateFades();
  }

  updateFades() {
    const { scrollLeft, scrollWidth, clientWidth } = this;
    const maxScroll = scrollWidth - clientWidth;

    // Calculate fade distances (0-20px based on scroll position)
    const fadeLeft = Math.min(scrollLeft, 20);
    const fadeRight = Math.min(maxScroll - scrollLeft, 20);

    this.style.setProperty("--fade-left", `${fadeLeft}px`);
    this.style.setProperty("--fade-right", `${fadeRight}px`);
  }
}

customElements.define("scroll-shadow", ScrollShadow);
