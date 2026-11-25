/**
 * TabsContainer - Parent web component (Light DOM)
 * Manages tab triggers and coordinates with TabPanel children
 */
if (!customElements.get("tabs-container")) {
  class TabsContainer extends HTMLElement {
    constructor() {
      super();
      this._initialized = false;
    }

    connectedCallback() {
      if (this._initialized) return;
      this._initialized = true;

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => this.init());
      } else {
        this.init();
      }
    }

    init() {
      this.triggersContainer = this.querySelector(".tabs__triggers");
      this.panels = this.querySelectorAll("tab-panel");

      // Generate triggers from panel data-label attributes
      this.generateTriggers();

      this.triggers = this.querySelectorAll(".tabs__trigger");

      // Bind click events to triggers
      this.triggers.forEach((trigger, index) => {
        trigger.addEventListener("click", () => this.activateTab(index));
        trigger.addEventListener("keydown", (e) =>
          this.handleKeydown(e, index),
        );
      });

      // Activate the first tab by default
      if (this.triggers.length > 0 && this.panels.length > 0) {
        this.activateTab(0);
      }

      // Shopify theme editor support
      if (window.Shopify?.designMode) {
        this.addEventListener("shopify:block:select", (event) => {
          const panel = event.target.closest("tab-panel");
          if (panel) {
            const index = Array.from(this.panels).indexOf(panel);
            if (index !== -1) {
              this.activateTab(index);
            }
          }
        });
      }
    }

    /**
     * Generate trigger buttons from tab-panel data-label attributes
     */
    generateTriggers() {
      if (!this.triggersContainer || this.panels.length === 0) return;

      // Clear existing triggers
      this.triggersContainer.innerHTML = "";

      this.panels.forEach((panel, index) => {
        const label = panel.dataset.label || `Tab ${index + 1}`;
        const panelId = panel.id || `tab-panel-${index}`;
        const triggerId = `tab-trigger-${panelId}`;

        // Set up panel ARIA attributes
        panel.setAttribute("aria-labelledby", triggerId);

        // Create trigger button
        const trigger = document.createElement("button");
        trigger.className = "tabs__trigger";
        trigger.type = "button";
        trigger.role = "tab";
        trigger.id = triggerId;
        trigger.setAttribute("aria-controls", panelId);
        trigger.setAttribute("aria-selected", "false");
        trigger.setAttribute("tabindex", index === 0 ? "0" : "-1");

        // Support for trigger styles that need indicators
        const triggerStyle = this.dataset.triggerStyle || "foreground";
        if (triggerStyle === "indicator") {
          trigger.innerHTML = `
            <span class="tabs__trigger-text">${label}</span>
            <span class="tabs__trigger-indicator" aria-hidden="true"></span>
          `;
        } else {
          trigger.textContent = label;
        }

        this.triggersContainer.appendChild(trigger);
      });
    }

    activateTab(index) {
      // Deactivate all triggers
      this.triggers.forEach((trigger) => {
        trigger.classList.remove("is-active");
        trigger.setAttribute("aria-selected", "false");
        trigger.setAttribute("tabindex", "-1");
      });

      // Deactivate all panels
      this.panels.forEach((panel) => {
        panel.classList.remove("is-active");
        panel.setAttribute("hidden", "");
      });

      // Activate selected trigger and panel
      const selectedTrigger = this.triggers[index];
      const selectedPanel = this.panels[index];

      if (selectedTrigger) {
        selectedTrigger.classList.add("is-active");
        selectedTrigger.setAttribute("aria-selected", "true");
        selectedTrigger.setAttribute("tabindex", "0");
      }

      if (selectedPanel) {
        selectedPanel.classList.add("is-active");
        selectedPanel.removeAttribute("hidden");
      }

      // Dispatch custom event
      this.dispatchEvent(
        new CustomEvent("tab-change", {
          bubbles: true,
          detail: { index, trigger: selectedTrigger, panel: selectedPanel },
        }),
      );
    }

    handleKeydown(event, currentIndex) {
      const totalTabs = this.triggers.length;
      let newIndex = currentIndex;

      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          event.preventDefault();
          newIndex = (currentIndex + 1) % totalTabs;
          break;
        case "ArrowLeft":
        case "ArrowUp":
          event.preventDefault();
          newIndex = (currentIndex - 1 + totalTabs) % totalTabs;
          break;
        case "Home":
          event.preventDefault();
          newIndex = 0;
          break;
        case "End":
          event.preventDefault();
          newIndex = totalTabs - 1;
          break;
        default:
          return;
      }

      this.triggers[newIndex]?.focus();
      this.activateTab(newIndex);
    }
  }

  customElements.define("tabs-container", TabsContainer);
}

/**
 * TabPanel - Child web component (Light DOM)
 * Represents a single tab panel content area
 */
if (!customElements.get("tab-panel")) {
  class TabPanel extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      // Panel is mostly passive, controlled by parent TabsContainer
    }
  }

  customElements.define("tab-panel", TabPanel);
}
