// background.js
chrome.runtime.onInstalled.addListener(() => {});


chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_TAB_ID") {
    sendResponse({ tabId: sender.tab.id });
  }
});
