// Main content script - orchestrates all translation functionality

import { TEXT_ELEMENT_SELECTOR, THRESHOLDS } from './config/constants';
import { TranslationService } from './services/translationService';
import { ContentProcessor } from './processors/contentProcessor';
import { setupMutationObserver } from './observers/mutationObserver';
import { setupSPADetection } from './observers/spaDetector';
import { setupLazyTranslation } from './observers/lazyTranslation';

// Global instances
const translationService = new TranslationService();
const contentProcessor = new ContentProcessor(translationService);

/**
 * Handle messages from the extension (toggle translator on/off)
 */
function setupMessageListener(): void {
  chrome.runtime.onMessage.addListener(
    async (
      request: { action: string; enabled: boolean },
      _sender: chrome.runtime.MessageSender,
      _sendResponse: (response?: any) => void
    ) => {
      if (request.action === 'toggleTranslator') {
        contentProcessor.setActive(request.enabled);

        if (request.enabled) {
          const isLargePage =
            document.querySelectorAll(TEXT_ELEMENT_SELECTOR).length >
            THRESHOLDS.LARGE_PAGE_ELEMENT_COUNT;

          if (isLargePage) {
            await contentProcessor.processVisibleElementsFirst();
          } else {
            await contentProcessor.processPageContent();
          }
        }
      }
    }
  );
}

/**
 * Initialize the extension
 */
function initialize(): void {
  chrome.storage.sync.get('translator_on', (result: { translator_on?: boolean }) => {
    const isActive = result.translator_on || false;
    contentProcessor.setActive(isActive);

    // Setup observers and listeners
    setupMessageListener();
    setupMutationObserver(contentProcessor);
    setupLazyTranslation(contentProcessor);
    setupSPADetection(contentProcessor);

    // Auto-start translation if enabled on page load
    if (isActive) {
      console.log('Extension is ON, automatically starting translation after page load');

      if (document.readyState === 'complete') {
        contentProcessor.processVisibleElementsFirst();
      } else {
        window.addEventListener('load', () => {
          contentProcessor.processVisibleElementsFirst();
        });
      }
    }
  });
}

// Start the extension
initialize();
