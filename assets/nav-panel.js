// class NavPanelParent extends HTMLElement {
//   connectedCallback() {
//     const label = this.getAttribute('label') || this.textContent.trim();

//     this.innerHTML = `
//       <span>${label}</span>
//       <svg class="nav-arrow" fill="none" viewBox="0 0 24 24" stroke-width="2">
//         <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
//       </svg>
//     `;
//   }
// }

// // Mobile Nav Child Component (regular links)
// class NavPanelChild extends HTMLElement {
//   connectedCallback() {
//   }
// }

// class NavPanel extends HTMLElement {
//   constructor() {
//     super();
//     this.panels = [];
//     this.currentPanelIndex = 0;
//     this.panelStack = [0];
//   }

//   connectedCallback() {
//     this.buildPanels();
//     this.render();
//     this.attachEventListeners();
//   }

//   buildPanels() {
//     const rootUl = this.querySelector(':scope > ul');
//     if (!rootUl) return;

//     this.panels = [];
//     this.buildPanelFromUl(rootUl, 'Main Menu');
//   }

//   buildPanelFromUl(ul, title) {
//     // Create current panel first and get its index
//     const currentPanelIndex = this.panels.length;
//     const panel = {
//       title: title,
//       items: []
//     };
//     this.panels.push(panel);

//     // Now process children
//     Array.from(ul.children).forEach(li => {
//       if (li.tagName !== 'LI') return;

//       const parent = li.querySelector(':scope > nav-panel-parent');
//       const child = li.querySelector(':scope > nav-panel-child');
//       const nestedUl = li.querySelector(':scope > ul');

//       if (parent && nestedUl) {
//         const label = parent.getAttribute('label') || parent.textContent.trim();

//         // Reserve the next panel index for this submenu
//         const childPanelIndex = this.panels.length;

//         panel.items.push({
//           type: 'parent',
//           label: label,
//           childPanelIndex: childPanelIndex
//         });

//         // Recursively build child panel
//         this.buildPanelFromUl(nestedUl, label);
//       } else if (child) {
//         panel.items.push({
//           type: 'child',
//           label: child.getAttribute('label') || child.textContent.trim(),
//           href: child.getAttribute('href')
//         });
//       }
//     });
//   }

//   render() {
//     const wrapper = document.createElement('div');
//     wrapper.className = 'nav-wrapper';

//     this.panels.forEach((panel, index) => {
//       const panelDiv = document.createElement('div');
//       panelDiv.className = `nav-panel ${index === 0 ? 'active' : 'next'}`;
//       panelDiv.dataset.panelIndex = index;

//       // Add header for non-root panels
//       if (index > 0) {
//         const header = document.createElement('div');
//         header.className = 'nav-panel-header';
//         header.innerHTML = `
//           <button class="nav-back-btn">
//             <svg fill="none" viewBox="0 0 24 24" stroke-width="2">
//               <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
//             </svg>
//           </button>
//           <span class="nav-panel-title">${panel.title}</span>
//         `;
//         panelDiv.appendChild(header);
//       }

//       // Build ul with items
//       const ul = document.createElement('ul');
//       panel.items.forEach(item => {
//         const li = document.createElement('li');

//         if (item.type === 'parent') {
//           const parent = document.createElement('nav-panel-parent');
//           parent.setAttribute('label', item.label);
//           parent.dataset.targetPanel = item.childPanelIndex;
//           li.appendChild(parent);
//         } else if (item.type === 'child') {
//           const child = document.createElement('nav-panel-child');
//           child.setAttribute('label', item.label);
//           if (item.href) {
//             child.setAttribute('href', item.href);
//           }
//           li.appendChild(child);
//         }

//         ul.appendChild(li);
//       });

//       panelDiv.appendChild(ul);
//       wrapper.appendChild(panelDiv);
//     });

//     this.innerHTML = '';
//     this.appendChild(wrapper);
//   }

//   attachEventListeners() {
//     // Handle clicks on parent elements to navigate forward
//     this.addEventListener('click', (e) => {
//       const parent = e.target.closest('nav-panel-parent');
//       if (parent && parent.dataset.targetPanel) {
//         e.preventDefault();
//         this.navigateToPanel(parseInt(parent.dataset.targetPanel));
//       }

//       // Handle back button clicks
//       if (e.target.closest('.nav-back-btn')) {
//         this.navigateBack();
//       }
//     });
//   }

//   navigateToPanel(targetIndex) {
//     const currentPanel = this.querySelector(`[data-panel-index="${this.currentPanelIndex}"]`);
//     const targetPanel = this.querySelector(`[data-panel-index="${targetIndex}"]`);

//     if (!targetPanel) return;

//     // Remove ALL state classes from current panel
//     currentPanel.classList.remove('active', 'next', 'prev');
//     currentPanel.classList.add('prev');

//     // Remove ALL state classes from target panel before making it active
//     targetPanel.classList.remove('active', 'next', 'prev');
//     targetPanel.classList.add('active');

//     this.panelStack.push(targetIndex);
//     this.currentPanelIndex = targetIndex;
//   }

//   navigateBack() {
//     if (this.panelStack.length <= 1) return;

//     const currentPanel = this.querySelector(`[data-panel-index="${this.currentPanelIndex}"]`);

//     this.panelStack.pop();
//     const previousIndex = this.panelStack[this.panelStack.length - 1];
//     const previousPanel = this.querySelector(`[data-panel-index="${previousIndex}"]`);

//     // Remove ALL state classes from current panel
//     currentPanel.classList.remove('active', 'next', 'prev');
//     currentPanel.classList.add('next');

//     // Remove ALL state classes from previous panel before making it active
//     previousPanel.classList.remove('active', 'next', 'prev');
//     previousPanel.classList.add('active');

//     this.currentPanelIndex = previousIndex;
//   }
// }

// // Register components
// customElements.define('nav-panel-parent', NavPanelParent);
// customElements.define('nav-panel-child', NavPanelChild);
// customElements.define('nav-panel', NavPanel);

class NavPanelParent extends HTMLElement {
  connectedCallback() {
    // Don't render yet - let NavPanel process the structure first
    // NavPanel will call render() on us when it's ready
  }

  render() {
    const label = this.getAttribute("label") || this.textContent.trim();
    this.innerHTML = `
      <span>${label}</span>
      <svg class="nav-arrow" fill="none" viewBox="0 0 24 24" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    `;
  }
}

class NavPanelChild extends HTMLElement {
  connectedCallback() {
    // Child elements are rendered as-is
  }
}

class NavPanel extends HTMLElement {
  constructor() {
    super();
    this.panels = [];
    this.currentPanelIndex = 0;
    this.panelStack = [0];
    this.initialized = false;
  }

  connectedCallback() {
    // Use MutationObserver to wait for all content to be ready
    if (!this.initialized) {
      // Try immediate initialization
      this.tryInitialize();

      // Also observe for any delayed content
      const observer = new MutationObserver(() => {
        if (!this.initialized && this.children.length > 0) {
          observer.disconnect();
          this.tryInitialize();
        }
      });

      observer.observe(this, { childList: true, subtree: true });

      // Fallback timeout
      setTimeout(() => {
        observer.disconnect();
        if (!this.initialized) {
          this.tryInitialize();
        }
      }, 100);
    }
  }

  tryInitialize() {
    const rootChildren = Array.from(this.children);
    // console.log('Initializing with children:', rootChildren.length);

    if (rootChildren.length === 0) {
      console.warn("No children found in nav-panel");
      return;
    }

    this.initialized = true;
    this.buildPanels();
    this.render();
    this.attachEventListeners();
  }

  buildPanels() {
    const rootChildren = Array.from(this.children);

    this.panels = [];
    this.buildPanelFromElements(rootChildren, "Main Menu");

    // console.log('Built panels:', this.panels);
  }

  buildPanelFromElements(elements, title) {
    const currentPanelIndex = this.panels.length;
    const panel = {
      title: title,
      items: [],
    };
    this.panels.push(panel);

    elements.forEach((el) => {
      if (el.tagName === "NAV-PANEL-PARENT") {
        const label = el.getAttribute("label") || el.textContent.trim();

        // Get nested nav-panel-parent and nav-panel-child elements
        const childElements = Array.from(el.children).filter(
          (child) =>
            child.tagName === "NAV-PANEL-PARENT" ||
            child.tagName === "NAV-PANEL-CHILD",
        );

        // console.log(`Parent "${label}" has ${childElements.length} children`);

        if (childElements.length > 0) {
          const childPanelIndex = this.panels.length;

          panel.items.push({
            type: "parent",
            label: label,
            childPanelIndex: childPanelIndex,
          });

          // Recursively build child panel
          this.buildPanelFromElements(childElements, label);
        }
      } else if (el.tagName === "NAV-PANEL-CHILD") {
        const link = el.querySelector("a");
        panel.items.push({
          type: "child",
          label: link?.textContent.trim() || el.textContent.trim(),
          href: link?.getAttribute("href"),
        });
      }
    });
  }

  render() {
    // console.log('Rendering panels...');
    this.innerHTML = "";

    this.panels.forEach((panel, index) => {
      const panelDiv = document.createElement("div");
      panelDiv.className = `nav-panel ${index === 0 ? "active" : "next"}`;
      panelDiv.dataset.panelIndex = index;

      // Add header for non-root panels
      if (index > 0) {
        const header = document.createElement("div");
        header.className = "nav-panel-header";
        header.innerHTML = `
          <button class="nav-back-btn">
            <svg fill="none" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span class="nav-panel-title">${panel.title}</span>
        `;
        panelDiv.appendChild(header);
      }

      // Build items directly without ul/li
      panel.items.forEach((item) => {
        if (item.type === "parent") {
          const parent = document.createElement("nav-panel-parent");
          parent.setAttribute("label", item.label);
          parent.dataset.targetPanel = item.childPanelIndex;
          parent.render(); // Now render the parent element
          panelDiv.appendChild(parent);
        } else if (item.type === "child") {
          const child = document.createElement("nav-panel-child");
          if (item.href) {
            const link = document.createElement("a");
            link.href = item.href;
            link.textContent = item.label;
            child.appendChild(link);
          } else {
            child.textContent = item.label;
          }
          panelDiv.appendChild(child);
        }
      });

      this.appendChild(panelDiv);
    });

    // console.log('Render complete');
  }

  attachEventListeners() {
    this.addEventListener("click", (e) => {
      const parent = e.target.closest("nav-panel-parent");
      if (parent && parent.dataset.targetPanel) {
        e.preventDefault();
        this.navigateToPanel(parseInt(parent.dataset.targetPanel));
      }

      if (e.target.closest(".nav-back-btn")) {
        this.navigateBack();
      }
    });
  }

  navigateToPanel(targetIndex) {
    const currentPanel = this.querySelector(
      `[data-panel-index="${this.currentPanelIndex}"]`,
    );
    const targetPanel = this.querySelector(
      `[data-panel-index="${targetIndex}"]`,
    );

    if (!targetPanel) return;

    currentPanel.classList.remove("active", "next", "prev");
    currentPanel.classList.add("prev");

    targetPanel.classList.remove("active", "next", "prev");
    targetPanel.classList.add("active");

    this.panelStack.push(targetIndex);
    this.currentPanelIndex = targetIndex;
  }

  navigateBack() {
    if (this.panelStack.length <= 1) return;

    const currentPanel = this.querySelector(
      `[data-panel-index="${this.currentPanelIndex}"]`,
    );

    this.panelStack.pop();
    const previousIndex = this.panelStack[this.panelStack.length - 1];
    const previousPanel = this.querySelector(
      `[data-panel-index="${previousIndex}"]`,
    );

    currentPanel.classList.remove("active", "next", "prev");
    currentPanel.classList.add("next");

    previousPanel.classList.remove("active", "next", "prev");
    previousPanel.classList.add("active");

    this.currentPanelIndex = previousIndex;
  }
}

// Make sure to define the components before they're used
customElements.define("nav-panel-parent", NavPanelParent);
customElements.define("nav-panel-child", NavPanelChild);
customElements.define("nav-panel", NavPanel);
