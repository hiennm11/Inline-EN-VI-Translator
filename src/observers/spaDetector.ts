// SPA navigation detection

import { ContentProcessor } from '../processors/contentProcessor';
import { resetTranslationProgress } from '../ui/progressIndicator';

export function setupSPADetection(processor: ContentProcessor): void {
  let lastUrl = location.href;

  const urlObserver = new MutationObserver(() => {
    if (lastUrl !== location.href) {
      console.log('URL changed from', lastUrl, 'to', location.href);
      lastUrl = location.href;

      if (processor.getActive()) {
        console.log('SPA navigation detected, starting translation');

        // Clear existing translations
        document.querySelectorAll('.translated').forEach((el) => {
          el.remove();
        });

        // Reset progress tracking
        resetTranslationProgress();

        // Remove existing progress indicator
        const existingProgress = document.getElementById('translation-progress');
        if (existingProgress && existingProgress.parentNode) {
          existingProgress.parentNode.removeChild(existingProgress);
        }

        // Process new content
        processor.processVisibleElementsFirst();
      }
    }
  });

  urlObserver.observe(document, {
    subtree: true,
    childList: true,
  });
}
