// /**
//  * @file utils.js
//  * @description Utility functions for the Shopify theme, primarily for dynamic content updates.
//  *
//  * This file provides helper functions to enhance the interactivity of the Shopify storefront.
//  * Currently, it includes the `rerenderSection` function for updating specific sections
//  * of the page without requiring a full page reload. This is particularly useful for
//  * features like AJAX-based pagination, filtering, or dynamic content loading.
//  *
//  * @usage
//  * 1. Import the function in your JavaScript file:
//  *    import { rerenderSection } from './utils.js';
//  *
//  * 2. Call the function with the appropriate parameters:
//  *    rerenderSection('/collections/all?page=2', 'collection-products-section');
//  *
//  *    - The URL should point to an endpoint that returns the updated HTML for the section.
//  *    - The sectionId should match the ID used in your Liquid templates (without the 'shopify-section-' prefix).
//  *
//  * @note Ensure that the fetched HTML matches the expected structure to avoid layout issues.
//  *       This function assumes the section is wrapped in an element with id `shopify-section-${sectionId}`.
//  */
// export function rerenderSection(url, sectionId) {
//   fetch(url)
//     .then((response) => response.text())
//     .then((html) => {
//       /*
//        * The Shopify section ID is dynamically set in the pagination-nav.liquid snippet via the data-section-id attribute.
//        * This allows us to target the specific section element in the DOM.
//        *
//        * In Shopify themes, each section is automatically wrapped in a <section> element with an ID in the format
//        * 'shopify-section-{sectionId}', where {sectionId} is the unique identifier for that section instance.
//        *
//        * Here, 'currentContent' selects this entire <section> element, including all its child content.
//        * We then replace its outerHTML with the newly fetched HTML to update the section's content dynamically
//        * without a full page reload. This is particularly useful for pagination, where we want to refresh
//        * only the product list or main content while keeping the rest of the page intact.
//        *
//        * Note: Ensure that the fetched HTML matches the structure exactly to avoid layout issues or loss of functionality.
//        */
//       const currentContent = document.getElementById(
//         `shopify-section-${sectionId}`
//       );

//       if (currentContent) {
//         currentContent.outerHTML = html;
//       } else {
//         console.warn("Content container not found");
//       }

//       document.dispatchEvent(
//         new CustomEvent("section:rerendered", {
//           bubbles: true,
//           detail: {
//             sectionId,
//             html,
//           },
//         })
//       );
//     });
// }

/**
 * @file utils.js
 * @description Utility functions for the Shopify theme, primarily for dynamic content updates.
 *
 * This file provides helper functions to enhance the interactivity of the Shopify storefront.
 * Currently, it includes the `rerenderSection` function for updating specific sections
 * of the page without requiring a full page reload. This is particularly useful for
 * features like AJAX-based pagination, filtering, or dynamic content loading.
 *
 * @usage
 * 1. Import the function in your JavaScript file:
 *    import { rerenderSection } from './utils.js';
 *
 * 2. Call the function with the appropriate parameters:
 *    rerenderSection('/collections/all?page=2', 'collection-products-section');
 *    or
 *    rerenderSection('/collections/all?page=2', 'my-custom-element', 'elementId');
 *
 *    - The URL should point to an endpoint that returns the updated HTML for the section.
 *    - The second parameter can be either a sectionId (default) or elementId.
 *    - The third parameter specifies the type: 'sectionId' (default) or 'elementId'.
 *    - For sectionId: should match the ID used in your Liquid templates (without the 'shopify-section-' prefix).
 *    - For elementId: should match the exact ID of the target element in the DOM.
 *
 * @note Ensure that the fetched HTML matches the expected structure to avoid layout issues.
 *       For sectionId, this function assumes the section is wrapped in an element with id `shopify-section-${sectionId}`.
 *       For elementId, this function targets the element with the exact provided ID.
 */
export function rerenderSection(url, identifier, type = "sectionId") {
  fetch(url)
    .then((response) => response.text())
    .then((html) => {
      const targetId =
        type === "elementId" ? identifier : `shopify-section-${identifier}`;
      const currentContent = document.getElementById(targetId);

      const placeholderDiv = document.createElement("div");
      placeholderDiv.innerHTML = html;

      currentContent.innerHTML = placeholderDiv.querySelector(
        `#${targetId}`,
      ).innerHTML;

      document.dispatchEvent(
        new CustomEvent("section:rerendered", {
          bubbles: true,
          detail: {
            identifier,
            type,
            targetId,
            html,
          },
        }),
      );
    });
}
