// popup.js
document.addEventListener("DOMContentLoaded", () => {
  const MAX_RULES = 7;

  const rulesDiv = document.getElementById("rules");
  const addBtn = document.getElementById("add");
  const newPrefix = document.getElementById("newPrefix");
  const newMatch = document.getElementById("newMatch");
  const newType = document.getElementById("newType");
  const enabledToggle = document.getElementById("enabled");
 
  function cleanPrefix(v) {
    v = v.toUpperCase().replace(/[\[\]]/g, "").trim();
    return `[${v}]`;
  }
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
  if (!tabs[0] || !tabs[0].url) return;

  // Only autofill if the user hasn't typed anything yet
  if (!newMatch.value) {
    newMatch.value = tabs[0].url;
  }
});

  // Global enable toggle
  chrome.storage.sync.get({ enabled: true }, data => {
    enabledToggle.checked = data.enabled;
  });

  enabledToggle.onchange = () => {
    chrome.storage.sync.set({ enabled: enabledToggle.checked });
  };

  function render(rules) {
    rulesDiv.innerHTML = "";

    rules.slice(0, MAX_RULES).forEach((rule, index) => {
      renderRule(rule, index);
    });

    if (rules.length > MAX_RULES) {
      const more = document.createElement("button");
      more.textContent = "See more";
      more.onclick = () => {
        chrome.tabs.create({
          url: chrome.runtime.getURL("manager.html")
        });
      };
      rulesDiv.appendChild(more);
    }
  }

  function renderRule(rule, index) {
    const row = document.createElement("div");
    row.className = "rule";
    row.draggable = true;

    row.innerHTML = `
      <span class="drag">☰</span>
      <input class="prefix" value="${rule.prefix}">
      <input class="match" value="${rule.match}">
      <select class="type">
        <option value="keyword" ${rule.type === "keyword" ? "selected" : ""}>keyword</option>
        <option value="url" ${rule.type === "url" ? "selected" : ""}>url</option>
        <option value="extension" ${rule.type === "extension" ? "selected" : ""}>extension</option>
      </select>
      <input class="toggle" type="checkbox" ${rule.enabled ? "checked" : ""}>
      <button class="del">✕</button>
    `;

    row.querySelector(".prefix").onchange = e =>
      updateRule(index, { prefix: cleanPrefix(e.target.value) });

    row.querySelector(".match").onchange = e =>
      updateRule(index, { match: e.target.value.toLowerCase() });

    row.querySelector(".type").onchange = e =>
      updateRule(index, { type: e.target.value });

    row.querySelector(".toggle").onchange = e =>
      updateRule(index, { enabled: e.target.checked });

    row.querySelector(".del").onclick = () => deleteRule(index);

    row.ondragstart = e =>
      e.dataTransfer.setData("text/plain", index);

    row.ondragover = e => e.preventDefault();

    row.ondrop = e =>
      moveRule(+e.dataTransfer.getData("text/plain"), index);

    rulesDiv.appendChild(row);
  }

  function updateRule(index, patch) {
    chrome.storage.sync.get({ rules: [] }, data => {
      Object.assign(data.rules[index], patch);
      chrome.storage.sync.set({ rules: data.rules }, () => render(data.rules));
    });
  }

  function deleteRule(index) {
    chrome.storage.sync.get({ rules: [] }, data => {
      data.rules.splice(index, 1);
      chrome.storage.sync.set({ rules: data.rules }, () => render(data.rules));
    });
  }

  function moveRule(from, to) {
    chrome.storage.sync.get({ rules: [] }, data => {
      const [item] = data.rules.splice(from, 1);
      data.rules.splice(to, 0, item);
      chrome.storage.sync.set({ rules: data.rules }, () => render(data.rules));
    });
  }

  addBtn.onclick = () => {
    if (!newPrefix.value || !newMatch.value) return;

    chrome.storage.sync.get({ rules: [] }, data => {
      data.rules.unshift({
        id: crypto.randomUUID(),
        prefix: cleanPrefix(newPrefix.value),
        match: newMatch.value.toLowerCase(),
        type: newType.value,
        enabled: true
      });

      chrome.storage.sync.set({ rules: data.rules }, () => {
        newPrefix.value = "";
        newMatch.value = "";
        render(data.rules);
      });
    });
  };

  chrome.storage.sync.get({ rules: [] }, data => render(data.rules));
});
