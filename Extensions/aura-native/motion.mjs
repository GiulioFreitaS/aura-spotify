const EASE = "cubic-bezier(.22, .65, .32, 1)";
const MAX_EFFECTS = 12;

function center(target) {
  if (target instanceof Element) {
    if (!target.isConnected || !target.getClientRects().length) return null;
    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    return x >= 0 && x <= innerWidth && y >= 0 && y <= innerHeight ? { x, y } : null;
  }
  return Number.isFinite(target?.x) && Number.isFinite(target?.y) ? target : null;
}

export function createMotion({ host, signal, enabled }) {
  const preference = matchMedia("(prefers-reduced-motion: reduce)");
  const running = new Map();
  let layer;
  const active = () => !signal.aborted && !document.hidden && !preference.matches && enabled();

  function stop(node) {
    const effect = running.get(node);
    if (!effect) return;
    running.delete(node);
    effect.animation.cancel();
    if (effect.remove) node.remove();
  }

  function clear() {
    for (const node of running.keys()) stop(node);
  }

  function animate(node, frames, options, remove = false, onFinish = undefined) {
    stop(node);
    while (running.size >= MAX_EFFECTS) stop(running.keys().next().value);
    const animation = node.animate(frames, { easing: EASE, ...options });
    running.set(node, { animation, remove });
    animation.addEventListener("finish", () => {
      if (running.get(node)?.animation !== animation) return;
      running.delete(node);
      if (remove) node.remove();
      if (active()) onFinish?.();
    }, { once: true });
  }

  function ornament(className, point) {
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "aura-motion-layer";
      layer.setAttribute("aria-hidden", "true");
      host.append(layer);
    }
    const node = document.createElement("span");
    node.className = className;
    node.style.left = point.x + "px";
    node.style.top = point.y + "px";
    layer.append(node);
    return node;
  }

  function wave(source, size = 142) {
    if (!active()) return;
    const point = center(source);
    if (!point) return;
    for (const [index, start] of [.28, .4].entries()) {
      const ring = ornament("aura-motion-ring", point);
      ring.style.setProperty("--aura-wave-size", size + "px");
      animate(ring, [
        { opacity: index ? .55 : .82, transform: "translate(-50%, -50%) scale(" + start + ")" },
        { opacity: 0, transform: "translate(-50%, -50%) scale(" + (index ? 1.17 : .92) + ")" },
      ], { duration: 480, delay: index * 65 }, true);
    }
  }

  function fly(source, destination, artwork) {
    if (!active()) return;
    const arrival = center(destination);
    if (!arrival) return;
    const departure = center(source);
    if (!artwork || !departure) {
      wave(arrival, 180);
      return;
    }
    const cover = ornament("aura-motion-cover", departure);
    const image = new Image();
    image.alt = "";
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => {
      if (!running.has(cover)) return;
      stop(cover);
      wave(arrival, 180);
    }, { once: true });
    image.src = artwork;
    cover.append(image);
    const dx = arrival.x - departure.x;
    const dy = arrival.y - departure.y;
    const arc = Math.min(70, Math.max(28, Math.abs(dx) * .12));
    const move = (x, y, scale, angle) =>
      "translate(-50%, -50%) translate(" + x + "px, " + y + "px) scale(" + scale + ") rotate(" + angle + "deg)";
    animate(cover, [
      { transform: move(0, 0, .66, -9), opacity: .28, offset: 0 },
      { transform: move(dx * .16, dy * .17 - arc * .55, 1, -5), opacity: 1, offset: .23 },
      { transform: move(dx * .63, dy * .68 - arc, .94, 6), opacity: 1, offset: .66 },
      { transform: move(dx, dy, .54, 0), opacity: 0, offset: 1 },
    ], { duration: 540, easing: "cubic-bezier(.28,.55,.46,1)" }, true, () => wave(arrival, 180));
  }

  function reveal(node, distance = 5) {
    if (!active() || !node?.getClientRects().length) return;
    animate(node, [
      { opacity: .64, translate: "0 " + distance + "px" },
      { opacity: 1, translate: "0 0" },
    ], { duration: 210 });
  }

  preference.addEventListener("change", () => { if (!active()) clear(); }, { signal });
  document.addEventListener("visibilitychange", () => { if (document.hidden) clear(); }, { signal });
  signal.addEventListener("abort", () => {
    clear();
    layer?.remove();
  }, { once: true });
  return { wave, fly, reveal, clear, active };
}
