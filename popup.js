//popup.js
// This script manages the popup UI for the extension, allowing users to add/edit/delete rules for prefixing tab titles, set custom titles for specific tabs, and configure settings like enabling/disabling the extension and choosing an emoji separator. It interacts with chrome.storage to persist user settings and rules, and communicates with content scripts to apply changes immediately.

document.addEventListener("DOMContentLoaded", () => {

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

  const EMOJIS = "😀 😁 😂 😊 😎 🤓 🧪 📄 📕 📘 📊 📈 📐 ⚛️ 🔥 ⭐".split(" ");

  function cleanPrefix(v) {
    v = (v || "").toUpperCase().replace(/[\[\]]/g, "").trim();
    return `[${v}]`;
  }

  // ---------------- AUTO FILL CURRENT TAB ----------------
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs?.[0];
    if (!tab) return;

    if (tab.url && !newMatch.value) newMatch.value = tab.url;
    if (tab.title && !input.value) input.value = tab.title;
  });

  // ---------------- CUSTOM TAB NAME ----------------

  applyBtn.onclick = () => {
    const newTitle = input.value.trim();
    if (!newTitle) return;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab) return;

      chrome.storage.sync.get({ customTitles: {} }, (data) => {
        const updated = { ...data.customTitles };
        updated[tab.id] = newTitle;

        chrome.storage.sync.set({ customTitles: updated }, () => {
          chrome.tabs.reload(tab.id); // <-- IMPORTANT
        });
      });
    });
  };

  resetBtn.onclick = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab) return;

      chrome.storage.sync.get({ customTitles: {} }, (data) => {
        const updated = { ...data.customTitles };
        delete updated[tab.id];

        chrome.storage.sync.set({ customTitles: updated }, () => {
          chrome.tabs.reload(tab.id); // <-- IMPORTANT
        });
      });
    });
  };



  // ---------------- EMOJI PICKER ----------------
  const picker = document.createElement("div");
  picker.style.position = "absolute";
  picker.style.display = "none";
  picker.style.background = "#fff";
  picker.style.border = "1px solid #ccc";
  picker.style.padding = "6px";
  picker.style.zIndex = 1000;

  let activeInput = null;
  let activeIndex = null;

  EMOJIS.forEach(e => {
    const s = document.createElement("span");
    s.textContent = e;
    s.style.cursor = "pointer";
    s.style.fontSize = "18px";
    s.style.padding = "4px";

    s.onclick = ev => {
      ev.stopPropagation();
      if (!activeInput) return;

      activeInput.value = e;
      if (activeIndex !== null) updateRule(activeIndex, { emoji: e });
      picker.style.display = "none";
    };

    picker.appendChild(s);
  });

  document.body.appendChild(picker);

  function wireEmojiInput(input, index = null) {
    input.addEventListener("focus", () => {
      const r = input.getBoundingClientRect();
      picker.style.left = r.left + "px";
      picker.style.top = r.bottom + "px";
      picker.style.display = "block";
      activeInput = input;
      activeIndex = index;
    });

    input.addEventListener("input", () => {
      const chars = [...input.value];
      input.value = chars[0] || "";
      if (index !== null) updateRule(index, { emoji: input.value });
    });
  }

  document.addEventListener("click", e => {
    if (!picker.contains(e.target) && !e.target.classList.contains("emoji")) {
      picker.style.display = "none";
      activeInput = null;
      activeIndex = null;
    }
  });

  wireEmojiInput(newEmoji);

  // ---------------- SETTINGS ----------------
  chrome.storage.sync.get({ enabled: true, emojiSeparator: " • " }, d => {
    enabledToggle.checked = d.enabled;
    sepSelect.value = d.emojiSeparator;
  });

  enabledToggle.onchange = () => {
    chrome.storage.sync.set({ enabled: enabledToggle.checked });
  };

  sepSelect.onchange = () => {
    chrome.storage.sync.set({ emojiSeparator: sepSelect.value });
  };

  // ---------------- RENDER ----------------
  function render(rules, maxRules = 3) {
    rulesDiv.innerHTML = "";

    const visibleRules = rules.slice(0, maxRules);

    visibleRules.forEach((rule, index) => {
      const row = document.createElement("div");
      row.className = "rule";
      row.dataset.index = index;

      row.innerHTML = `
      <div class="rule-item">
        <span class="drag">⠿</span>
        <input class="emoji" type="text" value="${rule.emoji || ""}">
        <input class="prefix" type="text" value="${rule.prefix}">
        <input class="match" type="text" value="${rule.match}">
        <select class="type">
          <option value="keyword" ${rule.type === "keyword" ? "selected" : ""}>keyword</option>
          <option value="url" ${rule.type === "url" ? "selected" : ""}>url</option>
          <option value="extension" ${rule.type === "extension" ? "selected" : ""}>extension</option>
        </select>
        <input class="toggle" type="checkbox" ${rule.enabled ? "checked" : ""}>
        <button class="del">✕</button>
      </div>
      `;

      const dragHandle = row.querySelector(".drag");
      row.draggable = false;

      dragHandle.addEventListener("mousedown", () => {
        row.draggable = true;
      });

      row.addEventListener("dragstart", () => {
        row.classList.add("dragging");
      });

      row.addEventListener("dragend", () => {
        row.classList.remove("dragging");
        row.draggable = false;
        saveOrder(maxRules);
      });

      wireEmojiInput(row.querySelector(".emoji"), index);

      row.querySelector(".prefix").onchange = e =>
        updateRule(index, { prefix: cleanPrefix(e.target.value) });

      row.querySelector(".match").onchange = e =>
        updateRule(index, { match: e.target.value.toLowerCase() });

      row.querySelector(".type").onchange = e =>
        updateRule(index, { type: e.target.value });

      row.querySelector(".toggle").onchange = e =>
        updateRule(index, { enabled: e.target.checked });

      row.querySelector(".del").onclick = () => deleteRule(index);

      rulesDiv.appendChild(row);
    });

    if (rules.length > maxRules) {
      const more = document.createElement("button");
      more.textContent = "See more";
      more.className = "btn btn-secondary";
      more.onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL("manager.html") });
      rulesDiv.appendChild(more);
    }
  }

  // ---------------- DRAG ----------------
  rulesDiv.addEventListener("dragover", e => {
    e.preventDefault();
    const dragging = document.querySelector(".dragging");
    if (!dragging) return;

    const afterElement = getDragAfterElement(rulesDiv, e.clientY);
    if (!afterElement) rulesDiv.appendChild(dragging);
    else rulesDiv.insertBefore(dragging, afterElement);
  });

  function getDragAfterElement(container, y) {
    const elements = [...container.querySelectorAll(".rule:not(.dragging)")];
    return elements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  function saveOrder(maxRules) {
    const rows = [...rulesDiv.querySelectorAll(".rule")];

    chrome.storage.sync.get({ rules: [] }, data => {
      const fullRules = [...data.rules];
      const visibleOriginal = fullRules.slice(0, maxRules);

      const reorderedVisible = rows.map(row => {
        const oldIndex = parseInt(row.dataset.index);
        return visibleOriginal[oldIndex];
      });

      const newRules = [
        ...reorderedVisible,
        ...fullRules.slice(maxRules)
      ];

      chrome.storage.sync.set({ rules: newRules }, () => {
        chrome.storage.sync.get({ popupLimit: 3 }, s => {
          render(newRules, s.popupLimit);
        });
      });
    });
  }

  function updateRule(index, patch) {
    chrome.storage.sync.get({ rules: [] }, d => {
      if (!d.rules[index]) return;
      Object.assign(d.rules[index], patch);
      chrome.storage.sync.set({ rules: d.rules }, () => {
        chrome.storage.sync.get({ popupLimit: 3 }, s => {
          render(d.rules, s.popupLimit);
        });
      });
    });
  }

  function deleteRule(index) {
    chrome.storage.sync.get({ rules: [] }, d => {
      d.rules.splice(index, 1);
      chrome.storage.sync.set({ rules: d.rules }, () => {
        chrome.storage.sync.get({ popupLimit: 3 }, s => {
          render(d.rules, s.popupLimit);
        });
      });
    });
  }

  // ---------------- ADD RULE ----------------
  addBtn.onclick = () => {
    if (!newPrefix.value || !newMatch.value) return;

    chrome.storage.sync.get({ rules: [] }, d => {
      d.rules.unshift({
        id: crypto.randomUUID(),
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

        chrome.storage.sync.get({ popupLimit: 3}, s => {
          render(d.rules, s.popupLimit);
        });
      });
    });
  };

  chrome.storage.sync.get({ rules: [], popupLimit: 3 }, d => {
    render(d.rules, d.popupLimit);
  });

});
