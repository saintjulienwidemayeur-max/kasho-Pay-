// Lightweight English/French switch.
// The UI is written in English; when French is selected, every visible text is translated at runtime from the
// dictionary in ./fr.ts (text nodes + placeholder / title / aria-label / alt attributes + toasts + page title).
import { useEffect, useState } from "react";
import { FR, MONTHS_FR, PATTERNS } from "./fr";

export type Lang = "en" | "fr";
const KEY = "kasho-lang";
const listeners = new Set<(l: Lang) => void>();

export function getLang(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "fr" || v === "en") return v;
  } catch { /* storage unavailable */ }
  return typeof navigator !== "undefined" && /^fr/i.test(navigator.language) ? "fr" : "en";
}

export function setLang(l: Lang) {
  try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
  listeners.forEach((fn) => fn(l));
}

export function useLang(): Lang {
  const [l, setL] = useState<Lang>("en"); // "en" on first render keeps SSR and hydration identical
  useEffect(() => {
    setL(getLang());
    listeners.add(setL);
    return () => void listeners.delete(setL);
  }, []);
  return l;
}

const norm = (s: string) => s.replace(/[’‘]/g, "'").replace(/ /g, " ");
const DATE_RE = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2})(.*)$/;
const missing = new Set<string>();
const debug = () => typeof location !== "undefined" && /[?&]i18n-debug=1/.test(location.search);

/** French text for an English UI string, or null when there is nothing to change. */
export function toFrench(text: string): string | null {
  const lead = /^\s*/.exec(text)![0];
  const trail = /\s*$/.exec(text)![0];
  const core = norm(text.trim());
  if (!core || !/[A-Za-z]/.test(core)) return null;
  const wrap = (r: string) => lead + r + trail;

  let hit = FR[core];
  if (hit !== undefined) return wrap(hit);

  // "Page title | Kasho Pay"
  const bar = core.lastIndexOf(" | ");
  if (bar > 0) {
    const head = FR[core.slice(0, bar)];
    if (head) return wrap(`${head}${core.slice(bar)}`);
  }
  for (const [re, rep] of PATTERNS) {
    const m = re.exec(core);
    if (m) {
      // Parts captured from the app (names, amounts) can themselves be translatable ("Pending", "Today"...).
      return wrap(rep.replace(/\$(\d)/g, (_, n) => {
        const part = m[Number(n)] ?? "";
        return FR[part] ?? part;
      }));
    }
  }
  const d = DATE_RE.exec(core);
  if (d) {
    const rest = d[3]!.replace(/\b(AM|PM)\b/g, (x) => x.toLowerCase() === "am" ? "AM" : "PM");
    return wrap(`${d[2]} ${MONTHS_FR[d[1]!]}${rest}`);
  }
  // Strings like "Savings · Pending": translate each " · " part.
  if (core.includes(" · ")) {
    const parts = core.split(" · ");
    const out = parts.map((p) => FR[p] ?? p);
    if (out.some((p, i) => p !== parts[i])) return wrap(out.join(" · "));
  }
  if (debug() && !missing.has(core) && /[a-z]{3}/.test(core) && !/^[\w.+-]+@[\w.-]+$/.test(core)) {
    missing.add(core);
    console.info("[i18n] untranslated:", core);
  }
  return null;
}

// React puts a "__reactFiber$..." property on every DOM element it has hydrated or created. Server-rendered elements
// that React has not reached yet (selective hydration of Suspense boundaries) do not have it, and changing their text
// before React compares it with the client render is what caused "Hydration failed" in French.
const hydrated = new WeakSet<Element>();
function isHydrated(el: Element | null): boolean {
  if (!el) return false;
  if (hydrated.has(el)) return true;
  for (const k in el) {
    if (k.startsWith("__reactFiber$")) { hydrated.add(el); return true; }
  }
  return false;
}

const ATTRS = ["placeholder", "title", "aria-label", "alt"] as const;
const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE"]);

/** Mount once at the root. Translates the whole document while French is active and restores English otherwise. */
export function I18nRuntime() {
  const lang = useLang();

  useEffect(() => {
    document.documentElement.lang = lang;
    const origText = new WeakMap<Node, { en: string; shown: string }>();
    const origAttr = new WeakMap<Element, Record<string, { en: string; shown: string }>>();
    const touched = new Set<Node>();
    let deferred = false; // some nodes were skipped because React has not hydrated them yet

    const doText = (n: Node) => {
      const parent = n.parentElement;
      if (!parent || SKIP.has(parent.tagName) || parent.closest("[data-no-i18n]")) return;
      if (!isHydrated(parent)) { deferred = true; return; }
      const cur = n.nodeValue ?? "";
      const rec = origText.get(n);
      // If React wrote a new value, that value is the new English original.
      const en = rec && rec.shown === cur ? rec.en : cur;
      const fr = toFrench(en);
      if (fr !== null && fr !== cur) {
        origText.set(n, { en, shown: fr });
        touched.add(n);
        n.nodeValue = fr;
      } else if (fr === null && rec && rec.shown !== cur) {
        origText.delete(n);
      }
    };
    const doAttrs = (el: Element) => {
      if (el.closest("[data-no-i18n]")) return;
      if (!isHydrated(el)) { deferred = true; return; }
      for (const a of ATTRS) {
        const cur = el.getAttribute(a);
        if (!cur) continue;
        const map = origAttr.get(el) ?? {};
        const rec = map[a];
        const en = rec && rec.shown === cur ? rec.en : cur;
        const fr = toFrench(en);
        if (fr !== null && fr !== cur) {
          map[a] = { en, shown: fr };
          origAttr.set(el, map);
          touched.add(el);
          el.setAttribute(a, fr);
        }
      }
    };
    const walk = (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) return doText(root);
      if (root.nodeType !== Node.ELEMENT_NODE) return;
      const el = root as Element;
      doAttrs(el);
      const w = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      let n: Node | null = w.nextNode();
      while (n) {
        if (n.nodeType === Node.TEXT_NODE) doText(n);
        else doAttrs(n as Element);
        n = w.nextNode();
      }
    };

    if (lang !== "fr") return;

    // Translate only after the page has hydrated: retry while React is still hydrating (max ~10 s).
    let retry: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();
    const pass = () => {
      deferred = false;
      obs.disconnect();
      walk(document.documentElement);
      attach();
      if (deferred && Date.now() - started < 10_000) retry = setTimeout(pass, 80);
    };
    const obs = new MutationObserver((muts) => {
      obs.disconnect();
      for (const m of muts) {
        if (m.type === "characterData") doText(m.target);
        else if (m.type === "attributes") doAttrs(m.target as Element);
        else m.addedNodes.forEach((n) => walk(n));
      }
      attach();
    });
    const attach = () => obs.observe(document.documentElement, {
      childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [...ATTRS],
    });
    retry = setTimeout(pass, 0);
    attach();

    return () => {
      clearTimeout(retry);
      obs.disconnect();
      // Back to English: restore every node we changed.
      touched.forEach((n) => {
        if (n.nodeType === Node.TEXT_NODE) {
          const r = origText.get(n);
          if (r && n.nodeValue === r.shown) n.nodeValue = r.en;
        } else {
          const el = n as Element;
          const map = origAttr.get(el);
          if (map) for (const [a, r] of Object.entries(map)) if (el.getAttribute(a) === r.shown) el.setAttribute(a, r.en);
        }
      });
    };
  }, [lang]);

  return null;
}

/** Small EN / FR switch. */
export function LanguageSwitch({ className = "" }: { className?: string }) {
  const lang = useLang();
  return (
    <div data-no-i18n className={`inline-flex overflow-hidden rounded-full border border-border text-xs font-semibold ${className}`} role="group" aria-label="Language">
      {(["en", "fr"] as const).map((l) => (
        <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l}
          className={`px-2.5 py-1 uppercase transition ${lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
          {l}
        </button>
      ))}
    </div>
  );
}
