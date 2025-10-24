// Element selection and filtering utilities

import { TEXT_ELEMENT_SELECTOR, MAIN_CONTENT_SELECTORS, THRESHOLDS, VIEWPORT_MARGINS } from '../config/constants';
import { isCodeElement } from './elementManipulation';

interface ScoredContainer {
  element: Element;
  score: number;
  textLength: number;
  textDensity: number;
  paragraphCount: number;
}

/**
 * Finds the most likely content container using content density analysis
 */
export function findContentByDensity(): Element | null {
  const potentialContainers = Array.from(
    document.querySelectorAll("div, section, main, article")
  ).filter((el) => {
    const tagName = el.tagName.toLowerCase();
    const id = (el.id || "").toLowerCase();
    const className = (el.className || "").toString().toLowerCase();

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

  const scoredContainers: ScoredContainer[] = potentialContainers
    .map((element) => {
      const textLength = element.textContent?.length || 0;
      const paragraphs = element.querySelectorAll(TEXT_ELEMENT_SELECTOR);
      const paragraphCount = paragraphs.length;

      const descendantCount = element.querySelectorAll("*").length || 1;
      const textDensity = textLength / descendantCount;

      const linkText = Array.from(element.querySelectorAll("a")).reduce(
        (total, a) => total + (a.textContent?.length || 0),
        0
      );
      const linkRatio = textLength > 0 ? linkText / textLength : 1;

      let score = 0;
      score += textLength * 0.1;
      score += paragraphCount * 10;
      score += textDensity * 5;
      score -= linkRatio * 50;

      return {
        element,
        score,
        textLength,
        textDensity,
        paragraphCount,
      };
    })
    .filter((container) => {
      return container.textLength > THRESHOLDS.MIN_CONTENT_LENGTH && 
             container.paragraphCount >= THRESHOLDS.MIN_PARAGRAPH_COUNT;
    })
    .sort((a, b) => b.score - a.score);

  return scoredContainers.length > 0 ? scoredContainers[0].element : null;
}

/**
 * Get main article paragraphs with improved content detection
 */
export function getMainArticleParagraphs(): Element[] {
  let container: Element | null = null;

  // Try each selector in order of likelihood
  for (const sel of MAIN_CONTENT_SELECTORS) {
    const elements = document.querySelectorAll(sel);
    if (elements.length > 0) {
      if (elements.length === 1) {
        container = elements[0];
      } else {
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

  if (!container) {
    container = findContentByDensity();
  }

  if (!container) {
    console.log("No specific content container found, using document body");
    container = document.body;
  }

  return Array.from(container.querySelectorAll(TEXT_ELEMENT_SELECTOR)).filter(
    (p) => {
      const parentClasses = (p.parentElement?.className || "") as string;
      const elementId = (p.id || "").toLowerCase();
      const elementClasses = (p.className || "").toString().toLowerCase();

      const isHidden = (p as HTMLElement).offsetParent === null;
      const isInUnwantedSection = /sidebar|nav|toc|footer|header|menu|comment|widget|ad/i.test(
        parentClasses + " " + elementClasses + " " + elementId
      );
      const hasMinimumText =
        (p.textContent?.trim().length || 0) >= THRESHOLDS.MIN_PARAGRAPH_LENGTH;

      return !isHidden && !isInUnwantedSection && hasMinimumText;
    }
  );
}

/**
 * Get all translatable paragraphs from the entire page
 */
export function getAllPageParagraphs(): Element[] {
  return Array.from(document.querySelectorAll(TEXT_ELEMENT_SELECTOR)).filter(
    (element) => {
      const elementClasses = (element.className || "").toString().toLowerCase();
      const elementId = (element.id || "").toLowerCase();
      const parentClasses = (element.parentElement?.className || "")
        .toString()
        .toLowerCase();

      const isHidden = (element as HTMLElement).offsetParent === null;
      const isInSkippedElement = /nav|footer|header|sidebar|menu|comment|widget|ad/i.test(
        elementClasses + " " + elementId + " " + parentClasses
      );
      const isShort =
        (element.textContent?.trim().length || 0) < THRESHOLDS.MIN_PARAGRAPH_LENGTH;
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
 */
export function getAllVisibleParagraphs(): Element[] {
  const allParagraphs = getAllPageParagraphs();

  const viewportTop = window.scrollY - VIEWPORT_MARGINS.TOP;
  const viewportBottom = window.scrollY + window.innerHeight + VIEWPORT_MARGINS.BOTTOM;

  return allParagraphs.filter((element) => {
    const rect = element.getBoundingClientRect();
    const elementTop = rect.top + window.scrollY;
    const elementBottom = rect.bottom + window.scrollY;

    return (
      (elementTop >= viewportTop && elementTop <= viewportBottom) ||
      (elementBottom >= viewportTop && elementBottom <= viewportBottom) ||
      (elementTop <= viewportTop && elementBottom >= viewportBottom)
    );
  });
}

/**
 * Element validation - check if element should be translated
 */
export function shouldTranslateElement(element: Element): boolean {
  const text = element.textContent?.trim() || "";

  return (
    text.length >= THRESHOLDS.MIN_PARAGRAPH_LENGTH &&
    !isCodeElement(element) &&
    !element.closest(".translated")
  );
}
