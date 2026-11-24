import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { chromium } from "playwright";

const asset = (file) => new URL("../" + file, import.meta.url);
const manifest = JSON.parse(await readFile(asset("manifest.json"), "utf8"));
const bundle = await readFile(asset("dist/marketplace/aura.js"), "utf8");
const stylesheet = await readFile(asset(manifest.usercss), "utf8");
const wallpaper = await readFile(asset(manifest.preview));
const albumArt = "https://i.scdn.co/image/aura-test-cover";

test("o manifesto aponta para o tema, a paleta, a prévia e o bundle público", async () => {
  assert.equal(manifest.name, "AURA");
  assert.equal(manifest.include.length, 1);
  const script = new URL(manifest.include[0]);
  assert.equal(script.protocol, "https:");
  assert.equal(script.pathname.split("/").at(-1), "aura.js");
  assert.match(await readFile(asset(manifest.schemes), "utf8"), /^\[Vinil\]/m);
  assert.ok((await readFile(asset(manifest.readme))).length > 0);
  assert.ok(wallpaper.length > 0);
  assert.match(bundle, /Copyright \(C\) 2011-2015 by Vitaly Puzrin/);
  assert.doesNotMatch(bundle, /(?:bridge-config\.mjs|\/layout\/v1|Desktop ao vivo)/);
});

test("o bundle monta os painéis sem marcadores de plataforma e abre o vinil, a fila e as letras", { timeout: 40_000 }, async (t) => {
  const browser = await chromium.launch({ executablePath: process.env.AURA_TEST_CHROMIUM });
  t.after(() => browser.close());
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(albumArt, (route) => route.fulfill({
    contentType: "image/jpeg",
    headers: { "Access-Control-Allow-Origin": "*" },
    body: wallpaper,
  }));
  await page.route("https://lrclib.net/api/get?*", (route) => route.fulfill({
    headers: { "Access-Control-Allow-Origin": "*" },
    json: {
      id: 42,
      trackName: "Faixa de teste",
      artistName: "Artista de teste",
      albumName: "Álbum de teste",
      duration: 180,
      instrumental: false,
      syncedLyrics: "[00:01.00]Linha de teste",
    },
  }));

  await page.setContent('<main id="main"></main>');
  await page.addStyleTag({ content: stylesheet });
  await page.evaluate((artwork) => {
    const track = {
      uri: "spotify:track:auratest",
      name: "Faixa de teste",
      artists: [{ name: "Artista de teste" }],
      metadata: { album_title: "Álbum de teste", image_url: artwork },
    };
    const preferences = new Map([["aura:preferences", JSON.stringify({
      version: 4, nativeLayout: true, nativeCutouts: true, reduceMotion: true,
    })]]);
    globalThis.Spicetify = {
      Player: {
        data: {
          item: track,
          isPaused: false,
          nextItems: [{ ...track, uri: "spotify:track:auranext", name: "Próxima faixa" }],
        },
        addEventListener() {},
        removeEventListener() {},
        getProgress: () => 12_000,
        getDuration: () => 180_000,
        getVolume: () => 0.7,
        getShuffle: () => false,
        getRepeat: () => 0,
        getHeart: () => false,
        getMute: () => false,
        formatTime: (ms) => Math.floor(ms / 60_000) + ":00",
      },
      Platform: { History: { location: { pathname: "/" }, listen: () => () => {} } },
      LocalStorage: {
        get: (key) => preferences.get(key),
        set: (key, value) => preferences.set(key, value),
      },
    };
  }, albumArt);
  await page.addScriptTag({ content: bundle });

  await page.locator("#aura-immersive").waitFor({ state: "attached" });
  await page.locator(".aura-native-background").waitFor({ state: "attached" });
  assert.equal(await page.locator("html[data-aura-native]").count(), 0);
  await page.locator("#main").evaluate((main) => {
    main.innerHTML = '<div class="Root__top-container"><header class="Root__globalNav"></header>' +
      '<aside id="Desktop_LeftSidebar_Id" class="Root__nav-bar"></aside><article class="Root__main-view"></article>' +
      '<aside class="Root__right-sidebar"></aside><footer class="Root__now-playing-bar"></footer></div>';
  });
  await page.locator("html[data-aura-native]").waitFor();
  await page.locator(".aura-native-background img:not([hidden])").waitFor();
  assert.equal(await page.locator(".aura-native-background img").getAttribute("src"), albumArt);

  await page.keyboard.press("Control+Alt+KeyA");
  await page.locator("#aura-immersive[open]").waitFor();
  assert.equal(await page.locator('[data-aura="title"]').textContent(), "Faixa de teste");
  await page.getByText("Próxima faixa", { exact: true }).waitFor();
  await page.locator('[data-aura="lyricsButton"]').click();
  await page.getByText("Linha de teste", { exact: true }).waitFor();

  await page.locator('[data-aura="settingsButton"]').click();
  await page.locator('#aura-immersive input[type="file"]').setInputFiles({
    name: "fundo.jpg",
    mimeType: "image/jpeg",
    buffer: wallpaper,
  });
  const localBackdrop = '.aura-native-background img[src^="data:image/jpeg;base64,"]';
  await page.locator(localBackdrop).waitFor({ state: "attached" });
  assert.equal(await page.locator('select option[value="desktop"]').count(), 0);
  await page.locator('[data-aura="useCover"]').click();
  await page.locator('.aura-native-background img[src^="https:"]').waitFor({ state: "attached" });

  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.locator("#aura-immersive[open]").waitFor({ state: "detached" });
  await page.setViewportSize({ width: 950, height: 720 });
  await page.locator("html[data-aura-native]").waitFor({ state: "detached" });
  assert.deepEqual(errors, []);
});
