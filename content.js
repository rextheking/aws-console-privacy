/**
 * AWS Console Privacy Mask - content script
 *
 * Masks sensitive AWS identifiers so they can be safely shown on a shared
 * screen. Designed to be zero-config: it detects what to hide automatically.
 *
 * Detection strategy:
 *   1. PATTERNS (no input needed):
 *        - 12-digit AWS account IDs, raw or dashed (123456789012 / 1234-5678-9012)
 *        - Full ARNs (arn:aws:service::account:resource...)
 *   2. AUTO-LEARN (no input needed):
 *        - AWS renders sensitive values next to fixed labels in the account
 *          menu ("Account name", "Federated user", "Account ID", "IAM user",
 *          "Assumed role", "User name"). We read the value beside each label,
 *          remember it, and then mask that value everywhere it appears on the
 *          page (e.g. the top-nav account tab).
 *   3. CUSTOM TERMS (optional fallback):
 *        - Anything the user types in the popup, for edge cases.
 *
 * Masking only touches text nodes, so layout is preserved. Originals are
 * stashed per-node so toggling off restores instantly.
 */

(() => {
  "use strict";

  const STASH = "__awsPrivacyOriginal";
  const MASK_CHAR = "*";

  let settings = {
    enabled: true,
    maskAccountId: true,
    maskArns: true,
    autoLearn: true,
    customTerms: [],
  };

  // Values discovered from labels at runtime (account name, federated user...).
  const learnedTerms = new Set();

  // Labels whose adjacent value we should learn and hide.
  const SENSITIVE_LABELS = [
    "account name",
    "account id",
    "federated user",
    "iam user",
    "assumed role",
    "user name",
    "username",
    "role",
  ];

  // --- Pattern helpers -----------------------------------------------------

  const ACCOUNT_ID_RE = /\b(?:\d{4}-\d{4}-\d{4}|\d{12})\b/g;
  const ARN_RE = /\barn:[a-z0-9-]*:[a-z0-9-]*:[a-z0-9-]*:[0-9]*:[^\s"'<>]+/gi;

  function maskLength(len) {
    return MASK_CHAR.repeat(Math.max(len, 1));
  }

  function maskPreservingDashes(match) {
    return match.replace(/[^-]/g, MASK_CHAR);
  }

  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function allCustomTerms() {
    // Learned + user-supplied, deduped.
    const set = new Set(learnedTerms);
    for (const t of settings.customTerms) {
      const v = (t || "").trim();
      if (v) set.add(v);
    }
    return [...set];
  }

  function buildTermsRegex(terms) {
    const cleaned = terms
      .map((t) => (t || "").trim())
      .filter((t) => t.length >= 2) // avoid masking single chars
      .map(escapeRegExp)
      .sort((a, b) => b.length - a.length);
    if (cleaned.length === 0) return null;
    return new RegExp(cleaned.join("|"), "g");
  }

  // --- Auto-learning from labels ------------------------------------------

  function isPlausibleValue(text) {
    if (!text) return false;
    const v = text.trim();
    if (v.length < 2 || v.length > 120) return false;
    // Don't learn a value that's itself just a label word.
    if (SENSITIVE_LABELS.includes(v.toLowerCase())) return false;
    // Ignore obvious UI noise.
    if (/^(purple|blue|green|orange|red|copy|copied)$/i.test(v)) return false;
    return true;
  }

  // Given a label element, find the value text associated with it.
  function extractValueForLabel(labelEl) {
    const labelText = labelEl.textContent.trim().toLowerCase();

    // Look within the label's container and the next sibling container.
    const candidates = [];
    if (labelEl.parentElement) candidates.push(labelEl.parentElement);
    if (labelEl.nextElementSibling) candidates.push(labelEl.nextElementSibling);
    if (labelEl.parentElement && labelEl.parentElement.nextElementSibling) {
      candidates.push(labelEl.parentElement.nextElementSibling);
    }

    for (const container of candidates) {
      // Collect visible text minus the label itself.
      let text = container.textContent || "";
      // Remove the label phrase from the front if present.
      const re = new RegExp("^\\s*" + escapeRegExp(labelEl.textContent.trim()), "i");
      text = text.replace(re, "").trim();
      // Take first line only.
      text = text.split("\n")[0].trim();
      if (text && text.toLowerCase() !== labelText && isPlausibleValue(text)) {
        return text;
      }
    }
    return null;
  }

  function learnFromLabels(root) {
    if (!settings.autoLearn) return;
    const scope = root && root.querySelectorAll ? root : document.body;
    // Any small element could be a label; scan common ones.
    const els = scope.querySelectorAll("label, dt, span, div, p, strong, b, th");
    let learnedSomething = false;

    for (const el of els) {
      // A label element should have short text equal to a known label.
      const txt = (el.textContent || "").trim().toLowerCase();
      if (txt.length > 20) continue;
      if (!SENSITIVE_LABELS.includes(txt)) continue;

      const value = extractValueForLabel(el);
      if (value && !learnedTerms.has(value)) {
        // Skip values that are already covered by account-id/arn regex.
        if (ACCOUNT_ID_RE.test(value)) {
          ACCOUNT_ID_RE.lastIndex = 0;
          continue;
        }
        ACCOUNT_ID_RE.lastIndex = 0;
        learnedTerms.add(value);
        learnedSomething = true;
      }
    }
    return learnedSomething;
  }

  // --- Core text transformation -------------------------------------------

  function maskText(text) {
    let out = text;
    if (settings.maskArns) {
      out = out.replace(ARN_RE, (m) => maskLength(m.length));
    }
    if (settings.maskAccountId) {
      out = out.replace(ACCOUNT_ID_RE, maskPreservingDashes);
    }
    const termsRe = buildTermsRegex(allCustomTerms());
    if (termsRe) {
      out = out.replace(termsRe, (m) => maskLength(m.length));
    }
    return out;
  }

  const SKIP_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "TEXTAREA",
    "INPUT",
    "SELECT",
    "OPTION",
  ]);

  function shouldSkipParent(node) {
    const el = node.parentElement;
    if (!el) return true;
    if (SKIP_TAGS.has(el.tagName)) return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function processTextNode(node) {
    if (shouldSkipParent(node)) return;
    const original = node.nodeValue;
    if (!original || !original.trim()) return;

    const masked = maskText(original);
    if (masked !== original) {
      if (node[STASH] === undefined) node[STASH] = original;
      node.nodeValue = masked;
    }
  }

  function walk(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(processTextNode);
  }

  function restoreAll() {
    if (!document.body) return;
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );
    let n;
    while ((n = walker.nextNode())) {
      if (n[STASH] !== undefined) {
        n.nodeValue = n[STASH];
        delete n[STASH];
      }
    }
  }

  // --- Observation ---------------------------------------------------------

  let observer = null;
  let pending = false;

  function scheduleScan() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      if (!settings.enabled) return;
      learnFromLabels(document.body);
      walk(document.body);
    });
  }

  function startObserver() {
    if (observer) return;
    observer = new MutationObserver((mutations) => {
      if (!settings.enabled) return;
      for (const m of mutations) {
        if (
          (m.type === "childList" && m.addedNodes.length) ||
          m.type === "characterData"
        ) {
          scheduleScan();
          return;
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  // --- Apply / lifecycle ---------------------------------------------------

  function applyState() {
    if (settings.enabled) {
      learnFromLabels(document.body);
      walk(document.body);
      startObserver();
    } else {
      stopObserver();
      restoreAll();
    }
  }

  function reapplyFromScratch() {
    stopObserver();
    restoreAll();
    applyState();
  }

  function loadSettings() {
    chrome.storage.sync.get(settings, (stored) => {
      settings = { ...settings, ...stored };
      applyState();
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    let changed = false;
    for (const key of Object.keys(changes)) {
      if (key in settings) {
        settings[key] = changes[key].newValue;
        changed = true;
      }
    }
    if (changed) reapplyFromScratch();
  });

  loadSettings();
})();
