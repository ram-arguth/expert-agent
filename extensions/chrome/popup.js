/**
 * Expert AI Chrome Extension - Popup Script
 *
 * Handles user interactions in the popup window.
 */

// Configuration
const API_BASE = getApiBase();

function getApiBase() {
  // Detect environment from storage or use default
  return "https://ai-dev.oz.ly"; // Change to production URL when ready
}

// DOM Elements
const agentSelect = document.getElementById("agent");
const queryInput = document.getElementById("query");
const submitBtn = document.getElementById("submit");
const responseArea = document.getElementById("response-area");
const responseContent = document.getElementById("response-content");
const viewFullBtn = document.getElementById("view-full");
const openAppLink = document.getElementById("open-app");

// State
let lastSessionId = null;

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  // Load saved agent preference
  const stored = await chrome.storage.local.get(["selectedAgent", "lastQuery"]);
  if (stored.selectedAgent) {
    agentSelect.value = stored.selectedAgent;
  }

  // Check for selected text from context menu
  const result = await chrome.storage.local.get(["contextMenuQuery"]);
  if (result.contextMenuQuery) {
    queryInput.value = result.contextMenuQuery;
    // Clear it after use
    await chrome.storage.local.remove("contextMenuQuery");
  }

  // Set up open app link
  openAppLink.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: API_BASE });
  });
});

// Save agent selection
agentSelect.addEventListener("change", () => {
  chrome.storage.local.set({ selectedAgent: agentSelect.value });
});

// Submit query
submitBtn.addEventListener("click", async () => {
  const agent = agentSelect.value;
  const query = queryInput.value.trim();

  if (!query) {
    showError("Please enter a question");
    return;
  }

  await submitQuery(agent, query);
});

// Handle Enter key in textarea
queryInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.ctrlKey) {
    submitBtn.click();
  }
});

async function submitQuery(agent, query) {
  // Show loading state
  submitBtn.disabled = true;
  submitBtn.textContent = "Thinking...";
  responseArea.classList.add("visible", "loading");
  responseArea.classList.remove("error");
  responseContent.textContent = "";
  viewFullBtn.style.display = "none";

  try {
    const response = await fetch(`${API_BASE}/api/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Include session cookie
      body: JSON.stringify({
        agentId: agent,
        input: { query },
        source: "extension",
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Please log in to Expert AI first");
      }
      throw new Error(`Request failed: ${response.statusText}`);
    }

    const data = await response.json();
    lastSessionId = data.sessionId;

    // Display response
    responseArea.classList.remove("loading");
    responseContent.textContent =
      data.summary || data.response || "No response";
    viewFullBtn.style.display = "block";
  } catch (error) {
    responseArea.classList.remove("loading");
    responseArea.classList.add("error");
    responseContent.textContent = error.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Ask Expert";
  }
}

function showError(message) {
  responseArea.classList.add("visible", "error");
  responseArea.classList.remove("loading");
  responseContent.textContent = message;
}

// View full analysis
viewFullBtn.addEventListener("click", () => {
  if (lastSessionId) {
    chrome.tabs.create({ url: `${API_BASE}/sessions/${lastSessionId}` });
  } else {
    chrome.tabs.create({ url: API_BASE });
  }
});
