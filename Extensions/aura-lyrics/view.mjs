import { createLyricsService, trackKey } from "./index.mjs";

function lastStarted(lines, time) {
  let low = 0;
  let high = lines.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (lines[mid].startMs <= time) low = mid + 1;
    else high = mid;
  }
  return low - 1;
}

function activeAt(lines, latest, time) {
  const active = new Set();
  const latestStart = lines[latest]?.startMs;
  for (let index = latest; index >= 0; index--) {
    const line = lines[index];
    if (line.text && (line.endMs === undefined ? line.startMs === latestStart : time < line.endMs)) {
      active.add(index);
    }
  }
  return active;
}

function lyricRow(line) {
  const row = document.createElement("p");
  row.className = "aura-lyric-line";
  row.dir = "auto";
  if (!line.text.trim()) row.classList.add("aura-lyric-gap");
  const words = line.words?.map((word) => {
    const span = document.createElement("span");
    span.className = "aura-lyric-word";
    span.textContent = word.text;
    row.append(span);
    return span;
  }) ?? [];
  if (!words.length) row.textContent = line.text;
  return { row, words };
}

export function createLyricsView(panel, signal, motionDisabled, text) {
  const service = createLyricsService();
  const statusMessages = {
    missing: text.lyricsMissing,
    mismatch: text.lyricsMismatch,
    unsupported: text.lyricsUnsupported,
    unavailable: text.lyricsSourceUnavailable,
  };
  const kindLabels = {
    word: text.lyricsByWord,
    line: text.lyricsByLine,
    plain: text.lyricsUnsynced,
  };
  const ui = Object.fromEntries([...panel.querySelectorAll("[data-lyrics]")].map(
    (node) => [node.dataset.lyrics, node],
  ));
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let track;
  let duration;
  let key;
  let requestTrack;
  let request;
  let retryTimer;
  let result;
  let rows = [];
  let active = new Set();
  let lastCentered = -1;
  let manualScrollUntil = 0;
  let time = 0;

  function render(next, status) {
    result = next;
    rows = [];
    active = new Set();
    lastCentered = -1;
    manualScrollUntil = 0;
    clearTimeout(retryTimer);

    ui.meta.hidden = !next;
    ui.source.href = next?.source.url ?? "https://lrclib.net/";
    ui.kind.textContent = kindLabels[next?.kind] ?? "";
    ui.kind.hidden = !ui.kind.textContent;
    ui.status.textContent = status ?? (next?.kind === "instrumental" ? text.lyricsInstrumental : statusMessages[next?.reason] ?? "");
    ui.status.hidden = !ui.status.textContent;
    ui.retry.hidden = next?.reason !== "unavailable" || !next.retryAt;
    if (!ui.retry.hidden) {
      const enableWhenReady = () => {
        const remaining = next.retryAt - Date.now();
        ui.retry.disabled = remaining > 0;
        if (remaining > 0) retryTimer = setTimeout(enableWhenReady, Math.min(remaining, 2_147_483_647));
      };
      enableWhenReady();
    }

    ui.scroll.hidden = !next?.lines.length;
    ui.scroll.dataset.timed = String(next?.kind === "word" || next?.kind === "line");
    rows = (next?.lines ?? []).map(lyricRow);
    ui.scroll.replaceChildren(...rows.map(({ row }) => row));
    ui.scroll.scrollTop = 0;
    paintTime();
  }

  function paintWords(line, fragments, playbackTime) {
    for (const [index, word] of line.words.entries()) {
      const started = word.startMs <= playbackTime;
      fragments[index].toggleAttribute("data-sung", started);
    }
  }

  function paintTime() {
    if (result?.kind !== "word" && result?.kind !== "line") return;
    const lines = result.lines;
    const nextActive = activeAt(lines, lastStarted(lines, time), time);
    for (const index of active) {
      if (!nextActive.has(index)) {
        rows[index].row.removeAttribute("aria-current");
        for (const word of rows[index].words) word.removeAttribute("data-sung");
      }
    }
    for (const index of nextActive) {
      const { row, words } = rows[index];
      if (!active.has(index)) row.setAttribute("aria-current", "true");
      if (words.length) paintWords(lines[index], words, time);
    }
    active = nextActive;

    const firstActive = Math.min(...nextActive);
    if (!Number.isFinite(firstActive) || firstActive === lastCentered || performance.now() < manualScrollUntil) return;
    const row = rows[firstActive].row;
    const top = row.offsetTop - (ui.scroll.clientHeight - row.offsetHeight) / 2;
    ui.scroll.scrollTo({ top, behavior: reducedMotion.matches || motionDisabled() ? "instant" : "smooth" });
    lastCentered = firstActive;
  }

  function lookup() {
    request?.abort();
    const controller = new AbortController();
    request = controller;
    render(null, text.lyricsSearching);
    service.lookup(requestTrack, controller.signal).then((next) => {
      if (request === controller && next) render(next);
    }, () => {
      if (request === controller) render(null, statusMessages.unavailable);
    });
  }

  ui.retry.addEventListener("click", () => {
    if (result?.retryAt && Date.now() >= result.retryAt) lookup();
  }, { signal });
  function pauseAutoScroll() {
    manualScrollUntil = performance.now() + 5000;
    lastCentered = -1;
  }
  for (const event of ["wheel", "pointerdown", "keydown"]) {
    ui.scroll.addEventListener(event, pauseAutoScroll, { signal, passive: true });
  }

  return {
    setTrack(nextTrack, nextDuration) {
      if (track === nextTrack && duration === nextDuration) return;
      track = nextTrack;
      duration = nextDuration;
      const next = nextTrack && { ...nextTrack, durationMs: nextDuration };
      const nextKey = trackKey(next) ?? (next ? "unsupported" : "empty");
      if (nextKey === key) return;
      key = nextKey;
      requestTrack = next;
      request?.abort();
      request = undefined;
      if (!next) render(null, text.lyricsEmpty);
      else if (nextKey === "unsupported") render(null, statusMessages.unsupported);
      else lookup();
    },
    updateTime(positionMs, offsetMs) {
      time = positionMs - offsetMs;
      paintTime();
    },
    clear() {
      request?.abort();
      request = undefined;
      track = undefined;
      duration = undefined;
      requestTrack = undefined;
      key = undefined;
      render(null);
    },
  };
}
