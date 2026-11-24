import { createAlbumTransition } from "./album-transition.mjs";
import { createMotion } from "./motion.mjs";

const ROOT = document.documentElement;
const MIN_WIDTH = 1050;
const MIN_HEIGHT = 540;
const PANELS = {
  root: ".Root__top-container",
  top: ".Root__globalNav",
  left: "#Desktop_LeftSidebar_Id",
  main: ".Root__main-view",
  right: ".Root__right-sidebar",
  dock: ".Root__now-playing-bar",
};
const LIBRARY = ".main-yourLibraryX-library";
const LIBRARY_LIST = ".main-yourLibraryX-libraryRootlist";
const OVERLAYS = [
  "#aura-immersive[open]", "dialog[open]", "[role='dialog'][aria-modal='true']",
  ".Root__cinema-view", "[data-cinema-npv-postEnter]",
].join(",");
const POPOVERS = "[role='menu'],[role='listbox'],[role='tooltip'],[data-tippy-root]";
const MOTION_POPOVERS = "[role='menu'],[role='listbox'],[role='dialog'][aria-modal='true']";
const TRACK_ROW = ".main-trackList-trackListRow,[data-testid='tracklist-row']";
const MEDIA_CARD = ".main-card-cardContainer,.main-yourLibraryX-listItem,[data-testid='card-container']";
const PLAY_CONTROL = [
  ".main-trackList-rowImagePlayButton", ".main-playButton-PlayButton button",
  "[data-testid='play-button']", "[data-testid='control-button-playpause']", "[data-testid^='control-button-skip-']",
].join(",");
const PRIMARY_FILTER = /^(playlists|álbuns|albums)$/i;
const LAYOUT_NODES = [...Object.values(PANELS), LIBRARY, OVERLAYS, POPOVERS].join(",");

function visible(element) {
  if (!element?.isConnected || !element.getClientRects().length) return false;
  const { width, height } = element.getBoundingClientRect();
  return width > 0 && height > 0 && getComputedStyle(element).visibility === "visible";
}

function findPanels() {
  return Object.fromEntries(Object.entries(PANELS).map(([key, selector]) =>
    [key, document.querySelector(selector)],
  ));
}

function changesLayout(records) {
  return records.some((record) => {
    if (record.type === "attributes") return true;
    if (record.target instanceof Element && record.target.closest(LIBRARY_LIST + ",#aura-immersive,.aura-motion-layer")) return false;
    return [...record.addedNodes, ...record.removedNodes].some((node) =>
      node instanceof Element && (node.matches(LAYOUT_NODES) || node.querySelector(LAYOUT_NODES)),
    );
  });
}

export function createNativeLayout({
  spicetify, signal, preferences, setLayout, getBackdrop, getTrack, accentForArtwork,
}) {
  const veil = document.createElement("div");
  veil.className = "aura-native-background";
  veil.setAttribute("aria-hidden", "true");
  const image = document.createElement("img");
  image.alt = "";
  image.referrerPolicy = "no-referrer";
  veil.append(image);
  document.body.prepend(veil);

  let panels = {};
  let layoutTimer;
  let attemptedExpansion = false;
  let expansionTimer;
  let buttonState;
  let button;
  let menu;
  const options = { signal };
  const player = spicetify.Player;
  const immersive = document.getElementById("aura-immersive");
  const motion = createMotion({
    host: document.body,
    signal,
    enabled: () => !preferences().reduceMotion && !immersive?.open,
  });
  const albumTransition = createAlbumTransition({ motion, panels: () => panels });
  let lastTrack = getTrack?.()?.uri;
  let playCue;
  let accentSource;

  function syncBackground() {
    if (document.hidden || !ROOT.hasAttribute("data-aura-native")) return;
    const source = getBackdrop();
    if (image.getAttribute("src") === (source || null)) return;
    image.hidden = true;
    if (source) image.src = source;
    else image.removeAttribute("src");
  }

  function syncPanelAccent(track) {
    if (document.hidden || !ROOT.hasAttribute("data-aura-native")) return;
    const config = preferences();
    const manual = config.colorMode === "manual" ? config.accent : "";
    const source = manual || track?.artwork || "";
    if (accentSource === source) return;
    accentSource = source;
    if (manual) ROOT.style.setProperty("--aura-native-accent", manual);
    else if (!source) ROOT.style.removeProperty("--aura-native-accent");
    else void accentForArtwork(source).then((color) => {
      if (!signal.aborted && accentSource === source) ROOT.style.setProperty("--aura-native-accent", color);
    });
  }

  function onTrackChange() {
    const track = getTrack?.();
    syncBackground();
    syncPanelAccent(track);
    if (!track?.uri || track.uri === lastTrack) return;
    lastTrack = track.uri;
    const cue = playCue;
    playCue = undefined;
    if (!motion.active()) return;
    const right = panels.right;
    const dock = panels.dock?.querySelector("[data-testid='cover-art-button']") ?? panels.dock;
    let destination = dock;
    if (right?.getAttribute("data-right-sidebar-hidden") !== "true" && visible(right)) {
      const rect = right.getBoundingClientRect();
      destination = { x: rect.left + rect.width / 2, y: rect.top + rect.height * .32 };
    }
    const source = cue && performance.now() - cue.time <= 1800 ? cue.point : undefined;
    motion.fly(source, destination, track.artwork);
  }

  function onMediaClick(event) {
    if (!motion.active() || event.button !== 0 || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey ||
        !(event.target instanceof Element)) return;
    const target = event.target;
    const control = target.closest("button,[role='button']");
    if (control?.matches(":disabled,[aria-disabled='true']") || target.closest(MOTION_POPOVERS)) return;
    const play = target.closest(PLAY_CONTROL);
    if (!play && albumTransition.capture(target)) return;
    const row = target.closest(TRACK_ROW);
    const item = row ?? target.closest(MEDIA_CARD);
    if (!play && (!item || (control && control !== item && item.contains(control)))) return;
    const point = event.detail ? { x: event.clientX, y: event.clientY } : play ?? item;
    if (event.detail < 2) motion.wave(point, play ? 96 : 146);
    if (play || row) playCue = { point, time: performance.now() };
  }

  document.addEventListener("click", onMediaClick, { ...options, capture: true });
  document.addEventListener("keydown", (event) => {
    if (event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) albumTransition.captureExit();
  }, { ...options, capture: true });
  image.addEventListener("load", () => { image.hidden = image.currentSrc !== image.src; }, options);
  image.addEventListener("error", () => { image.hidden = true; }, options);
  player.addEventListener("songchange", onTrackChange);

  const history = spicetify.Platform.History;
  const page = (pathname) => pathname?.startsWith("/search/") ? "/search" : pathname;
  let currentPath = history.location?.pathname;
  let pageFrame;
  const unlisten = history.listen?.((entry) => {
    const path = entry?.location?.pathname ?? entry?.pathname ?? history.location?.pathname;
    if (!path || path === currentPath) return;
    const previous = currentPath;
    currentPath = path;
    cancelAnimationFrame(pageFrame);
    if (!albumTransition.navigate(previous, path) && motion.active() && page(path) !== page(previous)) {
      pageFrame = requestAnimationFrame(() => {
        const view = panels.main?.querySelector(".main-view-container__scroll-node-child");
        motion.reveal(view?.firstElementChild ?? view, 7);
      });
    }
  });

  function toggle() { setLayout(!preferences().nativeLayout); }
  const playerLabel = "AURA · Layout em painéis";
  try {
    if (spicetify.Topbar?.Button) button = new spicetify.Topbar.Button(playerLabel, "album", toggle);
  } catch { /* O menu do perfil oferece o mesmo controle. */ }
  if (spicetify.Menu?.Item) {
    menu = new spicetify.Menu.Item(playerLabel, preferences().nativeLayout, toggle, "album");
    menu.register();
  }

  function update() {
    layoutTimer = undefined;
    if (document.hidden) return;
    const next = findPanels();
    if (Object.keys(PANELS).some((key) => next[key] !== panels[key])) {
      sizes.disconnect();
      for (const panel of Object.values(next).filter(Boolean)) sizes.observe(panel);
      panels = next;
    }
    const config = preferences();
    const supported = panels.root && panels.left && panels.main && panels.dock;
    const active = Boolean(config.nativeLayout && supported && innerWidth >= MIN_WIDTH && innerHeight >= MIN_HEIGHT);
    ROOT.toggleAttribute("data-aura-native", active);
    ROOT.toggleAttribute("data-aura-native-local", active && Boolean(config.background));
    ROOT.toggleAttribute("data-aura-native-motion", Boolean(supported && !config.reduceMotion));
    if (config.reduceMotion || immersive?.open) {
      albumTransition.cancel();
      motion.clear();
    }
    if (buttonState !== config.nativeLayout) {
      buttonState = config.nativeLayout;
      menu?.setState?.(buttonState);
      button?.element?.setAttribute("aria-pressed", String(buttonState));
    }
    if (active) {
      syncBackground();
      syncPanelAccent(getTrack?.());
    } else {
      image.hidden = true;
      image.removeAttribute("src");
    }

    if (active && !attemptedExpansion && !expansionTimer && panels.left.querySelector(LIBRARY)) {
      expansionTimer = setTimeout(() => {
        expansionTimer = undefined;
        if (!ROOT.hasAttribute("data-aura-native")) return;
        attemptedExpansion = true;
        const expand = [...(panels.left?.querySelectorAll("button[aria-label]") ?? [])].find((node) =>
          /^(Abrir Sua Biblioteca|Open Your Library|Expand Your Library)$/i.test(node.getAttribute("aria-label")),
        );
        expand?.click();
      }, 850);
    }
    if (active) {
      for (const filter of panels.left.querySelectorAll("[role='option']")) {
        filter.toggleAttribute("data-aura-library-filter", PRIMARY_FILTER.test(filter.textContent.trim()));
      }
    }
    if (!config.nativeLayout) attemptedExpansion = false;
  }

  function schedule() {
    if (!document.hidden && layoutTimer === undefined) layoutTimer = setTimeout(update, 34);
  }
  const sizes = new ResizeObserver(schedule);
  const shownMenus = new WeakSet();
  const layoutChanges = new MutationObserver((records) => {
    if (!changesLayout(records)) return;
    schedule();
    if (!motion.active()) return;
    let remaining = 4;
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element) || !node.isConnected) continue;
        const popup = node.matches(MOTION_POPOVERS) ? node : node.querySelector(MOTION_POPOVERS);
        if (!popup || shownMenus.has(popup) || !visible(popup)) continue;
        shownMenus.add(popup);
        motion.reveal(popup, 5);
        if (--remaining === 0) return;
      }
    }
  });
  layoutChanges.observe(document.body, { childList: true, subtree: true, attributes: true,
    attributeFilter: ["open", "aria-modal", "data-right-sidebar-hidden", "data-cinema-npv-postEnter"] });
  window.addEventListener("resize", schedule, options);
  document.addEventListener("visibilitychange", () => {
    clearTimeout(layoutTimer);
    layoutTimer = undefined;
    playCue = undefined;
    if (document.hidden) albumTransition.cancel();
    else update();
  }, options);
  signal.addEventListener("abort", () => {
    clearTimeout(layoutTimer);
    clearTimeout(expansionTimer);
    cancelAnimationFrame(pageFrame);
    albumTransition.cancel();
    if (typeof unlisten === "function") unlisten();
    sizes.disconnect();
    layoutChanges.disconnect();
    player.removeEventListener("songchange", onTrackChange);
    button?.deregister?.();
    menu?.deregister?.();
    veil.remove();
    ROOT.style.removeProperty("--aura-native-accent");
    for (const key of ["data-aura-native", "data-aura-native-local", "data-aura-native-motion"]) {
      ROOT.removeAttribute(key);
    }
  }, { once: true });

  update();
  return { refresh: schedule };
}
