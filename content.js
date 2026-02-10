// content.js
// Applies ONE prefix per tab based on stored rule priority

(() => {
const DEFAULT_RULES = [
  { id: "yt", enabled: true, emoji: "📺", prefix: "[YT]", match: "youtube.com", type: "url" },
  { id: "gdoc", enabled: true, emoji: "📄", prefix: "[DOC]", match: "docs.google.com/document", type: "url" },
  { id: "gslides", enabled: true, emoji: "📊", prefix: "[PPT]", match: "docs.google.com/presentation", type: "url" },
  { id: "gsheets", enabled: true, emoji: "📈", prefix: "[XLS]", match: "docs.google.com/spreadsheets", type: "url" },
  { id: "pdf", enabled: true, emoji: "📕", prefix: "[PDF]", match: ".pdf", type: "extension" },
  { id: "ppt", enabled: true, emoji: "", prefix: "[PPT]", match: ".ppt", type: "extension" },
  { id: "doc", enabled: true, emoji: "", prefix: "[DOC]", match: ".doc", type: "extension" },
  { id: "xls", enabled: true, emoji: "", prefix: "[XLS]", match: ".xls", type: "extension" },
  { id: "chem", enabled: true, emoji: "🧪", prefix: "[CHEM]", match: "chemistry chem", type: "keyword" },
  { id: "phys", enabled: true, emoji: "⚛️", prefix: "[PHYS]", match: "physics phys", type: "keyword" },
  { id: "math", enabled: true, emoji: "📐", prefix: "[MATHS]", match: "math maths algebra calculus", type: "keyword" }
];


  const DEFAULTS = { enabled: true, rules: null };

  chrome.storage.sync.get(DEFAULTS, data => {
    if (!data.rules) {
      chrome.storage.sync.set({ rules: DEFAULT_RULES }, run);
    } else {
      run();
    }
  });

  function run() {
    apply();
    observe();
    chrome.storage.onChanged.addListener(apply);
  }

  function ruleMatches(rule, url, title) {
    if (!rule.enabled) return false;
    const text = (url + " " + title).toLowerCase();

    if (rule.type === "keyword")
      return rule.match.split(" ").some(k => text.includes(k));

    if (rule.type === "url")
      return url.includes(rule.match);

    if (rule.type === "extension")
      return url.includes(rule.match);

    return false;
  }

  // 🔹 ADDITIVE: emoji support only
  function resolvePrefix(url, title, rules) {
    for (const rule of rules) {
      if (ruleMatches(rule, url, title)) {
        if (rule.emoji) {
          return `${rule.emoji} • ${rule.prefix}`;
        }
        return rule.prefix;
      }
    }
    return null;
  }

  function apply() {
    chrome.storage.sync.get(DEFAULTS, s => {
      if (!s.enabled || !s.rules) return;

      const titleEl = document.querySelector("title");
      if (!titleEl) return;

      // 🔹 ADDITIVE: safely strip emoji + prefix OR prefix only
      const cleanTitle = titleEl.textContent
        .replace(/^[^\[]+•\s*/, "")
        .replace(/^\[[^\]]+\]\s*/, "");

      const prefix = resolvePrefix(location.href, cleanTitle, s.rules);
      if (!prefix) return;

      const newTitle = `${prefix} ${cleanTitle}`;
if (titleEl.textContent !== newTitle) {
  titleEl.textContent = newTitle;
}

    });
  }

  function observe() {
    const obs = new MutationObserver(() => requestAnimationFrame(apply));
    const wait = setInterval(() => {
      const t = document.querySelector("title");
      if (t) {
        obs.observe(t, { childList: true });
        clearInterval(wait);
      }
    }, 50);
  }
})();
