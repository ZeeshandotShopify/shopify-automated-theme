class MonotoneNoise extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.canvas = null;
    this.ctx = null;
    this.resizeObserver = null;
  }

  static get observedAttributes() {
    return ["size", "opacity", "density", "color", "animated"];
  }

  connectedCallback() {
    this.render();
    this.setupCanvas();
    this.setupResizeObserver();
  }

  disconnectedCallback() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue && this.canvas) {
      this.drawNoise();
    }
  }

  // Getters for settings
  get size() {
    return parseFloat(this.getAttribute("size")) || 0.8;
  }

  get opacity() {
    return parseFloat(this.getAttribute("opacity")) || 0.05;
  }

  get density() {
    return parseFloat(this.getAttribute("density")) || 0.9;
  }

  get color() {
    return this.getAttribute("color") || "#000000";
  }

  get animated() {
    return this.hasAttribute("animated");
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 1;
        }
        canvas {
          width: 100%;
          height: 100%;
          display: block;
          mix-blend-mode: multiply;
        }
      </style>
      <canvas></canvas>
    `;
  }

  setupCanvas() {
    this.canvas = this.shadowRoot.querySelector("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.resizeCanvas();
    this.drawNoise();

    if (this.animated) {
      this.startAnimation();
    }
  }

  setupResizeObserver() {
    this.resizeObserver = new ResizeObserver(() => {
      this.resizeCanvas();
      this.drawNoise();
    });
    this.resizeObserver.observe(this);
  }

  resizeCanvas() {
    const rect = this.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  }

  drawNoise() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const imageData = this.ctx.createImageData(w, h);
    const data = imageData.data;

    const density = this.density;
    const grainSize = this.size;
    const rgb = this.hexToRgb(this.color);

    // Adjust pixel step based on size (larger size = larger grain)
    const step = Math.max(1, Math.floor(1 / grainSize));

    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        if (Math.random() < density) {
          const brightness = Math.random();
          const r = rgb.r * brightness;
          const g = rgb.g * brightness;
          const b = rgb.b * brightness;

          // Fill a block of pixels for grain effect
          for (let dy = 0; dy < step && y + dy < h; dy++) {
            for (let dx = 0; dx < step && x + dx < w; dx++) {
              const i = ((y + dy) * w + (x + dx)) * 4;
              data[i] = r;
              data[i + 1] = g;
              data[i + 2] = b;
              data[i + 3] = 255;
            }
          }
        }
      }
    }

    this.ctx.putImageData(imageData, 0, 0);
    this.canvas.style.opacity = this.opacity;
  }

  startAnimation() {
    const animate = () => {
      this.drawNoise();
      this.animationFrame = requestAnimationFrame(animate);
    };
    animate();
  }

  stopAnimation() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
  }
}

// Register the custom element
customElements.define("monotone-noise", MonotoneNoise);
