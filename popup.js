/* Popup logic: load settings, reflect them in the UI, persist changes. */

const DEFAULTS = {
  enabled: true,
  maskAccountId: true,
  maskArns: true,
  autoLearn: true,
  customTerms: [],
};

const els = {
  enabled: document.getElementById("enabled"),
  maskAccountId: document.getElementById("maskAccountId"),
  maskArns: document.getElementById("maskArns"),
  autoLearn: document.getElementById("autoLearn"),
  customTerms: document.getElementById("customTerms"),
  save: document.getElementById("save"),
  status: document.getElementById("status"),
};

function load() {
  chrome.storage.sync.get(DEFAULTS, (s) => {
    els.enabled.checked = s.enabled;
    els.maskAccountId.checked = s.maskAccountId;
    els.maskArns.checked = s.maskArns;
    els.autoLearn.checked = s.autoLearn;
    els.customTerms.value = (s.customTerms || []).join("\n");
  });
}

function flash(msg) {
  els.status.textContent = msg;
  setTimeout(() => (els.status.textContent = ""), 1500);
}

// Toggles persist immediately.
["enabled", "maskAccountId", "maskArns", "autoLearn"].forEach((key) => {
  els[key].addEventListener("change", () => {
    chrome.storage.sync.set({ [key]: els[key].checked });
  });
});

// Custom terms save on button click.
els.save.addEventListener("click", () => {
  const terms = els.customTerms.value
    .split("\n")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  chrome.storage.sync.set({ customTerms: terms }, () => flash("Saved"));
});

load();
