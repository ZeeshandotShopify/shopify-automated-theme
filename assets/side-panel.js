class SidePanel extends HTMLElement {
  connectedCallback() {
    // Wait for children to be upgraded/ready
    requestAnimationFrame(() => this.init());
  }

  init() {
    const blockId = this.dataset.blockId;
    if (!blockId) return;

    // The container is the sheet-menu inside this element
    const container = this.querySelector("sheet-menu");

    // The content is moved to body by sheet-menu, so we find it by ID
    const contentId = `side-panel-content-${blockId}`;
    let contentContainer = document.getElementById(contentId);

    // Fallback: Check if it's still inside the container (if sheet-menu hasn't moved it yet)
    if (!contentContainer && container) {
      contentContainer = container.querySelector(`#${contentId}`);
    }

    // If we still can't find content, use container as fallback for queries
    const targetContainer = contentContainer || container;
    if (!targetContainer) return;

    // Selectors
    // Triggers are inside the sheet-menu container (this component's children)
    const triggers = this.querySelectorAll(".side-panel-trigger-btn");
    const tabNavs = targetContainer.querySelectorAll(".side-panel-tab-btn");
    const tabContents = targetContainer.querySelectorAll(
      ".side-panel-tab-content",
    );

    // Function to activate a specific tab
    const activateTab = (tabId) => {
      // 1. Update Top Nav Buttons
      tabNavs.forEach((btn) => {
        if (btn.dataset.target === tabId) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });

      // 2. Show Correct Content
      tabContents.forEach((content) => {
        if (content.id === tabId) {
          content.style.display = "block";
        } else {
          content.style.display = "none";
        }
      });
    };

    // Event Listener: External Triggers
    triggers.forEach((trigger) => {
      trigger.addEventListener("click", (e) => {
        e.preventDefault();
        const targetTab = trigger.dataset.openTab;

        if (targetTab) {
          activateTab(targetTab);
        }

        if (container && typeof container.open === "function") {
          container.open();
        }
      });
    });

    // Event Listener: Internal Tab Switching
    tabNavs.forEach((btn) => {
      btn.addEventListener("click", () => {
        activateTab(btn.dataset.target);
      });
    });

    // Initialize first tab if none active
    // We check if any tab is already active (unlikely on fresh render)
    const activeTab = Array.from(tabNavs).find((btn) =>
      btn.classList.contains("active"),
    );
    if (!activeTab && tabNavs.length > 0) {
      activateTab(tabNavs[0].dataset.target);
    }
  }
}

if (!customElements.get("side-panel")) {
  customElements.define("side-panel", SidePanel);
}
