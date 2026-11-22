param(
  [switch]$Parar,
  [switch]$SomenteAuxiliar,
  [switch]$BloquearAtualizacoes,
  [switch]$Reaplicar
)

$ErrorActionPreference = 'Stop'
$auraPython = (Get-Command py.exe -ErrorAction Stop).Source
$auraBridge = Join-Path $PSScriptRoot 'aura_window.py'

if ($Parar) {
  & $auraPython -3 $auraBridge stop
  if ($LASTEXITCODE -ne 0) { throw 'O auxiliar não respondeu ao pedido de parada.' }
  return
}

$auraSpotify = Join-Path $env:APPDATA 'Spotify\Spotify.exe'
if (!(Test-Path -LiteralPath $auraSpotify -PathType Leaf) -or
    (Get-Item -LiteralPath $auraSpotify).VersionInfo.ProductVersion -ne '1.3.9.2055') {
  throw 'O AURA requer o Spotify 1.3.9.2055 do instalador desktop. Confira as versões testadas no README.'
}

if ($BloquearAtualizacoes) {
  & (Join-Path $PSScriptRoot 'Atualizacoes-AURA.ps1') block
}

if ($Reaplicar) {
  $auraSpicetify = (Get-Command spicetify.exe -ErrorAction SilentlyContinue).Source
  if (!$auraSpicetify) { $auraSpicetify = Join-Path $env:LOCALAPPDATA 'spicetify\spicetify.exe' }
  if (!(Test-Path -LiteralPath $auraSpicetify -PathType Leaf)) {
    throw 'Instale o Spicetify e ative o AURA conforme o README antes de reaplicar.'
  }
  $auraConfigPath = (& $auraSpicetify -c | Select-Object -Last 1)
  if ($LASTEXITCODE -ne 0 -or !$auraConfigPath) { throw 'A configuração do Spicetify não foi encontrada.' }
  $auraConfig = Get-Content -LiteralPath $auraConfigPath.Trim() -Raw
  $auraExtensionSetting = [regex]::Match($auraConfig, '(?m)^[ \t]*extensions[ \t]*=[ \t]*([^\r\n]*)').Groups[1].Value
  $auraExtensions = @($auraExtensionSetting -split '\|' | ForEach-Object { $_.Trim() })
  if ($auraConfig -notmatch '(?m)^[ \t]*current_theme[ \t]*=[ \t]*AURA[ \t]*\r?$' -or $auraExtensions -notcontains 'aura.js') {
    throw 'Ative o tema e a extensão do AURA conforme o README antes de reaplicar.'
  }

  $auraRunning = @(Get-Process Spotify -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $auraSpotify })
  foreach ($auraProcess in $auraRunning | Where-Object MainWindowHandle) {
    [void]$auraProcess.CloseMainWindow()
  }
  if ($auraRunning.Count) { Wait-Process -Id $auraRunning.Id -Timeout 8 -ErrorAction SilentlyContinue }
  if (Get-Process Spotify -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $auraSpotify }) {
    throw 'Feche o Spotify por completo antes de reaplicar o AURA.'
  }
  if ((Get-Item -LiteralPath $auraSpotify).VersionInfo.ProductVersion -ne '1.3.9.2055') {
    throw 'O Spotify trocou de versão ao fechar. Restaure a 1.3.9.2055 e execute o bloqueio antes de abrir.'
  }
  & $auraSpicetify --no-restart apply
  if ($LASTEXITCODE -ne 0) { throw 'O Spicetify não conseguiu reaplicar o AURA.' }
}

& $auraPython -3 $auraBridge prepare
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível preparar a ligação local do AURA.' }

& $auraPython -3 $auraBridge status 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Start-Process -FilePath $auraPython -ArgumentList @('-3', ('"' + $auraBridge + '"'), 'serve') -WindowStyle Hidden
  $auraReady = $false
  for ($auraAttempt = 0; $auraAttempt -lt 12 -and !$auraReady; $auraAttempt++) {
    Start-Sleep -Milliseconds 220
    & $auraPython -3 $auraBridge status 2>$null | Out-Null
    $auraReady = $LASTEXITCODE -eq 0
  }
  if (!$auraReady) { throw 'O auxiliar local do AURA não respondeu. Verifique se a porta está disponível.' }
}

if (!$SomenteAuxiliar) {
  Start-Process -FilePath $auraSpotify -ArgumentList '--disable-update-restarts'
}
Write-Output 'Auxiliar local do AURA em execução.'
