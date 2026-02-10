// content.js
// This script runs in page context and updates the document title by
// applying a single prefix per tab. Priority is determined by the order
// of the stored rules (first matching rule wins). The script supports
// emoji prefixes (emoji + separator + prefix) and plain bracketed prefixes.

(function () {
  // Default rules used to seed storage if none exist. Keep these small
  // and predictable; users can customize through the popup.
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

  // Temporary custom title state (set via popup UI). When set, it overrides
  // all prefix logic until reset.
  let tempCustomTitle = null;

  // Listen for simple messages from the popup to set/reset a temporary title.
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "SET_CUSTOM_TITLE") {
      tempCustomTitle = msg.title || null;
      apply(); // re-run immediately
    }

    if (msg.type === "RESET_CUSTOM_TITLE") {
      tempCustomTitle = null;
      apply();
    }
  });

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

  // Resolve the prefix for a page given rules and a separator for emoji.
  // Returns a string like "📕 • [PDF]" or just "[PDF]" or null if none apply.
  function resolvePrefix(url, title, rules, sep) {
    if (!rules || !Array.isArray(rules)) return null;
    for (const rule of rules) {
      try {
        if (ruleMatches(rule, url, title)) {
          if (rule.emoji) return `${rule.emoji}${sep}${rule.prefix}`;
          return rule.prefix;
        }
      } catch (err) {
        // Defensive: ignore faulty rules but continue
        console.warn("Prefix rule error", err, rule);
      }
    }
    return null;
  }

  // Apply prefix logic to the current tab title. This function is safe to run
  // repeatedly; it will avoid re-writing the title if nothing changed.
  function apply() {
    const titleEl = document.querySelector("title");
    if (!titleEl) return;

    // Highest priority: if popup set a temporary custom title, honour it
    if (tempCustomTitle) {
      if (titleEl.textContent !== tempCustomTitle) titleEl.textContent = tempCustomTitle;
      return; // skip prefixing while custom title is active
    }

    chrome.storage.sync.get(DEFAULTS, (s) => {
      if (!s.enabled || !s.rules) return;

      const titleElInner = document.querySelector("title");
      if (!titleElInner) return;

      // Strip any previously added emoji + separator or [PREFIX] so matching is performed
      // against a clean title. This uses a small, forgiving regex for emoji.
      const raw = titleElInner.textContent || "";

      const cleanTitle = raw
        // remove leading emoji + separator we added previously (e.g. "📕 • ")
        .replace(/^([\p{Emoji}\uFE0F]+)\s*(•|-|\||\s)?\s*/u, "")
        // remove leading bracketed prefix e.g. "[PDF] "
        .replace(/^\[[^\]]+\]\s*/, "");

      const sep = s.emojiSeparator || " • ";
      const prefix = resolvePrefix(location.href, cleanTitle, s.rules, sep);
      if (!prefix) return;

      const newTitle = `${prefix} ${cleanTitle}`;
      if (titleElInner.textContent !== newTitle) titleElInner.textContent = newTitle;
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
