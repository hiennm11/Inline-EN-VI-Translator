// Configuration and constants

export const TEXT_ELEMENT_SELECTOR =
  "p, h1, h2, h3, h4, h5, h6, span, li, td, th, figcaption, blockquote";

export const MAIN_CONTENT_SELECTORS = [
  "article",
  "main",
  ".main-content",
  '[role="main"]',
  ".content-base",
  ".post-content",
  ".entry-content",
  "#content",
  ".content",
  ".article",
  ".post",
  ".story",
];

export const BATCH_SETTINGS = {
  SMALL_PAGE_BATCH_SIZE: 5,
  LARGE_PAGE_BATCH_SIZE: 3,
  DYNAMIC_SITE_BATCH_SIZE: 2,
  SMALL_PAGE_DELAY: 300,
  LARGE_PAGE_DELAY: 500,
  DYNAMIC_SITE_DELAY: 400,
} as const;

export const VIEWPORT_MARGINS = {
  TOP: 300,
  BOTTOM: 500,
  INTERSECTION_OBSERVER: '200px',
} as const;

export const THRESHOLDS = {
  LARGE_PAGE_ELEMENT_COUNT: 100,
  MIN_PARAGRAPH_LENGTH: 10,
  MIN_CONTENT_LENGTH: 200,
  MIN_PARAGRAPH_COUNT: 2,
  SIGNIFICANT_CONTENT_THRESHOLD: 3,
  LARGE_CONTENT_THRESHOLD: 8,
  DYNAMIC_SITE_MUTATION_THRESHOLD: 10,
  DYNAMIC_SITE_ELEMENT_THRESHOLD: 5,
} as const;

export const TIMING = {
  MUTATION_THROTTLE_NORMAL: 500,
  MUTATION_THROTTLE_DYNAMIC: 800,
  MUTATION_COUNTER_RESET: 30000,
  SCROLL_THROTTLE: 500,
  PROGRESS_HIDE_DELAY: 3000,
  CANCEL_HIDE_DELAY: 1500,
} as const;
