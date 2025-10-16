// Configuration and globals
let isActiveTranslator = false;
const translators: Record<string, any> = {};

// Define selector for all text elements we want to translate
const TEXT_ELEMENT_SELECTOR =
  "p, h1, h2, h3, h4, h5, h6, span, li, td, th, figcaption, blockquote";

// Initialize state from storage
function initializeState(): void {
  chrome.storage.sync.get("translator_on", (result: { translator_on?: boolean }) => {
    isActiveTranslator = result.translator_on || false;
  });
}

// Language detection
async function detectLanguage(text: string): Promise<string> {
  if (!("LanguageDetector" in self)) {
    throw new Error("LanguageDetector is not supported.");
  }

  // Create detector only once
  if (!(window as any).languageDetector) {
    (window as any).languageDetector = await (self as any).LanguageDetector.create();
  }

  const { detectedLanguage } = (
    await (window as any).languageDetector.detect(text)
  )[0];
  return detectedLanguage;
}

// Get or create translator instance
async function getTranslatorInstance(sourceLanguage: string, targetLanguage: string): Promise<any | null> {
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
function insertTranslationElement(originalElement: Element, translationElement: Element): void {
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
function updateTranslationContent(translationElem: Element, translatedText: string): boolean {
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

// Element selection
function getMainArticleParagraphs(): Element[] {
  const mainSelectors = [
    "article",
    "main",
    ".main-content",
    '[role="main"]',
    ".content-base",
  ];
  let container: Element | null = null;
  for (const sel of mainSelectors) {
    container = document.querySelector(sel);
    if (container) break;
  }
  if (!container) return [];

  // Filter paragraphs, ignore nav/aside/toc inside main
  return Array.from(container.querySelectorAll(TEXT_ELEMENT_SELECTOR)).filter(
    (p) => {
      const parentClasses = (p.parentElement?.className || "") as string;
      return !/sidebar|nav|toc/i.test(parentClasses) && (p as HTMLElement).offsetParent !== null;
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
  // Get all main article paragraphs
  const articleParagraphs = getMainArticleParagraphs();
  
  // Process elements in smaller batches
  const BATCH_SIZE = 5;
  const DELAY_BETWEEN_BATCHES = 500; // ms
  
  // Create batches
  for (let i = 0; i < articleParagraphs.length; i += BATCH_SIZE) {
    if (!isActiveTranslator) break; // Stop if disabled mid-processing
    
    const batch = articleParagraphs.slice(i, i + BATCH_SIZE);
    
    // Process batch
    await Promise.all(batch.map(element => processElement(element)));
    
    // Show progress
    console.log(`Translated batch ${i/BATCH_SIZE + 1}/${Math.ceil(articleParagraphs.length/BATCH_SIZE)}`);
    
    // Wait before processing next batch to prevent overwhelming the browser
    if (i + BATCH_SIZE < articleParagraphs.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }
}

// Observer for dynamic content - MODIFIED to be more efficient
function setupMutationObserver(): MutationObserver {
  // Throttle function to prevent too many calls
  let processingTimeout: ReturnType<typeof setTimeout> | null = null;
  const throttledProcess = () => {
    if (processingTimeout) clearTimeout(processingTimeout);
    processingTimeout = setTimeout(async () => {
      if (!isActiveTranslator) return;
      
      // Get only new elements that need translation
      const articleParagraphs = getMainArticleParagraphs().filter(
        element => !element.nextElementSibling?.classList.contains('translated')
      );
      
      // Process in small batches
      const BATCH_SIZE = 3;
      for (let i = 0; i < articleParagraphs.length; i += BATCH_SIZE) {
        const batch = articleParagraphs.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(element => processElement(element)));
        
        // Small delay between batches
        if (i + BATCH_SIZE < articleParagraphs.length) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    }, 500);
  };

  const observer = new MutationObserver(throttledProcess);

  // Watch for changes to the content
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return observer;
}

// Add a new function to provide visual feedback
function showTranslationProgress(current: number, total: number): void {
  // Create or update progress indicator
  let progressElement = document.getElementById('translation-progress');
  if (!progressElement) {
    progressElement = document.createElement('div');
    progressElement.id = 'translation-progress';
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
  
  // Add cancel button
  progressElement.innerHTML = `
    Translating: ${current}/${total}
    <button id="cancel-translation" style="margin-left: 10px; cursor: pointer;">Cancel</button>
  `;
  
  // Add event listener
  document.getElementById('cancel-translation')?.addEventListener('click', () => {
    isActiveTranslator = false;
    if (progressElement) {
      progressElement.textContent = "Translation cancelled";
      setTimeout(() => {
        if (progressElement && progressElement.parentNode) {
          progressElement.parentNode.removeChild(progressElement);
        }
      }, 1500);
    }
  });
  
  // Hide after complete
  if (current >= total) {
    setTimeout(() => {
      if (progressElement && progressElement.parentNode) {
        progressElement.parentNode.removeChild(progressElement);
      }
    }, 3000);
  }
}

// Message handling - MODIFIED to handle large page option
function setupMessageListener(): void {
  chrome.runtime.onMessage.addListener(
    async (request: { action: string, enabled: boolean }, _sender: chrome.runtime.MessageSender, _sendResponse: (response?: any) => void) => {
      if (request.action === "toggleTranslator") {
        // Handle enabling/disabling the translator
        isActiveTranslator = request.enabled;

        if (isActiveTranslator) {
          // Add a flag for large pages
          const isLargePage = document.querySelectorAll(TEXT_ELEMENT_SELECTOR).length > 100;
          
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
  // Get all elements
  const allElements = getMainArticleParagraphs();
  
  // Show total count
  showTranslationProgress(0, allElements.length);
  
  // Split into visible and non-visible elements
  const visibleElements: Element[] = [];
  const nonVisibleElements: Element[] = [];
  
  allElements.forEach(element => {
    const rect = element.getBoundingClientRect();
    const isVisible = (
      rect.top >= 0 &&
      rect.top <= window.innerHeight * 3 // Include elements a bit below the viewport
    );
    
    if (isVisible) {
      visibleElements.push(element);
    } else {
      nonVisibleElements.push(element);
    }
  });
  
  // Process visible elements first
  const BATCH_SIZE = 5;
  const DELAY = 300;
  let processedCount = 0;
  
  // Process visible elements
  for (let i = 0; i < visibleElements.length; i += BATCH_SIZE) {
    if (!isActiveTranslator) break;
    
    const batch = visibleElements.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(element => processElement(element)));
    
    processedCount += batch.length;
    showTranslationProgress(processedCount, allElements.length);
    
    await new Promise(resolve => setTimeout(resolve, DELAY));
  }
  
  // Process remaining elements with longer delays
  for (let i = 0; i < nonVisibleElements.length; i += BATCH_SIZE) {
    if (!isActiveTranslator) break;
    
    const batch = nonVisibleElements.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(element => processElement(element)));
    
    processedCount += batch.length;
    showTranslationProgress(processedCount, allElements.length);
    
    await new Promise(resolve => setTimeout(resolve, DELAY * 2));
  }
}

// Add function for lazy loading translations
function setupLazyTranslation(): IntersectionObserver {
  // Create intersection observer
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && isActiveTranslator) {
        const element = entry.target;
        // Process this element if it needs translation
        if (!element.nextElementSibling?.classList.contains('translated')) {
          processElement(element);
        }
        // Unobserve after processing
        observer.unobserve(element);
      }
    });
  }, { rootMargin: '200px' });
  
  // Observe all translatable elements
  function observeAllElements(): void {
    if (!isActiveTranslator) return;
    
    const elements = getMainArticleParagraphs();
    elements.forEach(element => {
      if (!element.nextElementSibling?.classList.contains('translated')) {
        observer.observe(element);
      }
    });
  }
  
  // Call initially and when scrolling stops
  observeAllElements();
  
  // Add scroll listener with throttling
  let scrollTimeout: ReturnType<typeof setTimeout>;
  window.addEventListener('scroll', () => {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(observeAllElements, 500);
  });
  
  return observer;
}

// Initialize and run
function initialize(): void {
  initializeState();
  setupMessageListener();
  setupMutationObserver();
  setupLazyTranslation();
  // Only process visible content initially
  if (isActiveTranslator) {
    processVisibleElementsFirst();
  }
}

// Start the extension
initialize();