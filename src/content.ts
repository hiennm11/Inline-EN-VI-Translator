// Configuration and globals
let isActiveTranslator = false;
const translators: Record<string, any> = {};

// Define selector for all text elements we want to translate
const TEXT_ELEMENT_SELECTOR =
  "p, h1, h2, h3, h4, h5, h6, span, li, td, th, figcaption, blockquote";

// State is now initialized directly in the initialize function

// Language detection
async function detectLanguage(text: string): Promise<string> {
  if (!("LanguageDetector" in self)) {
    throw new Error("LanguageDetector is not supported.");
  }

  // Create detector only once
  if (!(window as any).languageDetector) {
    (window as any).languageDetector = await (
      self as any
    ).LanguageDetector.create();
  }

  const { detectedLanguage } = (
    await (window as any).languageDetector.detect(text)
  )[0];
  return detectedLanguage;
}

// Get or create translator instance
async function getTranslatorInstance(
  sourceLanguage: string,
  targetLanguage: string
): Promise<any | null> {
  const translatorKey = `${sourceLanguage}-${targetLanguage}`;

  // Check availability
  const availability = await (self as any).Translator.availability({
    sourceLanguage,
    targetLanguage,
  });

  if (availability === "unavailable") {
    console.log(`${sourceLanguage} - ${targetLanguage} pair is not supported.`);
    return null;
  }

  // Use existing translator or create a new one
  if (!translators[translatorKey]) {
    translators[translatorKey] = await (self as any).Translator.create({
      sourceLanguage,
      targetLanguage,
    });
  }

  return translators[translatorKey];
}

// Translation function
async function translateText(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
  updateCallback?: (text: string) => void
): Promise<string> {
  try {
    if (!("Translator" in self)) {
      throw new Error("Translator is not supported.");
    }

    const translator = await getTranslatorInstance(
      sourceLanguage,
      targetLanguage
    );

    if (!translator) {
      return "Translation not available for this language pair.";
    }

    let translatedText = "";

    // Use the streaming API
    const stream = translator.translateStreaming(text);
    for await (const chunk of stream) {
      translatedText += chunk;

      // Call update callback if provided
      if (updateCallback) {
        updateCallback(translatedText);
      }
    }

    return translatedText;
  } catch (err) {
    console.error("Translation error:", err);
    return "An error occurred. Please try again.";
  }
}

// DOM manipulation to add translations
function createTranslationElement(originalElement: Element): HTMLElement {
  // Determine the right tag to use
  const tagName = originalElement.tagName === "LI" ? "LI" : "P";

  const transElem = document.createElement(tagName);
  transElem.className = "translated";
  transElem.style.color = "#00695c";
  transElem.textContent = "..."; // Initial loading indicator

  return transElem;
}

// Insert translation element into the page
function insertTranslationElement(
  originalElement: Element,
  translationElement: Element
): void {
  // For list items, append to the list rather than after the element
  if (originalElement.tagName === "LI") {
    const parentList = originalElement.parentElement;
    if (
      parentList &&
      (parentList.tagName === "UL" || parentList.tagName === "OL")
    ) {
      parentList.insertBefore(translationElement, originalElement.nextSibling);
    } else {
      originalElement.insertAdjacentElement("afterend", translationElement);
    }
  } else {
    originalElement.insertAdjacentElement("afterend", translationElement);
  }
}

// Update translation content checking for duplicates
function updateTranslationContent(
  translationElem: Element,
  translatedText: string
): boolean {
  if (
    !hasDuplicateTranslation(translationElem, translatedText) &&
    !isNestedDuplicate(translationElem, translatedText)
  ) {
    translationElem.textContent = translatedText;
    return true;
  }
  return false;
}

// Helper functions for element selection and validation
function isCodeElement(element: Element): boolean {
  return (
    element.closest(
      'pre, code, .highlight, .code-block, [class*="language-"]'
    ) !== null
  );
}

function hasDuplicateTranslation(p: Element, translationText: string): boolean {
  // Check next sibling for class and content
  const next = p.nextElementSibling;
  return (
    next !== null &&
    next.classList.contains("translated") &&
    next.textContent?.trim() === translationText.trim()
  );
}

// Check for nested duplicate: e.g. <h3>…<span>…<p class="translated"></p>…</span>…</h3>
function isNestedDuplicate(p: Element, translationText: string): boolean {
  // Looks for ancestor containing a matching translated element
  let ancestor: Element | null = p.parentElement;
  while (ancestor) {
    const nested = ancestor.querySelector(".translated");
    if (nested && nested.textContent?.trim() === translationText.trim())
      return true;
    ancestor = ancestor.parentElement;
  }
  return false;
}

/**
 * Finds the most likely content container using content density analysis
 * This uses a heuristic approach that looks for areas of the page with:
 * - High density of text elements
 * - Good text-to-tag ratio (measure of content vs markup)
 * - Appropriate nesting level (not too shallow, not too deep)
 * Similar to how browser reader modes identify main content
 */
function findContentByDensity(): Element | null {
  // Get all potential content containers (exclude obvious non-content areas)
  const potentialContainers = Array.from(
    document.querySelectorAll("div, section, main, article")
  ).filter((el) => {
    const tagName = el.tagName.toLowerCase();
    const id = (el.id || "").toLowerCase();
    const className = (el.className || "").toString().toLowerCase();

    // Filter out obvious non-content containers
    return !(
      /sidebar|nav|header|footer|menu|comment|widget|ad/i.test(
        id + " " + className
      ) ||
      tagName === "nav" ||
      tagName === "header" ||
      tagName === "footer"
    );
  });

  if (potentialContainers.length === 0) return null;

  // Score each container based on content metrics
  interface ScoredContainer {
    element: Element;
    score: number;
    textLength: number;
    textDensity: number;
    paragraphCount: number;
  }

  const scoredContainers: ScoredContainer[] = potentialContainers
    .map((element) => {
      // Get content stats
      // Text nodes can be useful for more complex analysis if needed in the future
      // const textNodes = getTextNodesIn(element);
      const textLength = element.textContent?.length || 0;
      const paragraphs = element.querySelectorAll(TEXT_ELEMENT_SELECTOR);
      const paragraphCount = paragraphs.length;

      // Calculate text density (text length / element count)
      const descendantCount = element.querySelectorAll("*").length || 1;
      const textDensity = textLength / descendantCount;

      // Calculate link ratio (lower is better for content)
      const linkText = Array.from(element.querySelectorAll("a")).reduce(
        (total, a) => total + (a.textContent?.length || 0),
        0
      );
      const linkRatio = textLength > 0 ? linkText / textLength : 1;

      // Score based on these metrics
      let score = 0;
      score += textLength * 0.1; // Reward length
      score += paragraphCount * 10; // Heavily reward paragraph count
      score += textDensity * 5; // Reward text density
      score -= linkRatio * 50; // Penalize high link ratio

      return {
        element,
        score,
        textLength,
        textDensity,
        paragraphCount,
      };
    })
    .filter((container) => {
      // Filter out containers with too little content
      return container.textLength > 200 && container.paragraphCount >= 2;
    })
    .sort((a, b) => b.score - a.score);

  // Return the highest scoring container, or null if none found
  return scoredContainers.length > 0 ? scoredContainers[0].element : null;
}

/*
 * NOTE: This utility function is commented out for now but may be useful for future
 * enhancements to content detection algorithms.
 *
 * Helper function to get all text nodes within an element
 *
function getTextNodesIn(element: Element): Node[] {
  const textNodes: Node[] = [];
  const walker = document.createTreeWalker(
    element, 
    NodeFilter.SHOW_TEXT, 
    {
      acceptNode: node => {
        // Skip empty text nodes
        return node.textContent?.trim() 
          ? NodeFilter.FILTER_ACCEPT 
          : NodeFilter.FILTER_REJECT;
      }
    }
  );
  
  let node: Node | null;
  while (node = walker.nextNode()) {
    textNodes.push(node);
  }
  
  return textNodes;
}
*/

// Element selection with improved content detection
function getMainArticleParagraphs(): Element[] {
  // First approach: Try common container selectors
  const mainSelectors = [
    "article",
    "main",
    ".main-content",
    '[role="main"]',
    ".content-base",
    ".post-content",
    ".entry-content",
    "#content",
    ".content",
    ".article",
    ".post",
    ".story",
  ];

  let container: Element | null = null;

  // Try each selector in order of likelihood
  for (const sel of mainSelectors) {
    const elements = document.querySelectorAll(sel);
    // If multiple elements match, choose the one with the most text content
    if (elements.length > 0) {
      if (elements.length === 1) {
        container = elements[0];
      } else {
        // Find the element with the most text content
        let maxTextLength = 0;
        elements.forEach((el) => {
          const textLength = el.textContent?.length || 0;
          if (textLength > maxTextLength) {
            maxTextLength = textLength;
            container = el;
          }
        });
      }
      if (container) break;
    }
  }

  // Second approach: If no container found, use content density analysis
  if (!container) {
    container = findContentByDensity();
  }

  // If we still don't have a container, fall back to body
  if (!container) {
    console.log("No specific content container found, using document body");
    container = document.body;
  }

  // Filter paragraphs, ignore nav/aside/toc inside main
  return Array.from(container.querySelectorAll(TEXT_ELEMENT_SELECTOR)).filter(
    (p) => {
      const parentClasses = (p.parentElement?.className || "") as string;
      const elementId = (p.id || "").toLowerCase();
      const elementClasses = (p.className || "").toString().toLowerCase();

      // More comprehensive filtering
      const isHidden = (p as HTMLElement).offsetParent === null;
      const isInUnwantedSection =
        /sidebar|nav|toc|footer|header|menu|comment|widget|ad/i.test(
          parentClasses + " " + elementClasses + " " + elementId
        );
      const hasMinimumText = (p.textContent?.trim().length || 0) >= 10;

      return !isHidden && !isInUnwantedSection && hasMinimumText;
    }
  );
}

// Element validation
function shouldTranslateElement(element: Element): boolean {
  const text = element.textContent?.trim() || "";

  // Skip elements that are empty, very short, code, or already translated
  return (
    text.length >= 10 &&
    !isCodeElement(element) &&
    !element.closest(".translated")
  );
}

/**
 * Get all translatable paragraphs from the entire page
 * Used as fallback when main content detection doesn't find enough content
 */
function getAllPageParagraphs(): Element[] {
  // Get all text elements matching our selector
  return Array.from(document.querySelectorAll(TEXT_ELEMENT_SELECTOR)).filter(
    (element) => {
      const elementClasses = (element.className || "").toString().toLowerCase();
      const elementId = (element.id || "").toLowerCase();
      const parentClasses = (element.parentElement?.className || "")
        .toString()
        .toLowerCase();

      // Filter out elements that are:
      const isHidden = (element as HTMLElement).offsetParent === null;
      const isInSkippedElement =
        /nav|footer|header|sidebar|menu|comment|widget|ad/i.test(
          elementClasses + " " + elementId + " " + parentClasses
        );
      const isShort = (element.textContent?.trim().length || 0) < 10;
      const isCodeBlock = isCodeElement(element);
      const isTranslated = element.closest(".translated") !== null;

      return (
        !isHidden &&
        !isInSkippedElement &&
        !isShort &&
        !isCodeBlock &&
        !isTranslated
      );
    }
  );
}

/**
 * Get only currently visible paragraphs in the viewport with some margin
 * Used for dynamic sites to prioritize what the user is currently seeing
 */
function getAllVisibleParagraphs(): Element[] {
  // Get all filtered paragraphs first
  const allParagraphs = getAllPageParagraphs();

  // Get current viewport dimensions with some margin
  const viewportTop = window.scrollY - 300; // 300px above viewport
  const viewportBottom = window.scrollY + window.innerHeight + 500; // 500px below viewport

  // Filter only elements in or near viewport
  return allParagraphs.filter((element) => {
    const rect = element.getBoundingClientRect();
    const elementTop = rect.top + window.scrollY;
    const elementBottom = rect.bottom + window.scrollY;

    // Check if element is in extended viewport
    return (
      (elementTop >= viewportTop && elementTop <= viewportBottom) ||
      (elementBottom >= viewportTop && elementBottom <= viewportBottom) ||
      (elementTop <= viewportTop && elementBottom >= viewportBottom)
    );
  });
}

// Process a single element
async function processElement(element: Element): Promise<void> {
  if (!isActiveTranslator || !shouldTranslateElement(element)) {
    return;
  }

  const originalText = element.textContent?.trim() || "";

  // Skip if already translated
  const alreadyTranslated =
    element.nextElementSibling &&
    element.nextElementSibling.classList.contains("translated");
  if (alreadyTranslated) return;

  // Create and insert the translation element
  const transElem = createTranslationElement(element);
  insertTranslationElement(element, transElem);

  // Detect language and translate
  try {
    const sourceLanguage = await detectLanguage(originalText);

    // Only translate between English and Vietnamese
    if (sourceLanguage === "en" || sourceLanguage === "vi") {
      const targetLanguage = sourceLanguage === "en" ? "vi" : "en";

      // Translate with update callback
      await translateText(
        originalText,
        sourceLanguage,
        targetLanguage,
        (translatedText) => updateTranslationContent(transElem, translatedText)
      );
    } else {
      // Remove the translation element if language is not supported
      // transElem.remove();
    }
  } catch (error) {
    console.error("Error processing element:", error);
    transElem.textContent = "Translation error";
  }
}

// Main processing function - MODIFIED for batched processing
async function processPageContent(): Promise<void> {
  // Reset global translation progress before starting
  resetTranslationProgress();

  // Get all main article paragraphs
  const articleParagraphs = getMainArticleParagraphs();

  // Initialize the progress indicator with the total count
  showTranslationProgress(0, articleParagraphs.length);

  // Process elements in smaller batches
  const BATCH_SIZE = 5;
  const DELAY_BETWEEN_BATCHES = 500; // ms

  // Create batches
  for (let i = 0; i < articleParagraphs.length; i += BATCH_SIZE) {
    if (!isActiveTranslator) break; // Stop if disabled mid-processing

    const batch = articleParagraphs.slice(i, i + BATCH_SIZE);

    // Process batch
    await Promise.all(batch.map((element) => processElement(element)));

    // Update progress with this batch's count
    showTranslationProgress(batch.length, 0);

    // Show progress in console
    console.log(
      `Translated batch ${i / BATCH_SIZE + 1}/${Math.ceil(
        articleParagraphs.length / BATCH_SIZE
      )}`
    );

    // Wait before processing next batch to prevent overwhelming the browser
    if (i + BATCH_SIZE < articleParagraphs.length) {
      await new Promise((resolve) =>
        setTimeout(resolve, DELAY_BETWEEN_BATCHES)
      );
    }
  }
}

// Observer for dynamic content - MODIFIED to be more efficient and adaptive
function setupMutationObserver(): MutationObserver {
  // Throttle function to prevent too many calls
  let processingTimeout: ReturnType<typeof setTimeout> | null = null;
  let detectedDynamicSite = false;
  let mutationCounter = 0;
  let significantChangesDetected = false;
  let newElementsCount = 0;

  const throttledProcess = (mutations: MutationRecord[]) => {
    if (processingTimeout) clearTimeout(processingTimeout);

    // Track mutation frequency to detect dynamic sites (SPAs, infinite scroll)
    mutationCounter++;

    // Check if these mutations represent significant DOM changes
    // that might indicate new content being loaded
    let hasSignificantChanges = false;

    for (const mutation of mutations) {
      // Count added nodes that could contain content
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (
            node instanceof HTMLElement &&
            node.nodeType === Node.ELEMENT_NODE &&
            node.matches("div, section, article, p, h1, h2, h3, h4, h5, h6")
          ) {
            hasSignificantChanges = true;
            newElementsCount++;
            break;
          }
        }
      }

      if (hasSignificantChanges) break;
    }

    if (mutationCounter > 10 || newElementsCount > 5) {
      detectedDynamicSite = true;
    }

    if (hasSignificantChanges) {
      significantChangesDetected = true;
    }

    processingTimeout = setTimeout(
      async () => {
        if (!isActiveTranslator) return;

        // For highly dynamic sites, check for new content in the viewport first
        let articleParagraphs: Element[];

        if (detectedDynamicSite) {
          // Focus on visible content first for dynamic sites
          articleParagraphs = getAllVisibleParagraphs();
        } else {
          // For normal sites, use the main content detection
          articleParagraphs = getMainArticleParagraphs();
        }

        // Filter to only get new elements that need translation
        articleParagraphs = articleParagraphs.filter(
          (element) =>
            !element.nextElementSibling?.classList.contains("translated")
        );

        if (articleParagraphs.length === 0) return;

        // Show progress indicator if we have significant new content
        // and it's not just a few elements
        if (
          (significantChangesDetected && articleParagraphs.length > 3) ||
          articleParagraphs.length > 8
        ) {
          console.log(
            `Significant content changes detected, ${articleParagraphs.length} new paragraphs found`
          );

          // Initialize progress tracking with the new content
          if (!globalTranslationProgress.isActive) {
            // If no active translation, start fresh
            resetTranslationProgress();
            showTranslationProgress(0, articleParagraphs.length);
          } else {
            // If translation is already in progress, add to the existing count
            // Make sure to pass articleParagraphs.length as the second parameter (total)
            showTranslationProgress(0, articleParagraphs.length);
          }

          // Reset flags
          significantChangesDetected = false;
          newElementsCount = 0;
        }

        // Process in small batches
        const BATCH_SIZE = detectedDynamicSite ? 2 : 3; // Smaller batches for dynamic sites
        const DELAY = detectedDynamicSite ? 400 : 300; // Longer delays for dynamic sites

        for (let i = 0; i < articleParagraphs.length; i += BATCH_SIZE) {
          if (!isActiveTranslator) break; // Stop if disabled mid-processing

          const batch = articleParagraphs.slice(i, i + BATCH_SIZE);
          await Promise.all(batch.map((element) => processElement(element)));

          // Update progress with batch count if we're tracking progress
          if (globalTranslationProgress.isActive) {
            // We need to send both the batch size (current) and the total remaining
            // to ensure the progress display is accurate
            showTranslationProgress(batch.length, 0);
          }

          // Small delay between batches
          if (i + BATCH_SIZE < articleParagraphs.length) {
            await new Promise((resolve) => setTimeout(resolve, DELAY));
          }
        }
      },
      detectedDynamicSite ? 800 : 500
    ); // Longer throttle for dynamic sites
  };

  const observer = new MutationObserver(throttledProcess);

  // Watch for changes to the content with optimized configuration
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: false, // Don't need character data changes
    attributeFilter: ["class", "style"], // Only care about visibility changes
  });

  // Reset mutation counter periodically
  setInterval(() => {
    mutationCounter = 0;
    newElementsCount = 0;
  }, 30000);

  return observer;
}

// Global translation progress tracking
let globalTranslationProgress = {
  current: 0,
  total: 0,
  isActive: false,
  timeoutId: null as ReturnType<typeof setTimeout> | null,
};

// Add a new function to provide visual feedback with consolidated progress
function showTranslationProgress(current: number, total: number): void {
  // Update global progress counters
  if (!globalTranslationProgress.isActive) {
    // If this is a new translation session, reset counters
    globalTranslationProgress.current = current;
    globalTranslationProgress.total = total;
    globalTranslationProgress.isActive = true;
  } else {
    // For existing session, add to the current count
    globalTranslationProgress.current += current;

    // Always add new elements to the total
    if (total > 0) {
      globalTranslationProgress.total += total;
    }

    // Ensure total is never less than current
    if (globalTranslationProgress.total < globalTranslationProgress.current) {
      globalTranslationProgress.total = globalTranslationProgress.current;
    }
  }

  // Create or update progress indicator - ensure there's only one
  let progressElement = document.getElementById("translation-progress");
  if (!progressElement) {
    // Create new element if it doesn't exist
    progressElement = document.createElement("div");
    progressElement.id = "translation-progress";
    progressElement.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(0, 105, 92, 0.9);
      color: white;
      padding: 10px 15px;
      border-radius: 4px;
      z-index: 10000;
      font-family: system-ui;
      box-shadow: 0 3px 6px rgba(0,0,0,0.16);
    `;
    document.body.appendChild(progressElement);
  }

  // Update the content
  progressElement.innerHTML = `
    Translating: ${globalTranslationProgress.current}/${globalTranslationProgress.total}
    <button id="cancel-translation" style="margin-left: 10px; cursor: pointer;">Cancel</button>
  `;

  // Debug log to help diagnose issues
  console.log(
    `Progress updated: ${globalTranslationProgress.current}/${globalTranslationProgress.total}`
  );

  // Add event listener (using event delegation to avoid multiple listeners)
  const cancelButton = document.getElementById("cancel-translation");
  if (cancelButton) {
    // Remove existing listeners to avoid duplication
    const newCancelButton = cancelButton.cloneNode(true);
    if (cancelButton.parentNode) {
      cancelButton.parentNode.replaceChild(newCancelButton, cancelButton);
    }

    newCancelButton.addEventListener("click", () => {
      isActiveTranslator = false;
      if (progressElement) {
        progressElement.textContent = "Translation cancelled";

        // Clear any existing timeout
        if (globalTranslationProgress.timeoutId) {
          clearTimeout(globalTranslationProgress.timeoutId);
        }

        globalTranslationProgress.timeoutId = setTimeout(() => {
          if (progressElement && progressElement.parentNode) {
            progressElement.parentNode.removeChild(progressElement);
          }
          // Reset global progress tracker
          resetTranslationProgress();
        }, 1500);
      }
    });
  }

  // Hide after complete and reset
  if (globalTranslationProgress.current >= globalTranslationProgress.total) {
    // Clear any existing timeout
    if (globalTranslationProgress.timeoutId) {
      clearTimeout(globalTranslationProgress.timeoutId);
    }

    globalTranslationProgress.timeoutId = setTimeout(() => {
      if (progressElement && progressElement.parentNode) {
        progressElement.parentNode.removeChild(progressElement);
      }
      // Reset global progress tracker
      resetTranslationProgress();
    }, 3000);
  }
}

// Helper function to reset progress tracking
function resetTranslationProgress(): void {
  globalTranslationProgress = {
    current: 0,
    total: 0,
    isActive: false,
    timeoutId: null,
  };
}

// Message handling - MODIFIED to handle large page option
function setupMessageListener(): void {
  chrome.runtime.onMessage.addListener(
    async (
      request: { action: string; enabled: boolean },
      _sender: chrome.runtime.MessageSender,
      _sendResponse: (response?: any) => void
    ) => {
      if (request.action === "toggleTranslator") {
        // Handle enabling/disabling the translator
        isActiveTranslator = request.enabled;

        if (isActiveTranslator) {
          // Add a flag for large pages
          const isLargePage =
            document.querySelectorAll(TEXT_ELEMENT_SELECTOR).length > 100;

          if (isLargePage) {
            // For large pages, we'll translate visible elements first
            await processVisibleElementsFirst();
          } else {
            // For smaller pages, process normally
            await processPageContent();
          }
        }
      }
    }
  );
}

// New function to prioritize visible elements
async function processVisibleElementsFirst(): Promise<void> {
  // Reset global translation progress before starting
  resetTranslationProgress();

  // Get all elements from main content
  let allElements = getMainArticleParagraphs();

  // If very few paragraphs found, try using all body paragraphs as fallback
  if (allElements.length < 3) {
    console.log(
      "Few paragraphs found in main content, searching across entire page"
    );
    allElements = getAllPageParagraphs();
  }

  // Initialize the progress indicator with the total count
  showTranslationProgress(0, allElements.length);

  // Split into visible and non-visible elements
  const visibleElements: Element[] = [];
  const nonVisibleElements: Element[] = [];

  allElements.forEach((element) => {
    const rect = element.getBoundingClientRect();
    const isVisible = rect.top >= 0 && rect.top <= window.innerHeight * 3; // Include elements a bit below the viewport

    if (isVisible) {
      visibleElements.push(element);
    } else {
      nonVisibleElements.push(element);
    }
  });

  // Process visible elements first
  const BATCH_SIZE = 5;
  const DELAY = 300;

  // Process visible elements
  for (let i = 0; i < visibleElements.length; i += BATCH_SIZE) {
    if (!isActiveTranslator) break;

    const batch = visibleElements.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map((element) => processElement(element)));

    // Update progress with this batch's count
    showTranslationProgress(batch.length, 0);

    await new Promise((resolve) => setTimeout(resolve, DELAY));
  }

  // Process remaining elements with longer delays
  for (let i = 0; i < nonVisibleElements.length; i += BATCH_SIZE) {
    if (!isActiveTranslator) break;

    const batch = nonVisibleElements.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map((element) => processElement(element)));

    // Update progress with this batch's count
    showTranslationProgress(batch.length, 0);

    await new Promise((resolve) => setTimeout(resolve, DELAY * 2));
  }
}

// Add function for lazy loading translations
function setupLazyTranslation(): IntersectionObserver {
  // Create intersection observer
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && isActiveTranslator) {
          const element = entry.target;
          // Process this element if it needs translation
          if (!element.nextElementSibling?.classList.contains("translated")) {
            processElement(element);
          }
          // Unobserve after processing
          observer.unobserve(element);
        }
      });
    },
    { rootMargin: "200px" }
  );

  // Observe all translatable elements
  function observeAllElements(): void {
    if (!isActiveTranslator) return;

    const elements = getMainArticleParagraphs();
    elements.forEach((element) => {
      if (!element.nextElementSibling?.classList.contains("translated")) {
        observer.observe(element);
      }
    });
  }

  // Call initially and when scrolling stops
  observeAllElements();

  // Add scroll listener with throttling
  let scrollTimeout: ReturnType<typeof setTimeout>;
  window.addEventListener("scroll", () => {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(observeAllElements, 500);
  });

  return observer;
}

// Detect navigation in SPAs using URL change detection
function setupSPADetection(): void {
  let lastUrl = location.href;

  // Create a new observer to watch for URL changes
  const urlObserver = new MutationObserver(() => {
    if (lastUrl !== location.href) {
      console.log("URL changed from", lastUrl, "to", location.href);
      lastUrl = location.href;

      // chrome.storage.sync.get(
      //   "translator_on",
      //   (result: { translator_on?: boolean }) => {
      //     isActiveTranslator = result.translator_on || false;

      // If translator is active, process the new page content
      if (isActiveTranslator) {
        console.log("SPA navigation detected, starting translation");

        // Clear existing translations when navigating
        document.querySelectorAll(".translated").forEach((el) => {
          el.remove();
        });

        // Make sure to reset progress tracking when navigating to a new page
        resetTranslationProgress();

        // Remove any existing progress indicator to start fresh
        const existingProgress = document.getElementById(
          "translation-progress"
        );
        if (existingProgress && existingProgress.parentNode) {
          existingProgress.parentNode.removeChild(existingProgress);
        }

        // Process the new content
        processVisibleElementsFirst();
      }
      //   }
      // );
    }
  });

  // Start observing
  urlObserver.observe(document, {
    subtree: true,
    childList: true,
  });
}

// Initialize and run
function initialize(): void {
  // Get the current state from storage
  chrome.storage.sync.get(
    "translator_on",
    (result: { translator_on?: boolean }) => {
      isActiveTranslator = result.translator_on || false;

      // Set up all observers and listeners
      setupMessageListener();
      setupMutationObserver();
      setupLazyTranslation();
      setupSPADetection();

      // If the translator is enabled on page load, automatically start translating
      if (isActiveTranslator) {
        console.log(
          "Extension is ON, automatically starting translation after page load"
        );

        // Wait for page to be fully loaded before starting translation
        if (document.readyState === "complete") {
          processVisibleElementsFirst();
        } else {
          window.addEventListener("load", () => {
            processVisibleElementsFirst();
          });
        }
      }
    }
  );
}

// Start the extension
initialize();
