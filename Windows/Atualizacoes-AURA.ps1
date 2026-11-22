param(
  [Parameter(Position = 0)]
  [ValidateSet('status', 'block', 'unblock')]
  [string]$Acao = 'status'
)

$ErrorActionPreference = 'Stop'
$auraSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
$auraDacl = [Security.AccessControl.AccessControlSections]::Access
$auraParent = Join-Path $env:LOCALAPPDATA 'Spotify'
$auraStage = Join-Path $auraParent 'Update'

function Get-AuraDirectory($Path) {
  if (!(Test-Path -LiteralPath $Path)) { return }
  $auraItem = Get-Item -LiteralPath $Path -Force
  if (!$auraItem.PSIsContainer -or ($auraItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    throw "O atualizador precisa de um diretório local comum em $Path."
  }
  $auraItem
}

function Get-AuraAcl($Directory) {
  if ($PSVersionTable.PSEdition -eq 'Core') {
    return [IO.FileSystemAclExtensions]::GetAccessControl($Directory, $auraDacl)
  }
  $Directory.GetAccessControl($auraDacl)
}

function Set-AuraAcl($Directory, $Acl) {
  if ($PSVersionTable.PSEdition -eq 'Core') {
    [IO.FileSystemAclExtensions]::SetAccessControl($Directory, $Acl)
  } else {
    $Directory.SetAccessControl($Acl)
  }
}

function Get-AuraProtection($Path, $Rights, $Inheritance) {
  $auraDirectory = Get-AuraDirectory $Path
  $auraRule = [Security.AccessControl.FileSystemAccessRule]::new(
    $auraSid, $Rights, $Inheritance,
    [Security.AccessControl.PropagationFlags]::None, [Security.AccessControl.AccessControlType]::Deny
  )
  $auraMatches = @()
  $auraConflicts = 0
  if ($auraDirectory) {
    $auraAcl = Get-AuraAcl $auraDirectory
    $auraDenies = @($auraAcl.GetAccessRules($true, $false, [Security.Principal.SecurityIdentifier]) | Where-Object {
      $_.IdentityReference -eq $auraSid -and $_.AccessControlType -eq 'Deny'
    })
    $auraMatches = @($auraDenies | Where-Object {
      $_.FileSystemRights -eq $auraRule.FileSystemRights -and
        $_.InheritanceFlags -eq $auraRule.InheritanceFlags -and $_.PropagationFlags -eq $auraRule.PropagationFlags
    })
    $auraConflicts = $auraDenies.Count - $auraMatches.Count
  }
  [pscustomobject]@{ Directory = $auraDirectory; Rule = $auraRule; Matches = $auraMatches; Conflicts = $auraConflicts }
}

function Invoke-AuraUpdateProtection {
  $null = Get-AuraDirectory $env:LOCALAPPDATA
  # Regra no nível da pasta do Spotify, sem herança. Impede substituir a pasta Update pelo pai.
  $auraParentRights = [Security.AccessControl.FileSystemRights]::DeleteSubdirectoriesAndFiles
  $auraStageRights = [Security.AccessControl.FileSystemRights]'Write,Delete,DeleteSubdirectoriesAndFiles,ExecuteFile'
  $auraInherit = [Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit'
  $auraParentRule = Get-AuraProtection $auraParent $auraParentRights 'None'
  $auraStageRule = Get-AuraProtection $auraStage $auraStageRights $auraInherit

  if ($Acao -eq 'status') {
    if ($auraStageRule.Matches.Count -and $auraParentRule.Matches.Count) {
      Write-Output 'Atualizações automáticas bloqueadas.'
    } elseif ($auraStageRule.Matches.Count -or $auraParentRule.Matches.Count) {
      Write-Output 'Bloqueio parcial. Execute block para completá-lo.'
    } else {
      Write-Output 'Bloqueio de atualizações do AURA inativo.'
    }
    return
  }

  if ($Acao -eq 'block') {
    $auraExe = Join-Path $env:APPDATA 'Spotify\Spotify.exe'
    if (!(Test-Path -LiteralPath $auraExe -PathType Leaf) -or
        (Get-Item -LiteralPath $auraExe).VersionInfo.ProductVersion -ne '1.3.9.2055') {
      throw 'Instale o Spotify 1.3.9.2055 para Windows pelo instalador desktop antes de bloquear a versão.'
    }
    foreach ($auraEntry in @($auraParentRule, $auraStageRule)) {
      if (!$auraEntry.Matches.Count -and $auraEntry.Conflicts) {
        throw "Já existem outras regras de restrição em $($auraEntry.Directory.FullName)."
      }
    }
  }

  $auraChanged = [Collections.Generic.List[object]]::new()
  $auraPending = $null
  $auraCreatedStage = $false
  try {
    if ($Acao -eq 'block' -and !$auraStageRule.Matches.Count) {
      if ($auraStageRule.Directory -and (Get-ChildItem -LiteralPath $auraStage -Force | Select-Object -First 1)) {
        # Guarda a atualização pendente fora do caminho que o Spotify usa para aplicá-la.
        $auraName = 'Update-AURA-' + [Guid]::NewGuid().ToString('N')
        $auraPending = Join-Path $auraParentRule.Directory.FullName $auraName
        if ($auraStageRule.Directory.FullName -ine $auraStage -or
            [IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($auraPending)) -ine $auraParent -or
            (Test-Path -LiteralPath $auraPending)) {
          throw 'O caminho para guardar a atualização pendente não é válido.'
        }
        [IO.Directory]::Move($auraStageRule.Directory.FullName, $auraPending)
      }
      if (!(Test-Path -LiteralPath $auraStage)) {
        New-Item -ItemType Directory -Path $auraStage -Force | Out-Null
        $auraCreatedStage = $true
      }
      $auraStageRule = Get-AuraProtection $auraStage $auraStageRights $auraInherit
      $auraParentRule = Get-AuraProtection $auraParent $auraParentRights 'None'
    }

    foreach ($auraEntry in @($auraStageRule, $auraParentRule)) {
      if (!$auraEntry.Directory) { continue }
      $auraAcl = Get-AuraAcl $auraEntry.Directory
      $auraOriginal = $auraAcl.GetSecurityDescriptorSddlForm($auraDacl)
      if ($Acao -eq 'block' -and !$auraEntry.Matches.Count) {
        $auraAcl.AddAccessRule($auraEntry.Rule)
      } elseif ($Acao -eq 'unblock' -and $auraEntry.Matches.Count) {
        foreach ($auraRule in $auraEntry.Matches) { $auraAcl.RemoveAccessRuleSpecific($auraRule) }
      } else { continue }
      Set-AuraAcl $auraEntry.Directory $auraAcl
      $auraChanged.Add(@{ Directory = $auraEntry.Directory; Original = $auraOriginal })
    }

    $auraParentRule = Get-AuraProtection $auraParent $auraParentRights 'None'
    $auraStageRule = Get-AuraProtection $auraStage $auraStageRights $auraInherit
    $auraRuleCount = [int][bool]$auraParentRule.Matches.Count + [int][bool]$auraStageRule.Matches.Count
    $auraExpectedCount = if ($Acao -eq 'block') { 2 } else { 0 }
    if ($auraRuleCount -ne $auraExpectedCount) { throw 'O estado final do bloqueio não corresponde ao solicitado.' }
  } catch {
    for ($auraIndex = $auraChanged.Count - 1; $auraIndex -ge 0; $auraIndex--) {
      $auraPrevious = $auraChanged[$auraIndex]
      $auraAcl = Get-AuraAcl $auraPrevious.Directory
      $auraAcl.SetSecurityDescriptorSddlForm($auraPrevious.Original, $auraDacl)
      Set-AuraAcl $auraPrevious.Directory $auraAcl
    }
    if ($auraPending -and (Test-Path -LiteralPath $auraPending)) {
      $auraCurrentStage = Get-AuraDirectory $auraStage
      if ($auraCreatedStage -and $auraCurrentStage.FullName -ieq $auraStage -and
          !(Get-ChildItem -LiteralPath $auraStage -Force | Select-Object -First 1)) {
        [IO.Directory]::Delete($auraCurrentStage.FullName)
      }
      if (!(Test-Path -LiteralPath $auraStage)) {
        [IO.Directory]::Move($auraPending, $auraStage)
      } else {
        Write-Warning "A atualização pendente está guardada em $auraPending."
      }
    }
    throw
  }

  if ($Acao -eq 'block') {
    Write-Output 'Atualizações automáticas bloqueadas.'
    if ($auraPending) { Write-Output "Atualização anterior guardada em $auraPending." }
  } else {
    Write-Output 'Bloqueio de atualizações do AURA removido.'
  }
}

$auraGuard = [Threading.Mutex]::new($false, ('Local\AURA-SpotifyUpdate-' + $auraSid.Value))
$auraLocked = $false
try {
  try { $auraLocked = $auraGuard.WaitOne(5000) }
  catch [Threading.AbandonedMutexException] { $auraLocked = $true }
  if (!$auraLocked) { throw 'A proteção de atualizações está sendo alterada por outro comando do AURA.' }
  Invoke-AuraUpdateProtection
} finally {
  if ($auraLocked) { $auraGuard.ReleaseMutex() }
  $auraGuard.Dispose()
}
