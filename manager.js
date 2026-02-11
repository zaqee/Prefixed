// manger.js
// This script mirrors the popup.js UI but is designed for a full-page manager (manager.html) rather than a popup. It allows users to manage more rules at once and includes drag-and-drop reordering. The core logic for adding/editing/deleting rules and syncing with storage is shared with popup.js, but the UI and interactions are adapted for a larger screen and more complex interface.

document.addEventListener("DOMContentLoaded", () => {
  const rulesDiv = document.getElementById("rules");
  const addBtn = document.getElementById("add");
  const popupLimitInput = document.getElementById("popupLimit");
  const newEmoji = document.getElementById("newEmoji");
  const newPrefix = document.getElementById("newPrefix");
  const newMatch = document.getElementById("newMatch");
  const newType = document.getElementById("newType");
  const sepSelect = document.getElementById("emojiSeparator");

  const EMOJIS = "😀 😁 😂 😊 😎 🤓 🧪 📄 📕 📘 📊 📈 📐 ⚛️ 🔥 ⭐".split(" ");

  function cleanPrefix(v) {
    v = v.toUpperCase().replace(/[\[\]]/g, "").trim();
    return `[${v}]`;
  }

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

  // ---------------- SEPARATOR ----------------
  chrome.storage.sync.get({ emojiSeparator: " • " }, d => {
    sepSelect.value = d.emojiSeparator;
  });

  sepSelect.onchange = () => {
    chrome.storage.sync.set({ emojiSeparator: sepSelect.value });
  };

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.emojiSeparator) {
      sepSelect.value = changes.emojiSeparator.newValue;
    }
  });

  // ---------------- RENDER ----------------
  function render(rules) {
    rulesDiv.innerHTML = "";

    rules.forEach((rule, index) => {
      const row = document.createElement("div");
      row.className = "rule";
      row.dataset.index = index;

      row.innerHTML = `
        <span class="drag">⠿</span>
        <input class="emoji" type="text" value="${rule.emoji || ""}">
        <input class="prefix" type="text" value="${rule.prefix}">
        <input class="match" type="text" value="${rule.match}">
        <select class="type">
          <option value="keyword" ${rule.type === "keyword" ? "selected" : ""}>keyword</option>
          <option value="url" ${rule.type === "url" ? "selected" : ""}>url</option>
          <option value="extension" ${rule.type === "extension" ? "selected" : ""}>extension</option>
        </select>
        <button class="del">✕</button>
      `;

      // Enable dragging only from ⠿
      const dragHandle = row.querySelector(".drag");
      row.draggable = false;

      dragHandle.addEventListener("mousedown", () => {
        row.draggable = true;
      });

      row.addEventListener("dragstart", e => {
        row.classList.add("dragging");
      });

      row.addEventListener("dragend", () => {
        row.classList.remove("dragging");
        row.draggable = false;
        saveOrder();
      });

      wireEmojiInput(row.querySelector(".emoji"), index);

      row.querySelector(".prefix").onchange = e =>
        updateRule(index, { prefix: cleanPrefix(e.target.value) });

      row.querySelector(".match").onchange = e =>
        updateRule(index, { match: e.target.value.toLowerCase() });

      row.querySelector(".type").onchange = e =>
        updateRule(index, { type: e.target.value });

      row.querySelector(".del").onclick = () => deleteRule(index);

      rulesDiv.appendChild(row);
    });
  }

  // ---------------- DRAG LOGIC ----------------
  rulesDiv.addEventListener("dragover", e => {
    e.preventDefault();
    const dragging = document.querySelector(".dragging");
    if (!dragging) return;

    const afterElement = getDragAfterElement(rulesDiv, e.clientY);
    if (!afterElement) {
      rulesDiv.appendChild(dragging);
    } else {
      rulesDiv.insertBefore(dragging, afterElement);
    }
  });

  function getDragAfterElement(container, y) {
    const elements = [...container.querySelectorAll(".rule:not(.dragging)")];

    return elements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;

      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  function saveOrder() {
    const rows = [...rulesDiv.querySelectorAll(".rule")];

    chrome.storage.sync.get({ rules: [] }, data => {
      const newRules = rows.map(row => {
        const oldIndex = parseInt(row.dataset.index);
        return data.rules[oldIndex];
      });

      chrome.storage.sync.set({ rules: newRules }, () => {
        render(newRules);
      });
    });
  }

  function updateRule(index, patch) {
    chrome.storage.sync.get({ rules: [] }, d => {
      if (!d.rules[index]) return;
      Object.assign(d.rules[index], patch);
      chrome.storage.sync.set({ rules: d.rules }, () => render(d.rules));
    });
  }

  function deleteRule(index) {
    chrome.storage.sync.get({ rules: [] }, d => {
      d.rules.splice(index, 1);
      chrome.storage.sync.set({ rules: d.rules }, () => render(d.rules));
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
        render(d.rules);
      });
    });
  };

  // ---------------- POPUP LIMIT ----------------
  chrome.storage.sync.get({ popupLimit: 3 }, d => {
    popupLimitInput.value = d.popupLimit;
  });

  popupLimitInput.addEventListener("change", () => {
    let value = parseInt(popupLimitInput.value);

    if (isNaN(value) || value < 1) value = 1;
    if (value > 50) value = 50;

    popupLimitInput.value = value;

    chrome.storage.sync.set({ popupLimit: value });
  });

  chrome.storage.sync.get({ rules: [] }, d => render(d.rules));
});
