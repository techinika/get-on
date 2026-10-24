(function () {
  try {
    var script = document.currentScript as HTMLScriptElement | null;
    if (!script) return;
    var gaId = script.getAttribute("data-ga") || "";
    var consentMode = script.getAttribute("data-consent") || "ask";
    if (!gaId) return;

    var key = "gs_consent_v1";
    var storage = null;
    try {
      storage = window.localStorage;
    } catch (e) {}

    function readDecision() {
      if (!storage) return null;
      try {
        var raw = storage.getItem(key);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.t !== "number") return null;
        var age = Date.now() - parsed.t;
        if (age > 1000 * 60 * 60 * 24 * 365) return null;
        return parsed;
      } catch (e) {
        return null;
      }
    }

    function writeDecision(dec) {
      if (!storage) return;
      try {
        storage.setItem(key, JSON.stringify(dec));
      } catch (e) {}
    }

    var decision = readDecision();
    var gpc = !!(navigator as any).globalPrivacyControl;
    if (gpc) {
      return;
    }

    if (consentMode === "always") {
      loadGa();
      return;
    }

    if (decision && typeof decision.ga === "boolean") {
      if (decision.ga) loadGa();
      return;
    }

    showBanner();
  } catch (e) {}

  function loadGa() {
    try {
      (window as any).dataLayer = (window as any).dataLayer || [];
      function gtag() {
        ((window as any).dataLayer).push(arguments);
      }
      (window as any).gtag = gtag;
      gtag("js", new Date());
      var scriptEl = document.createElement("script");
      scriptEl.async = true;
      scriptEl.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent((document.currentScript as any)?.getAttribute("data-ga") || "");
      document.head.appendChild(scriptEl);
      gtag("config", (document.currentScript as any)?.getAttribute("data-ga") || "");
    } catch (e) {}
  }

  function showBanner() {
    try {
      var banner = document.querySelector(".gs-consent") as HTMLElement | null;
      if (!banner) return;
      banner.hidden = false;
      var accept = banner.querySelector(".gs-consent-accept") as HTMLElement | null;
      var decline = banner.querySelector(".gs-consent-decline") as HTMLElement | null;
      var link = document.querySelector(".gs-cookie-link") as HTMLElement | null;
      if (accept) {
        accept.onclick = function () {
          writeDecision({ ga: true, t: Date.now() });
          banner.hidden = true;
          loadGa();
        };
      }
      if (decline) {
        decline.onclick = function () {
          writeDecision({ ga: false, t: Date.now() });
          banner.hidden = true;
        };
      }
      if (link) {
        link.onclick = function (e) {
          e.preventDefault();
          banner.hidden = false;
        };
      }
    } catch (e) {}
  }
})();
