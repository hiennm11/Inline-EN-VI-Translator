// Content processing logic

import { BATCH_SETTINGS } from '../config/constants';
import { getMainArticleParagraphs, getAllPageParagraphs, shouldTranslateElement } from '../dom/elementSelection';
import { 
  createTranslationElement, 
  insertTranslationElement, 
  updateTranslationContent 
} from '../dom/elementManipulation';
import { LanguageDetectorService } from '../services/languageDetector';
import { TranslationService } from '../services/translationService';
import { showTranslationProgress, resetTranslationProgress, globalTranslationProgress } from '../ui/progressIndicator';

export class ContentProcessor {
  private translationService: TranslationService;
  private isActiveTranslator: boolean = false;

  constructor(translationService: TranslationService) {
    this.translationService = translationService;
  }

  setActive(active: boolean): void {
    this.isActiveTranslator = active;
  }

  getActive(): boolean {
    return this.isActiveTranslator;
  }

  async processElement(element: Element): Promise<void> {
    if (!this.isActiveTranslator || !shouldTranslateElement(element)) {
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
      const sourceLanguage = await LanguageDetectorService.detectLanguage(
        originalText
      );

      // Only translate between English and Vietnamese
      if (sourceLanguage === "en" || sourceLanguage === "vi") {
        const targetLanguage = sourceLanguage === "en" ? "vi" : "en";

        // Translate with update callback
        await this.translationService.translateText(
          originalText,
          sourceLanguage,
          targetLanguage,
          (translatedText) => updateTranslationContent(transElem, translatedText)
        );
      }
    } catch (error) {
      console.error("Error processing element:", error);
      transElem.textContent = "Translation error";
    }
  }

  async processPageContent(): Promise<void> {
    resetTranslationProgress();

    const articleParagraphs = getMainArticleParagraphs();

    showTranslationProgress(0, articleParagraphs.length, () => {
      this.isActiveTranslator = false;
    });

    const BATCH_SIZE = BATCH_SETTINGS.SMALL_PAGE_BATCH_SIZE;
    const DELAY_BETWEEN_BATCHES = BATCH_SETTINGS.LARGE_PAGE_DELAY;

    for (let i = 0; i < articleParagraphs.length; i += BATCH_SIZE) {
      if (!this.isActiveTranslator) break;

      const batch = articleParagraphs.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map((element) => this.processElement(element)));

      showTranslationProgress(batch.length, 0, () => {
        this.isActiveTranslator = false;
      });

      console.log(
        `Translated batch ${i / BATCH_SIZE + 1}/${Math.ceil(
          articleParagraphs.length / BATCH_SIZE
        )}`
      );

      if (i + BATCH_SIZE < articleParagraphs.length) {
        await new Promise((resolve) =>
          setTimeout(resolve, DELAY_BETWEEN_BATCHES)
        );
      }
    }
  }

  async processVisibleElementsFirst(): Promise<void> {
    resetTranslationProgress();

    let allElements = getMainArticleParagraphs();

    if (allElements.length < 3) {
      console.log(
        "Few paragraphs found in main content, searching across entire page"
      );
      allElements = getAllPageParagraphs();
    }

    showTranslationProgress(0, allElements.length, () => {
      this.isActiveTranslator = false;
    });

    const visibleElements: Element[] = [];
    const nonVisibleElements: Element[] = [];

    allElements.forEach((element) => {
      const rect = element.getBoundingClientRect();
      const isVisible = rect.top >= 0 && rect.top <= window.innerHeight * 3;

      if (isVisible) {
        visibleElements.push(element);
      } else {
        nonVisibleElements.push(element);
      }
    });

    const BATCH_SIZE = BATCH_SETTINGS.SMALL_PAGE_BATCH_SIZE;
    const DELAY = BATCH_SETTINGS.SMALL_PAGE_DELAY;

    // Process visible elements
    for (let i = 0; i < visibleElements.length; i += BATCH_SIZE) {
      if (!this.isActiveTranslator) break;

      const batch = visibleElements.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map((element) => this.processElement(element)));

      showTranslationProgress(batch.length, 0, () => {
        this.isActiveTranslator = false;
      });

      await new Promise((resolve) => setTimeout(resolve, DELAY));
    }

    // Process remaining elements
    for (let i = 0; i < nonVisibleElements.length; i += BATCH_SIZE) {
      if (!this.isActiveTranslator) break;

      const batch = nonVisibleElements.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map((element) => this.processElement(element)));

      showTranslationProgress(batch.length, 0, () => {
        this.isActiveTranslator = false;
      });

      await new Promise((resolve) => setTimeout(resolve, DELAY * 2));
    }
  }

  async processDynamicContent(
    articleParagraphs: Element[],
    detectedDynamicSite: boolean
  ): Promise<void> {
    const BATCH_SIZE = detectedDynamicSite
      ? BATCH_SETTINGS.DYNAMIC_SITE_BATCH_SIZE
      : BATCH_SETTINGS.LARGE_PAGE_BATCH_SIZE;
    const DELAY = detectedDynamicSite
      ? BATCH_SETTINGS.DYNAMIC_SITE_DELAY
      : BATCH_SETTINGS.SMALL_PAGE_DELAY;

    for (let i = 0; i < articleParagraphs.length; i += BATCH_SIZE) {
      if (!this.isActiveTranslator) break;

      const batch = articleParagraphs.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map((element) => this.processElement(element)));

      if (globalTranslationProgress.isActive) {
        showTranslationProgress(batch.length, 0, () => {
          this.isActiveTranslator = false;
        });
      }

      if (i + BATCH_SIZE < articleParagraphs.length) {
        await new Promise((resolve) => setTimeout(resolve, DELAY));
      }
    }
  }
}
