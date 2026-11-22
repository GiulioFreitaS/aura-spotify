import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyLyrics,
  createLyricsCache,
  createLyricsService,
  matchesTrack,
  parseLrc,
  retryAfterMs,
  trackKey,
} from "../Extensions/aura-lyrics/index.mjs";

const track = {
  uri: "spotify:track:exemplo-aura",
  title: "Jardim das Marés (feat. Iara)",
  artist: "Maré Alta, Iara",
  primaryArtist: "Maré Alta",
  album: "Vento Leve",
  durationMs: 180_400,
};

const record = {
  id: 21,
  trackName: "Jardim das Mares",
  artistName: "Maré Alta feat. Iara",
  albumName: "Vento Leve",
  duration: 180,
  plainLyrics: "A janela acende\n\nO céu clareia",
};

const lyricsfile = `
version: "1.0"
metadata:
  duration_ms: 180000
  artist: Maré Alta
  title: Jardim das Marés
lines:
  - words:
      - text: "Vento "
        end_ms: 1600
        start_ms: 1200
      - start_ms: 1600
        text: leve
    end_ms: 2400
    text: Vento leve
    start_ms: 1200
  - text: Chuva mansa
    start_ms: 1750
    end_ms: 2300
`;

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

test("LRC usa as marcações recebidas, ordena repetições e preserva lacunas", () => {
  const lrc = "\uFEFF[ar:Maré Alta]\r\n[offset:+100]\r\n[01:02.345][00:01.2] Vento leve\n" +
    "[00:02.12]Chuva\n[00:03]\n[00:61.99]Inválido\n[0100:00]Fora da duração";
  assert.deepEqual(parseLrc(lrc, 80_000), [
    { text: "Vento leve", startMs: 1100 },
    { text: "Chuva", startMs: 2020 },
    { text: "", startMs: 2900 },
    { text: "Vento leve", startMs: 62_245 },
  ]);
  assert.deepEqual(parseLrc("sem tempo\n[00:02]"), []);
});

test("aceita metadados equivalentes e descarta versões, artistas ou durações diferentes", () => {
  assert.equal(matchesTrack(track, record), true);
  assert.equal(matchesTrack(track, { ...record, trackName: "Jardim das Marés - Ao Vivo" }), false);
  assert.equal(matchesTrack(track, { ...record, artistName: "Iara, Outro Artista" }), false);
  assert.equal(matchesTrack(track, { ...record, artistName: "Maré Alta 2" }), false);
  assert.equal(matchesTrack(track, { ...record, duration: 177 }), false);
  assert.equal(matchesTrack(track, { ...record, duration: "180" }), false);
  assert.equal(trackKey({ ...track, uri: "spotify:local:privado" }), null);
  assert.equal(trackKey({ ...track, durationMs: 0 }), null);
  assert.equal(classifyLyrics(track, { ...record, instrumental: true, duration: 171 }).reason, "mismatch");
});

test("Lyricsfile preserva palavras com tempos reais e permite linhas sobrepostas", () => {
  const result = classifyLyrics(track, { ...record, lyricsfile });
  assert.equal(result.kind, "word");
  assert.equal(result.source.url, "https://lrclib.net/tracks/21");
  assert.deepEqual(result.lines, [
    {
      text: "Vento leve", startMs: 1200, endMs: 2400, words: [
        { text: "Vento ", startMs: 1200, endMs: 1600 },
        { text: "leve", startMs: 1600 },
      ],
    },
    { text: "Chuva mansa", startMs: 1750, endMs: 2300, words: undefined },
  ]);
});

test("tempos por palavra inválidos voltam a sincronizar só por linha", () => {
  for (const invalid of [
    lyricsfile.replace("start_ms: 1600", "start_ms: 1100"),
    lyricsfile.replace("text: leve", "text: vento"),
    lyricsfile.replace("end_ms: 1600", "end_ms: 2600"),
  ]) {
    const result = classifyLyrics(track, { ...record, lyricsfile: invalid });
    assert.equal(result.kind, "line");
    assert.equal(result.lines[0].words, undefined);
  }
});

test("confere os metadados do Lyricsfile e usa LRC quando o formato é inválido", () => {
  const wrong = lyricsfile.replace("title: Jardim das Marés", "title: Crescendo no escuro");
  assert.equal(classifyLyrics(track, { ...record, lyricsfile: wrong }).reason, "mismatch");
  for (const input of [
    lyricsfile.replace('version: "1.0"', 'version: "2.0"'),
    lyricsfile.replace("  artist: Maré Alta", "  artist: Maré Alta\n  artist: Outra pessoa"),
    lyricsfile.replace("lines:", "referencia: &trecho Exemplo\nalias: *trecho\nlines:"),
  ]) {
    assert.deepEqual(classifyLyrics(track, { ...record, lyricsfile: input, syncedLyrics: "[00:05]Vento leve" }).lines,
      [{ text: "Vento leve", startMs: 5000 }]);
  }
});

test("diferencia letra simples, instrumental e ausência de letra", () => {
  const plain = classifyLyrics(track, record);
  assert.equal(plain.kind, "plain");
  assert.deepEqual(plain.lines, [{ text: "A janela acende" }, { text: "" }, { text: "O céu clareia" }]);
  assert.equal(classifyLyrics(track, { ...record, instrumental: true }).kind, "instrumental");
  assert.equal(classifyLyrics(track, { ...record, plainLyrics: null }).reason, "missing");
});

test("cache limitado remove o menos recente e expira registros positivos e negativos", () => {
  let now = 100;
  const cache = createLyricsCache(2, () => now);
  cache.set("faixa-a", { kind: "line" }, 10);
  cache.set("faixa-b", { kind: "none" }, 20);
  assert.equal(cache.get("faixa-a").kind, "line");
  cache.set("faixa-c", { kind: "plain" }, 5);
  assert.equal(cache.get("faixa-b"), undefined);
  now = 105;
  assert.equal(cache.get("faixa-c"), undefined);
  assert.equal(cache.get("faixa-a").kind, "line");
  now = 110;
  assert.equal(cache.get("faixa-a"), undefined);
});

test("consulta uma vez por assinatura e envia só os campos da música", async () => {
  const requests = [];
  const service = createLyricsService({ fetchLyrics: async (url, init) => {
    requests.push({ url, init });
    return json(record);
  } });
  const first = service.lookup(track);
  assert.strictEqual(first, service.lookup({ ...track }));
  const result = await first;
  assert.equal(result.kind, "plain");
  assert.strictEqual(await service.lookup(track), result);
  assert.equal(requests.length, 1);
  assert.deepEqual(Object.fromEntries(requests[0].url.searchParams), {
    track_name: track.title,
    artist_name: track.primaryArtist,
    album_name: track.album,
    duration: "180",
  });
  assert.equal(requests[0].init.credentials, "omit");
  assert.match(requests[0].init.headers["Lrclib-Client"], /^AURA\//);
  assert.equal(requests[0].init.referrerPolicy, "no-referrer");
  assert.equal(requests[0].url.origin, "https://lrclib.net");
});

test("espera entre consultas, ignora faixas canceladas e guarda resposta ausente", async () => {
  let now = 1000;
  const waits = [];
  let calls = 0;
  const service = createLyricsService({
    now: () => now,
    wait: async (ms) => { waits.push(ms); now += ms; },
    fetchLyrics: async () => { calls++; return json({}, 404); },
  });
  const first = service.lookup(track);
  const controller = new AbortController();
  const secondTrack = { ...track, uri: "spotify:track:segunda" };
  const canceled = service.lookup(secondTrack, controller.signal);
  controller.abort();
  const revisit = service.lookup(secondTrack);
  assert.equal((await first).reason, "missing");
  assert.equal(await canceled, null);
  assert.equal((await revisit).reason, "missing");
  assert.equal((await service.lookup(track)).reason, "missing");
  assert.equal(calls, 2);
  assert.deepEqual(waits, [350]);
});

test("honra Retry-After e espaça uma nova tentativa explícita", async () => {
  let now = 1000;
  let calls = 0;
  const service = createLyricsService({
    now: () => now,
    random: () => 0.5,
    fetchLyrics: async () => ++calls === 1 ? json({}, 429, { "Retry-After": "60" }) : json(record),
  });
  const result = await service.lookup(track);
  assert.equal(result.reason, "unavailable");
  assert.equal(result.retryAt, 68_500);
  assert.strictEqual(await service.lookup(track), result);
  assert.equal((await service.lookup({ ...track, uri: "spotify:track:outra" })).retryAt, result.retryAt);
  assert.equal(calls, 1);
  now = result.retryAt;
  assert.equal((await service.lookup(track)).kind, "plain");
  assert.equal(calls, 2);
  assert.equal(retryAfterMs("Thu, 01 Jan 1970 00:01:00 GMT", 10_000), 50_000);
});

test("cancela resposta lenta e mantém a falha no cache até o próximo horário", async () => {
  let calls = 0;
  const service = createLyricsService({
    timeoutMs: 15,
    random: () => 0,
    fetchLyrics: (_url, { signal }) => {
      calls++;
      return new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("timeout do teste")), { once: true });
      });
    },
  });
  const result = await service.lookup(track);
  assert.equal(result.reason, "unavailable");
  assert.ok(result.retryAt > Date.now());
  assert.strictEqual(await service.lookup(track), result);
  assert.equal(calls, 1);
});
