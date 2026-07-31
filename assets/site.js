(() => {
  "use strict";

  const config = window.KRON_I18N;
  if (!config) {
    console.error("KRON translations failed to load.");
    return;
  }

  const { translations, languageNames, rtlLocales, defaultLocale } = config;
  const supportedLocales = Object.keys(translations);
  const storageKey = "kron-language";

  const normalizeLocale = (value) => {
    if (!value) return null;
    const normalized = String(value).trim().toLowerCase().replace("_", "-");
    if (supportedLocales.includes(normalized)) return normalized;
    const base = normalized.split("-")[0];
    return supportedLocales.includes(base) ? base : null;
  };

  const getInitialLocale = () => {
    const urlLocale = normalizeLocale(new URLSearchParams(window.location.search).get("lang"));
    if (urlLocale) return urlLocale;

    try {
      const storedLocale = normalizeLocale(window.localStorage.getItem(storageKey));
      if (storedLocale) return storedLocale;
    } catch {
      // Storage may be disabled. The site still works without persistence.
    }

    for (const candidate of navigator.languages || [navigator.language]) {
      const browserLocale = normalizeLocale(candidate);
      if (browserLocale) return browserLocale;
    }

    return defaultLocale;
  };

  const lookup = (locale, key) => {
    const localized = translations[locale]?.[key];
    if (typeof localized === "string") return localized;
    return translations[defaultLocale]?.[key] ?? key;
  };

  const updateUrl = (locale) => {
    const url = new URL(window.location.href);
    if (locale === defaultLocale) {
      url.searchParams.delete("lang");
    } else {
      url.searchParams.set("lang", locale);
    }
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const applyLocale = (locale, { updateHistory = true } = {}) => {
    const activeLocale = normalizeLocale(locale) || defaultLocale;
    const isRtl = rtlLocales.includes(activeLocale);

    document.documentElement.lang = activeLocale;
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
    document.body.dataset.locale = activeLocale;

    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const key = element.dataset.i18n;
      element.textContent = lookup(activeLocale, key);
    });

    document.querySelectorAll("[data-i18n-aria]").forEach((element) => {
      element.setAttribute("aria-label", lookup(activeLocale, element.dataset.i18nAria));
    });

    document.querySelectorAll("[data-i18n-title]").forEach((element) => {
      element.setAttribute("title", lookup(activeLocale, element.dataset.i18nTitle));
    });

    const titleKey = document.body.dataset.titleKey || "metaTitle";
    const descriptionKey = document.body.dataset.descriptionKey || "metaDescription";
    document.title = lookup(activeLocale, titleKey);

    const description = document.querySelector('meta[name="description"]');
    if (description) description.setAttribute("content", lookup(activeLocale, descriptionKey));

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", lookup(activeLocale, titleKey));

    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) ogDescription.setAttribute("content", lookup(activeLocale, descriptionKey));

    const languageSelect = document.getElementById("language-select");
    if (languageSelect) languageSelect.value = activeLocale;

    try {
      window.localStorage.setItem(storageKey, activeLocale);
    } catch {
      // Persistence is optional.
    }

    if (updateHistory) updateUrl(activeLocale);

    window.dispatchEvent(new CustomEvent("kron:languagechange", { detail: { locale: activeLocale } }));
  };

  const populateLanguageSelect = () => {
    const select = document.getElementById("language-select");
    if (!select) return;

    select.replaceChildren();
    supportedLocales.forEach((locale) => {
      const option = document.createElement("option");
      option.value = locale;
      option.textContent = languageNames[locale] || locale.toUpperCase();
      select.append(option);
    });

    select.addEventListener("change", (event) => applyLocale(event.target.value));
  };

  const initializeHeader = () => {
    const header = document.querySelector(".site-header");
    if (!header) return;

    const updateHeader = () => header.classList.toggle("is-scrolled", window.scrollY > 10);
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
  };

  const initializeReveal = () => {
    const items = [...document.querySelectorAll(".reveal")];
    if (!items.length) return;

    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      items.forEach((item) => item.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -9%", threshold: 0.12 }
    );

    items.forEach((item) => observer.observe(item));
  };

  const initializeFloatingStage = () => {
    const visual = document.querySelector(".hero-visual");
    const stage = document.querySelector(".floating-stage");
    if (!visual || !stage || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = null;
    const reset = () => {
      stage.style.setProperty("--rx", "0deg");
      stage.style.setProperty("--ry", "0deg");
    };

    visual.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") return;
      const bounds = visual.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;

      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        stage.style.setProperty("--rx", `${(-y * 4).toFixed(2)}deg`);
        stage.style.setProperty("--ry", `${(x * 6).toFixed(2)}deg`);
      });
    });

    visual.addEventListener("pointerleave", reset);
    visual.addEventListener("blur", reset, true);
  };

  const initializeYears = () => {
    document.querySelectorAll("[data-current-year]").forEach((element) => {
      element.textContent = String(new Date().getFullYear());
    });
  };

  const initializeExternalLinks = () => {
    document.querySelectorAll('a[href^="https://"]').forEach((link) => {
      const target = new URL(link.href).origin;
      if (target !== window.location.origin) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
    });
  };

  const validateTranslations = () => {
    if (!window.console || !translations[defaultLocale]) return;
    const requiredKeys = Object.keys(translations[defaultLocale]);
    supportedLocales.forEach((locale) => {
      const missing = requiredKeys.filter((key) => typeof translations[locale]?.[key] !== "string" || !translations[locale][key].trim());
      if (missing.length) console.warn(`[KRON i18n] ${locale} is missing:`, missing);
    });
  };

  populateLanguageSelect();
  applyLocale(getInitialLocale(), { updateHistory: false });
  initializeHeader();
  initializeReveal();
  initializeFloatingStage();
  initializeYears();
  initializeExternalLinks();
  validateTranslations();

  window.KRON_SITE = Object.freeze({ applyLocale, supportedLocales: [...supportedLocales] });
})();
