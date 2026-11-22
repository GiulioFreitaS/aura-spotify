import { createAlbumTransition } from "./album-transition.mjs";
import { createMotion } from "./motion.mjs";

const ROOT = document.documentElement;
const MIN_WIDTH = 1050;
const MIN_HEIGHT = 540;
const BRIDGE_INTERVAL = 850;
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

function outline(width, height, radius = 0) {
  const corners = [[0, 0], [width, 0], [width, height], [0, height]];
  if (!radius) return corners;
  const segments = Math.min(10, Math.max(5, Math.ceil(radius / 4)));
  return corners.flatMap(([x, y], i) => {
    const cx = x ? x - radius : radius;
    const cy = y ? y - radius : radius;
    return Array.from({ length: segments + 1 }, (_, step) => {
      const angle = ((i + 2) + step / segments) * Math.PI / 2;
      return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
    });
  });
}

function shape(element) {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const px = (key) => Number.parseFloat(style[key]) || 0;
  const boxSize = (key, fallback, extras) => {
    const size = px(key);
    if (!size) return fallback;
    return style.boxSizing === "border-box" ? size : size + extras.reduce((total, side) => total + px(side), 0);
  };
  const width = boxSize("width", element.offsetWidth, ["paddingLeft", "paddingRight", "borderLeftWidth", "borderRightWidth"]);
  const height = boxSize("height", element.offsetHeight, ["paddingTop", "paddingBottom", "borderTopWidth", "borderBottomWidth"]);
  const matrix = style.transform === "none" ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(style.transform);
  const [originX, originY] = style.transformOrigin.split(" ").map(Number.parseFloat);
  const radius = Math.min(width / 2, height / 2, Number.parseFloat(style.borderTopLeftRadius) || 0);
  const project = (x, y) => {
    const point = matrix.transformPoint(new DOMPoint(x - originX, y - originY));
    return [point.x / point.w, point.y / point.w];
  };
  const outer = outline(width, height).map(([x, y]) => project(x, y));
  const left = rect.left - Math.min(...outer.map(([x]) => x));
  const top = rect.top - Math.min(...outer.map(([, y]) => y));
  const points = radius ? outline(width, height, radius).map(([x, y]) => project(x, y)) : outer;
  return points.map(([x, y]) => [x + left, y + top]);
}

function rectangle(rect, corner = 0) {
  const { left, right, top, bottom } = rect;
  const width = right - left, height = bottom - top;
  const radius = Math.min(width / 2, height / 2, corner);
  return outline(width, height, radius).map(([x, y]) => [x + left, y + top]);
}

function region(panels, mode) {
  if (!mode || [panels.root, panels.top, panels.left, panels.main].some((panel) => !visible(panel)) ||
      !visible(panels.dock) || [...document.querySelectorAll(OVERLAYS)].some(visible)) return null;
  // O menu nativo e os botões do Windows ficam nos cantos, fora da ilha.
  const regions = [
    shape(panels.top),
    rectangle({ left: 9, top: 8, right: 62, bottom: 54 }, 23),
    rectangle({ left: innerWidth - 138, top: 7, right: innerWidth - 6, bottom: 54 }, 24),
  ];
  if (mode === "wallpaper") {
    regions.push(rectangle({ left: 0, top: 0, right: innerWidth, bottom: innerHeight }, 18));
  } else {
    for (const pane of [panels.left, panels.main, panels.right, panels.dock].filter(visible)) {
      regions.push(shape(pane));
    }
  }
  for (const popup of [...document.querySelectorAll(POPOVERS)].filter(visible).slice(0, 8)) {
    regions.push(rectangle(popup.getBoundingClientRect()));
  }
  return regions.map((points) => points.map(([x, y]) => [
    Math.round(Math.min(1, Math.max(0, x / innerWidth)) * 10000),
    Math.round(Math.min(1, Math.max(0, y / innerHeight)) * 10000),
  ]));
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
  spicetify, signal, preferences, setLayout, setLiveBackground, getBackdrop, getTrack, accentForArtwork,
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
  let bridgeTimer;
  let retryAfter = 0;
  let requestBusy = false;
  let appliedMode = null;
  let bridge;
  let attemptedExpansion = false;
  let expansionTimer;
  let buttonState;
  let button;
  let menu;
  let wallpaperItem;
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
    wallpaperItem = new spicetify.Menu.Item("AURA · Papel de parede", !preferences().nativeCutouts, () => {
      setLiveBackground(!preferences().nativeCutouts);
    });
    wallpaperItem.register();
  }

  function backdropMode() {
    if (!ROOT.hasAttribute("data-aura-native")) return null;
    return preferences().nativeCutouts ? "desktop" : "wallpaper";
  }

  function syncBackdrop() {
    ROOT.toggleAttribute("data-aura-cutouts", appliedMode === "desktop" && backdropMode() === "desktop");
  }

  async function reportRegion() {
    if (!bridge || signal.aborted || document.hidden || requestBusy || performance.now() < retryAfter) return;
    const mode = backdropMode();
    const polygons = region(panels, mode);
    if (!polygons && !appliedMode) return;
    requestBusy = true;
    try {
      const response = await fetch("http://127.0.0.1:" + bridge.port + "/layout/v1", {
        method: "POST",
        cache: "no-store",
        credentials: "omit",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + bridge.token },
        body: JSON.stringify({ polygons }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(650)]),
      });
      if (!response.ok) throw new Error("Recorte temporariamente indisponível.");
      appliedMode = polygons ? mode : null;
      syncBackdrop();
    } catch {
      if (!document.hidden) {
        appliedMode = null;
        retryAfter = performance.now() + 1700;
        syncBackdrop();
      }
    } finally {
      requestBusy = false;
      if (mode !== backdropMode() && !signal.aborted) schedule();
    }
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
    syncBackdrop();
    if (wallpaperItem && wallpaperItem.isEnabled === config.nativeCutouts) {
      wallpaperItem.setState(!config.nativeCutouts);
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
    void reportRegion();
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
        motion.reveal(popup, backdropMode() === "desktop" ? 0 : 5);
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
    else {
      retryAfter = 0;
      update();
    }
  }, options);
  import("./bridge-config.mjs").then(({ default: config }) => {
    if (signal.aborted || !Number.isInteger(config?.port) || config.port < 1024 || config.port > 65535 ||
        typeof config?.token !== "string" || !/^[a-f0-9]{64}$/i.test(config.token)) return;
    bridge = config;
    bridgeTimer = setInterval(reportRegion, BRIDGE_INTERVAL);
    void reportRegion();
  }).catch(() => {});

  signal.addEventListener("abort", () => {
    clearTimeout(layoutTimer);
    clearTimeout(expansionTimer);
    clearInterval(bridgeTimer);
    cancelAnimationFrame(pageFrame);
    albumTransition.cancel();
    if (typeof unlisten === "function") unlisten();
    sizes.disconnect();
    layoutChanges.disconnect();
    player.removeEventListener("songchange", onTrackChange);
    button?.deregister?.();
    menu?.deregister?.();
    wallpaperItem?.deregister?.();
    veil.remove();
    ROOT.style.removeProperty("--aura-native-accent");
    for (const key of ["data-aura-native", "data-aura-native-local", "data-aura-native-motion", "data-aura-cutouts"]) {
      ROOT.removeAttribute(key);
    }
  }, { once: true });

  update();
  return { refresh: schedule };
}
