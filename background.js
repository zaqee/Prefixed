// background.js
//Listens for messages from content scripts and responds with the tab ID when requested.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.getTabId && sender.tab?.id) {
    sendResponse(sender.tab.id);
  }
});
