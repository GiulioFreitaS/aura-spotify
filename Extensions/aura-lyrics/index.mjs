import { JSON_SCHEMA, load } from "./js-yaml.mjs";

const SOURCE = { name: "LRCLIB", url: "https://lrclib.net/" };
const ENDPOINT = new URL("/api/get", SOURCE.url);
const CLIENT = "AURA/0.2.0 (Spicetify extension; https://spicetify.app/)";
const RESPONSE_LIMIT = 768 * 1024;
const TEXT_LIMIT = 384 * 1024;
const MAX_LINES = 600;
const MAX_WORDS_PER_LINE = 160;
const TIMING_TOLERANCE_MS = 2000;
const REQUEST_GAP = 350;
const RETRY_DELAY_MS = 15000;
const ONE_MINUTE = 60_000;

/**
 * @typedef {{ uri: string, title: string, artist: string, primaryArtist: string, album: string, durationMs: number }} Track
 * @typedef {{ text: string, startMs: number, endMs?: number }} TimedWord
 * @typedef {{ text: string, startMs?: number, endMs?: number, words?: TimedWord[] }} LyricLine
 * @typedef {{
 *   kind: "word" | "line" | "plain" | "instrumental" | "none",
 *   lines: LyricLine[],
 *   source: { name: string, url: string },
 *   reason?: "missing" | "mismatch" | "unsupported" | "unavailable",
 *   retryAt?: number
 * }} LyricsResult
 */

function normalized(value) {
  if (typeof value !== "string") return "";
  return value.normalize("NFKD").toLowerCase()
    .replace(/(\p{Script=Latin})\p{M}+/gu, "$1")
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim();
}

function normalizedTitle(value) {
  if (typeof value !== "string") return "";
  return normalized(value.replace(/\s*[(\[]\s*(?:feat(?:uring)?|ft)\.?\s+[^\])]+[\])]\s*$/i, ""));
}

export function trackKey(track) {
  if (typeof track?.uri !== "string" || !track.uri.startsWith("spotify:track:") ||
      !Number.isFinite(track.durationMs) || track.durationMs < 1000 || track.durationMs > 3_600_000) return null;
  const title = normalizedTitle(track.title);
  const artist = normalized(track.primaryArtist);
  if (!title || !artist) return null;
  return JSON.stringify([track.uri, title, artist, normalized(track.artist), normalized(track.album), Math.round(track.durationMs)]);
}

export function matchesTrack(track, record) {
  const title = normalizedTitle(record?.trackName ?? record?.name);
  const artistName = record?.artistName;
  if (!title || title !== normalizedTitle(track?.title) || typeof artistName !== "string") return false;
  const primary = normalized(track.primaryArtist);
  if (!primary) return false;
  const credited = normalized(artistName);
  const firstCredit = normalized(artistName.split(/,|\s+(?:feat(?:uring)?\.?|ft\.?|&|and)\s+/i, 1)[0]);
  if (credited !== primary && credited !== normalized(track.artist) && firstCredit !== primary) return false;
  return Number.isFinite(record.duration) && record.duration > 0 &&
    Math.abs(record.duration * 1000 - track.durationMs) <= TIMING_TOLERANCE_MS;
}

function parseTimestamp(minute, second, fraction = "") {
  return (Number(minute) * 60 + Number(second)) * 1000 + Number(fraction.padEnd(3, "0"));
}

export function parseLrc(text, endLimit = Infinity) {
  if (typeof text !== "string" || text.length > TEXT_LIMIT) return [];
  const offset = Number(/^\s*\[offset:\s*([+-]?\d{1,7})\s*\]/im.exec(text)?.[1] ?? 0);
  const lines = [];
  for (const row of text.split(/\r\n?|\n/)) {
    let rest = row.trim();
    const times = [];
    let match;
    while ((match = /^\[(\d{1,4}):([0-5]\d)(?:[.:](\d{1,3}))?\]/.exec(rest))) {
      const startMs = Math.max(0, parseTimestamp(match[1], match[2], match[3]) - offset);
      if (startMs <= endLimit) times.push(startMs);
      rest = rest.slice(match[0].length).trimStart();
      if (times.length >= MAX_LINES) break;
    }
    for (const startMs of times) {
      if (lines.length >= MAX_LINES) break;
      lines.push({ text: rest, startMs });
    }
    if (lines.length >= MAX_LINES) break;
  }
  return lines.some((line) => line.text) ? lines.sort((a, b) => a.startMs - b.startMs) : [];
}

function parsePlain(text) {
  if (typeof text !== "string" || text.length > TEXT_LIMIT || !text.trim()) return [];
  return text.trim().split(/\r\n?|\n/).slice(0, MAX_LINES).map((line) => ({ text: line }));
}

function validTime(value, maximum) {
  return Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}

function timedWords(input, text, startMs, endMs) {
  if (!Array.isArray(input) || !input.length || input.length > MAX_WORDS_PER_LINE) return undefined;
  let previousStart = startMs;
  const words = [];
  for (const word of input) {
    const start = word?.start_ms;
    const end = word?.end_ms;
    if (typeof word?.text !== "string" || !word.text || !validTime(start, endMs) || start < previousStart ||
        (end != null && (!validTime(end, endMs) || end < start))) return undefined;
    words.push(end == null ? { text: word.text, startMs: start } : { text: word.text, startMs: start, endMs: end });
    previousStart = start;
  }
  return words.map((word) => word.text).join("") === text ? words : undefined;
}

function timedLine(line, maximum) {
  const startMs = line?.start_ms;
  const endMs = line?.end_ms;
  if (typeof line?.text !== "string" || !validTime(startMs, maximum) ||
      (endMs != null && (!validTime(endMs, maximum) || endMs < startMs))) return null;
  const words = timedWords(line.words, line.text, startMs, endMs ?? maximum);
  return { text: line.text, startMs, endMs: endMs ?? undefined, words };
}

function parseLyricsfile(text, track, sourceDuration) {
  if (typeof text !== "string" || !text.trim() || text.length > TEXT_LIMIT) return null;
  let file;
  try {
    file = load(text, { schema: JSON_SCHEMA, maxAliases: 0, maxDepth: 12, maxTotalMergeKeys: 0 });
  } catch {
    return null;
  }
  if (file?.version !== "1.0" || !file.metadata) return null;
  const metadata = file.metadata;
  if (!matchesTrack(track, {
    trackName: metadata.title,
    artistName: metadata.artist,
    duration: metadata.duration_ms == null ? sourceDuration : metadata.duration_ms / 1000,
  })) return { mismatch: true };
  const endLimit = track.durationMs + TIMING_TOLERANCE_MS;
  const lines = Array.isArray(file.lines)
    ? file.lines.slice(0, MAX_LINES).map((line) => timedLine(line, endLimit)).filter(Boolean)
    : [];
  return {
    lines: lines.some((line) => line.text) ? lines.sort((a, b) => a.startMs - b.startMs) : [],
    plain: parsePlain(file.plain),
    instrumental: metadata.instrumental === true,
  };
}

/** @returns {LyricsResult} */
function noLyrics(reason, source = SOURCE, retryAt) {
  return { kind: "none", lines: [], source, reason, ...(retryAt === undefined ? {} : { retryAt }) };
}

/** @returns {LyricsResult} */
export function classifyLyrics(track, record) {
  const source = Number.isSafeInteger(record?.id) && record.id > 0
    ? { name: SOURCE.name, url: new URL("/tracks/" + record.id, SOURCE.url).href }
    : SOURCE;
  if (!matchesTrack(track, record)) return noLyrics("mismatch", SOURCE);
  if (record.instrumental === true) return { kind: "instrumental", lines: [], source };
  const file = parseLyricsfile(record.lyricsfile, track, record.duration);
  if (file?.mismatch) return noLyrics("mismatch", SOURCE);
  if (file?.instrumental) return { kind: "instrumental", lines: [], source };
  if (file?.lines.length) {
    return { kind: file.lines.some((line) => line.words) ? "word" : "line", lines: file.lines, source };
  }
  const lines = parseLrc(record.syncedLyrics, track.durationMs + TIMING_TOLERANCE_MS);
  if (lines.length) return { kind: "line", lines, source };
  const plain = file?.plain.length ? file.plain : parsePlain(record.plainLyrics);
  return plain.length ? { kind: "plain", lines: plain, source } : noLyrics("missing", source);
}

export function createLyricsCache(capacity = 40, now = Date.now) {
  const entries = new Map();
  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      entries.delete(key);
      if (entry.expiresAt <= now()) return undefined;
      entries.set(key, entry);
      return entry.result;
    },
    set(key, result, ttl) {
      entries.delete(key);
      entries.set(key, { result, expiresAt: now() + ttl });
      if (entries.size > capacity) entries.delete(entries.keys().next().value);
    },
  };
}

async function readResponse(response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!/(?:\/|\+)json(?:\s*;|$)/i.test(contentType) ||
      Number(response.headers.get("content-length")) > RESPONSE_LIMIT || !response.body) {
    throw new Error("Resposta da fonte de letras inválida");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > RESPONSE_LIMIT) {
        await reader.cancel();
        throw new Error("Resposta da fonte de letras grande demais");
      }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}

export function retryAfterMs(header, now) {
  if (!header?.trim()) return 0;
  const value = Number(header);
  if (Number.isFinite(value)) return Math.max(0, value * 1000);
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(0, date - now) : 0;
}

export function createLyricsService({
  fetchLyrics = (...args) => globalThis.fetch(...args),
  now = Date.now,
  random = Math.random,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  timeoutMs = 6000,
  capacity = 40,
} = {}) {
  const cache = createLyricsCache(capacity, now);
  const pending = new Map();
  let queue = Promise.resolve();
  let nextRequestAt = 0;
  let blockedUntil = 0;

  function unavailable(header) {
    const delay = Math.max(RETRY_DELAY_MS, retryAfterMs(header, now()));
    blockedUntil = now() + delay + Math.round(delay * .25 * random());
    return noLyrics("unavailable", SOURCE, blockedUntil);
  }

  async function request(track) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const url = new URL(ENDPOINT);
    url.searchParams.set("track_name", track.title);
    url.searchParams.set("artist_name", track.primaryArtist);
    if (track.album) url.searchParams.set("album_name", track.album);
    url.searchParams.set("duration", String(Math.round(track.durationMs / 1000)));
    try {
      const response = await fetchLyrics(url, {
        signal: controller.signal,
        credentials: "omit",
        referrerPolicy: "no-referrer",
        redirect: "error",
        headers: { "Lrclib-Client": CLIENT },
      });
      if (response.status === 404) return noLyrics("missing");
      if (!response.ok) return unavailable(response.headers.get("retry-after"));
      return classifyLyrics(track, await readResponse(response));
    } catch {
      return unavailable();
    } finally {
      clearTimeout(timer);
      nextRequestAt = now() + REQUEST_GAP;
    }
  }

  /** One scheduled lookup per track key. A closed or replaced view cancels queued work. */
  function lookup(track, signal) {
    const key = trackKey(track);
    if (!key) return Promise.resolve(noLyrics("unsupported"));
    const cached = cache.get(key);
    if (cached) return Promise.resolve(cached);
    const inFlight = pending.get(key);
    if (inFlight && (inFlight.started || !inFlight.signal?.aborted)) return inFlight.promise;
    const job = { signal, started: false };
    job.promise = queue.then(async () => {
      if (signal?.aborted) return null;
      if (blockedUntil > now()) return noLyrics("unavailable", SOURCE, blockedUntil);
      const gap = nextRequestAt - now();
      if (gap > 0) await wait(gap);
      if (signal?.aborted) return null;
      job.started = true;
      const result = await request(track);
      const ttl = result.retryAt ? Math.max(0, result.retryAt - now())
        : result.kind === "none" ? 5 * ONE_MINUTE : 30 * ONE_MINUTE;
      cache.set(key, result, ttl);
      return result;
    }).finally(() => {
      if (pending.get(key) === job) pending.delete(key);
    });
    pending.set(key, job);
    queue = job.promise.catch(() => {});
    return job.promise;
  }

  return { lookup };
}
