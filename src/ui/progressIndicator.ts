// Progress indicator UI management

import { TIMING } from '../config/constants';

export interface TranslationProgress {
  current: number;
  total: number;
  isActive: boolean;
  timeoutId: ReturnType<typeof setTimeout> | null;
}

export let globalTranslationProgress: TranslationProgress = {
  current: 0,
  total: 0,
  isActive: false,
  timeoutId: null,
};

export function resetTranslationProgress(): void {
  globalTranslationProgress = {
    current: 0,
    total: 0,
    isActive: false,
    timeoutId: null,
  };
}

export function showTranslationProgress(
  current: number,
  total: number,
  onCancel: () => void
): void {
  // Update global progress counters
  if (!globalTranslationProgress.isActive) {
    globalTranslationProgress.current = current;
    globalTranslationProgress.total = total;
    globalTranslationProgress.isActive = true;
  } else {
    globalTranslationProgress.current += current;

    if (total > 0) {
      globalTranslationProgress.total += total;
    }

    if (globalTranslationProgress.total < globalTranslationProgress.current) {
      globalTranslationProgress.total = globalTranslationProgress.current;
    }
  }

  // Create or update progress indicator
  let progressElement = document.getElementById("translation-progress");
  if (!progressElement) {
    progressElement = document.createElement("div");
    progressElement.id = "translation-progress";
    progressElement.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(0, 105, 92, 0.9);
      color: white;
      padding: 10px 15px;
      border-radius: 4px;
      z-index: 10000;
      font-family: system-ui;
      box-shadow: 0 3px 6px rgba(0,0,0,0.16);
    `;
    document.body.appendChild(progressElement);
  }

  // Update the content
  progressElement.innerHTML = `
    Translating: ${globalTranslationProgress.current}/${globalTranslationProgress.total}
    <button id="cancel-translation" style="margin-left: 10px; cursor: pointer;">Cancel</button>
  `;

  // Debug log
  console.log(
    `Progress updated: ${globalTranslationProgress.current}/${globalTranslationProgress.total}`
  );

  // Add event listener
  const cancelButton = document.getElementById("cancel-translation");
  if (cancelButton) {
    const newCancelButton = cancelButton.cloneNode(true);
    if (cancelButton.parentNode) {
      cancelButton.parentNode.replaceChild(newCancelButton, cancelButton);
    }

    newCancelButton.addEventListener("click", () => {
      onCancel();
      if (progressElement) {
        progressElement.textContent = "Translation cancelled";

        if (globalTranslationProgress.timeoutId) {
          clearTimeout(globalTranslationProgress.timeoutId);
        }

        globalTranslationProgress.timeoutId = setTimeout(() => {
          if (progressElement && progressElement.parentNode) {
            progressElement.parentNode.removeChild(progressElement);
          }
          resetTranslationProgress();
        }, TIMING.CANCEL_HIDE_DELAY);
      }
    });
  }

  // Hide after complete
  if (
    globalTranslationProgress.current >= globalTranslationProgress.total
  ) {
    if (globalTranslationProgress.timeoutId) {
      clearTimeout(globalTranslationProgress.timeoutId);
    }

    globalTranslationProgress.timeoutId = setTimeout(() => {
      if (progressElement && progressElement.parentNode) {
        progressElement.parentNode.removeChild(progressElement);
      }
      resetTranslationProgress();
    }, TIMING.PROGRESS_HIDE_DELAY);
  }
}
