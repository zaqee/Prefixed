// popup.js
// UI for the extension popup. Responsible for listing rules, adding new rules,
// editing existing rules, and sending simple messages to the content script.

document.addEventListener("DOMContentLoaded", () => {
  // --- Configuration ---
  const MAX_RULES = 7; // how many rules to show inline in the popup

  // --- DOM references ---
  const rulesDiv = document.getElementById("rules");
  const addBtn = document.getElementById("add");
  const input = document.getElementById("customTitle");
  const applyBtn = document.getElementById("applyTitle");
  const resetBtn = document.getElementById("resetTitle");
  const newEmoji = document.getElementById("newEmoji");
  const newPrefix = document.getElementById("newPrefix");
  const newMatch = document.getElementById("newMatch");
  const newType = document.getElementById("newType");
  const enabledToggle = document.getElementById("enabled");
  const sepSelect = document.getElementById("emojiSeparator");

  // Short list of emoji for the picker (keeps popup compact)
  const EMOJIS = "😀 😁 😂 😊 😎 🤓 🧪 📄 📕 📘 📊 📈 📐 ⚛️ 🔥 ⭐".split(" ");

  // --- Utilities ---
  function cleanPrefix(value) {
    // Normalise user input into a bracketed uppercase prefix: "pdf" -> "[PDF]"
    const v = (value || "").toUpperCase().replace(/[^A-Z]/g, "").trim();
    return `[${v}]`;
  }
  chrome.tabs.onActivated.addListener(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs?.[0];
      if (tab?.title) input.value = tab.title;
    });
  });
  
  // --- Load saved UI state ---
  chrome.storage.sync.get({ enabled: true, emojiSeparator: " • " }, (d) => {
    enabledToggle.checked = !!d.enabled;
    sepSelect.value = d.emojiSeparator || " • ";
  });

  // Keep the emoji separator in sync
  sepSelect.onchange = () => chrome.storage.sync.set({ emojiSeparator: sepSelect.value });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.emojiSeparator) sepSelect.value = changes.emojiSeparator.newValue;
  });

  // Persist the enabled toggle
  enabledToggle.onchange = () => chrome.storage.sync.set({ enabled: enabledToggle.checked });

  // If the user opens the popup on a tab, prefill the match input with the tab URL
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs?.[0];
    if (!tab) return;
  
    // Prefill match field (you already had this)
    if (tab.url && !newMatch.value) {
      newMatch.value = tab.url;
    }
  
    // 🔥 NEW: Prefill custom title field
    if (tab.title && !input.value) {
      input.value = tab.title;
    }
  });
  

  // --- Emoji picker UI ---
  const picker = document.createElement("div");
  picker.className = "emoji-picker";
  Object.assign(picker.style, {
    position: "absolute",
    display: "none",
    background: "#fff",
    border: "1px solid #ccc",
    padding: "6px",
    zIndex: 1000
  });

  let activeInput = null; // input element that requested the picker
  let activeIndex = null; // rule index (if editing an existing rule)

  // Populate picker with emoji buttons
  EMOJIS.forEach((emoji) => {
    const node = document.createElement("span");
    node.textContent = emoji;
    node.style.cursor = "pointer";
    node.style.fontSize = "18px";
    node.style.padding = "4px";

    node.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (!activeInput) return;
      activeInput.value = emoji;
      if (activeIndex !== null) updateRule(activeIndex, { emoji });
      picker.style.display = "none";
    });

    picker.appendChild(node);
  });

  document.body.appendChild(picker);

  function wireEmojiInput(input, index = null) {
    // Show emoji picker positioned below the input when focused
    input.addEventListener("focus", () => {
      const r = input.getBoundingClientRect();
      picker.style.left = `${r.left}px`;
      picker.style.top = `${r.bottom}px`;
      picker.style.display = "block";
      activeInput = input;
      activeIndex = index;
    });

    // Keep only the first character (emoji) and immediately persist
    input.addEventListener("input", () => {
      const chars = [...input.value];
      input.value = chars[0] || "";
      if (index !== null) updateRule(index, { emoji: input.value });
    });
  }

  document.addEventListener("click", (e) => {
    if (!picker.contains(e.target) && !e.target.classList.contains("emoji")) {
      picker.style.display = "none";
      activeInput = null;
      activeIndex = null;
    }
  });

  wireEmojiInput(newEmoji);

  // --- Rule rendering / editing ---
  function render(rules) {
    rulesDiv.innerHTML = "";
    (rules || []).slice(0, MAX_RULES).forEach((rule, index) => {
      const row = document.createElement("div");
      row.className = "rule";

      // Keep markup small and predictable; attach listeners afterwards
      row.innerHTML = `
        <span class="drag">☰</span>
        <input class="emoji" value="${rule.emoji || ""}">
        <input class="prefix" value="${rule.prefix || ""}">
        <input class="match" value="${rule.match || ""}">
        <select class="type">
          <option value="keyword" ${rule.type === "keyword" ? "selected" : ""}>keyword</option>
          <option value="url" ${rule.type === "url" ? "selected" : ""}>url</option>
          <option value="extension" ${rule.type === "extension" ? "selected" : ""}>extension</option>
        </select>
        <input class="toggle" type="checkbox" ${rule.enabled ? "checked" : ""}>
        <button class="del">✕</button>
      `;

      wireEmojiInput(row.querySelector(".emoji"), index);

      row.querySelector(".prefix").onchange = (e) => updateRule(index, { prefix: cleanPrefix(e.target.value) });
      row.querySelector(".match").onchange = (e) => updateRule(index, { match: e.target.value.toLowerCase() });
      row.querySelector(".type").onchange = (e) => updateRule(index, { type: e.target.value });
      row.querySelector(".toggle").onchange = (e) => updateRule(index, { enabled: e.target.checked });
      row.querySelector(".del").onclick = () => deleteRule(index);

      rulesDiv.appendChild(row);
    });

    if ((rules || []).length > MAX_RULES) {
      const more = document.createElement("button");
      more.textContent = "See more";
      more.onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL("manager.html") });
      rulesDiv.appendChild(more);
    }
  }

  function updateRule(index, patch) {
    // Patch a rule at index and re-render.
    chrome.storage.sync.get({ rules: [] }, (d) => {
      if (!d.rules[index]) return; // defensive
      Object.assign(d.rules[index], patch);
      chrome.storage.sync.set({ rules: d.rules }, () => render(d.rules));
    });
  }

  function deleteRule(index) {
    chrome.storage.sync.get({ rules: [] }, (d) => {
      d.rules.splice(index, 1);
      chrome.storage.sync.set({ rules: d.rules }, () => render(d.rules));
    });
  }

  // --- Custom title controls ---

  applyBtn.onclick = () => {
  const value = (input.value || "").trim();
  if (!value) return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs?.[0];
    if (!tab?.id) return;

    chrome.storage.sync.get({ customTitles: {} }, (data) => {
      const customTitles = data.customTitles;
      customTitles[tab.id] = value;

      chrome.storage.sync.set({ customTitles }, () => {
        chrome.tabs.reload(tab.id);
      });
    });
  });
};

resetBtn.onclick = () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs?.[0];
    if (!tab?.id) return;

    chrome.storage.sync.get({ customTitles: {} }, (data) => {
      const customTitles = data.customTitles;
      delete customTitles[tab.id];

      chrome.storage.sync.set({ customTitles }, () => {
        chrome.tabs.reload(tab.id);
      });
    });
  });
};

  
  
  
  

  // --- Add new rule ---
  addBtn.onclick = () => {
    if (!newPrefix.value || !newMatch.value) return;

    chrome.storage.sync.get({ rules: [] }, (d) => {
      d.rules.unshift({
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        emoji: newEmoji.value || "",
        prefix: cleanPrefix(newPrefix.value),
        match: newMatch.value.toLowerCase(),
        type: newType.value,
        enabled: true
      });

      chrome.storage.sync.set({ rules: d.rules }, () => {
        newEmoji.value = "";
        newPrefix.value = "";
        newMatch.value = "";
        render(d.rules);
      });
    });
  };

  // Initial render
  chrome.storage.sync.get({ rules: [] }, (d) => render(d.rules || []));
});
