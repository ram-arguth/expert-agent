/**
 * Expert AI Chrome Extension - Content Script
 *
 * Runs in the context of web pages to capture text selections.
 */

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_SELECTION") {
    const selection = window.getSelection();
    const selectedText = selection ? selection.toString().trim() : "";
    sendResponse({ text: selectedText });
  }
});

// Optional: Add visual indicator when text is selected
// This provides a subtle hint that text can be queried
let selectionTimeout = null;

document.addEventListener("mouseup", () => {
  clearTimeout(selectionTimeout);

  const selection = window.getSelection();
  const selectedText = selection ? selection.toString().trim() : "";

  if (selectedText.length > 10) {
    // Could show a floating button here in future
    // For now, just log for debugging
    console.log(
      "[Expert AI] Text selected:",
      selectedText.substring(0, 50) + "...",
    );
  }
});

console.log("[Expert AI] Content script loaded");
