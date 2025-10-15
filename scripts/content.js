let isActiveTranslator = false;

chrome.storage.sync.get("translator_on", ({ translator_on }) => {
  isActiveTranslator = translator_on;
});

// Global translator instances
const translators = {};

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

async function translate(text, transElem) {
  if ("Translator" in self) {
    try {
      const sourceLanguage = await detectLanguage(text);
      const targetLanguage = sourceLanguage === "en" ? "vi" : "en";
      const translatorKey = `${sourceLanguage}-${targetLanguage}`;

      const availability = await Translator.availability({
        sourceLanguage,
        targetLanguage,
      });
      const isUnavailable = availability === "unavailable";

      if (isUnavailable) {
        console.log(
          `${sourceLanguage} - ${targetLanguage} pair is not supported.`
        );
        transElem.textContent =
          "Translation not available for this language pair.";
        return;
      }

      // Use existing translator or create a new one
      let translator;
      if (translators[translatorKey]) {
        translator = translators[translatorKey];
      } else {
        translator = await Translator.create({
          sourceLanguage,
          targetLanguage,
        });
        // Store the translator for future use
        translators[translatorKey] = translator;
      }

      // Start with loading indicator
      transElem.textContent = "...";

      // Create buffer to accumulate translated text
      let translatedText = "";

      // Use the streaming API
      const stream = translator.translateStreaming(text);
      for await (const chunk of stream) {
        translatedText += chunk;
        // transElem.textContent = translatedText;

        // Before inserting
        if (
          !hasDuplicateTranslation(transElem, translatedText) &&
          !isNestedDuplicate(transElem, translatedText)
        ) {
          // Insert translated paragraph as needed
          transElem.textContent = translatedText;
        }
      }

      return translatedText;
    } catch (err) {
      console.error(err.name, err.message);
      transElem.textContent = "An error occurred. Please try again.";
      return "An error occurred. Please try again.";
    }
  }
}

async function translateElement(element) {
  const original = element.textContent.trim();
  // Skip empty elements or very short content
  if (!original || original.length < 2) return;

  const alreadyTranslated =
    element.nextElementSibling &&
    element.nextElementSibling.classList.contains("translated");
  if (alreadyTranslated) return;

  // Create the translation element with the same tag as the original
  const tagName = element.tagName === "LI" ? "LI" : "P";
  const transElem = document.createElement(tagName);
  transElem.className = "translated";
  transElem.style.color = "#00695c";
  transElem.textContent = "..."; // Initial loading indicator

  // For list items, append to the list rather than after the element
  if (element.tagName === "LI") {
    const parentList = element.parentElement;
    if (
      parentList &&
      (parentList.tagName === "UL" || parentList.tagName === "OL")
    ) {
      parentList.insertBefore(transElem, element.nextSibling);
    } else {
      element.insertAdjacentElement("afterend", transElem);
    }
  } else {
    element.insertAdjacentElement("afterend", transElem);
  }

  const lang = await detectLanguage(original);
  if (lang === "en" || lang === "vi") {
    // Pass the translation element to update it during streaming
    await translate(original, transElem);
  } else {
    // Remove the translation element if language is not supported
    transElem.remove();
  }
}

// Define selector for all text elements we want to translate
const TEXT_ELEMENT_SELECTOR =
  "p, h1, h2, h3, h4, h5, h6, span, li, td, th, figcaption, blockquote";

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

// Translate all existing text elements
async function translateAll(node) {
  // Get all main article paragraphs
  const articleParagraphs = getMainArticleParagraphs();

  articleParagraphs.forEach(async (element) => {
    if (!isActiveTranslator) return;

    if (isCodeElement(element)) return;

    // Skip elements that are part of the UI or very small
    if (
      element.closest(".translated") ||
      element.textContent.trim().length < 10
    )
      return;
    await translateElement(element);
  });
}

translateAll(document);

const observer = new MutationObserver(async (mutations) => {
  if (!isActiveTranslator) return;
  for (const mutation of mutations) {
    // If new nodes were added
    for (const node of mutation.addedNodes) {
      if (node instanceof Element) {
        // Find and translate all text elements in the added node
        await translateAll(node);
      }
    }
  }
});

// https://developer.chrome.com/ is a SPA (Single Page Application) so can
// update the address bar and render new content without reloading. Our content
// script won't be reinjected when this happens, so we need to watch for
// changes to the content.
observer.observe(document.body, {
  attributes: true,
  childList: true,
  subtree: true,
});

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === "toggleTranslator") {
    // Handle enabling/disabling the translator
    isActiveTranslator = request.enabled;

    if (isActiveTranslator) {
      await translateAll(document);
    }
  }
});
