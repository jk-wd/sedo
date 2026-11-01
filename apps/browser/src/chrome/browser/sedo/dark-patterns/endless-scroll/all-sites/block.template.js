// Page script for every http(s) document. Placeholder names are filled from
// selectors.json. The browser calls it with the start-page limit: (3).
((maxScrolls) => {
  if (globalThis.__sedoEndlessScroll) return;
  const defaultLimit = %%kDefaultLimit%%;
  const maxLimit = %%kMaxLimit%%;
  const nearEndScreens = %%kNearEndScreens%%;
  const minGrowthScreens = %%kMinGrowthScreens%%;
  const minScrollerHeight = %%kMinScrollerHeight%%;
  const loadWindowMs = %%kLoadWindowMs%%;
  const burstGapMs = %%kBurstGapMs%%;
  const loadCooldownMs = %%kLoadCooldownMs%%;
  const scrollIntentMs = %%kScrollIntentMs%%;
  const clickGraceMs = %%kClickGraceMs%%;
  const requestIntentMs = %%kRequestIntentMs%%;
  const requestGrowthMs = %%kRequestGrowthMs%%;
  const requestGrowthScreens = %%kRequestGrowthScreens%%;
  const counterLabel = %%kCounterLabel%%;
  const limitLabel = %%kLimitLabel%%;
  const fontFamily = %%kLabelFontFamily%%;
  const fontData = %%kLabelFont%%;
  const requested = Math.floor(Number(maxScrolls));
  const limit = Number.isFinite(requested)
    ? Math.min(maxLimit, Math.max(0, requested))
    : defaultLimit;
  globalThis.__sedoEndlessScroll = { pattern: %%pattern%%, site: %%site%%, limit };

  const now = () => performance.now();
  const scrollKeys = new Set(["ArrowDown", "PageDown", "End", " ", "Spacebar"]);
  // Scroller element -> the height before a load and when the user neared its end.
  const states = new Map();
  let page = location.origin + location.pathname;
  let count = 0;
  let capped = null;
  let lastIntent = -Infinity;
  let lastClick = -Infinity;
  let timer = 0;
  let host = null;
  let pill = null;
  let fontAdded = false;
  // method + origin + pathname -> the last query and body. The first sight of
  // a path is the baseline. A later request counts only when that changes.
  const seenRequests = new Map();
  let watch = null;
  let activeScroller = null;

  const css = [
    ":host{all:initial;display:block;position:fixed;left:50%;bottom:24px;transform:translateX(-50%);",
    "z-index:2147483647;pointer-events:none}",
    `.pill{display:flex;align-items:center;gap:12px;padding:10px 18px;border-radius:999px;`,
    `background:#141414;color:#fff;box-shadow:0 6px 24px rgba(0,0,0,.25);white-space:nowrap;`,
    `font-family:${JSON.stringify(fontFamily)},"Proxima Nova",system-ui,sans-serif;font-weight:700;`,
    "font-size:15px;line-height:1.2}",
    ".dots{display:flex;gap:5px}",
    ".dot{width:8px;height:8px;border-radius:50%;background:#5a5a5a}",
    ".dot.used{background:#46b571}",
    ".pill.limit .dot.used{background:#0da2e2}",
  ].join("");

  const addFont = () => {
    if (fontAdded) return;
    fontAdded = true;
    try {
      const bytes = Uint8Array.from(atob(fontData), (char) => char.charCodeAt(0));
      const face = new FontFace(fontFamily, bytes, { weight: "700" });
      document.fonts.add(face);
      face.load().catch(() => {});
    } catch (error) {
      // The counter falls back to the system font.
    }
  };

  const render = () => {
    addFont();
    if (!host) {
      host = document.createElement("sedo-endless-scroll-counter");
      const root = host.attachShadow({ mode: "open" });
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      root.adoptedStyleSheets = [sheet];
      pill = document.createElement("div");
      pill.setAttribute("role", "status");
      root.append(pill);
    }
    if (!host.isConnected && document.documentElement) document.documentElement.appendChild(host);
    pill.className = capped ? "pill limit" : "pill";
    const text = document.createElement("span");
    text.className = "label";
    text.textContent = capped ? limitLabel : `${counterLabel} ${count}`;
    const dots = document.createElement("span");
    dots.className = "dots";
    dots.setAttribute("aria-label", `${count} of ${limit}`);
    for (let index = 0; index < limit; index += 1) {
      const dot = document.createElement("span");
      dot.className = index < count ? "dot used" : "dot";
      dots.append(dot);
    }
    pill.replaceChildren(text, dots);
  };

  const docScroller = () => document.scrollingElement || document.documentElement;
  const scrollerOf = (target) =>
    target === document || target === document.documentElement || target === document.body
      ? docScroller()
      : target;

  const canScrollDown = (node) => {
    if (!(node instanceof Element)) return false;
    const overflow = getComputedStyle(node).overflowY;
    if (overflow !== "auto" && overflow !== "scroll" && overflow !== "overlay") return false;
    return node.scrollTop + node.clientHeight < node.scrollHeight - 1;
  };

  const clamp = () => {
    if (!capped) return;
    const { scroller, maxTop } = capped;
    if (scroller.scrollTop > maxTop + 1) scroller.scrollTo({ top: maxTop, behavior: "instant" });
  };

  // Past the limit, a wheel turn toward the end does nothing. A scroller
  // inside the feed, such as a dialog, keeps its own wheel.
  const onCappedWheel = (event) => {
    if (!capped || event.deltaY <= 0 || event.ctrlKey) return;
    const { scroller, maxTop } = capped;
    if (scroller.scrollTop < maxTop - 1) return;
    let inside = scroller === docScroller();
    for (const node of event.composedPath()) {
      if (node === scroller) {
        inside = true;
        break;
      }
      if (canScrollDown(node)) return;
    }
    if (inside) event.preventDefault();
  };

  const cap = (scroller, heightBefore) => {
    capped = { scroller, maxTop: Math.max(0, heightBefore - scroller.clientHeight) };
    addEventListener("wheel", onCappedWheel, { capture: true, passive: false });
    clamp();
    render();
  };

  const reset = () => {
    const current = location.origin + location.pathname;
    if (current === page) return;
    page = current;
    count = 0;
    capped = null;
    watch = null;
    activeScroller = null;
    states.clear();
    seenRequests.clear();
    removeEventListener("wheel", onCappedWheel, { capture: true });
    if (host) host.remove();
  };

  // One load is one scroll. The limit lets that many through; the next one
  // stops the feed where it ended before that load.
  const onLoad = (scroller, heightBefore) => {
    if (capped) return;
    if (count < limit) {
      count += 1;
      render();
      return;
    }
    cap(scroller, heightBefore);
  };

  const check = () => {
    timer = 0;
    reset();
    const t = now();
    let armed = false;
    // A repeated page request counts when the scroller then grows by a screen.
    // This runs before the near-end loop so that one jump is one load.
    if (watch) {
      const scroller = watch.scroller;
      if (!(scroller instanceof Element) || !scroller.isConnected || t - lastClick < clickGraceMs) {
        watch = null;
      } else {
        const growth = scroller.scrollHeight - watch.heightBefore;
        if (growth >= requestGrowthScreens * scroller.clientHeight) {
          const heightBefore = watch.heightBefore;
          const height = scroller.scrollHeight;
          watch = null;
          const state = states.get(scroller);
          if (state) {
            state.heightBefore = height;
            state.addedAt = 0;
            state.cooldownUntil = t + loadCooldownMs;
          }
          onLoad(scroller, heightBefore);
        } else if (t > watch.until) {
          watch = null;
        } else {
          armed = true;
        }
      }
    }
    for (const [scroller, state] of states) {
      if (!scroller.isConnected) {
        states.delete(scroller);
        continue;
      }
      if (t - state.nearEndAt > loadWindowMs) continue;
      armed = true;
      const height = scroller.scrollHeight;
      if (t < state.cooldownUntil) {
        state.heightBefore = height;
        continue;
      }
      const growth = height - state.heightBefore;
      if (growth < minGrowthScreens * scroller.clientHeight) {
        // A burst of new items has ended without adding a screen's worth.
        if (t - state.addedAt >= burstGapMs) {
          state.heightBefore = height;
          state.addedAt = 0;
        }
        continue;
      }
      // Growth without new feed items (images loading), or after a "load
      // more" click, is not endless scroll.
      if (!state.addedAt || t - lastClick < clickGraceMs) {
        state.heightBefore = height;
        state.addedAt = 0;
        continue;
      }
      const heightBefore = state.heightBefore;
      state.heightBefore = height;
      state.addedAt = 0;
      state.cooldownUntil = t + loadCooldownMs;
      if (watch && watch.scroller === scroller) watch = null;
      onLoad(scroller, heightBefore);
    }
    if (armed && !capped) timer = setTimeout(check, 150);
  };

  const schedule = () => {
    if (!timer && !capped) timer = setTimeout(check, 50);
  };

  const onScroll = (event) => {
    reset();
    const scroller = scrollerOf(event.target);
    if (!(scroller instanceof Element)) return;
    if (capped) {
      if (capped.scroller === scroller) clamp();
      return;
    }
    const age = now() - lastIntent;
    if (age > requestIntentMs) return;
    activeScroller = scroller;
    if (age > scrollIntentMs) return;
    const height = scroller.clientHeight;
    if (height < minScrollerHeight) return;
    const remaining = scroller.scrollHeight - scroller.scrollTop - height;
    if (remaining > nearEndScreens * height) return;
    let state = states.get(scroller);
    if (!state) {
      state = { heightBefore: scroller.scrollHeight, nearEndAt: -Infinity, addedAt: 0, cooldownUntil: 0 };
      states.set(scroller, state);
    }
    if (now() - state.nearEndAt > loadWindowMs) state.heightBefore = scroller.scrollHeight;
    state.nearEndAt = now();
    schedule();
  };

  // A feed adds items next to items of the same kind.
  const isFeedItem = (node) => {
    const previous = node.previousElementSibling;
    if (!previous || previous.localName !== node.localName) return false;
    return node.parentElement.childElementCount >= 4 || previous.className === node.className;
  };

  const observer = new MutationObserver((records) => {
    if (capped || !states.size) return;
    const t = now();
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE || node === host || !isFeedItem(node)) continue;
        for (const [scroller, state] of states) {
          if (t - state.nearEndAt > loadWindowMs) continue;
          if (scroller === docScroller() || scroller.contains(node)) state.addedAt = t;
        }
      }
    }
    schedule();
  });

  // The next page of a feed is the same pathname with a new query or body.
  // Images, scripts, styles, and fonts are not pages.
  const staticAsset = /\.(?:avif|css|gif|jpe?g|js|mjs|mp4|png|svg|ttf|webm|webp|woff2?)$/i;
  const skippedType = (type) => {
    const value = String(type || '').toLowerCase();
    return value.startsWith('image/') || value.startsWith('font/')
      || value.startsWith('audio/') || value.startsWith('video/')
      || value.startsWith('text/css') || value.includes('javascript');
  };
  const armWatch = () => {
    if (capped || now() - lastIntent > requestIntentMs || now() - lastClick < clickGraceMs) return;
    const scroller = activeScroller instanceof Element && activeScroller.isConnected
      ? activeScroller
      : docScroller();
    if (scroller.clientHeight < minScrollerHeight) return;
    if (watch && watch.scroller === scroller) {
      watch.until = now() + requestGrowthMs;
      schedule();
      return;
    }
    watch = {
      scroller,
      heightBefore: scroller.scrollHeight,
      until: now() + requestGrowthMs,
    };
    schedule();
  };
  const noteRequest = (method, rawUrl, body) => {
    let parsed;
    try {
      parsed = new URL(rawUrl, location.href);
    } catch (error) {
      return;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return;
    if (staticAsset.test(parsed.pathname)) return;
    const key = `${method}\n${parsed.origin}${parsed.pathname}`;
    const signature = `${parsed.search}\n${body || ''}`;
    const previous = seenRequests.get(key);
    seenRequests.set(key, signature);
    if (previous === undefined || previous === signature) return;
    armWatch();
  };
  const acceptResponse = (response, request) => {
    if (!response || !response.ok) return;
    let type = '';
    try {
      type = response.headers.get('content-type') || '';
    } catch (error) {
      return;
    }
    if (skippedType(type)) return;
    noteRequest(request.method, request.url, request.body);
  };
  const bodyText = (body) => {
    if (typeof body === 'string') return body;
    if (body instanceof URLSearchParams) return body.toString();
    return '';
  };
  const origFetch = globalThis.fetch;
  if (typeof origFetch === 'function') {
    globalThis.fetch = function (input, init) {
      const result = origFetch.apply(this, arguments);
      try {
        const url = typeof input === 'string' ? input
          : input instanceof URL ? input.href
          : input && input.url;
        if (url && result && typeof result.then === 'function') {
          const request = {
            method: String((init && init.method) || (input instanceof Request && input.method) || 'GET').toUpperCase(),
            url,
            body: bodyText(init && init.body),
          };
          result.then((response) => {
            try { acceptResponse(response, request); } catch (error) {}
          }, () => {});
        }
      } catch (error) {
        // A broken request still reaches the page.
      }
      return result;
    };
  }
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    try {
      this.__sedoEndlessMethod = String(method || 'GET').toUpperCase();
      this.__sedoEndlessUrl = String(url);
      if (!this.__sedoEndlessHooked) {
        this.__sedoEndlessHooked = true;
        this.addEventListener('load', () => {
          try {
            acceptResponse({
              ok: this.status >= 200 && this.status < 300,
              headers: { get: (name) => this.getResponseHeader(name) },
            }, {
              method: this.__sedoEndlessMethod,
              url: this.__sedoEndlessUrl,
              body: this.__sedoEndlessBody || '',
            });
          } catch (error) {}
        });
      }
    } catch (error) {}
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    try { this.__sedoEndlessBody = bodyText(body); } catch (error) {}
    return origSend.apply(this, arguments);
  };

  const intent = () => {
    lastIntent = now();
  };
  addEventListener("wheel", (event) => {
    if (event.deltaY > 0) intent();
  }, { capture: true, passive: true });
  addEventListener("touchmove", intent, { capture: true, passive: true });
  addEventListener("pointerdown", intent, { capture: true, passive: true });
  addEventListener("keydown", (event) => {
    if (scrollKeys.has(event.key)) intent();
  }, { capture: true, passive: true });
  addEventListener("click", () => {
    lastClick = now();
  }, { capture: true, passive: true });
  document.addEventListener("scroll", onScroll, { capture: true, passive: true });
  if (globalThis.navigation && navigation.addEventListener) {
    navigation.addEventListener("navigatesuccess", reset);
  }
  addEventListener("popstate", reset);
  observer.observe(document, { childList: true, subtree: true });
})
