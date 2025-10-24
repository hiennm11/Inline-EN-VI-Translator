// DOM element manipulation functions

export function createTranslationElement(originalElement: Element): HTMLElement {
  // Determine the right tag to use
  const tagName = originalElement.tagName === "LI" ? "LI" : "P";

  const transElem = document.createElement(tagName);
  transElem.className = "translated";
  transElem.style.color = "#00695c";
  transElem.textContent = "..."; // Initial loading indicator

  return transElem;
}

export function insertTranslationElement(
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

export function updateTranslationContent(
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

export function hasDuplicateTranslation(
  p: Element,
  translationText: string
): boolean {
  // Check next sibling for class and content
  const next = p.nextElementSibling;
  return (
    next !== null &&
    next.classList.contains("translated") &&
    next.textContent?.trim() === translationText.trim()
  );
}

export function isNestedDuplicate(
  p: Element,
  translationText: string
): boolean {
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

export function isCodeElement(element: Element): boolean {
  return (
    element.closest(
      'pre, code, .highlight, .code-block, [class*="language-"]'
    ) !== null
  );
}
