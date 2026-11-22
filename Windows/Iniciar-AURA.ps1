param([switch]$Parar, [switch]$SomenteAuxiliar)

$ErrorActionPreference = 'Stop'
$auraPython = (Get-Command py.exe -ErrorAction Stop).Source
$auraBridge = Join-Path $PSScriptRoot 'aura_window.py'

if ($Parar) {
  & $auraPython -3 $auraBridge stop
  if ($LASTEXITCODE -ne 0) { throw 'O auxiliar não respondeu ao pedido de parada.' }
  return
}

$auraSpotify = Join-Path $env:APPDATA 'Spotify\Spotify.exe'
if ((Get-Item -LiteralPath $auraSpotify).VersionInfo.ProductVersion -ne '1.3.9.2055') {
  throw 'O recorte da janela foi preparado para o Spotify 1.3.9.2055.'
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
