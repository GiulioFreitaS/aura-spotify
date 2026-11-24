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

async function exerciseBundle(t, locale, labels) {
  const browser = await chromium.launch({ executablePath: process.env.AURA_TEST_CHROMIUM });
  t.after(() => browser.close());
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(albumArt, (route) => route.fulfill({
    contentType: "image/png",
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
  await page.evaluate(({ artwork, locale }) => {
    const track = {
      uri: "spotify:track:auratest",
      name: "Faixa de teste",
      artists: [{ name: "Artista de teste" }],
      metadata: { album_title: "Álbum de teste", image_url: artwork },
    };
    const preferences = new Map([["aura:preferences", JSON.stringify({
      version: 4, nativeLayout: true, nativeCutouts: true, reduceMotion: true,
    })]]);
    document.documentElement.lang = "en";
    globalThis.Spicetify = {
      Locale: locale === "en-GB" ? { getLocale: () => locale } : undefined,
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
      Platform: { Session: { locale: "pt-BR" }, History: { location: { pathname: "/" }, listen: () => () => {} } },
      LocalStorage: {
        get: (key) => preferences.get(key),
        set: (key, value) => preferences.set(key, value),
      },
    };
  }, { artwork: albumArt, locale });
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
  const immersive = page.locator("#aura-immersive[open]");
  await immersive.waitFor();
  assert.equal(await immersive.getAttribute("lang"), labels.lang);
  assert.equal(await page.locator('[data-aura="title"]').textContent(), "Faixa de teste");
  await page.getByRole("heading", { name: labels.upNext, exact: true }).waitFor();
  await page.getByText(labels.playing, { exact: true }).waitFor();
  await page.getByText("Próxima faixa", { exact: true }).waitFor();
  await page.locator('[data-aura="lyricsButton"]').click();
  await page.getByText("Linha de teste", { exact: true }).waitFor();
  await page.getByText(labels.lineSynced, { exact: true }).waitFor();

  await page.getByRole("button", { name: labels.settings, exact: true }).click();
  await page.getByRole("heading", { name: labels.settings, exact: true }).waitFor();
  await page.getByRole("button", { name: labels.chooseImage, exact: true }).waitFor();
  await page.locator('#aura-immersive input[type="file"]').setInputFiles({
    name: "fundo.png",
    mimeType: "image/png",
    buffer: wallpaper,
  });
  const localBackdrop = '.aura-native-background img[src^="data:image/jpeg;base64,"]';
  await page.locator(localBackdrop).waitFor({ state: "attached" });
  assert.equal(await page.locator('select option[value="desktop"]').count(), 0);
  await page.getByText(labels.localImage, { exact: true }).waitFor();
  await page.getByRole("button", { name: labels.useAlbumCover, exact: true }).click();
  await page.locator('.aura-native-background img[src^="https:"]').waitFor({ state: "attached" });

  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.locator("#aura-immersive[open]").waitFor({ state: "detached" });
  await page.setViewportSize({ width: 950, height: 720 });
  await page.locator("html[data-aura-native]").waitFor({ state: "detached" });
  assert.deepEqual(errors, []);
}

test("os painéis, o modo imersivo e os ajustes usam o português da sessão do Spotify", { timeout: 40_000 }, (t) => {
  return exerciseBundle(t, "pt-BR", {
    lang: "pt-BR", upNext: "A seguir", playing: "Em reprodução", lineSynced: "Por linha",
    settings: "Ajustes", chooseImage: "Escolher imagem", useAlbumCover: "Usar capa do álbum",
    localImage: "Imagem local em uso",
  });
});

test("o idioma inglês do Spotify prevalece nos painéis, nos ajustes e nos estados do player", { timeout: 40_000 }, (t) => {
  return exerciseBundle(t, "en-GB", {
    lang: "en", upNext: "Up next", playing: "Playing", lineSynced: "Line synced",
    settings: "Settings", chooseImage: "Choose image", useAlbumCover: "Use album cover",
    localImage: "Using a local image",
  });
});
