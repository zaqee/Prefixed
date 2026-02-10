// manager.js
document.addEventListener("DOMContentLoaded", () => {
  const rulesDiv = document.getElementById("rules");
  const addBtn = document.getElementById("add");

  const newEmoji = document.getElementById("newEmoji");
  const newPrefix = document.getElementById("newPrefix");
  const newMatch = document.getElementById("newMatch");
  const newType = document.getElementById("newType");

  const EMOJIS = "😀 😁 😂 😊 😎 🤓 🧪 📄 📕 📘 📊 📈 📐 ⚛️ 🔥 ⭐".split(" ");
  const sepSelect = document.getElementById("emojiSeparator");

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

      row.innerHTML = `
        <input class="emoji" value="${rule.emoji || ""}">
        <input class="prefix" value="${rule.prefix}">
        <input class="match" value="${rule.match}">
        <select class="type">
          <option value="keyword" ${rule.type==="keyword"?"selected":""}>keyword</option>
          <option value="url" ${rule.type==="url"?"selected":""}>url</option>
          <option value="extension" ${rule.type==="extension"?"selected":""}>extension</option>
        </select>
        <input class="toggle" type="checkbox" ${rule.enabled?"checked":""}>
        <button class="del">✕</button>
      `;

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
  }

  function updateRule(index, patch) {
    chrome.storage.sync.get({ rules: [] }, d => {
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

  chrome.storage.sync.get({ rules: [] }, d => render(d.rules));
});
