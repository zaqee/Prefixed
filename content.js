// content.js
// This script runs in page context and updates the document title by
// applying a single prefix per tab. Priority is determined by the order
// adding custom tab names
// hirarchy of custom tab > prefix > defualt tittle.
// of the stored rules (first matching rule wins). The script supports
// emoji prefixes (emoji + separator + prefix) and plain bracketed prefixes.

(function () {
  // Default rules used to seed storage if none exist.
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

  const DEFAULTS = { enabled: true, rules: null, emojiSeparator: " • " };

  // Ensure rules exist (seed defaults) then start
  chrome.storage.sync.get(DEFAULTS, (data) => {
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

  // Check whether a rule matches given url/title. Rule types: keyword, url, extension
  function ruleMatches(rule, url, title) {
    if (!rule || !rule.enabled) return false;
    const text = `${url} ${title}`.toLowerCase();

    if (rule.type === "keyword") {
      return (rule.match || "").split(/\s+/).some((k) => k && text.includes(k));
    }

    if (rule.type === "url") return (url || "").includes(rule.match || "");

    if (rule.type === "extension") return (url || "").includes(rule.match || "");

    return false;
  }
  function scoreRule(rule, url, title) {
    if (!rule || !rule.enabled) return -1;

    const u = (url || "").toLowerCase();
    const t = (title || "").toLowerCase();
    const match = (rule.match || "").toLowerCase();

    let score = 0;

    // BASE WEIGHTS
    if (rule.type === "extension" && u.includes(match)) score += 90;

    if (rule.type === "url" && u.includes(match)) score += 70;
    const body = document.body?.innerText?.slice(0, 5000).toLowerCase() || "";


    if (rule.type === "keyword") {
      const words = match.split(/\s+/);
      if (words.some(k => k && t.includes(k))) score += 120;     // title strong
      else if (words.some(k => k && u.includes(k))) score += 50; // url weaker
      else if (words.some(k => k && body.includes(k))) score += 70; // body weaker
    }

    // SPECIFICITY
    score += match.length;

    // USER BOOST
    score += rule.priorityBoost || 0;

    return score;
  }

  // Resolve the prefix for a page given rules and a separator for emoji.
  // Returns a string like "📕 • [PDF]" or just "[PDF]" or null if none apply.
  function resolvePrefix(url, title, rules, sep) {
    if (!rules || !Array.isArray(rules)) return null;

    let bestRule = null;
    let bestScore = -1;

    rules.forEach((rule, index) => {
      const s = scoreRule(rule, url, title);

      if (s > bestScore) {
        bestScore = s;
        bestRule = rule;
      }
      // tie → earlier in list wins automatically
    });

    if (!bestRule || bestScore <= 0) return null;

    if (bestRule.emoji) return `${bestRule.emoji}${sep}${bestRule.prefix}`;
    return bestRule.prefix;
  }


  // Apply prefix logic to the current tab title. This function is safe to run
  // repeatedly; it will avoid re-writing the title if nothing changed.
  function apply() {
    const titleEl = document.querySelector("title");
    if (!titleEl) return;

    chrome.storage.sync.get(DEFAULTS, (s) => {
      if (!s.enabled) return;

      chrome.storage.sync.get({ customTitles: {} }, (data) => {
        const tabId = chrome.devtools ? null : null;
      });
    });

    chrome.storage.sync.get({ customTitles: {}, ...DEFAULTS }, (s) => {
      if (!s.enabled) return;

      const titleElInner = document.querySelector("title");
      if (!titleElInner) return;

      // GET CURRENT TAB ID
      chrome.runtime.sendMessage({ getTabId: true }, (tabId) => {
        if (!tabId) return;

        const customTitle = s.customTitles[tabId];

        // PRIORITY 1: Custom title overrides EVERYTHING
        if (customTitle) {
          if (titleElInner.textContent !== customTitle) {
            titleElInner.textContent = customTitle;
          }
          return;
        }

        // PREFIX LOGIC
        if (!s.rules) return;

        const raw = titleElInner.textContent || "";

        const cleanTitle = raw
          .replace(/^([\p{Emoji}\uFE0F]+)\s*(•|-|\||\s)?\s*/u, "")
          .replace(/^\[[^\]]+\]\s*/, "");

        const sep = s.emojiSeparator || " • ";
        const prefix = resolvePrefix(location.href, cleanTitle, s.rules, sep);
        if (!prefix) return;

        const newTitle = `${prefix} ${cleanTitle}`;
        if (titleElInner.textContent !== newTitle) {
          titleElInner.textContent = newTitle;
        }
      });
    });
  }



  // Observe title changes and re-apply prefix when title updates
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
