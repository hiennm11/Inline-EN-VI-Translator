// Mutation observer for dynamic content

import { THRESHOLDS, TIMING } from '../config/constants';
import { getMainArticleParagraphs, getAllVisibleParagraphs } from '../dom/elementSelection';
import { showTranslationProgress, resetTranslationProgress, globalTranslationProgress } from '../ui/progressIndicator';
import { ContentProcessor } from '../processors/contentProcessor';

export function setupMutationObserver(processor: ContentProcessor): MutationObserver {
  let processingTimeout: ReturnType<typeof setTimeout> | null = null;
  let detectedDynamicSite = false;
  let mutationCounter = 0;
  let significantChangesDetected = false;
  let newElementsCount = 0;

  const throttledProcess = (mutations: MutationRecord[]) => {
    if (processingTimeout) clearTimeout(processingTimeout);

    mutationCounter++;

    let hasSignificantChanges = false;

    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (
            node instanceof HTMLElement &&
            node.nodeType === Node.ELEMENT_NODE &&
            node.matches('div, section, article, p, h1, h2, h3, h4, h5, h6')
          ) {
            hasSignificantChanges = true;
            newElementsCount++;
            break;
          }
        }
      }

      if (hasSignificantChanges) break;
    }

    if (
      mutationCounter > THRESHOLDS.DYNAMIC_SITE_MUTATION_THRESHOLD ||
      newElementsCount > THRESHOLDS.DYNAMIC_SITE_ELEMENT_THRESHOLD
    ) {
      detectedDynamicSite = true;
    }

    if (hasSignificantChanges) {
      significantChangesDetected = true;
    }

    processingTimeout = setTimeout(async () => {
      if (!processor.getActive()) return;

      let articleParagraphs: Element[];

      if (detectedDynamicSite) {
        articleParagraphs = getAllVisibleParagraphs();
      } else {
        articleParagraphs = getMainArticleParagraphs();
      }

      articleParagraphs = articleParagraphs.filter(
        (element) => !element.nextElementSibling?.classList.contains('translated')
      );

      if (articleParagraphs.length === 0) return;

      if (
        (significantChangesDetected &&
          articleParagraphs.length > THRESHOLDS.SIGNIFICANT_CONTENT_THRESHOLD) ||
        articleParagraphs.length > THRESHOLDS.LARGE_CONTENT_THRESHOLD
      ) {
        console.log(
          `Significant content changes detected, ${articleParagraphs.length} new paragraphs found`
        );

        if (!globalTranslationProgress.isActive) {
          resetTranslationProgress();
          showTranslationProgress(0, articleParagraphs.length, () => {
            processor.setActive(false);
          });
        } else {
          showTranslationProgress(0, articleParagraphs.length, () => {
            processor.setActive(false);
          });
        }

        significantChangesDetected = false;
        newElementsCount = 0;
      }

      await processor.processDynamicContent(articleParagraphs, detectedDynamicSite);
    }, detectedDynamicSite ? TIMING.MUTATION_THROTTLE_DYNAMIC : TIMING.MUTATION_THROTTLE_NORMAL);
  };

  const observer = new MutationObserver(throttledProcess);

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: false,
    attributeFilter: ['class', 'style'],
  });

  setInterval(() => {
    mutationCounter = 0;
    newElementsCount = 0;
  }, TIMING.MUTATION_COUNTER_RESET);

  return observer;
}
