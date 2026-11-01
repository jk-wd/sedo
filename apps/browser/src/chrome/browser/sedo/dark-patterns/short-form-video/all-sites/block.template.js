// Page script for every http(s) document. Placeholder names are filled from selectors.json.
(() => {
  if (globalThis.__sedoShortFormVideo) return;
  const maxDuration = %%kMaxDurationSeconds%%;
  const minPortraitRatio = %%kMinPortraitRatio%%;
  const label = %%kBlockedLabel%%;
  const fontFamily = %%kLabelFontFamily%%;
  const fontData = %%kLabelFont%%;
  globalThis.__sedoShortFormVideo = { pattern: %%pattern%%, site: %%site%% };

  const attachShadow = Element.prototype.attachShadow;
  const mediaEvents = ["loadedmetadata", "durationchange", "resize", "play", "playing"];
  const watched = new WeakSet();
  const scannedRoots = new WeakSet();
  const blocked = new Map();
  let shield = null;
  let layer = null;
  let frame = 0;
  let fontAdded = false;

  // A page stylesheet or CSP cannot reach a constructed sheet in this shadow root.
  const css = [
    ":host{all:initial;display:block;position:fixed;inset:0;pointer-events:none;z-index:2147483647}",
    ".box{position:fixed;box-sizing:border-box;display:none;align-items:center;justify-content:center;",
    "padding:16px;background:#000;color:#fff;pointer-events:auto;overflow:hidden;container-type:size}",
    `.label{font-family:${JSON.stringify(fontFamily)},"Proxima Nova",system-ui,sans-serif;font-weight:700;`,
    "font-size:clamp(13px,9cqmin,22px);line-height:1.2;text-align:center;text-wrap:balance}",
  ].join("");

  const isVideo = (node) =>
    node.localName === "video" && node.namespaceURI === "http://www.w3.org/1999/xhtml";

  // "block" for a portrait clip of at most maxDuration seconds. Camera and
  // screen streams, live streams, and audio-only media are kept. "unknown"
  // until the size and length are loaded.
  const classify = (video) => {
    if (video.srcObject) return "keep";
    if (video.readyState < 1) return "unknown";
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return "keep";
    const duration = video.duration;
    if (Number.isNaN(duration)) return "unknown";
    if (!Number.isFinite(duration) || duration <= 0) return "keep";
    return height / width >= minPortraitRatio && duration <= maxDuration ? "block" : "keep";
  };

  const addFont = () => {
    if (fontAdded) return;
    fontAdded = true;
    try {
      const bytes = Uint8Array.from(atob(fontData), (char) => char.charCodeAt(0));
      const face = new FontFace(fontFamily, bytes, { weight: "700" });
      document.fonts.add(face);
      face.load().catch(() => {});
    } catch (error) {
      // The label falls back to the system font.
    }
  };

  const ensureShield = () => {
    if (!shield) {
      shield = document.createElement("sedo-short-form-shield");
      layer = attachShadow.call(shield, { mode: "open" });
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      layer.adoptedStyleSheets = [sheet];
    }
    if (!shield.isConnected && document.documentElement) {
      document.documentElement.appendChild(shield);
    }
  };

  const parentOf = (node) =>
    node.parentElement || (node.parentNode instanceof ShadowRoot ? node.parentNode.host : null);

  // The part of the video on screen, cut by every scrolling or clipping ancestor.
  const visibleRect = (video) => {
    const rect = video.getBoundingClientRect();
    let left = rect.left;
    let top = rect.top;
    let right = rect.right;
    let bottom = rect.bottom;
    for (
      let node = parentOf(video);
      node && node !== document.body && node !== document.documentElement;
      node = parentOf(node)
    ) {
      const style = getComputedStyle(node);
      const clipX = style.overflowX !== "visible";
      const clipY = style.overflowY !== "visible";
      if (clipX || clipY) {
        const box = node.getBoundingClientRect();
        if (clipX) {
          left = Math.max(left, box.left);
          right = Math.min(right, box.right);
        }
        if (clipY) {
          top = Math.max(top, box.top);
          bottom = Math.min(bottom, box.bottom);
        }
      }
      if (style.position === "fixed") break;
    }
    left = Math.max(left, 0);
    top = Math.max(top, 0);
    right = Math.min(right, innerWidth);
    bottom = Math.min(bottom, innerHeight);
    return { left, top, width: right - left, height: bottom - top };
  };

  const place = () => {
    frame = 0;
    for (const [video, entry] of blocked) {
      if (!video.isConnected) {
        release(video);
        continue;
      }
      const shown = video.checkVisibility ? video.checkVisibility({ opacityProperty: true }) : true;
      const rect = shown ? visibleRect(video) : null;
      const placed =
        rect && rect.width > 0 && rect.height > 0
          ? `${rect.left},${rect.top},${rect.width},${rect.height}`
          : "";
      if (placed === entry.placed) continue;
      entry.placed = placed;
      const style = entry.box.style;
      if (!placed) {
        style.display = "none";
        continue;
      }
      style.display = "flex";
      style.left = `${rect.left}px`;
      style.top = `${rect.top}px`;
      style.width = `${rect.width}px`;
      style.height = `${rect.height}px`;
    }
    if (blocked.size) ensureShield();
    schedule();
  };

  const schedule = () => {
    if (!frame && blocked.size) frame = requestAnimationFrame(place);
  };

  const block = (video) => {
    if (!video.paused) video.pause();
    if (blocked.has(video)) return;
    addFont();
    ensureShield();
    const box = document.createElement("div");
    box.className = "box";
    const text = document.createElement("span");
    text.className = "label";
    text.textContent = label;
    box.append(text);
    layer.append(box);
    blocked.set(video, {
      box,
      placed: "",
      visibility: video.style.getPropertyValue("visibility"),
      priority: video.style.getPropertyPriority("visibility"),
    });
    video.style.setProperty("visibility", "hidden", "important");
    video.setAttribute("data-sedo-short-form", "blocked");
    schedule();
  };

  const release = (video) => {
    const entry = blocked.get(video);
    if (!entry) return;
    blocked.delete(video);
    entry.box.remove();
    if (entry.visibility) video.style.setProperty("visibility", entry.visibility, entry.priority);
    else video.style.removeProperty("visibility");
    video.removeAttribute("data-sedo-short-form");
  };

  // A player that swaps the source keeps its state until the new size and
  // length are known.
  const evaluate = (video) => {
    const verdict = classify(video);
    if (verdict === "block") block(video);
    else if (verdict === "keep") release(video);
  };

  const track = (video) => {
    if (!watched.has(video)) {
      watched.add(video);
      for (const type of mediaEvents) video.addEventListener(type, () => evaluate(video));
    }
    evaluate(video);
  };

  const scan = (node) => {
    if (isVideo(node)) {
      track(node);
      return;
    }
    if (!node.querySelectorAll) return;
    for (const video of node.querySelectorAll("video")) track(video);
  };

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) scan(node);
    }
  });
  const observe = (root) => observer.observe(root, { childList: true, subtree: true });

  // Shadow roots from parsed HTML are not created through attachShadow.
  const deepScan = (root) => {
    scan(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const shadow = node.shadowRoot;
      if (shadow && shadow !== layer && !scannedRoots.has(shadow)) {
        scannedRoots.add(shadow);
        observe(shadow);
        deepScan(shadow);
      }
    }
  };

  Element.prototype.attachShadow = function (init) {
    const root = attachShadow.call(this, init);
    scannedRoots.add(root);
    observe(root);
    return root;
  };

  observe(document);
  scan(document);
  document.addEventListener("DOMContentLoaded", () => deepScan(document), { once: true });
})();
