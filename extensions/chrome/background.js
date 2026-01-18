/**
 * Expert AI Chrome Extension - Background Service Worker
 *
 * Handles context menu creation and background tasks.
 */

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "ask-expert",
    title: 'Ask Expert AI about "%s"',
    contexts: ["selection"],
  });

  chrome.contextMenus.create({
    id: "ask-expert-page",
    title: "Ask Expert AI about this page",
    contexts: ["page"],
  });

  console.log("Expert AI extension installed");
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  let query = "";

  if (info.menuItemId === "ask-expert" && info.selectionText) {
    query = info.selectionText.trim();
  } else if (info.menuItemId === "ask-expert-page") {
    // Get page title and URL for context
    query = `Analyze this page: ${tab.title}\nURL: ${tab.url}`;
  }

  if (query) {
    // Store query for popup to use
    await chrome.storage.local.set({ contextMenuQuery: query });

    // Open popup
    // Note: In MV3, we can't programmatically open the popup, so we open a new tab
    // For better UX, users click the extension icon after right-clicking
    chrome.action.openPopup().catch(() => {
      // If openPopup fails (e.g., not available), create notification
      console.log("Opening popup programmatically not supported, query saved");
    });
  }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_SELECTION") {
    // Forward to content script and get selection
    chrome.tabs.sendMessage(
      sender.tab?.id || 0,
      { type: "GET_SELECTION" },
      (response) => {
        sendResponse(response);
      },
    );
    return true; // Keep channel open for async response
  }

  if (message.type === "OPEN_APP") {
    const apiBase = "https://ai-dev.oz.ly";
    chrome.tabs.create({
      url: message.path ? `${apiBase}${message.path}` : apiBase,
    });
  }
});

// Listen for extension icon click
chrome.action.onClicked.addListener((tab) => {
  // This won't fire if popup.html is set, but keeping for reference
  console.log("Extension icon clicked on tab:", tab.url);
});
