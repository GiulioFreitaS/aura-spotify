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
const ITEMS = ".main-yourLibraryX-listItem";
const LIBRARY = ".main-yourLibraryX-libraryRootlist";
const OVERLAYS = [
  "#aura-immersive[open]", "dialog[open]", "[role='dialog'][aria-modal='true']",
  ".Root__cinema-view", "[data-cinema-npv-postEnter]",
].join(",");
const POPOVERS = "[role='menu'],[role='listbox'],[role='tooltip'],[data-tippy-root]";
const PRIMARY_FILTER = /^(playlists|álbuns|albums)$/i;

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
  const width = element.offsetWidth, height = element.offsetHeight;
  const style = getComputedStyle(element);
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
  const points = !radius ? outer : corners.flatMap(([x, y], i) => {
    const cx = x ? x - radius : radius;
    const cy = y ? y - radius : radius;
    return Array.from({ length: 5 }, (_, step) => {
      const angle = ((i + 2) + step / 4) * Math.PI / 2;
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
  // A primeira faixa contém as bordas nativas de arraste e os botões de janela do Windows.
  const top = Math.max(58, Math.ceil(panels.top.getBoundingClientRect().bottom));
  const regions = [rectangle({ left: 0, top: 0, right: innerWidth, bottom: top })];
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

function observeLibrary(left, signal) {
  const list = left.querySelector(LIBRARY);
  const grid = list?.querySelector("[role='grid']");
  if (!grid) return;
  let scroll = grid.parentElement;
  while (scroll !== left && !/auto|scroll/.test(getComputedStyle(scroll).overflowY)) {
    scroll = scroll.parentElement;
  }
  if (scroll === left) return;
  const options = { signal };
  let paintTimer;
  let drag;
  let suppressClick = false;
  grid.classList.add("aura-arc-list");
  scroll.classList.add("aura-arc-scroll");

  function paint() {
    paintTimer = undefined;
    if (document.hidden) return;
    const viewport = scroll.getBoundingClientRect();
    if (!viewport.height) return;
    const middle = viewport.top + viewport.height / 2;
    const rows = [...grid.querySelectorAll(ITEMS)].map((row) => {
      const oldBox = row.getBoundingClientRect();
      const relative = (oldBox.top + oldBox.height / 2 - middle) / (viewport.height / 2);
      return [row, relative];
    });
    const nearest = rows.reduce((closest, item) =>
      !closest || Math.abs(item[1]) < Math.abs(closest[1]) ? item : closest, null)?.[0];
    for (const [row, relative] of rows) {
      const edge = Math.min(Math.abs(relative), 1);
      row.style.setProperty("--aura-arc-x", Math.round((1 - edge ** 2) * 41) + "px");
      row.style.setProperty("--aura-arc-scale", (1 - edge * .18).toFixed(2));
      row.style.setProperty("--aura-arc-tilt", Math.round(Math.min(1, Math.max(-1, relative)) * 10) + "deg");
      row.toggleAttribute("data-aura-arc-current", row === nearest);
    }
  }

  function queuePaint() {
    if (paintTimer === undefined) paintTimer = setTimeout(paint, 32);
  }

  scroll.addEventListener("scroll", queuePaint, { ...options, passive: true });
  const resized = new ResizeObserver(queuePaint);
  resized.observe(scroll);
  const rowsChanged = new MutationObserver(queuePaint);
  rowsChanged.observe(grid, { childList: true, subtree: true });
  scroll.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0 || event.pointerType !== "mouse" || event.altKey ||
        event.target.closest("input, button, [role='button']:not([class*='legacy-list-row'])") ||
        event.clientX >= scroll.getBoundingClientRect().right - 10) return;
    suppressClick = false;
    drag = { id: event.pointerId, y: event.clientY, top: scroll.scrollTop, active: false };
  }, options);
  scroll.addEventListener("pointermove", (event) => {
    if (event.pointerId !== drag?.id) return;
    if (!event.buttons) { drag = undefined; return; }
    const offset = event.clientY - drag.y;
    if (!drag.active && Math.abs(offset) < 6) return;
    if (!drag.active) scroll.setPointerCapture(event.pointerId);
    drag.active = true;
    suppressClick = true;
    scroll.scrollTop = drag.top - offset;
    event.preventDefault();
  }, options);
  scroll.addEventListener("dragstart", (event) => {
    if (drag && !event.altKey) event.preventDefault();
  }, options);
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    window.addEventListener(type, (event) => {
      if (event.pointerId === drag?.id) drag = undefined;
    }, { ...options, capture: true });
  }
  scroll.addEventListener("click", (event) => {
    if (!suppressClick || !event.detail) return;
    suppressClick = false;
    event.preventDefault();
    event.stopPropagation();
  }, { ...options, capture: true });

  paint();
  signal.addEventListener("abort", () => {
    clearTimeout(paintTimer);
    resized.disconnect();
    rowsChanged.disconnect();
    scroll.classList.remove("aura-arc-scroll");
    grid.classList.remove("aura-arc-list");
    for (const row of grid.querySelectorAll(ITEMS)) {
      row.style.removeProperty("--aura-arc-x");
      row.style.removeProperty("--aura-arc-scale");
      row.style.removeProperty("--aura-arc-tilt");
      row.removeAttribute("data-aura-arc-current");
    }
  }, { once: true });
  return grid;
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
  let lastGrid;
  let library;
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
    if (!bridge || signal.aborted || requestBusy || performance.now() < retryAfter) return;
    const config = preferences();
    const active = config.nativeCutouts && ROOT.hasAttribute("data-aura-native") && !document.hidden;
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
      sentActive = Boolean(polygons && response.ok);
      ROOT.toggleAttribute("data-aura-cutouts", sentActive);
    } catch {
      sentActive = false;
      retryAfter = performance.now() + 1700;
      ROOT.removeAttribute("data-aura-cutouts");
    } finally {
      requestBusy = false;
    }
  }

  function update() {
    layoutTimer = undefined;
    panels = findPanels();
    const config = preferences();
    const supported = panels.root && panels.left && panels.main && panels.dock;
    const active = Boolean(config.nativeLayout && supported && innerWidth >= MIN_WIDTH && innerHeight >= MIN_HEIGHT);
    ROOT.toggleAttribute("data-aura-native", active);
    ROOT.toggleAttribute("data-aura-native-local", active && Boolean(config.background));
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

    if (active && !attemptedExpansion && !expansionTimer && panels.left.querySelector(".main-yourLibraryX-library")) {
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
    const grid = active ? panels.left.querySelector(LIBRARY + " [role='grid']") : null;
    if (grid !== lastGrid) {
      library?.abort();
      lastGrid = grid;
      if (grid) {
        library = new AbortController();
        observeLibrary(panels.left, library.signal);
      }
    }
    void reportRegion();
  }

  function schedule() {
    if (layoutTimer === undefined) layoutTimer = setTimeout(update, 70);
  }
  const layoutChanges = new MutationObserver(schedule);
  // Mudanças de rota, portais, menus e painéis podem ocorrer depois da primeira renderização.
  layoutChanges.observe(document.body, { childList: true, subtree: true, attributes: true,
    attributeFilter: ["open", "aria-modal", "data-right-sidebar-hidden", "data-cinema-npv-postEnter"] });
  window.addEventListener("resize", schedule, options);
  document.addEventListener("visibilitychange", schedule, options);
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
    library?.abort();
    layoutChanges.disconnect();
    player.removeEventListener("songchange", onPlayer);
    button?.deregister?.();
    menu?.deregister?.();
    veil.remove();
    for (const key of ["data-aura-native", "data-aura-native-local", "data-aura-cutouts"]) ROOT.removeAttribute(key);
  }, { once: true });

  update();
  return { refresh: schedule };
}
