// Lazy translation using Intersection Observer

import { VIEWPORT_MARGINS } from '../config/constants';
import { getMainArticleParagraphs } from '../dom/elementSelection';
import { ContentProcessor } from '../processors/contentProcessor';

export function setupLazyTranslation(processor: ContentProcessor): IntersectionObserver {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && processor.getActive()) {
          const element = entry.target;
          if (!element.nextElementSibling?.classList.contains('translated')) {
            processor.processElement(element);
          }
          observer.unobserve(element);
        }
      });
    },
    { rootMargin: VIEWPORT_MARGINS.INTERSECTION_OBSERVER }
  );

  function observeAllElements(): void {
    if (!processor.getActive()) return;

    const elements = getMainArticleParagraphs();
    elements.forEach((element) => {
      if (!element.nextElementSibling?.classList.contains('translated')) {
        observer.observe(element);
      }
    });
  }

  observeAllElements();

  let scrollTimeout: ReturnType<typeof setTimeout>;
  window.addEventListener('scroll', () => {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(observeAllElements, 500);
  });

  return observer;
}
