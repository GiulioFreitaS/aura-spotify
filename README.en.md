# AURA

[Português](README.md) · **English** · [Türkçe](README.tr.md)

**A Spicetify theme and extension for Spotify on Windows, Linux, and macOS.** AURA gives the library, browsing view, and Now Playing panel their own floating surfaces. Immersive mode turns the album cover into a spinning record.

[Demo](#demo) · [Installation](#installation) · [Spotify updates](#spotify-updates) · [Using AURA](#using-aura) · [Development](#development)

## Demo

### Immersive player and queue

![AURA in immersive mode with a vinyl record, a playback queue, and floating controls](docs/media/aura-imersivo.png)

### Desktop layout

![Spotify arranged in three floating panels, with navigation at the top and a floating player at the bottom](docs/media/aura-paineis.png)

### Immersive lyrics

![Lyrics in the side panel next to the vinyl record](docs/media/aura-letras.png)

## Features

### Desktop layout

- **Three floating panels with perspective** for your library, browsing, and the current track, plus a floating navigation bar and player.
- **Album-based lighting** along the panel edges, navigation bar, and player. The light changes with the current track and also works with custom wallpaper.
- **Animations across pages, menus, cards, and controls.** Start a track from a card to see its cover travel toward Now Playing or the player bar. Open an album to see its artwork expand into the header and return to the original card when that card is visible.
- **Customizable wallpaper.** AURA uses the album cover by default. To match your system wallpaper, select the image file in the immersive settings. The same background fills the space behind the floating panels.

### Immersive mode

- **A spinning record with album artwork**, a customizable background, an optional clock, and controls for playback, volume, seeking, shuffle, repeat, and liked tracks.
- **A scrollable queue** that puts manually queued tracks above the upcoming album or playlist tracks. It stays in sync while playback is paused.
- **Lyrics in the side panel or below the record**, with word-by-word timing, line timing, or plain text depending on the track. [LRCLIB](https://lrclib.net/docs)
- **Saved settings** for color, wallpaper, keyboard shortcut, dimming, record size, and 3D depth. Reduce motion also applies to the desktop layout.

## Installation

### Install from Marketplace

1. Install Spicetify and Marketplace using the official guide.
2. In Spotify, open **Marketplace → Themes** and search for **AURA**.
3. Install the theme and restart Spotify if prompted. AURA loads its immersive player, queue, and lyrics with the theme.

[Set up Spicetify and Marketplace](https://spicetify.app/docs/getting-started)

### Compatibility

| Platform | Spotify versions supported by Spicetify 2.46.7 |
| --- | --- |
| Windows | 1.2.14 through 1.3.9 |
| Linux | 1.2.14 through 1.3.8 |
| macOS | 1.2.14 through 1.3.9 |

AURA's Spotify desktop test reference is **1.3.9.2055 on Windows**. The repository checks exercise the package and UI in Chromium on Windows, Linux, and macOS. [Spicetify 2.46.7 release notes](https://github.com/spicetify/cli/releases/tag/v2.46.7)

### Manual installation on Windows

#### 1. Set up Spotify and get AURA

Open Spotify and sign in. Install Spicetify using its Windows guide, then reopen PowerShell so the command is available. [Install Spicetify on Windows](https://spicetify.app/docs/getting-started#windows)

[Download the AURA ZIP](https://github.com/GiulioFreitaS/aura-spotify/archive/refs/heads/main.zip) and extract it, or clone the repository.

```powershell
git clone https://github.com/GiulioFreitaS/aura-spotify.git
Set-Location .\aura-spotify
```

To keep the compatible version, [block automatic updates](#spotify-updates) before quitting Spotify. Apply the protection as soon as the tested build is installed.

Open PowerShell in the folder containing `README.md`, `Themes`, and `Extensions`. Run `spicetify` to generate the configuration. On a fresh install, back up the original Spotify client. If you already use Spicetify, use your existing backup. [Spicetify CLI commands](https://spicetify.app/docs/cli/commands)

```powershell
spicetify --version
spicetify
spicetify backup
```

#### 2. Apply AURA

Run this block from the project folder. It saves your previous configuration to a dated file. Keep the path it prints so you can restore that configuration later.

<details>
<summary>Show the installation commands</summary>

```powershell
$auraData = (spicetify path userdata).Trim()
$auraConfig = (spicetify -c).Trim()

if (!(Test-Path -LiteralPath $auraConfig -PathType Leaf)) {
    throw 'Run spicetify to generate config-xpui.ini before continuing.'
}

$auraFiles = [ordered]@{
    '.\Themes\AURA'            = 'Themes\AURA'
    '.\Extensions\aura.js'     = 'Extensions\aura.js'
    '.\Extensions\aura-lyrics' = 'Extensions\node_modules\aura-lyrics'
    '.\Extensions\aura-native' = 'Extensions\node_modules\aura-native'
}

foreach ($auraRelativePath in $auraFiles.Values) {
    $auraTarget = Join-Path $auraData $auraRelativePath
    if (Test-Path -LiteralPath $auraTarget) {
        throw 'AURA is already installed. See the Updating section.'
    }
}

$auraBackupName = 'AURA-config-' + (Get-Date -Format 'yyyyMMdd-HHmmssfff') + '.ini'
$auraBackup = Join-Path ([IO.Path]::GetTempPath()) $auraBackupName
Copy-Item -LiteralPath $auraConfig -Destination $auraBackup -ErrorAction Stop
Write-Output "Configuration backup saved to $auraBackup"

foreach ($auraFile in $auraFiles.GetEnumerator()) {
    $auraTarget = Join-Path $auraData $auraFile.Value
    $auraParent = Split-Path -Parent $auraTarget
    New-Item -ItemType Directory -Path $auraParent -Force -ErrorAction Stop | Out-Null
    Copy-Item -LiteralPath $auraFile.Key -Destination $auraTarget -Recurse -ErrorAction Stop
}

spicetify config extensions aura.js
if ($LASTEXITCODE -ne 0) { throw 'Could not enable the AURA extension.' }

spicetify config current_theme AURA color_scheme Vinil inject_css 1 replace_colors 1 expose_apis 1
if ($LASTEXITCODE -ne 0) { throw 'Could not select the AURA theme.' }

spicetify apply
if ($LASTEXITCODE -ne 0) { throw 'Could not apply AURA to Spotify.' }
```

</details>

## Spotify updates

After updating Spotify, check version compatibility and reapply Spicetify. [Updating Spicetify](https://spicetify.app/docs/getting-started#updating)

On Windows, the desktop client can update itself on launch and replace the files that load Spicetify. To keep Spotify at **1.3.9.2055**, run this command in PowerShell from the AURA folder.

```powershell
.\Windows\Atualizacoes-AURA.ps1 block
```

The block uses local permissions on `%LOCALAPPDATA%\Spotify\Update`. It applies when launching from the regular Spotify shortcut and after a Windows restart. If an update is already staged, the script saves its files in an adjacent `Update-AURA-*` folder. [Spicetify update folder protection](https://github.com/spicetify/cli/releases/tag/v3.0.0-beta.14)

| Action | Command |
| --- | --- |
| Check whether updates are blocked | `.\Windows\Atualizacoes-AURA.ps1 status` |
| Allow automatic updates again | `.\Windows\Atualizacoes-AURA.ps1 unblock` |
| Block updates and start Spotify | `.\Windows\Iniciar-AURA.ps1 -BloquearAtualizacoes` |

### If Spotify returns to its default layout

If Spotify already updated, restore desktop version **1.3.9.2055** and block updates before restarting it. If you have already set up AURA, the launcher can reapply the customization and open Spotify.

```powershell
.\Windows\Iniciar-AURA.ps1 -BloquearAtualizacoes -Reaplicar
```

To reapply a manual installation, run `spicetify apply` after blocking updates and closing Spotify.

## Using AURA

AURA's interface uses Portuguese labels. The table shows the exact settings and controls to look for.

| Action | Where to find it |
| --- | --- |
| Open immersive mode | Press **Ctrl + Alt + A** (Control + Option + A on macOS), or click the record icon in the player bar. The profile menu may also show **AURA · Modo imersivo**. |
| Return to Spotify | Press **Esc** or select **Sair**. From settings, the first **Esc** returns to immersive mode. |
| Toggle the floating panels | Use the AURA icon in the navigation bar or **AURA · Layout em painéis** in the profile menu. |
| Change the background | Open **Settings** in immersive mode to choose an image or switch back to album artwork. |
| Show lyrics | Select **Lyrics** in the side menu. Use **Settings → Lyrics** to change the placement or adjust the timing. |
| Reduce animations | Open **Settings → Reduce motion**. AURA also respects your system's reduced-motion preference. |

AURA reads Spotify's language when it opens. The interface is available in English, Portuguese, and Turkish, with English used for other Spotify languages.

While showing lyrics, AURA queries LRCLIB with the track title, artist, album, and duration. Playback position drives the highlighting when timing data is available. You can shift the lyrics up to five seconds in either direction. [Lyricsfile format](https://github.com/tranxuanthang/lyricsfile/blob/main/SPECIFICATION.md)

## Updating

For Marketplace installs, use **Installed** to apply updates when they become available.

For a manual install on Windows, back up your current files, then update `Themes\AURA\user.css`, `Extensions\aura.js`, and the `aura-lyrics` and `aura-native` modules under `Extensions\node_modules` in your Spicetify data folder. Run `spicetify apply` to load the update. [Spicetify JavaScript modules](https://spicetify.app/docs/development/js-modules)

## Restoring your previous setup

For Marketplace installs, remove AURA under **Installed**.

For a manual install on Windows, set `$auraBackup` to the path printed during installation.

```powershell
Copy-Item -LiteralPath $auraBackup -Destination (spicetify -c).Trim() -Force -ErrorAction Stop
```

Run `spicetify apply` to reload your previous customizations. If you were using the original Spotify client before installing AURA, run `spicetify restore`. [Spicetify restore command](https://spicetify.app/docs/cli/commands#restore)

To allow future Spotify updates, run `.\Windows\Atualizacoes-AURA.ps1 unblock`.

## Development

| Folder | Contents |
| --- | --- |
| [Themes/AURA](Themes/AURA) | Theme styles and colors |
| [Extensions](Extensions) | Player integration, animations, and lyrics |
| [Windows](Windows) | Launcher and Spotify version protection for Windows |
| [tests](tests) | Lyrics and Marketplace UI tests |

The root manifest points to the theme, palette, preview, and bundled script that GitHub Pages serves to Marketplace.

Run the checks from the project root with Node.js 22 or later.

```sh
npm ci
npm test
npm run build:marketplace
npx playwright install chromium
npm run test:marketplace
```

In Spotify, change tracks and check the record, queue, and lyrics. Pick a local image and switch back to the album cover. See the [Portuguese decision log](docs/DECISOES.md).

## Credits

AURA is an independent customization for Spotify desktop built with [Spicetify](https://spicetify.app/). Lyrics come from [LRCLIB](https://lrclib.net/). The lyrics module includes [js-yaml and its license](Extensions/aura-lyrics/LICENSE-js-yaml.txt).
