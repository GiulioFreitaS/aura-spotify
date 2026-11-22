(function startAura() {
  "use strict";

  const PREFERENCES_KEY = "aura:preferences";
  const DEFAULTS = { version: 2, modifiers: "ctrl-alt", key: "A", background: null, lyricsOffsetMs: 0 };
  const MAX_IMAGE_INPUT = 18 * 1024 * 1024;
  const MAX_IMAGE_DATA = 1_400_000;
  const THEME_ID = "aura-immersive";
  const IDLE_DELAY = 3600;
  const PLAYER_FALLBACK_DELAY = 500;

  const layout = `
    <div class="aura-background" aria-hidden="true">
      <img data-aura="background" alt="" referrerpolicy="no-referrer" hidden>
    </div>
    <div class="aura-shell" data-aura="shell">
      <header class="aura-header aura-chrome">
        <span class="aura-wordmark">AURA</span>
        <nav class="aura-nav" aria-label="Navegação">
          <button type="button" data-aura="library"><span class="aura-icon" data-icon="library" aria-hidden="true"></span>Biblioteca</button>
          <button type="button" data-aura="search"><span class="aura-icon" data-icon="search" aria-hidden="true"></span>Buscar</button>
          <button type="button" data-aura="lyricsButton" aria-controls="aura-lyrics" aria-expanded="false">Letras</button>
          <button type="button" data-aura="settingsButton" aria-controls="aura-settings" aria-expanded="false">Ajustes</button>
          <button type="button" data-aura="exit" class="aura-exit" aria-label="Sair do modo imersivo">Sair <kbd aria-hidden="true">Esc</kbd></button>
        </nav>
      </header>
      <div class="aura-stage">
        <div class="aura-record" aria-hidden="true">
          <div class="aura-disc">
            <div class="aura-label"><img data-aura="cover" alt="" referrerpolicy="no-referrer" hidden></div>
          </div>
        </div>
        <div class="aura-track">
          <p class="aura-playback-state" data-aura="state" hidden></p>
          <h1 class="aura-title" data-aura="title" tabindex="-1" autofocus aria-live="polite"></h1>
          <p class="aura-artist" data-aura="artist" hidden></p>
          <p class="aura-album" data-aura="album" hidden></p>
          <div class="aura-controls aura-chrome" role="group" aria-label="Controles de reprodução">
            <div class="aura-timeline">
              <time data-aura="elapsed">0:00</time>
              <input class="aura-range" data-aura="seek" type="range" min="0" max="1000" value="0" aria-label="Posição na faixa" disabled>
              <time data-aura="duration">0:00</time>
            </div>
            <div class="aura-transport">
              <div class="aura-actions">
                <button type="button" data-aura="previous" aria-label="Faixa anterior" title="Faixa anterior"><span class="aura-icon" data-icon="skip-back" aria-hidden="true"></span></button>
                <button type="button" data-aura="play" class="aura-play" aria-label="Reproduzir"><span class="aura-icon" data-aura="playIcon" aria-hidden="true"></span></button>
                <button type="button" data-aura="next" aria-label="Próxima faixa" title="Próxima faixa"><span class="aura-icon" data-icon="skip-forward" aria-hidden="true"></span></button>
              </div>
              <div class="aura-volume">
                <span class="aura-icon" data-icon="volume" aria-hidden="true"></span>
                <input class="aura-range" data-aura="volume" type="range" min="0" max="100" value="0" aria-label="Volume">
              </div>
            </div>
            <p class="aura-player-error" data-aura="playerError" role="status"></p>
          </div>
        </div>
        <section id="aura-lyrics" class="aura-lyrics" data-aura="lyrics" aria-labelledby="aura-lyrics-title" hidden>
          <header class="aura-lyrics-header">
            <h2 id="aura-lyrics-title">Letra</h2>
            <p class="aura-lyrics-meta" data-lyrics="meta" hidden>
              <a data-lyrics="source" href="https://lrclib.net/" target="_blank" rel="noopener noreferrer">LRCLIB</a>
              <span data-lyrics="kind" hidden></span>
            </p>
          </header>
          <p class="aura-lyrics-status" data-lyrics="status" role="status"></p>
          <button type="button" class="aura-lyrics-retry" data-lyrics="retry" hidden>Tentar novamente</button>
          <div class="aura-lyrics-scroll" data-lyrics="scroll" role="region" aria-label="Letra da faixa" tabindex="0" hidden></div>
        </section>
      </div>
    </div>
    <section id="aura-settings" class="aura-settings" data-aura="settings" aria-labelledby="aura-settings-title" hidden>
      <div class="aura-settings-card">
        <header class="aura-settings-header">
          <h2 id="aura-settings-title">Ajustes</h2>
          <button type="button" data-aura="settingsBack">Voltar</button>
        </header>
        <fieldset>
          <legend>Atalho de teclado</legend>
          <div class="aura-setting-options">
            <select data-aura="modifiers" aria-label="Teclas modificadoras">
              <option value="ctrl-alt">Ctrl + Alt</option>
              <option value="ctrl-shift">Ctrl + Shift</option>
            </select>
            <span aria-hidden="true">+</span>
            <select data-aura="key" aria-label="Letra do atalho"></select>
          </div>
        </fieldset>
        <fieldset>
          <legend>Fundo</legend>
          <p data-aura="backgroundChoice"></p>
          <div class="aura-setting-options">
            <button type="button" data-aura="chooseImage">Escolher imagem</button>
            <button type="button" data-aura="useCover">Usar capa do álbum</button>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/bmp" data-aura="file" hidden>
          </div>
        </fieldset>
        <fieldset>
          <legend>Letras</legend>
          <div class="aura-setting-options">
            <label for="aura-lyrics-offset">Atraso (ms)</label>
            <input id="aura-lyrics-offset" type="number" min="-5000" max="5000" step="100" data-aura="lyricsOffset" aria-describedby="aura-lyrics-offset-help">
            <button type="button" data-aura="resetLyricsOffset">Zerar</button>
          </div>
          <p id="aura-lyrics-offset-help">Valores positivos fazem a letra aparecer mais tarde.</p>
        </fieldset>
        <p data-aura="settingStatus" role="status"></p>
      </div>
    </section>`;

  function validatePreferences(value) {
    if (value?.version !== 1 && value?.version !== DEFAULTS.version) return { ...DEFAULTS };
    const { modifiers, key, background, lyricsOffsetMs } = value;
    return {
      version: DEFAULTS.version,
      modifiers: modifiers === "ctrl-shift" ? modifiers : DEFAULTS.modifiers,
      key: typeof key === "string" && /^[A-Z]$/.test(key) ? key : DEFAULTS.key,
      background: typeof background === "string" &&
        background.length <= MAX_IMAGE_DATA &&
        /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(background) ? background : null,
      lyricsOffsetMs: Number.isSafeInteger(lyricsOffsetMs) && Math.abs(lyricsOffsetMs) <= 5000 ? lyricsOffsetMs : 0,
    };
  }

  function loadPreferences(storage) {
    try {
      return validatePreferences(JSON.parse(storage.get(PREFERENCES_KEY)));
    } catch {
      return { ...DEFAULTS };
    }
  }

  async function encodeBackground(file) {
    if (file.size > MAX_IMAGE_INPUT) throw new Error("Escolha uma imagem de até 18 MiB.");
    const bitmap = await createImageBitmap(file).catch(() => {
      throw new Error("Não foi possível abrir a imagem. Escolha um JPG, PNG, WebP, AVIF ou BMP.");
    });
    try {
      const scale = Math.min(1, 1440 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d", { alpha: false });
      ctx.fillStyle = "#100e17";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const encoded = canvas.toDataURL("image/jpeg", .82);
      return encoded.length <= MAX_IMAGE_DATA ? encoded : canvas.toDataURL("image/jpeg", .62);
    } finally {
      bitmap.close();
    }
  }

  function artworkUrl(value) {
    if (typeof value !== "string") return "";
    const imageId = /^spotify:image:([a-f\d]{40})$/i.exec(value)?.[1];
    if (imageId) return "https://i.scdn.co/image/" + imageId;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
    } catch {
      return "";
    }
  }

  function trackDetails(item) {
    const meta = item?.metadata ?? {};
    const artists = item?.artists?.map((artist) => artist.name).filter(Boolean) ?? [];
    if (!artists.length) {
      for (const [key, value] of Object.entries(meta)) {
        if (/^artist_name(?::\d+)?$/.test(key) && typeof value === "string" && value) {
          artists.push(value);
        }
      }
    }
    const artwork = [
      meta.image_xlarge_url, meta.image_large_url, meta.image_url, meta.image_small_url,
      ...(item?.images ?? []).map((image) => image.url),
      ...(item?.album?.images ?? []).map((image) => image.url),
    ].map(artworkUrl).find(Boolean);
    return {
      title: item?.name || meta.title || (item ? "Faixa sem título" : "Nenhuma faixa selecionada"),
      artist: [...new Set(artists)].join(", ") || meta.album_artist_name || "",
      primaryArtist: item?.artists?.[0]?.name || meta.artist_name || artists[0] || meta.album_artist_name || "",
      album: item?.album?.name || meta.album_title || "",
      artwork: artwork ?? "",
    };
  }

  function showImage(image, source) {
    if (image.getAttribute("src") === (source || null)) return;
    image.hidden = true;
    if (source) image.src = source;
    else image.removeAttribute("src");
  }

  function navigateNative(spicetify, target) {
    // A Biblioteca lateral usa o controle nativo quando ele está disponível.
    if (target === "library") {
      const sidebar = document.querySelector("#Desktop_LeftSidebar_Id, .YourLibraryX");
      const toggle = document.querySelector('button[aria-controls="Desktop_LeftSidebar_Id"]')
        ?? sidebar?.querySelector("button.main-yourLibraryX-collapseButton");
      if (toggle?.getClientRects().length && !toggle.disabled) {
        if (toggle.getAttribute("aria-expanded") === "false" ||
            (toggle.getAttribute("aria-expanded") === null && sidebar?.clientWidth < 120)) {
          toggle.click();
        }
        toggle.focus();
        return;
      }
      const libraryLink = sidebar?.querySelector('a[href^="/collection/"], a[href^="/playlist/"]');
      if (libraryLink?.getClientRects().length) {
        libraryLink.focus();
        return;
      }
    }
    spicetify.Platform.History.push(target === "search" ? "/search" : "/collection/tracks");
  }

  function mount(spicetify) {
    const player = spicetify.Player;
    const readPlayerState = () => spicetify.Platform.PlayerAPI?.getState?.() ?? player.data;
    const trackFromState = (state) => state?.item ?? state?.track ?? null;
    const playbackId = (state) => state?.playbackId ?? state?.playback_id;
    const storage = spicetify.LocalStorage;
    const dialog = document.createElement("dialog");
    dialog.id = THEME_ID;
    dialog.lang = "pt-BR";
    dialog.setAttribute("aria-label", "Modo imersivo AURA");
    dialog.innerHTML = layout;
    document.body.append(dialog);

    const ui = Object.fromEntries([...dialog.querySelectorAll("[data-aura]")].map(
      (node) => [node.dataset.aura, node],
    ));
    const icons = spicetify.SVGIcons;
    const iconFallbacks = { play: "▶", pause: "Ⅱ", "skip-back": "⏮", "skip-forward": "⏭", volume: "◖" };

    function drawIcon(node, name) {
      if (node.dataset.currentIcon === name) return;
      node.dataset.currentIcon = name;
      const body = icons?.[name];
      if (body) {
        node.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' + body + "</svg>";
      } else node.textContent = iconFallbacks[name] ?? "";
    }

    for (const node of dialog.querySelectorAll("[data-icon]")) drawIcon(node, node.dataset.icon);
    for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") ui.key.add(new Option(letter, letter));

    const lifetime = new AbortController();
    const eventOptions = { signal: lifetime.signal };
    let prefs = loadPreferences(storage);
    let current;
    let cover = "";
    let lyricsTrack = null;
    let lyricsView;
    let lyricsModule;
    let playing = false;
    let listening = false;
    let playerTimer;
    let lastPlayerEvent = 0;
    let idleTimer;
    let releaseTimer;
    let drag;
    let imageRequest = 0;
    let playbarButton;
    let profileItem;

    const clamp = (value, max) => Math.min(max, Math.max(0, Number.isFinite(value) ? value : 0));
    const updateText = (node, text) => {
      if (node.textContent !== text) node.textContent = text;
    };

    function showControls() {
      clearTimeout(idleTimer);
      dialog.removeAttribute("data-idle");
      if (dialog.open && playing && !document.hidden && ui.settings.hidden && !drag) {
        idleTimer = setTimeout(() => dialog.setAttribute("data-idle", ""), IDLE_DELAY);
      }
    }

    function paintRange(range, value, text) {
      if (range.valueAsNumber !== value) range.value = value;
      const fill = value / Number(range.max) * 100 + "%";
      if (range.style.getPropertyValue("--aura-level") !== fill) {
        range.style.setProperty("--aura-level", fill);
      }
      if (range.getAttribute("aria-valuetext") !== text) range.setAttribute("aria-valuetext", text);
    }

    function paintProgress(position = player.getProgress()) {
      const duration = clamp(player.getDuration(), Number.MAX_SAFE_INTEGER);
      const elapsed = clamp(position, duration);
      const elapsedLabel = player.formatTime(elapsed);
      const durationLabel = player.formatTime(duration);
      ui.seek.disabled = !current || duration <= 0;
      updateText(ui.elapsed, elapsedLabel);
      updateText(ui.duration, durationLabel);
      paintRange(ui.seek, duration ? Math.round(elapsed / duration * 1000) : 0, elapsedLabel + " de " + durationLabel);
      if (lyricsView && !ui.lyrics.hidden && dialog.open && !document.hidden) {
        lyricsView.setTrack(lyricsTrack, duration);
        lyricsView.updateTime(elapsed, prefs.lyricsOffsetMs);
      }
    }

    function paintVolume(level) {
      const value = Math.round(clamp(level, 1) * 100);
      paintRange(ui.volume, value, value + "%");
    }

    function syncProgress() {
      if (!dialog.open || document.hidden) return;
      const state = readPlayerState();
      const track = trackFromState(state);
      if (track !== current) syncTrack(track);
      syncPlayback(state);
      if (drag?.slider !== ui.seek) paintProgress();
      if (drag?.slider !== ui.volume) paintVolume(player.getVolume());
    }

    function syncPlayback(state) {
      const paused = state?.isPaused ?? state?.is_paused;
      const isPlaying = Boolean(current && (typeof paused === "boolean" ? !paused : player.isPlaying()));
      const buffering = state?.isBuffering ?? state?.is_buffering;
      const shouldSpin = isPlaying && !buffering;
      const changed = playing !== shouldSpin;
      playing = shouldSpin;
      dialog.toggleAttribute("data-playing", playing);
      updateText(ui.state, isPlaying ? (buffering ? "Carregando" : "Em reprodução") : "Em pausa");
      const label = isPlaying ? "Pausar" : "Reproduzir";
      if (ui.play.title !== label) {
        ui.play.setAttribute("aria-label", label);
        ui.play.title = label;
        drawIcon(ui.playIcon, isPlaying ? "pause" : "play");
      }
      if (changed) showControls();
    }

    function syncBackground() {
      dialog.toggleAttribute("data-local-background", Boolean(prefs.background));
      showImage(ui.background, prefs.background || cover);
    }

    function syncTrack(track) {
      const changedTrack = current?.uri !== track?.uri;
      current = track;
      const { title, artist, album, artwork, primaryArtist } = trackDetails(current);
      lyricsTrack = current ? { uri: current.uri, title: current.name || current.metadata?.title || "", artist, primaryArtist, album } : null;
      updateText(ui.title, title);
      updateText(ui.artist, artist);
      updateText(ui.album, album);
      ui.artist.hidden = !artist;
      ui.album.hidden = !album;
      ui.state.hidden = !current;
      ui.previous.disabled = ui.play.disabled = ui.next.disabled = !current;
      cover = artwork;
      showImage(ui.cover, cover);
      syncBackground();
      paintProgress();
      if (changedTrack) showControls();
    }

    const playerEvents = ["songchange", "onplaypause", "onprogress"];

    function onPlayerEvent() {
      lastPlayerEvent = performance.now();
      syncProgress();
    }

    function observePlayer() {
      const shouldListen = dialog.open && !document.hidden;
      if (shouldListen === listening) return;
      listening = shouldListen;
      for (const type of playerEvents) {
        if (listening) player.addEventListener(type, onPlayerEvent);
        else player.removeEventListener(type, onPlayerEvent);
      }
      if (listening) {
        onPlayerEvent();
        playerTimer = setInterval(() => {
          if (performance.now() - lastPlayerEvent >= PLAYER_FALLBACK_DELAY) syncProgress();
        }, PLAYER_FALLBACK_DELAY);
      } else {
        clearInterval(playerTimer);
        playing = false;
        dialog.removeAttribute("data-playing");
        lyricsView?.clear();
        showControls();
      }
    }

    function syncSettings() {
      ui.modifiers.value = prefs.modifiers;
      ui.key.value = prefs.key;
      ui.lyricsOffset.value = prefs.lyricsOffsetMs;
      ui.resetLyricsOffset.disabled = prefs.lyricsOffsetMs === 0;
      ui.backgroundChoice.textContent = prefs.background ? "Imagem local em uso" : "Capa do álbum em uso";
      ui.useCover.disabled = !prefs.background;
      if (playbarButton) {
        const label = (prefs.modifiers === "ctrl-shift" ? "Ctrl+Shift+" : "Ctrl+Alt+") + prefs.key;
        playbarButton.label = "AURA · Modo imersivo (" + label + ")";
        playbarButton.element.setAttribute("aria-keyshortcuts", label.replace("Ctrl", "Control"));
      }
    }

    function savePreferences(change) {
      const next = validatePreferences({ ...prefs, ...change });
      try {
        storage.set(PREFERENCES_KEY, JSON.stringify(next));
        prefs = next;
        ui.settingStatus.textContent = "";
      } catch {
        ui.settingStatus.textContent = "Não foi possível salvar os ajustes no Spotify.";
      }
      syncSettings();
      syncBackground();
      if (dialog.open && !ui.lyrics.hidden) paintProgress();
    }

    function toggleLyrics() {
      const open = ui.lyrics.hidden;
      ui.lyrics.hidden = !open;
      ui.lyricsButton.setAttribute("aria-expanded", String(open));
      dialog.toggleAttribute("data-lyrics", open);
      showControls();
      if (!open) {
        lyricsView?.clear();
        return;
      }
      if (lyricsView) {
        paintProgress();
        return;
      }
      const status = ui.lyrics.querySelector('[data-lyrics="status"]');
      status.hidden = false;
      status.textContent = "Carregando letras…";
      lyricsModule ??= import("./node_modules/aura-lyrics/view.mjs").then(({ createLyricsView }) => {
        if (lifetime.signal.aborted) return;
        lyricsView = createLyricsView(ui.lyrics, lifetime.signal);
        if (!ui.lyrics.hidden && dialog.open) paintProgress();
      }).catch(() => {
        status.textContent = "O módulo de letras não pôde ser carregado.";
        lyricsModule = undefined;
      });
    }

    function openSettings() {
      syncSettings();
      ui.settingStatus.textContent = "";
      ui.settings.hidden = false;
      ui.settingsButton.setAttribute("aria-expanded", "true");
      dialog.setAttribute("aria-labelledby", "aura-settings-title");
      ui.shell.inert = true;
      ui.settingsBack.focus();
      showControls();
    }

    function closeSettings(restoreFocus) {
      imageRequest += 1;
      ui.chooseImage.disabled = false;
      ui.settings.hidden = true;
      ui.settingsButton.setAttribute("aria-expanded", "false");
      dialog.removeAttribute("aria-labelledby");
      ui.shell.inert = false;
      if (restoreFocus) ui.settingsButton.focus();
      showControls();
    }

    function closeView() {
      if (dialog.open) dialog.close();
      if (!ui.lyrics.hidden) toggleLyrics();
      if (!ui.settings.hidden) closeSettings(false);
      clearTimeout(releaseTimer);
      drag = null;
      observePlayer();
      current = undefined;
      showImage(ui.cover, "");
      showImage(ui.background, "");
      updateText(ui.playerError, "");
    }

    function toggleView() {
      if (dialog.open) {
        closeView();
        return;
      }
      if (getComputedStyle(dialog).getPropertyValue("--aura-theme").trim() !== "1") {
        spicetify.showNotification("Ative o tema AURA para abrir o modo imersivo.", true);
        return;
      }
      dialog.showModal();
      observePlayer();
    }

    function keyDown(event) {
      if (event.repeat || event.isComposing || event.getModifierState("AltGraph")) return;
      const editing = event.target instanceof Element &&
        event.target.closest('input:not([type="range"]), textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]');
      const useShift = prefs.modifiers === "ctrl-shift";
      if (editing || event.code !== "Key" + prefs.key || !event.ctrlKey || event.metaKey ||
          event.altKey !== !useShift || event.shiftKey !== useShift) return;
      event.preventDefault();
      event.stopPropagation();
      toggleView();
    }

    async function control(action) {
      updateText(ui.playerError, "");
      try {
        await action();
      } catch {
        if (dialog.open) updateText(ui.playerError, "O Spotify não conseguiu executar esse controle.");
      }
    }

    function clearDrag(event) {
      if (event.pointerId !== drag?.pointerId) return;
      clearTimeout(releaseTimer);
      // Deixa o evento change do controle nativo concluir o gesto.
      releaseTimer = setTimeout(() => {
        drag = null;
        if (event.type === "pointercancel") syncProgress();
        showControls();
      }, 0);
    }

    for (const slider of [ui.seek, ui.volume]) {
      slider.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || !event.isPrimary) return;
        clearTimeout(releaseTimer);
        const state = readPlayerState();
        drag = { slider, pointerId: event.pointerId, uri: trackFromState(state)?.uri, playbackId: playbackId(state) };
        showControls();
      }, eventOptions);
    }

    ui.seek.addEventListener("input", () => {
      paintProgress(player.getDuration() * ui.seek.valueAsNumber / 1000);
    }, eventOptions);
    ui.seek.addEventListener("change", () => {
      const state = readPlayerState();
      const track = trackFromState(state);
      if (drag?.slider === ui.seek && (drag.uri !== track?.uri || drag.playbackId !== playbackId(state))) {
        paintProgress();
        return;
      }
      const position = Math.round(player.getDuration() * ui.seek.valueAsNumber / 1000);
      if (track && !ui.seek.disabled) control(() => player.seek(position));
    }, eventOptions);
    ui.volume.addEventListener("input", () => paintVolume(ui.volume.valueAsNumber / 100), eventOptions);
    ui.volume.addEventListener("change", () => control(() => player.setVolume(ui.volume.valueAsNumber / 100)), eventOptions);
    ui.play.addEventListener("click", () => control(() => player.togglePlay()), eventOptions);
    ui.previous.addEventListener("click", () => control(() => player.back()), eventOptions);
    ui.next.addEventListener("click", () => control(() => player.next()), eventOptions);

    ui.settingsButton.addEventListener("click", openSettings, eventOptions);
    ui.lyricsButton.addEventListener("click", toggleLyrics, eventOptions);
    ui.settingsBack.addEventListener("click", () => closeSettings(true), eventOptions);
    ui.exit.addEventListener("click", closeView, eventOptions);
    for (const target of ["library", "search"]) {
      ui[target].addEventListener("click", () => {
        closeView();
        try {
          navigateNative(spicetify, target);
        } catch {
          spicetify.showNotification("Abra a Biblioteca ou a Busca pelos controles do Spotify.", true);
        }
      }, eventOptions);
    }

    for (const setting of ["modifiers", "key"]) {
      ui[setting].addEventListener("change", () => savePreferences({ [setting]: ui[setting].value }), eventOptions);
    }
    ui.lyricsOffset.addEventListener("change", () => {
      const offset = ui.lyricsOffset.valueAsNumber;
      savePreferences({ lyricsOffsetMs: Number.isFinite(offset) ? Math.round(Math.max(-5000, Math.min(5000, offset))) : 0 });
    }, eventOptions);
    ui.resetLyricsOffset.addEventListener("click", () => savePreferences({ lyricsOffsetMs: 0 }), eventOptions);
    ui.chooseImage.addEventListener("click", () => ui.file.click(), eventOptions);
    ui.useCover.addEventListener("click", () => {
      imageRequest += 1;
      ui.chooseImage.disabled = false;
      savePreferences({ background: null });
    }, eventOptions);
    ui.file.addEventListener("change", async () => {
      const file = ui.file.files[0];
      ui.file.value = "";
      if (!file) return;
      const request = ++imageRequest;
      ui.chooseImage.disabled = true;
      ui.settingStatus.textContent = "Preparando imagem…";
      try {
        const background = await encodeBackground(file);
        if (request !== imageRequest) return;
        if (!validatePreferences({ ...prefs, background }).background) {
          throw new Error("A imagem ficou grande demais. Escolha uma imagem menor.");
        }
        savePreferences({ background });
      } catch (error) {
        if (request === imageRequest) updateText(ui.settingStatus, error.message);
      } finally {
        if (request === imageRequest) ui.chooseImage.disabled = false;
      }
    }, eventOptions);

    for (const image of [ui.cover, ui.background]) {
      image.addEventListener("load", () => { image.hidden = image.currentSrc !== image.src; }, eventOptions);
    }
    ui.cover.addEventListener("error", () => { ui.cover.hidden = true; }, eventOptions);
    ui.background.addEventListener("error", () => {
      if (prefs.background && ui.background.getAttribute("src") === prefs.background) {
        prefs = { ...prefs, background: null };
        savePreferences({});
      } else ui.background.hidden = true;
    }, eventOptions);

    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      if (ui.settings.hidden) closeView();
      else closeSettings(true);
    }, eventOptions);
    dialog.addEventListener("close", () => {
      if (!dialog.open) closeView();
    }, eventOptions);
    for (const event of ["pointermove", "pointerdown", "keydown", "focusin"]) {
      dialog.addEventListener(event, showControls, eventOptions);
    }
    window.addEventListener("pointerup", clearDrag, { ...eventOptions, capture: true });
    window.addEventListener("pointercancel", clearDrag, { ...eventOptions, capture: true });
    window.addEventListener("keydown", keyDown, { ...eventOptions, capture: true });
    document.addEventListener("visibilitychange", observePlayer, eventOptions);

    const label = "AURA · Modo imersivo";
    try {
      if (spicetify.Playbar?.Button) playbarButton = new spicetify.Playbar.Button(label, "album", toggleView, false, false, true);
    } catch (error) {
      console.warn("[AURA] Botão da barra indisponível.", error);
    }
    const fallbackTimer = setTimeout(() => {
      if (playbarButton?.element?.isConnected || !spicetify.Menu?.Item) return;
      profileItem = new spicetify.Menu.Item(label, false, toggleView, "album");
      profileItem.register();
    }, playbarButton ? 2000 : 0);
    syncSettings();

    window.addEventListener("pagehide", () => {
      closeView();
      lifetime.abort();
      clearTimeout(fallbackTimer);
      playbarButton?.deregister();
      profileItem?.deregister();
      dialog.remove();
    }, { once: true });
  }

  function init(attempt = 0) {
    const spicetify = globalThis.Spicetify;
    if (document.getElementById(THEME_ID)) return;
    if (!document.body || !spicetify?.Player?.addEventListener ||
        !spicetify.Platform?.History || !spicetify.LocalStorage) {
      if (attempt < 80) setTimeout(() => init(attempt + 1), 250);
      else console.warn("[AURA] As APIs necessárias do Spicetify não carregaram.");
      return;
    }
    mount(spicetify);
  }

  init();
})();
