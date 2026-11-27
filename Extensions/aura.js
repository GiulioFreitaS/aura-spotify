(function startAura() {
  "use strict";

  const PREFERENCES_KEY = "aura:preferences";
  const VISUAL_DEFAULTS = {
    dim: 32, colorMode: "album", accent: "#dba581", discSize: 100, depth: 72,
    lyricsSize: 100, lyricsPosition: "side", showClock: true, showQueue: true,
    reduceMotion: false, autoHide: false,
  };
  const NATIVE_DEFAULTS = { nativeLayout: true };
  const DEFAULTS = { version: 4, modifiers: "ctrl-alt", key: "A", background: null, lyricsOffsetMs: 0, ...VISUAL_DEFAULTS, ...NATIVE_DEFAULTS };
  const VISUAL_RANGES = { dim: [0, 80], discSize: [70, 116], depth: [0, 100], lyricsSize: [80, 135] };
  const VISUAL_TOGGLES = ["showClock", "showQueue", "reduceMotion", "autoHide"];
  const TOGGLES = [...VISUAL_TOGGLES, "nativeLayout"];
  const HEX_COLOR = /^#[a-f\d]{6}$/i;
  const MAX_IMAGE_INPUT = 18 * 1024 * 1024;
  const MAX_IMAGE_DATA = 1_400_000;
  const THEME_ID = "aura-immersive";
  const IDLE_DELAY = 3600;
  const PLAYER_FALLBACK_DELAY = 500;

  const MESSAGES = {
    settings: ["Ajustes", "Settings", "Ayarlar"],
    exit: ["Sair", "Exit", "Çık"],
    exitImmersive: ["Sair do modo imersivo", "Exit immersive mode", "Sürükleyici moddan çık"],
    searchSpotify: ["Buscar no Spotify", "Search Spotify", "Spotify'da ara"],
    searchCatalog: ["Buscar músicas, artistas e álbuns", "Search songs, artists, and albums", "Şarkı, sanatçı ve albüm ara"],
    navigation: ["Navegação do AURA", "AURA navigation", "AURA gezinme menüsü"],
    nowPlaying: ["Reprodução", "Now playing", "Şimdi çalıyor"],
    lyrics: ["Letras", "Lyrics", "Şarkı sözleri"],
    library: ["Biblioteca", "Library", "Kitaplığın"],
    likedSongs: ["Músicas curtidas", "Liked Songs", "Beğenilen Şarkılar"],
    queueAndLyrics: ["Fila e letra", "Queue and lyrics", "Çalma sırası ve şarkı sözleri"],
    upNext: ["A seguir", "Up next", "Sıradakiler"],
    playbackQueue: ["Fila de reprodução", "Playback queue", "Çalma sırası"],
    addedToQueue: ["Adicionadas à fila", "Added to queue", "Sıraya eklenenler"],
    comingUp: ["Em seguida", "Coming up", "Ardından"],
    upcomingTracks: ["Próximas faixas", "Upcoming tracks", "Sonraki parçalar"],
    lyricsHeading: ["Letra", "Lyrics", "Şarkı sözleri"],
    retry: ["Tentar novamente", "Try again", "Tekrar dene"],
    trackLyrics: ["Letra da faixa", "Song lyrics", "Parçanın sözleri"],
    playbackControls: ["Controles de reprodução", "Playback controls", "Oynatma kontrolleri"],
    likeTrack: ["Curtir faixa", "Like track", "Parçayı beğen"],
    shuffle: ["Modo aleatório", "Shuffle", "Karışık çal"],
    previousTrack: ["Faixa anterior", "Previous track", "Önceki parça"],
    play: ["Reproduzir", "Play", "Çal"],
    nextTrack: ["Próxima faixa", "Next track", "Sonraki parça"],
    repeatOff: ["Repetição desligada", "Repeat off", "Tekrar kapalı"],
    trackPosition: ["Posição na faixa", "Track position", "Parçadaki konum"],
    mute: ["Silenciar", "Mute", "Sesi kapat"],
    back: ["Voltar", "Back", "Geri"],
    sceneAndColor: ["Cena e cor", "Scene and color", "Sahne ve renk"],
    chooseImage: ["Escolher imagem", "Choose image", "Görsel seç"],
    useAlbumCover: ["Usar capa do álbum", "Use album cover", "Albüm kapağını kullan"],
    dimming: ["Escurecimento", "Dimming", "Karartma"],
    accentColor: ["Cor de destaque", "Accent color", "Vurgu rengi"],
    fromAlbumCover: ["Da capa", "From album cover", "Albüm kapağından"],
    chooseAccent: ["Escolher cor de destaque", "Choose accent color", "Vurgu rengini seç"],
    composition: ["Composição", "Layout", "Düzen"],
    depth: ["Profundidade 3D e brilho decorativo", "3D depth and glow", "3B derinlik ve parıltı"],
    recordSize: ["Tamanho do disco", "Record size", "Plak boyutu"],
    clock: ["Relógio", "Clock", "Saat"],
    sideQueue: ["Fila lateral", "Queue sidebar", "Yan panelde çalma sırası"],
    reduceMotion: ["Reduzir movimento", "Reduce motion", "Hareketi azalt"],
    autoHide: ["Recolher controles", "Auto-hide controls", "Kontrolleri otomatik gizle"],
    lyricsPosition: ["Posição", "Position", "Konum"],
    sidePanel: ["Painel lateral", "Side panel", "Yan panel"],
    belowRecord: ["Abaixo do disco", "Below the record", "Plağın altında"],
    textSize: ["Tamanho do texto", "Text size", "Metin boyutu"],
    lyricsDelay: ["Atraso (ms)", "Delay (ms)", "Gecikme (ms)"],
    reset: ["Zerar", "Reset", "Sıfırla"],
    lyricsOffsetHelp: ["Valores positivos fazem a letra aparecer mais tarde.", "Positive values make lyrics appear later.", "Pozitif değerler şarkı sözlerinin daha geç görünmesini sağlar."],
    keyboardShortcut: ["Atalho de teclado", "Keyboard shortcut", "Klavye kısayolu"],
    modifierKeys: ["Teclas modificadoras", "Modifier keys", "Değiştirici tuşlar"],
    shortcutLetter: ["Letra do atalho", "Shortcut letter", "Kısayol harfi"],
    spotifyWindow: ["Janela normal do Spotify", "Spotify desktop layout", "Spotify pencere görünümü"],
    floatingPanels: ["Layout em painéis", "Floating panels", "Yüzen paneller"],
    resetVisual: ["Restaurar visual do AURA", "Reset AURA appearance", "AURA görünümünü sıfırla"],
    imageSizeError: ["Escolha uma imagem de até 18 MiB.", "Choose an image up to 18 MiB.", "En fazla 18 MiB boyutunda bir görsel seç."],
    imageOpenError: ["Não foi possível abrir a imagem. Escolha um JPG, PNG, WebP, AVIF ou BMP.", "Could not open the image. Choose a JPG, PNG, WebP, AVIF, or BMP.", "Görsel açılamadı. JPG, PNG, WebP, AVIF veya BMP biçiminde bir dosya seç."],
    untitledTrack: ["Faixa sem título", "Untitled track", "Adsız parça"],
    noSelectedTrack: ["Nenhuma faixa selecionada", "No track selected", "Parça seçilmedi"],
    noTrack: ["Nenhuma faixa", "No track", "Parça yok"],
    immersiveMode: ["Modo imersivo", "Immersive mode", "Sürükleyici mod"],
    timeSeparator: [" de ", " of ", " / "],
    buffering: ["Carregando", "Loading", "Yükleniyor"],
    playing: ["Em reprodução", "Playing", "Çalıyor"],
    paused: ["Em pausa", "Paused", "Duraklatıldı"],
    pause: ["Pausar", "Pause", "Duraklat"],
    repeatTrack: ["Repetir faixa", "Repeat track", "Parçayı tekrarla"],
    repeatQueue: ["Repetir fila", "Repeat queue", "Çalma sırasını tekrarla"],
    unlikeTrack: ["Remover das músicas curtidas", "Remove from Liked Songs", "Beğenilen Şarkılar'dan kaldır"],
    unmute: ["Reativar som", "Unmute", "Sesi aç"],
    emptyQueue: ["Nenhuma próxima faixa na fila.", "No upcoming tracks.", "Sırada başka parça yok."],
    queueUnavailable: ["A fila está indisponível.", "Queue unavailable.", "Çalma sırası kullanılamıyor."],
    localImageActive: ["Imagem local em uso", "Using a local image", "Yerel görsel kullanılıyor"],
    albumCoverActive: ["Capa do álbum em uso", "Using album cover", "Albüm kapağı kullanılıyor"],
    saveError: ["Não foi possível salvar os ajustes no Spotify.", "Could not save settings in Spotify.", "Ayarlar Spotify'a kaydedilemedi."],
    loadingLyrics: ["Carregando letras…", "Loading lyrics…", "Şarkı sözleri yükleniyor…"],
    lyricsModuleError: ["O módulo de letras não pôde ser carregado.", "Could not load the lyrics module.", "Şarkı sözleri modülü yüklenemedi."],
    themeRequired: ["Ative o tema AURA para abrir o modo imersivo.", "Enable the AURA theme to open immersive mode.", "Sürükleyici modu açmak için AURA temasını etkinleştir."],
    playerError: ["O Spotify não conseguiu executar esse controle.", "Spotify could not complete this playback action.", "Spotify bu oynatma işlemini tamamlayamadı."],
    navigationError: ["Abra a Biblioteca ou a Busca pelos controles do Spotify.", "Open Your Library or Search using Spotify’s own controls.", "Kitaplığın'ı veya Ara bölümünü Spotify'ın kendi kontrollerinden aç."],
    preparingImage: ["Preparando imagem…", "Preparing image…", "Görsel hazırlanıyor…"],
    imageStillTooLarge: ["A imagem ficou grande demais. Escolha uma imagem menor.", "The image is too large. Choose a smaller image.", "Görsel çok büyük. Daha küçük bir görsel seç."],
    lyricsMissing: ["Letra indisponível para esta faixa.", "Lyrics are unavailable for this track.", "Bu parça için şarkı sözü bulunamadı."],
    lyricsMismatch: ["A letra encontrada não corresponde a esta versão da faixa.", "The lyrics do not match this version of the track.", "Bulunan sözler parçanın bu sürümüyle eşleşmiyor."],
    lyricsUnsupported: ["A busca de letras está disponível para músicas do catálogo.", "Lyrics lookup is available for songs in the Spotify catalog.", "Şarkı sözü araması yalnızca Spotify kataloğundaki şarkılarda kullanılabilir."],
    lyricsSourceUnavailable: ["A fonte de letras está indisponível agora.", "The lyrics provider is currently unavailable.", "Şarkı sözü sağlayıcısına şu anda ulaşılamıyor."],
    lyricsByWord: ["Por palavra", "Word synced", "Kelime kelime eşzamanlı"],
    lyricsByLine: ["Por linha", "Line synced", "Satır satır eşzamanlı"],
    lyricsUnsynced: ["Sem sincronização", "Unsynced", "Eşzamanlı değil"],
    lyricsInstrumental: ["Faixa instrumental", "Instrumental track", "Enstrümantal parça"],
    lyricsSearching: ["Buscando letra…", "Looking up lyrics…", "Şarkı sözleri aranıyor…"],
    lyricsEmpty: ["Toque uma faixa para ver a letra.", "Play a track to see its lyrics.", "Sözlerini görmek için bir parça çal."],
    volume: ["Volume", "Volume", "Ses düzeyi"],
    manualColor: ["Manual", "Manual", "Elle seç"],
  };

  const layout = (text) => `
    <div class="aura-background" aria-hidden="true">
      <img data-aura="background" alt="" referrerpolicy="no-referrer" hidden>
    </div>
    <div class="aura-shell" data-aura="shell">
      <header class="aura-header">
        <span class="aura-wordmark">AURA</span>
        <div class="aura-header-actions aura-chrome">
          <button type="button" data-aura="settingsButton" aria-controls="aura-settings" aria-expanded="false"><span class="aura-icon" data-icon="settings" aria-hidden="true"></span>${text.settings}</button>
          <button type="button" data-aura="exit" class="aura-exit" aria-label="${text.exitImmersive}">${text.exit} <kbd aria-hidden="true">Esc</kbd></button>
        </div>
      </header>
      <div class="aura-stage" data-aura="stage">
        <div class="aura-wing aura-wing-left aura-glass">
          <form class="aura-search" data-aura="searchForm" role="search" aria-label="${text.searchSpotify}">
            <button type="submit" data-aura="search" aria-label="${text.searchSpotify}" title="${text.searchSpotify}"><span class="aura-icon" data-icon="search" aria-hidden="true"></span></button>
            <input type="search" data-aura="query" aria-label="${text.searchCatalog}" placeholder="${text.searchSpotify}" maxlength="120" autocomplete="off">
          </form>
          <nav class="aura-nav" aria-label="${text.navigation}">
            <button type="button" data-aura="now" aria-controls="aura-scene" aria-pressed="true"><span class="aura-icon" data-icon="album" aria-hidden="true"></span>${text.nowPlaying}</button>
            <button type="button" data-aura="lyricsButton" aria-controls="aura-lyrics" aria-expanded="false"><span class="aura-icon" data-icon="lyrics" aria-hidden="true"></span>${text.lyrics}</button>
            <button type="button" data-aura="library"><span class="aura-icon" data-icon="library" aria-hidden="true"></span>${text.library}</button>
            <button type="button" data-aura="favorites"><span class="aura-icon" data-icon="heart" aria-hidden="true"></span>${text.likedSongs}</button>
          </nav>
          <div class="aura-clock" data-aura="clock" hidden>
            <time data-aura="clockTime"></time>
            <span data-aura="clockDate"></span>
          </div>
        </div>
        <section id="aura-scene" class="aura-scene aura-glass" data-aura="scene" aria-labelledby="aura-title">
          <div class="aura-hero">
            <div class="aura-turntable" aria-hidden="true">
              <div class="aura-record">
                <div class="aura-disc">
                  <div class="aura-label"><img data-aura="cover" alt="" referrerpolicy="no-referrer" hidden></div>
                </div>
              </div>
            </div>
            <div class="aura-track">
              <p class="aura-playback-state" data-aura="state" hidden></p>
              <h1 id="aura-title" class="aura-title" data-aura="title" tabindex="-1" autofocus aria-live="polite"></h1>
              <p class="aura-artist" data-aura="artist" hidden></p>
              <p class="aura-album" data-aura="album" hidden></p>
            </div>
          </div>
        </section>
        <aside class="aura-wing aura-wing-right aura-glass" data-aura="side" aria-label="${text.queueAndLyrics}">
          <section class="aura-queue" data-aura="queue" aria-labelledby="aura-queue-title">
            <h2 id="aura-queue-title"><span class="aura-icon" data-icon="queue" aria-hidden="true"></span>${text.upNext}</h2>
            <p class="aura-queue-empty" data-aura="queueStatus" hidden></p>
            <div class="aura-queue-scroll" data-aura="queueScroll" role="region" aria-label="${text.playbackQueue}" tabindex="0" hidden>
              <div data-aura="queueManualGroup" hidden>
                <h3>${text.addedToQueue}</h3>
                <ol class="aura-queue-tracks" data-aura="queueManual"></ol>
              </div>
              <div data-aura="queueNextGroup" hidden>
                <h3 data-aura="queueNextHeading" hidden>${text.comingUp}</h3>
                <ol class="aura-queue-tracks" data-aura="queueTracks" aria-label="${text.upcomingTracks}"></ol>
              </div>
            </div>
          </section>
          <section id="aura-lyrics" class="aura-lyrics" data-aura="lyrics" aria-labelledby="aura-lyrics-title" hidden>
            <header class="aura-lyrics-header">
              <h2 id="aura-lyrics-title"><span class="aura-icon" data-icon="lyrics" aria-hidden="true"></span>${text.lyricsHeading}</h2>
              <p class="aura-lyrics-meta" data-lyrics="meta" hidden>
                <a data-lyrics="source" href="https://lrclib.net/" target="_blank" rel="noopener noreferrer">LRCLIB</a>
                <span data-lyrics="kind" hidden></span>
              </p>
            </header>
            <p class="aura-lyrics-status" data-lyrics="status" role="status"></p>
            <button type="button" class="aura-lyrics-retry" data-lyrics="retry" hidden>${text.retry}</button>
            <div class="aura-lyrics-scroll" data-lyrics="scroll" role="region" aria-label="${text.trackLyrics}" tabindex="0" hidden></div>
          </section>
        </aside>
      </div>
      <footer class="aura-dock aura-glass aura-chrome" role="group" aria-label="${text.playbackControls}">
        <div class="aura-dock-track">
          <div class="aura-dock-cover" aria-hidden="true"><img data-aura="dockCover" alt="" referrerpolicy="no-referrer" hidden></div>
          <div class="aura-dock-labels">
            <span data-aura="dockTitle"></span>
            <span data-aura="dockArtist" hidden></span>
          </div>
          <button type="button" data-aura="like" aria-pressed="false" aria-label="${text.likeTrack}" title="${text.likeTrack}"><span class="aura-icon" data-aura="likeIcon" aria-hidden="true"></span></button>
        </div>
        <div class="aura-actions">
          <button type="button" data-aura="shuffle" aria-pressed="false" aria-label="${text.shuffle}" title="${text.shuffle}"><span class="aura-icon" data-icon="shuffle" aria-hidden="true"></span></button>
          <button type="button" data-aura="previous" aria-label="${text.previousTrack}" title="${text.previousTrack}"><span class="aura-icon" data-icon="skip-back" aria-hidden="true"></span></button>
          <button type="button" data-aura="play" class="aura-play" aria-label="${text.play}"><span class="aura-icon" data-aura="playIcon" aria-hidden="true"></span></button>
          <button type="button" data-aura="next" aria-label="${text.nextTrack}" title="${text.nextTrack}"><span class="aura-icon" data-icon="skip-forward" aria-hidden="true"></span></button>
          <button type="button" data-aura="repeat" aria-pressed="false" aria-label="${text.repeatOff}" title="${text.repeatOff}"><span class="aura-icon" data-aura="repeatIcon" aria-hidden="true"></span></button>
        </div>
        <div class="aura-timeline">
          <time data-aura="elapsed">0:00</time>
          <input class="aura-range" data-aura="seek" type="range" min="0" max="1000" value="0" aria-label="${text.trackPosition}" disabled>
          <time data-aura="duration">0:00</time>
        </div>
        <div class="aura-volume">
          <button type="button" data-aura="mute" aria-pressed="false" aria-label="${text.mute}" title="${text.mute}"><span class="aura-icon" data-aura="muteIcon" aria-hidden="true"></span></button>
          <input class="aura-range" data-aura="volume" type="range" min="0" max="100" value="0" aria-label="${text.volume}">
        </div>
        <p class="aura-player-error" data-aura="playerError" role="status"></p>
      </footer>
    </div>
    <section id="aura-settings" class="aura-settings" data-aura="settings" aria-labelledby="aura-settings-title" hidden>
      <div class="aura-settings-card aura-glass">
        <header class="aura-settings-header">
          <h2 id="aura-settings-title">${text.settings}</h2>
          <button type="button" data-aura="settingsBack">${text.back}</button>
        </header>
        <div class="aura-settings-grid">
          <fieldset>
            <legend>${text.sceneAndColor}</legend>
            <p data-aura="backgroundChoice"></p>
            <div class="aura-setting-options">
              <button type="button" data-aura="chooseImage">${text.chooseImage}</button>
              <button type="button" data-aura="useCover">${text.useAlbumCover}</button>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/bmp" data-aura="file" hidden>
            </div>
            <label class="aura-setting-slider">${text.dimming}<input class="aura-range" type="range" data-aura="dim" min="0" max="80" step="1"></label>
            <div class="aura-setting-options">
              <label for="aura-color-mode">${text.accentColor}</label>
              <select id="aura-color-mode" data-aura="colorMode">
                <option value="album">${text.fromAlbumCover}</option>
                <option value="manual">${text.manualColor}</option>
              </select>
              <input type="color" data-aura="accent" aria-label="${text.chooseAccent}">
            </div>
          </fieldset>
          <fieldset>
            <legend>${text.composition}</legend>
            <label class="aura-setting-slider">${text.depth}<input class="aura-range" type="range" data-aura="depth" min="0" max="100" step="1"></label>
            <label class="aura-setting-slider">${text.recordSize}<input class="aura-range" type="range" data-aura="discSize" min="70" max="116" step="1"></label>
            <div class="aura-setting-toggles">
              <label><input type="checkbox" data-aura="showClock">${text.clock}</label>
              <label><input type="checkbox" data-aura="showQueue">${text.sideQueue}</label>
              <label><input type="checkbox" data-aura="reduceMotion">${text.reduceMotion}</label>
              <label><input type="checkbox" data-aura="autoHide">${text.autoHide}</label>
            </div>
          </fieldset>
          <fieldset>
            <legend>${text.lyrics}</legend>
            <div class="aura-setting-options">
              <label for="aura-lyrics-position">${text.lyricsPosition}</label>
              <select id="aura-lyrics-position" data-aura="lyricsPosition">
                <option value="side">${text.sidePanel}</option>
                <option value="below">${text.belowRecord}</option>
              </select>
            </div>
            <label class="aura-setting-slider">${text.textSize}<input class="aura-range" type="range" data-aura="lyricsSize" min="80" max="135" step="1"></label>
            <div class="aura-setting-options">
              <label for="aura-lyrics-offset">${text.lyricsDelay}</label>
              <input id="aura-lyrics-offset" type="number" min="-5000" max="5000" step="100" data-aura="lyricsOffset" aria-describedby="aura-lyrics-offset-help">
              <button type="button" data-aura="resetLyricsOffset">${text.reset}</button>
            </div>
            <p id="aura-lyrics-offset-help">${text.lyricsOffsetHelp}</p>
          </fieldset>
          <fieldset>
            <legend>${text.keyboardShortcut}</legend>
            <div class="aura-setting-options">
              <select data-aura="modifiers" aria-label="${text.modifierKeys}">
                <option value="ctrl-alt">Ctrl + Alt</option>
                <option value="ctrl-shift">Ctrl + Shift</option>
              </select>
              <span aria-hidden="true">+</span>
              <select data-aura="key" aria-label="${text.shortcutLetter}"></select>
            </div>
          </fieldset>
          <fieldset>
            <legend>${text.spotifyWindow}</legend>
            <div class="aura-setting-toggles">
              <label><input type="checkbox" data-aura="nativeLayout">${text.floatingPanels}</label>
            </div>
          </fieldset>
        </div>
        <footer class="aura-settings-footer">
          <button type="button" data-aura="resetVisual">${text.resetVisual}</button>
          <p data-aura="settingStatus" role="status"></p>
        </footer>
      </div>
    </section>`;

  function validatePreferences(value) {
    if (![1, 2, 3, DEFAULTS.version].includes(value?.version)) return { ...DEFAULTS };
    const { modifiers, key, background, lyricsOffsetMs } = value;
    const visual = { ...VISUAL_DEFAULTS, ...NATIVE_DEFAULTS };
    for (const [setting, [min, max]] of Object.entries(VISUAL_RANGES)) {
      if (Number.isInteger(value[setting]) && value[setting] >= min && value[setting] <= max) visual[setting] = value[setting];
    }
    for (const setting of TOGGLES) {
      if (typeof value[setting] === "boolean") visual[setting] = value[setting];
    }
    return {
      ...visual,
      colorMode: value.colorMode === "manual" ? "manual" : VISUAL_DEFAULTS.colorMode,
      accent: typeof value.accent === "string" && HEX_COLOR.test(value.accent) ? value.accent.toLowerCase() : VISUAL_DEFAULTS.accent,
      lyricsPosition: value.lyricsPosition === "below" ? "below" : VISUAL_DEFAULTS.lyricsPosition,
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

  async function encodeBackground(file, text) {
    if (file.size > MAX_IMAGE_INPUT) throw new Error(text.imageSizeError);
    const bitmap = await createImageBitmap(file).catch(() => {
      throw new Error(text.imageOpenError);
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

  function thumbnailArtwork(item) {
    return artworkUrl(item?.metadata?.image_small_url) || artworkUrl(item?.metadata?.image_url);
  }

  function trackDetails(item, text) {
    const meta = item?.metadata ?? {};
    const artists = Array.isArray(item?.artists) ? item.artists.map((artist) => artist?.name).filter(Boolean) : [];
    if (!artists.length) {
      for (const [key, value] of Object.entries(meta)) {
        if (/^artist_name(?::\d+)?$/.test(key) && typeof value === "string" && value) {
          artists.push(value);
        }
      }
    }
    const artwork = [
      meta.image_xlarge_url, meta.image_large_url, meta.image_url, meta.image_small_url,
      ...(Array.isArray(item?.images) ? item.images : []).map((image) => image?.url ?? image?.uri),
      ...(Array.isArray(item?.album?.images) ? item.album.images : []).map((image) => image?.url ?? image?.uri),
    ].map(artworkUrl).find(Boolean);
    return {
      title: item?.name || meta.title || (item ? text.untitledTrack : text.noSelectedTrack),
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

  function readQueue(spicetify, state) {
    const origin = spicetify.Player.origin ?? spicetify.Platform.PlayerAPI;
    try {
      // No 1.3.9 a fila do player separa inserções manuais da sequência do álbum ou playlist.
      const queue = origin?.getQueue?.();
      if (Array.isArray(queue?.queued) && Array.isArray(queue?.nextUp)) {
        return { manual: queue.queued, next: queue.nextUp };
      }
    } catch { /* O player pode ainda estar se conectando ao dispositivo. */ }
    const tracks = Array.isArray(state?.nextItems) ? state.nextItems : spicetify.Queue?.nextTracks;
    if (!Array.isArray(tracks)) return null;
    return {
      manual: tracks.filter((track) => track?.provider === "queue"),
      next: tracks.filter((track) => track?.provider !== "queue"),
    };
  }

  function observeQueue(spicetify, listener) {
    const origin = spicetify.Player.origin ?? spicetify.Platform.PlayerAPI;
    try {
      const events = origin?.getEvents?.();
      if (typeof events?.addListener !== "function" || typeof events?.removeListener !== "function") return;
      const stop = events.addListener("queue_update", listener);
      return typeof stop === "function" ? stop : () => events.removeListener("queue_update", listener);
    } catch { /* O ciclo de atualização do player também pode ler a fila. */ }
  }

  function coverAccent(image) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 24;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0, 24, 24);
    const { data } = context.getImageData(0, 0, 24, 24);
    const buckets = new Map();
    for (let i = 0; i < data.length; i += 4) {
      const red = data[i], green = data[i + 1], blue = data[i + 2];
      const max = Math.max(red, green, blue), min = Math.min(red, green, blue);
      const saturation = max - min;
      if (data[i + 3] < 192 || saturation < 26 || max < 55 || min > 223) continue;
      const key = (red >> 5) * 64 + (green >> 5) * 8 + (blue >> 5);
      const bucket = buckets.get(key) ?? { red: 0, green: 0, blue: 0, weight: 0 };
      const weight = 1 + saturation / 128;
      bucket.red += red * weight;
      bucket.green += green * weight;
      bucket.blue += blue * weight;
      bucket.weight += weight;
      buckets.set(key, bucket);
    }
    const best = [...buckets.values()].sort((left, right) => right.weight - left.weight)[0];
    if (!best) return VISUAL_DEFAULTS.accent;
    return "#" + [best.red, best.green, best.blue].map((sum) =>
      Math.round(sum / best.weight).toString(16).padStart(2, "0"),
    ).join("");
  }

  function navigateNative(spicetify, target, query = "") {
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
    if (target === "search") {
      spicetify.Platform.History.push(query ? "/search/" + encodeURIComponent(query) : "/search");
    } else spicetify.Platform.History.push("/collection/tracks");
  }

  function mount(spicetify) {
    const locale = spicetify.Locale?.getLocale?.() || spicetify.Platform.Session?.locale ||
      document.documentElement.lang || "pt-BR";
    // A coluna segue a ordem das traduções em MESSAGES: português, inglês, turco.
    const [lang, column] = /^pt(?:[-_]|$)/i.test(locale) ? ["pt-BR", 0]
      : /^tr(?:[-_]|$)/i.test(locale) ? ["tr-TR", 2] : ["en", 1];
    const text = Object.fromEntries(Object.entries(MESSAGES).map(([key, values]) => [key, values[column]]));
    const immersiveLabel = "AURA · " + text.immersiveMode;
    const player = spicetify.Player;
    const readPlayerState = () => spicetify.Platform.PlayerAPI?.getState?.() ?? player.data;
    const trackFromState = (state) => state?.item ?? state?.track ?? null;
    const playbackId = (state) => state?.playbackId ?? state?.playback_id;
    const storage = spicetify.LocalStorage;
    const dialog = document.createElement("dialog");
    dialog.id = THEME_ID;
    dialog.lang = lang;
    dialog.setAttribute("aria-label", immersiveLabel);
    dialog.innerHTML = layout(text);
    document.body.append(dialog);

    const ui = Object.fromEntries([...dialog.querySelectorAll("[data-aura]")].map(
      (node) => [node.dataset.aura, node],
    ));
    const icons = spicetify.SVGIcons;
    const iconFallbacks = {
      album: "◉", heart: "♡", "heart-active": "♥", library: "▥", lyrics: "♫", play: "▶", pause: "Ⅱ",
      queue: "≡", repeat: "↻", "repeat-once": "↻¹", search: "⌕", settings: "⚙", shuffle: "⤨",
      "skip-back": "⏮", "skip-forward": "⏭", volume: "◖", "volume-off": "◖×",
    };

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
    for (const [button, suffix] of Object.entries({ like: "Heart", mute: "Mute", repeat: "Repeat", shuffle: "Shuffle" })) {
      ui[button].hidden = typeof player["toggle" + suffix] !== "function" || typeof player["get" + suffix] !== "function";
    }

    const lifetime = new AbortController();
    const eventOptions = { signal: lifetime.signal };
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    const stacked = matchMedia("(max-width: 50rem)");
    const timeFormat = new Intl.DateTimeFormat(lang, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    const dateFormat = new Intl.DateTimeFormat(lang, { weekday: "short", day: "numeric", month: "long" });
    const accents = new Map();
    let prefs = loadPreferences(storage);
    let current;
    let cover = "";
    let accentInput;
    let queueSnapshot;
    let manualQueueKeys = new Set();
    let stopQueue;
    let lyricsTrack = null;
    let lyricsView;
    let lyricsModule;
    let playing = false;
    let listening = false;
    let playerTimer;
    let lastPlayerEvent = 0;
    let lastExtras = -Infinity;
    let clockTimer;
    let pointerTimer;
    let pointerX;
    let pointerY;
    let idleTimer;
    let releaseTimer;
    let drag;
    let imageRequest = 0;
    let playbarButton;
    let profileItem;
    let nativeLayout;
    let immersiveMotion;

    const clamp = (value, max) => Math.min(max, Math.max(0, Number.isFinite(value) ? value : 0));
    const updateText = (node, text) => {
      if (node.textContent !== text) node.textContent = text;
    };

    function showControls() {
      clearTimeout(idleTimer);
      dialog.removeAttribute("data-idle");
      if (prefs.autoHide && dialog.open && playing && !document.hidden && ui.settings.hidden && !drag) {
        idleTimer = setTimeout(() => dialog.setAttribute("data-idle", ""), IDLE_DELAY);
      }
    }

    function paintRange(range, value, text) {
      if (range.valueAsNumber !== value) range.value = value;
      const min = Number(range.min);
      const fill = (value - min) / (Number(range.max) - min) * 100 + "%";
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
      paintRange(ui.seek, duration ? Math.round(elapsed / duration * 1000) : 0, elapsedLabel + text.timeSeparator + durationLabel);
      if (lyricsView && !ui.lyrics.hidden && dialog.open && !document.hidden) {
        lyricsView.setTrack(lyricsTrack, duration);
        lyricsView.updateTime(elapsed, prefs.lyricsOffsetMs);
      }
    }

    function paintVolume(level) {
      const value = Math.round(clamp(level, 1) * 100);
      paintRange(ui.volume, value, value + "%");
    }

    function syncProgress(forceExtras = false) {
      if (!dialog.open || document.hidden) return;
      const state = readPlayerState();
      const track = trackFromState(state);
      if (track !== current) syncTrack(track);
      syncPlayback(state);
      if (drag?.slider !== ui.seek) paintProgress();
      if (drag?.slider !== ui.volume) paintVolume(player.getVolume());
      const now = performance.now();
      if (forceExtras || now - lastExtras >= PLAYER_FALLBACK_DELAY) {
        lastExtras = now;
        syncPlaybackButtons(state);
        if (!stopQueue) syncQueue(state);
      }
    }

    function syncPlayback(state) {
      const paused = state?.isPaused ?? state?.is_paused;
      const isPlaying = Boolean(current && (typeof paused === "boolean" ? !paused : player.isPlaying()));
      const buffering = state?.isBuffering ?? state?.is_buffering;
      const shouldSpin = isPlaying && !buffering;
      const changed = playing !== shouldSpin;
      playing = shouldSpin;
      dialog.toggleAttribute("data-playing", playing);
      updateText(ui.state, isPlaying ? (buffering ? text.buffering : text.playing) : text.paused);
      const label = isPlaying ? text.pause : text.play;
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

    function accentForArtwork(source) {
      if (accents.has(source)) return accents.get(source);
      const sample = new Image();
      sample.crossOrigin = "anonymous";
      sample.referrerPolicy = "no-referrer";
      sample.src = source;
      const color = sample.decode().then(() => coverAccent(sample)).catch(() => VISUAL_DEFAULTS.accent);
      if (accents.size >= 32) accents.delete(accents.keys().next().value);
      accents.set(source, color);
      return color;
    }

    function syncAccent() {
      const manual = prefs.colorMode === "manual";
      const source = manual ? prefs.accent : thumbnailArtwork(current) || cover;
      if (source === accentInput) return;
      accentInput = source;
      if (manual || !source) {
        dialog.style.setProperty("--aura-accent-color", source || VISUAL_DEFAULTS.accent);
        return;
      }
      void accentForArtwork(source).then((color) => {
        if (!lifetime.signal.aborted && accentInput === source) dialog.style.setProperty("--aura-accent-color", color);
      });
    }

    function syncPlaybackButtons(state) {
      if (!ui.shuffle.hidden) ui.shuffle.setAttribute("aria-pressed", String(Boolean(state && player.getShuffle())));
      if (!ui.repeat.hidden) {
        const repeat = state && player.getRepeat();
        const label = repeat === 2 ? text.repeatTrack : repeat === 1 ? text.repeatQueue : text.repeatOff;
        ui.repeat.setAttribute("aria-pressed", String(repeat === 1 || repeat === 2));
        ui.repeat.setAttribute("aria-label", label);
        ui.repeat.title = label;
        drawIcon(ui.repeatIcon, repeat === 2 ? "repeat-once" : "repeat");
      }
      if (!ui.like.hidden) {
        const liked = Boolean(current && player.getHeart());
        const label = liked ? text.unlikeTrack : text.likeTrack;
        ui.like.setAttribute("aria-pressed", String(liked));
        ui.like.setAttribute("aria-label", label);
        ui.like.title = label;
        drawIcon(ui.likeIcon, liked ? "heart-active" : "heart");
      }
      if (!ui.mute.hidden) {
        const muted = Boolean(player.getMute());
        const label = muted ? text.unmute : text.mute;
        ui.mute.setAttribute("aria-pressed", String(muted));
        ui.mute.setAttribute("aria-label", label);
        ui.mute.title = label;
        drawIcon(ui.muteIcon, muted ? "volume-off" : "volume");
      }
    }

    function queueTracks(tracks) {
      const occurrences = new Map();
      return tracks.filter((item) =>
        typeof item?.uri === "string" && item.uri && !/^spotify:(?:delimiter|separator)(?::|$)/.test(item.uri),
      ).map((item) => {
        const occurrence = (occurrences.get(item.uri) ?? 0) + 1;
        occurrences.set(item.uri, occurrence);
        return { key: item.uid || item.uri + "#" + occurrence, ...trackDetails(item, text) };
      });
    }

    function syncQueue(state) {
      if (!dialog.open || document.hidden || ui.queue.hidden) return;
      const queue = readQueue(spicetify, state ?? readPlayerState());
      const manual = queueTracks(queue?.manual ?? []);
      const next = queueTracks(queue?.next ?? []);
      const status = manual.length || next.length ? "" :
        queue ? text.emptyQueue : text.queueUnavailable;
      const manualSignature = JSON.stringify(manual);
      const nextSignature = JSON.stringify(next);
      if (queueSnapshot?.status === status && queueSnapshot.manual === manualSignature &&
          queueSnapshot.next === nextSignature) return;
      updateText(ui.queueStatus, status);
      ui.queueStatus.hidden = !status;
      ui.queueScroll.hidden = Boolean(status);
      ui.queueManualGroup.hidden = !manual.length;
      ui.queueNextGroup.hidden = !next.length;
      ui.queueNextHeading.hidden = !manual.length;
      const rowFor = ({ title, artist, artwork }, arriving) => {
        const row = document.createElement("li");
        if (arriving) row.setAttribute("data-aura-queue-arrival", "");
        const cover = document.createElement("span");
        cover.className = "aura-queue-cover";
        if (artwork) {
          const image = new Image();
          image.alt = "";
          image.referrerPolicy = "no-referrer";
          image.decoding = "async";
          image.loading = "lazy";
          image.addEventListener("error", () => image.remove(), { once: true });
          image.src = artwork;
          cover.append(image);
        }
        const details = document.createElement("span");
        details.className = "aura-queue-labels";
        details.title = artist ? title + " · " + artist : title;
        const name = document.createElement("strong");
        name.textContent = title;
        details.append(name);
        if (artist) {
          const byline = document.createElement("span");
          byline.textContent = artist;
          details.append(byline);
        }
        row.append(cover, details);
        return row;
      };
      if (queueSnapshot?.manual !== manualSignature) {
        const updating = queueSnapshot !== undefined;
        ui.queueManual.replaceChildren(...manual.map((item) => rowFor(item, updating && !manualQueueKeys.has(item.key))));
        manualQueueKeys = new Set(manual.map((item) => item.key));
      }
      if (queueSnapshot?.next !== nextSignature) {
        ui.queueTracks.replaceChildren(...next.map((item) => rowFor(item, false)));
      }
      queueSnapshot = { status, manual: manualSignature, next: nextSignature };
    }

    function syncTrack(track) {
      const changedTrack = current?.uri !== track?.uri;
      const animateTrack = Boolean(changedTrack && current && track && ui.settings.hidden);
      current = track;
      const { title, artist, album, artwork, primaryArtist } = trackDetails(current, text);
      lyricsTrack = current ? { uri: current.uri, title: current.name || current.metadata?.title || "", artist, primaryArtist, album } : null;
      updateText(ui.title, title);
      updateText(ui.dockTitle, current ? title : text.noTrack);
      updateText(ui.artist, artist);
      updateText(ui.dockArtist, artist);
      updateText(ui.album, album);
      ui.artist.hidden = !artist;
      ui.dockArtist.hidden = !artist;
      ui.album.hidden = !album;
      ui.state.hidden = !current;
      ui.previous.disabled = ui.play.disabled = ui.next.disabled = ui.like.disabled =
        ui.shuffle.disabled = ui.repeat.disabled = !current;
      cover = artwork;
      showImage(ui.cover, cover);
      showImage(ui.dockCover, cover);
      syncAccent();
      syncBackground();
      paintProgress();
      if (changedTrack) showControls();
      if (animateTrack) {
        immersiveMotion?.wave(ui.cover.closest(".aura-record"), 310);
        immersiveMotion?.reveal(ui.title.parentElement, 7);
      }
    }

    const playerEvents = ["songchange", "onplaypause", "onprogress"];

    function onPlayerEvent(event) {
      lastPlayerEvent = performance.now();
      syncProgress(event?.type !== "onprogress");
      if (stopQueue && event?.type === "songchange") syncQueue();
    }

    function observePlayer() {
      syncClock();
      const shouldListen = dialog.open && !document.hidden;
      if (shouldListen === listening) return;
      listening = shouldListen;
      for (const type of playerEvents) {
        if (listening) player.addEventListener(type, onPlayerEvent);
        else player.removeEventListener(type, onPlayerEvent);
      }
      if (listening) {
        stopQueue = observeQueue(spicetify, () => syncQueue());
        syncQueue();
        onPlayerEvent();
        playerTimer = setInterval(() => {
          if (performance.now() - lastPlayerEvent >= PLAYER_FALLBACK_DELAY) syncProgress();
        }, PLAYER_FALLBACK_DELAY);
      } else {
        stopQueue?.();
        stopQueue = undefined;
        clearInterval(playerTimer);
        playing = false;
        dialog.removeAttribute("data-playing");
        lyricsView?.clear();
        resetParallax();
        showControls();
      }
    }

    function syncClock() {
      clearTimeout(clockTimer);
      ui.clock.hidden = !prefs.showClock;
      if (!dialog.open || document.hidden || ui.clock.hidden) return;
      const date = new Date();
      updateText(ui.clockTime, timeFormat.format(date));
      updateText(ui.clockDate, dateFormat.format(date));
      clockTimer = setTimeout(syncClock, 60_000 - date.getTime() % 60_000 + 25);
    }

    function resetParallax() {
      clearTimeout(pointerTimer);
      pointerTimer = undefined;
      ui.stage.style.removeProperty("--aura-drift-x");
      ui.stage.style.removeProperty("--aura-drift-y");
    }

    function moveParallax(event) {
      if (event.pointerType !== "mouse" || reducedMotion.matches || prefs.reduceMotion || !prefs.depth ||
          !ui.settings.hidden || stacked.matches) return;
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (pointerTimer !== undefined) return;
      pointerTimer = setTimeout(() => {
        pointerTimer = undefined;
        const strength = prefs.depth / 100;
        ui.stage.style.setProperty("--aura-drift-x", ((pointerX / dialog.clientWidth - .5) * 15 * strength).toFixed(2) + "px");
        ui.stage.style.setProperty("--aura-drift-y", ((pointerY / dialog.clientHeight - .5) * 11 * strength).toFixed(2) + "px");
      }, 40);
    }

    function applyVisualRanges(visual) {
      dialog.style.setProperty("--aura-dim", visual.dim / 100);
      dialog.style.setProperty("--aura-effect", visual.depth / 100);
      dialog.style.setProperty("--aura-tilt", visual.depth * .2 + "deg");
      dialog.style.setProperty("--aura-disc-scale", visual.discSize / 100);
      dialog.style.setProperty("--aura-lyrics-scale", visual.lyricsSize / 100);
      dialog.toggleAttribute("data-no-effects", visual.depth === 0);
    }

    function syncPanels() {
      const queueWasHidden = ui.queue.hidden;
      const below = prefs.lyricsPosition === "below";
      const parent = below ? ui.scene : ui.side;
      if (ui.lyrics.parentElement !== parent) parent.append(ui.lyrics);
      const sideLyrics = !below && !ui.lyrics.hidden;
      ui.queue.hidden = sideLyrics || !prefs.showQueue;
      ui.side.hidden = ui.queue.hidden && !sideLyrics;
      dialog.toggleAttribute("data-no-side", ui.side.hidden);
      dialog.toggleAttribute("data-side-lyrics", sideLyrics);
      if (queueWasHidden && !ui.queue.hidden) syncQueue();
    }

    function syncSettings() {
      ui.modifiers.value = prefs.modifiers;
      ui.key.value = prefs.key;
      ui.lyricsOffset.value = prefs.lyricsOffsetMs;
      ui.resetLyricsOffset.disabled = prefs.lyricsOffsetMs === 0;
      ui.backgroundChoice.textContent = prefs.background ? text.localImageActive : text.albumCoverActive;
      ui.useCover.disabled = !prefs.background;
      ui.colorMode.value = prefs.colorMode;
      ui.accent.value = prefs.accent;
      ui.accent.disabled = prefs.colorMode !== "manual";
      ui.lyricsPosition.value = prefs.lyricsPosition;
      for (const setting of TOGGLES) ui[setting].checked = prefs[setting];
      for (const setting of Object.keys(VISUAL_RANGES)) paintRange(ui[setting], prefs[setting], prefs[setting] + "%");
      dialog.toggleAttribute("data-reduced", prefs.reduceMotion);
      if (prefs.reduceMotion) immersiveMotion?.clear();
      applyVisualRanges(prefs);
      syncAccent();
      syncPanels();
      syncClock();
      if (playbarButton) {
        const label = (prefs.modifiers === "ctrl-shift" ? "Ctrl+Shift+" : "Ctrl+Alt+") + prefs.key;
        playbarButton.label = immersiveLabel + " (" + label + ")";
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
        ui.settingStatus.textContent = text.saveError;
      }
      syncSettings();
      syncBackground();
      nativeLayout?.refresh();
      showControls();
      if (dialog.open) syncProgress(true);
    }

    function toggleLyrics() {
      const open = ui.lyrics.hidden;
      ui.lyrics.hidden = !open;
      ui.lyricsButton.setAttribute("aria-expanded", String(open));
      ui.now.setAttribute("aria-pressed", String(!open));
      syncPanels();
      showControls();
      if (!open) {
        lyricsView?.clear();
        return;
      }
      immersiveMotion?.reveal(ui.lyrics);
      if (stacked.matches || prefs.lyricsPosition === "below") ui.lyrics.scrollIntoView({ block: "nearest" });
      if (lyricsView) {
        paintProgress();
        return;
      }
      const status = ui.lyrics.querySelector('[data-lyrics="status"]');
      status.hidden = false;
      status.textContent = text.loadingLyrics;
      lyricsModule ??= import("./node_modules/aura-lyrics/view.mjs").then(({ createLyricsView }) => {
        if (lifetime.signal.aborted) return;
        lyricsView = createLyricsView(ui.lyrics, lifetime.signal, () => prefs.reduceMotion, text);
        if (!ui.lyrics.hidden && dialog.open) paintProgress();
      }).catch(() => {
        status.textContent = text.lyricsModuleError;
        lyricsModule = undefined;
      });
    }

    function openSettings() {
      immersiveMotion?.clear();
      syncSettings();
      ui.settingStatus.textContent = "";
      ui.settings.hidden = false;
      ui.settingsButton.setAttribute("aria-expanded", "true");
      dialog.setAttribute("aria-labelledby", "aura-settings-title");
      ui.shell.inert = true;
      resetParallax();
      ui.settingsBack.focus();
      immersiveMotion?.reveal(ui.settings.firstElementChild, 7);
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
      immersiveMotion?.clear();
      if (!ui.lyrics.hidden) toggleLyrics();
      if (!ui.settings.hidden) closeSettings(false);
      clearTimeout(releaseTimer);
      drag = null;
      observePlayer();
      current = undefined;
      cover = "";
      syncAccent();
      queueSnapshot = undefined;
      manualQueueKeys.clear();
      ui.queueManual.replaceChildren();
      ui.queueTracks.replaceChildren();
      showImage(ui.cover, "");
      showImage(ui.dockCover, "");
      showImage(ui.background, "");
      updateText(ui.playerError, "");
    }

    function toggleView() {
      if (dialog.open) {
        closeView();
        return;
      }
      if (getComputedStyle(dialog).getPropertyValue("--aura-theme").trim() !== "1") {
        spicetify.showNotification(text.themeRequired, true);
        return;
      }
      dialog.showModal();
      observePlayer();
      immersiveMotion?.reveal(ui.stage, 7);
    }

    function dismissView() {
      if (ui.settings.hidden) closeView();
      else closeSettings(true);
    }

    function keyDown(event) {
      if (dialog.open && event.key === "Escape" && !event.isComposing) {
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) dismissView();
        return;
      }
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
        syncProgress(true);
      } catch {
        if (dialog.open) updateText(ui.playerError, text.playerError);
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
    for (const [setting, method] of Object.entries({ like: "toggleHeart", mute: "toggleMute", repeat: "toggleRepeat", shuffle: "toggleShuffle" })) {
      if (!ui[setting].hidden) ui[setting].addEventListener("click", () => control(() => player[method]()), eventOptions);
    }

    ui.settingsButton.addEventListener("click", openSettings, eventOptions);
    ui.lyricsButton.addEventListener("click", toggleLyrics, eventOptions);
    ui.settingsBack.addEventListener("click", () => closeSettings(true), eventOptions);
    ui.exit.addEventListener("click", closeView, eventOptions);
    ui.now.addEventListener("click", () => {
      if (!ui.lyrics.hidden) toggleLyrics();
      ui.title.focus();
    }, eventOptions);
    function openNative(target, query) {
      closeView();
      try {
        navigateNative(spicetify, target, query);
      } catch {
        spicetify.showNotification(text.navigationError, true);
      }
    }
    ui.library.addEventListener("click", () => openNative("library"), eventOptions);
    ui.favorites.addEventListener("click", () => openNative("favorites"), eventOptions);
    ui.searchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const query = ui.query.value.trim();
      ui.query.value = "";
      openNative("search", query);
    }, eventOptions);

    for (const setting of ["modifiers", "key", "colorMode", "lyricsPosition", "accent"]) {
      ui[setting].addEventListener("change", () => savePreferences({ [setting]: ui[setting].value }), eventOptions);
    }
    for (const setting of TOGGLES) {
      ui[setting].addEventListener("change", () => savePreferences({ [setting]: ui[setting].checked }), eventOptions);
    }
    for (const setting of Object.keys(VISUAL_RANGES)) {
      const slider = ui[setting];
      slider.addEventListener("input", () => {
        paintRange(slider, slider.valueAsNumber, slider.value + "%");
        applyVisualRanges({ ...prefs, [setting]: slider.valueAsNumber });
      }, eventOptions);
      slider.addEventListener("change", () => savePreferences({ [setting]: slider.valueAsNumber }), eventOptions);
    }
    ui.resetVisual.addEventListener("click", () => savePreferences(VISUAL_DEFAULTS), eventOptions);
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
      ui.settingStatus.textContent = text.preparingImage;
      try {
        const background = await encodeBackground(file, text);
        if (request !== imageRequest) return;
        if (!validatePreferences({ ...prefs, background }).background) {
          throw new Error(text.imageStillTooLarge);
        }
        savePreferences({ background });
      } catch (error) {
        if (request === imageRequest) updateText(ui.settingStatus, error.message);
      } finally {
        if (request === imageRequest) ui.chooseImage.disabled = false;
      }
    }, eventOptions);

    for (const image of [ui.cover, ui.dockCover, ui.background]) {
      image.addEventListener("load", () => { image.hidden = image.currentSrc !== image.src; }, eventOptions);
    }
    ui.cover.addEventListener("error", () => { ui.cover.hidden = true; }, eventOptions);
    ui.dockCover.addEventListener("error", () => { ui.dockCover.hidden = true; }, eventOptions);
    ui.background.addEventListener("error", () => {
      if (prefs.background && ui.background.getAttribute("src") === prefs.background) {
        prefs = { ...prefs, background: null };
        savePreferences({});
      } else ui.background.hidden = true;
    }, eventOptions);

    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      dismissView();
    }, eventOptions);
    dialog.addEventListener("close", () => {
      if (!dialog.open) closeView();
    }, eventOptions);
    dialog.addEventListener("click", (event) => {
      const button = event.target instanceof Element && event.target.closest("button");
      if (!button || button.disabled || !ui.settings.hidden || button === ui.exit) return;
      immersiveMotion?.wave(event.detail ? { x: event.clientX, y: event.clientY } : button, 92);
    }, { ...eventOptions, capture: true });
    for (const event of ["pointermove", "pointerdown", "keydown", "focusin"]) {
      dialog.addEventListener(event, showControls, eventOptions);
    }
    dialog.addEventListener("pointermove", moveParallax, { ...eventOptions, passive: true });
    dialog.addEventListener("pointerleave", resetParallax, eventOptions);
    reducedMotion.addEventListener("change", resetParallax, eventOptions);
    stacked.addEventListener("change", resetParallax, eventOptions);
    window.addEventListener("pointerup", clearDrag, { ...eventOptions, capture: true });
    window.addEventListener("pointercancel", clearDrag, { ...eventOptions, capture: true });
    window.addEventListener("keydown", keyDown, { ...eventOptions, capture: true });
    document.addEventListener("visibilitychange", observePlayer, eventOptions);

    try {
      if (spicetify.Playbar?.Button) playbarButton = new spicetify.Playbar.Button(immersiveLabel, "album", toggleView, false, false, true);
    } catch (error) {
      console.warn("[AURA] Botão da barra indisponível.", error);
    }
    const fallbackTimer = setTimeout(() => {
      if (playbarButton?.element?.isConnected || !spicetify.Menu?.Item) return;
      profileItem = new spicetify.Menu.Item(immersiveLabel, false, toggleView, "album");
      profileItem.register();
    }, playbarButton ? 2000 : 0);
    syncSettings();
    import("./node_modules/aura-native/motion.mjs").then(({ createMotion }) => {
      if (lifetime.signal.aborted) return;
      immersiveMotion = createMotion({
        host: dialog,
        signal: lifetime.signal,
        enabled: () => dialog.open && !prefs.reduceMotion,
      });
    }).catch((error) => console.warn("[AURA] Animações do modo imersivo indisponíveis.", error));
    import("./node_modules/aura-native/view.mjs").then(({ createNativeLayout }) => {
      if (lifetime.signal.aborted) return;
      nativeLayout = createNativeLayout({
        spicetify,
        signal: lifetime.signal,
        layoutLabel: "AURA · " + text.floatingPanels,
        preferences: () => prefs,
        setLayout: (enabled) => savePreferences({ nativeLayout: enabled }),
        getBackdrop: () => prefs.background || trackDetails(trackFromState(readPlayerState()), text).artwork,
        accentForArtwork,
        getTrack: () => {
          const track = trackFromState(readPlayerState());
          if (!track) return null;
          return { uri: track.uri, artwork: thumbnailArtwork(track) || trackDetails(track, text).artwork };
        },
      });
    }).catch((error) => console.warn("[AURA] Layout da janela normal indisponível.", error));

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
    let ready = document.body && spicetify?.Player?.addEventListener &&
      spicetify.Platform?.History && spicetify.LocalStorage;
    if (ready) {
      try { spicetify.Player.getProgress(); }
      catch { ready = false; }
    }
    if (!ready) {
      if (attempt < 80) setTimeout(() => init(attempt + 1), 250);
      else console.warn("[AURA] As APIs necessárias do Spicetify não carregaram.");
      return;
    }
    mount(spicetify);
  }

  init();
})();
