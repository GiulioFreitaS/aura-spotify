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
  const corners = [[0, 0], [width, 0], [width, height], [0, height]];
  const outer = corners.map(([x, y]) => project(x, y));
  const left = rect.left - Math.min(...outer.map(([x]) => x));
  const top = rect.top - Math.min(...outer.map(([, y]) => y));
  const segments = Math.min(10, Math.max(5, Math.ceil(radius / 4)));
  const points = !radius ? outer : corners.flatMap(([x, y], i) => {
    const cx = x ? x - radius : radius;
    const cy = y ? y - radius : radius;
    return Array.from({ length: segments + 1 }, (_, step) => {
      const angle = ((i + 2) + step / segments) * Math.PI / 2;
      return project(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    });
  });
  return points.map(([x, y]) => [x + left, y + top]);
}

function rectangle(rect) {
  const { left, right, top, bottom } = rect;
  return [[left, top], [right, top], [right, bottom], [left, bottom]];
}

function region(panels, active) {
  if (!active || [panels.root, panels.top, panels.left, panels.main].some((panel) => !visible(panel)) ||
      !visible(panels.dock) || [...document.querySelectorAll(OVERLAYS)].some(visible)) return null;
  // O menu nativo e os botões do Windows ficam nos cantos, fora da ilha.
  const regions = [
    shape(panels.top),
    rectangle({ left: 0, top: 0, right: 58, bottom: 54 }),
    rectangle({ left: innerWidth - 142, top: 0, right: innerWidth, bottom: 54 }),
  ];
  for (const pane of [panels.left, panels.main, panels.right, panels.dock].filter(visible)) {
    regions.push(shape(pane));
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
    if (record.target instanceof Element && record.target.closest(LIBRARY_LIST)) return false;
    return [...record.addedNodes, ...record.removedNodes].some((node) =>
      node instanceof Element && (node.matches(LAYOUT_NODES) || node.querySelector(LAYOUT_NODES)),
    );
  });
}

export function createNativeLayout({ spicetify, signal, preferences, setLayout, getBackdrop }) {
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
  let sentActive = false;
  let bridge;
  let attemptedExpansion = false;
  let expansionTimer;
  let buttonState;
  let button;
  let menu;
  const options = { signal };
  const player = spicetify.Player;
  const onPlayer = () => {
    if (document.hidden || !ROOT.hasAttribute("data-aura-native")) return;
    const source = getBackdrop();
    if (image.getAttribute("src") === (source || null)) return;
    image.hidden = true;
    if (source) image.src = source;
    else image.removeAttribute("src");
  };
  image.addEventListener("load", () => { image.hidden = image.currentSrc !== image.src; }, options);
  image.addEventListener("error", () => { image.hidden = true; }, options);
  player.addEventListener("songchange", onPlayer);

  function toggle() { setLayout(!preferences().nativeLayout); }
  const playerLabel = "AURA · Layout em painéis";
  try {
    if (spicetify.Topbar?.Button) button = new spicetify.Topbar.Button(playerLabel, "album", toggle);
  } catch { /* O menu do perfil oferece o mesmo controle. */ }
  if (spicetify.Menu?.Item) {
    menu = new spicetify.Menu.Item(playerLabel, preferences().nativeLayout, toggle, "album");
    menu.register();
  }

  async function reportRegion() {
    if (!bridge || signal.aborted || document.hidden || requestBusy || performance.now() < retryAfter) return;
    const config = preferences();
    const active = config.nativeCutouts && ROOT.hasAttribute("data-aura-native");
    const polygons = region(panels, active);
    if (!polygons && !sentActive) return;
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
      sentActive = Boolean(polygons);
      ROOT.toggleAttribute("data-aura-cutouts", sentActive);
    } catch {
      if (!document.hidden) {
        sentActive = false;
        retryAfter = performance.now() + 1700;
        ROOT.removeAttribute("data-aura-cutouts");
      }
    } finally {
      requestBusy = false;
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
    ROOT.toggleAttribute("data-aura-native-motion", active && !config.reduceMotion);
    if (buttonState !== config.nativeLayout) {
      buttonState = config.nativeLayout;
      menu?.setState?.(buttonState);
      button?.element?.setAttribute("aria-pressed", String(buttonState));
    }
    if (active) onPlayer();
    else {
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
  const layoutChanges = new MutationObserver((records) => {
    if (changesLayout(records)) schedule();
  });
  layoutChanges.observe(document.body, { childList: true, subtree: true, attributes: true,
    attributeFilter: ["open", "aria-modal", "data-right-sidebar-hidden", "data-cinema-npv-postEnter"] });
  window.addEventListener("resize", schedule, options);
  document.addEventListener("visibilitychange", () => {
    clearTimeout(layoutTimer);
    layoutTimer = undefined;
    if (!document.hidden) {
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
    sizes.disconnect();
    layoutChanges.disconnect();
    player.removeEventListener("songchange", onPlayer);
    button?.deregister?.();
    menu?.deregister?.();
    veil.remove();
    for (const key of ["data-aura-native", "data-aura-native-local", "data-aura-native-motion", "data-aura-cutouts"]) {
      ROOT.removeAttribute(key);
    }
  }, { once: true });

  update();
  return { refresh: schedule };
}
