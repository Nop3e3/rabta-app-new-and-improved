// Runtime auto-translator.
//
// When the app is in Arabic, this module walks the DOM, finds English
// text nodes (including text rendered from Supabase data) and replaces
// them with Arabic. Translations come from:
//   1. The static dictionary (passed in)
//   2. localStorage cache of previously-translated phrases
//   3. The MyMemory free translation API (https://mymemory.translated.net/doc/spec.php)
//
// Original English text is stored on the text node itself so we can
// restore it when the user switches back to English.
//
// Inputs (placeholders, values) and form fields are also handled.

const CACHE_KEY = "rabta.translation_cache.v1";
const ENDPOINT = "https://api.mymemory.translated.net/get";

// Tags whose text should NEVER be translated.
const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "CODE",
  "PRE",
  "SVG",
  "PATH",
  "CIRCLE",
  "RECT",
  "LINE",
  "POLYLINE",
  "POLYGON",
  "G",
  "DEFS",
  "FILTER",
]);

// Attribute names whose values should be translated when present.
const TRANSLATABLE_ATTRS = ["placeholder", "title", "alt", "aria-label"];

let cache = {};
let pending = new Map(); // text -> Promise<string>
let observer = null;
let started = false;
let dictRef = {};

// ---- Cache ----

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    cache = raw ? JSON.parse(raw) : {};
  } catch {
    cache = {};
  }
}

let saveTimer = null;
function persistCache() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {}
  }, 250);
}

// ---- Helpers ----

function isPureArabic(s) {
  // If the string is already mostly Arabic, leave it alone.
  if (!s) return false;
  const arabic = s.match(/[؀-ۿ]/g);
  return arabic && arabic.length / s.length > 0.4;
}

function shouldTranslate(text) {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  // Skip pure numbers, punctuation, very short symbols
  if (/^[\d\s.,:;!?\-_/\\()*+%#@$^&]+$/.test(trimmed)) return false;
  // Already Arabic
  if (isPureArabic(trimmed)) return false;
  // Skip URLs / emails
  if (/^https?:\/\//i.test(trimmed)) return false;
  if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(trimmed)) return false;
  return true;
}

function lookupStatic(text) {
  if (!text) return null;
  if (Object.prototype.hasOwnProperty.call(dictRef, text)) return dictRef[text];
  const trimmed = text.trim();
  if (trimmed && Object.prototype.hasOwnProperty.call(dictRef, trimmed)) {
    // Preserve original whitespace around the translated trimmed text
    const lead = text.match(/^\s*/)[0];
    const trail = text.match(/\s*$/)[0];
    return lead + dictRef[trimmed] + trail;
  }
  return null;
}

// ---- Remote translation ----

async function fetchTranslation(text) {
  const trimmed = text.trim();
  if (!trimmed) return text;

  // Static dictionary first
  const stat = lookupStatic(trimmed);
  if (stat != null) return stat;

  // Cache
  if (Object.prototype.hasOwnProperty.call(cache, trimmed)) {
    return cache[trimmed];
  }

  // De-dupe in-flight requests
  if (pending.has(trimmed)) return pending.get(trimmed);

  const url =
    ENDPOINT +
    "?q=" +
    encodeURIComponent(trimmed) +
    "&langpair=en|ar";

  const p = fetch(url)
    .then((r) => r.json())
    .then((data) => {
      const out =
        (data && data.responseData && data.responseData.translatedText) ||
        trimmed;
      // MyMemory sometimes echoes the input on failure or returns markers
      if (typeof out === "string" && out.length > 0) {
        cache[trimmed] = out;
        persistCache();
        return out;
      }
      return trimmed;
    })
    .catch(() => trimmed)
    .finally(() => {
      pending.delete(trimmed);
    });

  pending.set(trimmed, p);
  return p;
}

// ---- DOM walking ----

function isUnderSkippedTag(node) {
  let p = node.parentNode;
  while (p && p !== document.body) {
    if (p.nodeType === 1 && SKIP_TAGS.has(p.tagName)) return true;
    if (p.nodeType === 1 && p.dataset && p.dataset.noTranslate === "true") {
      return true;
    }
    p = p.parentNode;
  }
  return false;
}

function collectTextNodes(root) {
  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      if (isUnderSkippedTag(n)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let cur;
  while ((cur = walker.nextNode())) nodes.push(cur);
  return nodes;
}

function collectAttrNodes(root) {
  const out = [];
  const els = root.nodeType === 1 ? [root, ...root.querySelectorAll("*")] : [];
  for (const el of els) {
    if (SKIP_TAGS.has(el.tagName)) continue;
    if (el.dataset && el.dataset.noTranslate === "true") continue;
    for (const attr of TRANSLATABLE_ATTRS) {
      const val = el.getAttribute && el.getAttribute(attr);
      if (val && shouldTranslate(val)) out.push({ el, attr, val });
    }
  }
  return out;
}

// ---- Apply / restore ----

async function translateTextNode(node) {
  const original = node.nodeValue;
  if (!shouldTranslate(original)) return;
  // Stash the original on the node for restoration
  if (node.__rabtaOriginal == null) {
    node.__rabtaOriginal = original;
  }
  const src = node.__rabtaOriginal;
  // Try static first (sync)
  const stat = lookupStatic(src);
  if (stat != null) {
    node.nodeValue = stat;
    return;
  }
  // Async API
  const translated = await fetchTranslation(src);
  // Make sure language hasn't switched back while we waited
  if (!started) return;
  if (translated && translated !== node.nodeValue) {
    node.nodeValue = translated;
  }
}

async function translateAttr(entry) {
  const { el, attr, val } = entry;
  if (!shouldTranslate(val)) return;
  const key = "__rabtaOriginalAttr_" + attr;
  if (el[key] == null) el[key] = val;
  const src = el[key];
  const stat = lookupStatic(src);
  if (stat != null) {
    el.setAttribute(attr, stat);
    return;
  }
  const translated = await fetchTranslation(src);
  if (!started) return;
  if (translated) el.setAttribute(attr, translated);
}

function translateRoot(root) {
  if (!root) return;
  if (root.nodeType === 3) {
    translateTextNode(root);
    return;
  }
  if (root.nodeType !== 1 && root.nodeType !== 9) return;

  const textNodes = collectTextNodes(root);
  for (const n of textNodes) translateTextNode(n);

  const attrEntries = collectAttrNodes(root);
  for (const e of attrEntries) translateAttr(e);
}

function restoreAll() {
  // Restore any node we previously modified.
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    if (n.__rabtaOriginal != null) {
      n.nodeValue = n.__rabtaOriginal;
    }
  }
  // Restore attributes
  const els = document.body.querySelectorAll("*");
  for (const el of els) {
    for (const attr of TRANSLATABLE_ATTRS) {
      const key = "__rabtaOriginalAttr_" + attr;
      if (el[key] != null) {
        el.setAttribute(attr, el[key]);
      }
    }
  }
}

// ---- Public API ----

export function startAutoTranslator(staticDictionary) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  dictRef = staticDictionary || {};
  loadCache();
  started = true;

  // Initial pass
  translateRoot(document.body);

  // Watch for new content (route changes, lazy loads, Supabase fetches, etc.)
  if (observer) observer.disconnect();
  observer = new MutationObserver((mutations) => {
    if (!started) return;
    for (const m of mutations) {
      if (m.type === "childList") {
        for (const node of m.addedNodes) {
          if (node.nodeType === 3 || node.nodeType === 1) {
            translateRoot(node);
          }
        }
      } else if (m.type === "characterData") {
        // Text changed. Re-run translation on this node.
        const node = m.target;
        if (node && node.nodeType === 3) {
          // Forget previous original because the source itself changed
          if (
            node.__rabtaOriginal != null &&
            !isPureArabic(node.nodeValue) &&
            node.nodeValue !== node.__rabtaOriginal
          ) {
            node.__rabtaOriginal = node.nodeValue;
          }
          translateTextNode(node);
        }
      } else if (m.type === "attributes") {
        const el = m.target;
        const attr = m.attributeName;
        if (TRANSLATABLE_ATTRS.includes(attr)) {
          translateAttr({
            el,
            attr,
            val: el.getAttribute(attr) || "",
          });
        }
      }
    }
  });

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: TRANSLATABLE_ATTRS,
  });
}

export function stopAutoTranslator() {
  started = false;
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (typeof document !== "undefined" && document.body) {
    restoreAll();
  }
}

export default { startAutoTranslator, stopAutoTranslator };
