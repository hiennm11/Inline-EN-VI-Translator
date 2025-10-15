// Configuration and globals
let isActiveTranslator = false;
const translators = {};

// Define selector for all text elements we want to translate
const TEXT_ELEMENT_SELECTOR =
  "p, h1, h2, h3, h4, h5, h6, span, li, td, th, figcaption, blockquote";

// Initialize state from storage
function initializeState() {
  chrome.storage.sync.get("translator_on", ({ translator_on }) => {
    isActiveTranslator = translator_on;
  });
}

// Language detection
async function detectLanguage(text) {
  if (!("LanguageDetector" in self)) {
    throw new Error("LanguageDetector is not supported.");
  }

  // Create detector only once
  if (!window.languageDetector) {
    window.languageDetector = await LanguageDetector.create();
  }

  const { detectedLanguage, confidence } = (
    await window.languageDetector.detect(text)
  )[0];
  return detectedLanguage;
}

// Get or create translator instance
async function getTranslatorInstance(sourceLanguage, targetLanguage) {
  const translatorKey = `${sourceLanguage}-${targetLanguage}`;

  // Check availability
  const availability = await Translator.availability({
    sourceLanguage,
    targetLanguage,
  });

  if (availability === "unavailable") {
    console.log(`${sourceLanguage} - ${targetLanguage} pair is not supported.`);
    return null;
  }

  // Use existing translator or create a new one
  if (!translators[translatorKey]) {
    translators[translatorKey] = await Translator.create({
      sourceLanguage,
      targetLanguage,
    });
  }

  return translators[translatorKey];
}

// Translation function
async function translateText(
  text,
  sourceLanguage,
  targetLanguage,
  updateCallback
) {
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
function createTranslationElement(originalElement) {
  // Determine the right tag to use
  const tagName = originalElement.tagName === "LI" ? "LI" : "P";

  const transElem = document.createElement(tagName);
  transElem.className = "translated";
  transElem.style.color = "#00695c";
  transElem.textContent = "..."; // Initial loading indicator

  return transElem;
}

// Insert translation element into the page
function insertTranslationElement(originalElement, translationElement) {
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
function updateTranslationContent(translationElem, translatedText) {
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
function isCodeElement(element) {
  return (
    element.closest(
      'pre, code, .highlight, .code-block, [class*="language-"]'
    ) !== null
  );
}

function hasDuplicateTranslation(p, translationText) {
  // Check next sibling for class and content
  const next = p.nextElementSibling;
  return (
    next &&
    next.classList.contains("translated") &&
    next.textContent.trim() === translationText.trim()
  );
}

// Check for nested duplicate: e.g. <h3>…<span>…<p class="translated"></p>…</span>…</h3>
function isNestedDuplicate(p, translationText) {
  // Looks for ancestor containing a matching translated element
  let ancestor = p.parentElement;
  while (ancestor) {
    const nested = ancestor.querySelector(".translated");
    if (nested && nested.textContent.trim() === translationText.trim())
      return true;
    ancestor = ancestor.parentElement;
  }
  return false;
}

// Element selection
function getMainArticleParagraphs() {
  const mainSelectors = ["article", "main", ".main-content", '[role="main"]'];
  let container = null;
  for (const sel of mainSelectors) {
    container = document.querySelector(sel);
    if (container) break;
  }
  if (!container) return [];

  // Filter paragraphs, ignore nav/aside/toc inside main
  return Array.from(container.querySelectorAll(TEXT_ELEMENT_SELECTOR)).filter(
    (p) => {
      const parentClasses = p.parentElement.className || "";
      return !/sidebar|nav|toc/i.test(parentClasses) && p.offsetParent;
    }
  );
}

// Element validation
function shouldTranslateElement(element) {
  const text = element.textContent.trim();

  // Skip elements that are empty, very short, code, or already translated
  return (
    text.length >= 10 &&
    !isCodeElement(element) &&
    !element.closest(".translated")
  );
}

// Process a single element
async function processElement(element) {
  if (!isActiveTranslator || !shouldTranslateElement(element)) {
    return;
  }

  const originalText = element.textContent.trim();

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

// Main processing function
async function processPageContent() {
  // Get all main article paragraphs
  const articleParagraphs = getMainArticleParagraphs();

  for (const element of articleParagraphs) {
    await processElement(element);
  }
}

// Observer for dynamic content
function setupMutationObserver() {
  const observer = new MutationObserver(async (mutations) => {
    if (!isActiveTranslator) return;

    for (const mutation of mutations) {
      // If new nodes were added
      for (const node of mutation.addedNodes) {
        if (node instanceof Element) {
          // Process all translatable elements in the added node
          const articleParagraphs = getMainArticleParagraphs();
          for (const element of articleParagraphs) {
            await processElement(element);
          }
        }
      }
    }
  });

  // Watch for changes to the content
  observer.observe(document.body, {
    attributes: true,
    childList: true,
    subtree: true,
  });

  return observer;
}

// Message handling
function setupMessageListener() {
  chrome.runtime.onMessage.addListener(
    async (request, sender, sendResponse) => {
      if (request.action === "toggleTranslator") {
        // Handle enabling/disabling the translator
        isActiveTranslator = request.enabled;

        if (isActiveTranslator) {
          await processPageContent();
        }
      }
    }
  );
}

// Initialize and run
function initialize() {
  initializeState();
  setupMessageListener();
  setupMutationObserver();
  processPageContent();
}

// Start the extension
initialize();
