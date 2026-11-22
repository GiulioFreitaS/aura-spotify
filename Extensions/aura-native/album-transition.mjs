const CARD = [
  ".main-card-cardContainer",
  ".main-yourLibraryX-listItem",
  "[data-testid='card-container']",
  "div:has(> [data-testid='shortcut-background'])",
].join(",");
const CARD_ARTWORK = ".main-cardImage-image,.x-entityImage-imageContainer img,[data-testid='shortcut-image']";
const HEADER_ARTWORK = "[data-testid='album-page'] img.main-entityHeader-image";
const ALBUM_LINK = "a[href^='/album/'],a[href^='spotify:album:']";
const WAIT_FOR_COVER = 1250;

function albumPath(value) {
  const id = /^(?:\/album\/|spotify:album:)([a-z\d]{22})(?:$|[/?#-])/i.exec(value ?? "")?.[1];
  return id ? "/album/" + id : null;
}

function artworkFrame(element, panel) {
  if (!(element instanceof HTMLImageElement) || !panel?.contains(element) || !element.isConnected ||
      !element.complete || !element.naturalWidth) return null;
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const scrollArea = element.closest(".main-view-container__scroll-node,[data-overlayscrollbars-viewport]") ?? panel;
  const viewport = scrollArea.getBoundingClientRect();
  const style = getComputedStyle(element);
  if (rect.width < 24 || rect.height < 24 || style.visibility !== "visible" ||
      x < Math.max(0, viewport.left) || x > Math.min(innerWidth, viewport.right) ||
      y < Math.max(0, viewport.top) || y > Math.min(innerHeight, viewport.bottom)) return null;
  const artwork = element.currentSrc || element.src;
  const radius = style.borderRadius === "0px" ? "5px" : style.borderRadius;
  return { element, rect, artwork, radius };
}

function sameArtwork(left, right) {
  if (left === right) return true;
  // O CDN do Spotify usa variantes de tamanho para a mesma capa.
  const variant = /^https:\/\/i\.scdn\.co\/image\/[a-f\d]{16}([a-f\d]{24})(?:\?|$)/i;
  const identity = variant.exec(left)?.[1];
  return Boolean(identity && identity === variant.exec(right)?.[1]);
}

function restoredArtwork(panel, source) {
  if (panel.contains(source.element) && sameArtwork(source.artwork, source.element.currentSrc)) {
    const original = artworkFrame(source.element, panel);
    if (original) return original;
  }
  let nearest;
  let distance = Infinity;
  for (const image of panel.querySelectorAll(CARD_ARTWORK)) {
    if (!sameArtwork(source.artwork, image.currentSrc)) continue;
    const frame = artworkFrame(image, panel);
    if (!frame) continue;
    const delta = Math.abs(frame.rect.left - source.rect.left) + Math.abs(frame.rect.top - source.rect.top);
    if (delta < distance) {
      nearest = frame;
      distance = delta;
    }
  }
  return nearest;
}

export function createAlbumTransition({ motion, panels }) {
  let cue;
  let openAlbum;
  let cancelWait;
  let cancelMove;

  function captureExit() {
    if (!openAlbum || !motion.active()) return;
    const frame = artworkFrame(openAlbum.header, panels().main);
    openAlbum.departure = frame && { frame, time: performance.now() };
  }

  function capture(target) {
    cue = undefined;
    if (target.closest(".main-globalNav-historyButtonsContainer")) captureExit();
    const link = target.closest("a[href]");
    const card = target.closest(CARD) ?? link;
    if (!card || (link && !albumPath(link.getAttribute("href")))) return false;
    const linkPath = albumPath((link ?? card.querySelector(ALBUM_LINK))?.getAttribute("href"));
    const path = linkPath ?? albumPath(card.id);
    if (card.id.startsWith("spotify:") && !path) return false;
    const button = target.closest("button");
    if (button && button !== card && !linkPath) return false;
    const image = card.querySelector(CARD_ARTWORK) ?? link?.querySelector("img");
    const area = panels().left?.contains(image) ? "left" : "main";
    const panel = panels()[area];
    if (!panel?.contains(image)) return false;
    const source = artworkFrame(image, panel);
    if (!source) return false;
    const header = panels().main?.querySelector(HEADER_ARTWORK);
    cue = { source, area, path, header, previousArtwork: header?.currentSrc, time: performance.now() };
    return Boolean(path);
  }

  function waitForArtwork(panel, source, locate, arrive) {
    if (!panel) return false;
    let frame;
    const observer = new MutationObserver(schedule);
    const timer = setTimeout(stop, WAIT_FOR_COVER);
    function stop() {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      observer.disconnect();
      panel.removeEventListener("load", schedule, true);
      panel.removeEventListener("scroll", schedule, true);
      cancelWait = undefined;
    }
    function schedule() {
      if (frame !== undefined) return;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        if (!motion.active()) { stop(); return; }
        const destination = locate();
        if (!destination) return;
        stop();
        cancelMove = motion.moveArtwork(source, destination);
        arrive?.(destination);
      });
    }
    cancelWait = stop;
    observer.observe(panel, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "srcset"] });
    panel.addEventListener("load", schedule, true);
    panel.addEventListener("scroll", schedule, { capture: true, passive: true });
    schedule();
    return true;
  }

  function cancel() {
    cancelWait?.();
    cancelMove?.();
    cancelMove = undefined;
    openAlbum = undefined;
    cue = undefined;
  }

  function navigate(previous, path) {
    const opening = cue;
    const leaving = openAlbum;
    cancel();
    if (!motion.active()) return false;
    const main = panels().main;
    if (leaving && leaving.path === previous && leaving.returnPath === path) {
      const live = artworkFrame(leaving.header, main);
      const recent = leaving.departure && performance.now() - leaving.departure.time < 500;
      const from = live ?? (recent ? leaving.departure.frame : null);
      const panel = panels()[leaving.area];
      if (from && panel) return waitForArtwork(panel, from, () => restoredArtwork(panel, leaving.source));
    }
    const album = albumPath(path);
    if (!album || !opening || performance.now() - opening.time > 1400 || (opening.path && opening.path !== album)) return false;
    return waitForArtwork(main, opening.source, () => {
      const image = main.querySelector(HEADER_ARTWORK);
      if (image === opening.header && image?.currentSrc === opening.previousArtwork) return null;
      return artworkFrame(image, main);
    }, (destination) => {
      openAlbum = { source: opening.source, area: opening.area, path, returnPath: previous, header: destination.element };
    });
  }

  return { capture, captureExit, navigate, cancel };
}
