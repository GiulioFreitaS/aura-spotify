# AURA

**Português** · [English](README.en.md)

**Tema e extensão para o Spotify desktop no Windows.** AURA coloca a biblioteca, a navegação e a reprodução em painéis flutuantes. O modo imersivo leva a capa para um vinil que gira junto com a música.

[Demonstração](#demonstração) · [Instalação](#instalação) · [Como usar](#como-usar) · [Desenvolvimento](#desenvolvimento)

## Demonstração

[![Modo imersivo do AURA com disco, fila de reprodução e player flutuante](docs/media/aura-imersivo.jpg)](docs/media/aura-demo.mp4)

[Assistir à gravação original · 53 s](docs/media/aura-demo.mp4)

## Recursos

### Janela do Spotify

![Janela normal do Spotify com navegação em ilha, três painéis e player flutuante](docs/media/aura-paineis.jpg)

- **Três painéis em perspectiva** para biblioteca, conteúdo e faixa atual, com uma ilha de navegação e um player flutuante.
- **Iluminação por álbum** nas bordas, na ilha e no player. A cor acompanha a faixa em reprodução, inclusive com um papel de parede personalizado.
- **Animações de navegação** em páginas, menus, cards e controles. Ao iniciar uma faixa, a miniatura viaja até o painel de reprodução. Ao abrir um álbum, a capa cresce até o cabeçalho e retorna ao card de origem se ele estiver visível.
- **Dois fundos.** Papel de parede usa a imagem escolhida no AURA ou a capa do álbum. Desktop ao vivo revela a área de trabalho e os outros apps nos espaços entre os painéis.

### Modo imersivo

- **Vinil com a capa inteira**, fundo configurável, relógio opcional e controles de reprodução, volume, posição na faixa, aleatório, repetição e curtidas.
- **Fila rolável** com as faixas adicionadas manualmente acima das próximas faixas do álbum ou da playlist. A fila acompanha o Spotify durante a pausa.
- **Letras no painel lateral ou abaixo do vinil**, com indicação de sincronização por palavra, por linha ou texto simples, conforme a faixa. [LRCLIB](https://lrclib.net/docs)
- **Ajustes persistentes** de cor, fundo, atalho, escurecimento, tamanho do disco e profundidade. **Reduzir movimento** também vale para a janela normal.

## Instalação

### Versões testadas

| Componente | Versão ou uso |
| --- | --- |
| Spotify para Windows | **1.3.9.2055**, do instalador desktop |
| Spicetify | **2.46.7** |
| Python 3 | Opcional, para **Desktop ao vivo**. O auxiliar usa o iniciador `py.exe`. |
| Node.js | Opcional, para rodar as verificações do código. |

As notas do Spicetify 2.46.7 declaram compatibilidade com o Spotify para Windows até a série **1.3.9**. Confira as versões antes de aplicar o tema. [Notas oficiais do Spicetify](https://github.com/spicetify/cli/releases/tag/v2.46.7)

### 1. Preparar o Spotify e baixar o AURA

Abra o Spotify e entre com sua conta. Instale o Spicetify pelo guia oficial e reabra o PowerShell para reconhecer o comando. [Instalação do Spicetify no Windows](https://spicetify.app/docs/getting-started#windows)

[Baixe o ZIP do AURA](https://github.com/GiulioFreitaS/aura-spotify/archive/refs/heads/main.zip) e extraia a pasta, ou clone o repositório.

```powershell
git clone https://github.com/GiulioFreitaS/aura-spotify.git
Set-Location .\aura-spotify
```

Abra o PowerShell na pasta que contém `README.md`, `Themes` e `Extensions`. Gere a configuração com `spicetify`. Em uma instalação nova, faça o backup inicial do Spotify original. Se já usa Spicetify, use o backup existente. [Comandos do Spicetify](https://spicetify.app/docs/cli/commands)

```powershell
spicetify --version
spicetify
spicetify backup
```

### 2. Ativar o AURA

Execute o bloco na pasta do projeto. Ele guarda a configuração anterior em um arquivo datado. Anote o caminho exibido para poder restaurá-la.

```powershell
$auraData = (spicetify path userdata).Trim()
$auraConfig = (spicetify -c).Trim()

if (!(Test-Path -LiteralPath $auraConfig -PathType Leaf)) {
    throw 'Execute spicetify para gerar config-xpui.ini antes de continuar.'
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
        throw 'Já existe uma instalação do AURA. Consulte a seção Atualizar.'
    }
}

$auraBackupName = 'AURA-config-' + (Get-Date -Format 'yyyyMMdd-HHmmssfff') + '.ini'
$auraBackup = Join-Path ([IO.Path]::GetTempPath()) $auraBackupName
Copy-Item -LiteralPath $auraConfig -Destination $auraBackup -ErrorAction Stop
Write-Output "Backup da configuração em $auraBackup"

foreach ($auraFile in $auraFiles.GetEnumerator()) {
    $auraTarget = Join-Path $auraData $auraFile.Value
    $auraParent = Split-Path -Parent $auraTarget
    New-Item -ItemType Directory -Path $auraParent -Force -ErrorAction Stop | Out-Null
    Copy-Item -LiteralPath $auraFile.Key -Destination $auraTarget -Recurse -ErrorAction Stop
}

spicetify config extensions aura.js
if ($LASTEXITCODE -ne 0) { throw 'Falha ao ativar a extensão AURA.' }

spicetify config current_theme AURA color_scheme Vinil inject_css 1 replace_colors 1 expose_apis 1
if ($LASTEXITCODE -ne 0) { throw 'Falha ao selecionar o tema AURA.' }

spicetify apply
if ($LASTEXITCODE -ne 0) { throw 'Falha ao aplicar o AURA ao Spotify.' }
```

### 3. Ativar o recorte da janela (opcional)

Instale Python 3 com o iniciador `py.exe` se quiser ver o desktop nos vãos. Feche o Spotify e execute o iniciador na pasta do AURA para abrir o cliente e o auxiliar local.

```powershell
.\Windows\Iniciar-AURA.ps1
```

Escolha **Ajustes → Janela normal do Spotify → Fundo da janela → Desktop ao vivo** no modo imersivo. Com o auxiliar desligado, os espaços entre os painéis mostram o fundo do AURA. [Regiões de janela do Windows](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowrgn)

## Como usar

| Ação | Onde encontrar |
| --- | --- |
| Abrir o modo imersivo | **Ctrl + Alt + A** ou botão com ícone de disco no player. O menu do perfil também pode oferecer **AURA · Modo imersivo**. |
| Voltar ao Spotify | **Esc** ou **Sair**. Nos ajustes, o primeiro **Esc** volta ao modo imersivo. |
| Alternar o layout em painéis | Ícone do AURA na ilha de navegação ou **AURA · Layout em painéis** no perfil. |
| Mudar o fundo | **Ajustes** no modo imersivo. É possível escolher uma imagem ou voltar a usar a capa do álbum. |
| Mostrar letras | **Letras** no menu lateral. Use **Ajustes → Letras** para mudar a posição ou corrigir a sincronia. |
| Reduzir as animações | **Ajustes → Reduzir movimento**. As preferências de movimento do Windows também são respeitadas. |

O AURA consulta o LRCLIB ao exibir letras, usando título, artista, álbum e duração. A posição da música controla o destaque quando o resultado tem marcações de tempo. O atraso manual aceita até cinco segundos em cada direção. [Formato Lyricsfile](https://github.com/tranxuanthang/lyricsfile/blob/main/SPECIFICATION.md)

## Atualizar

Guarde uma cópia dos arquivos atuais e atualize `Themes\AURA\user.css`, `Extensions\aura.js` e os módulos `aura-lyrics` e `aura-native` em `Extensions\node_modules` na pasta de dados do Spicetify. Preserve o `bridge-config.mjs` criado pelo auxiliar, se existir. Rode `spicetify apply` para carregar a atualização. [Módulos JavaScript do Spicetify](https://spicetify.app/docs/development/js-modules)

## Voltar à configuração anterior

Se usar o auxiliar da janela, pare-o antes de restaurar. Em outra sessão do PowerShell, atribua a `$auraBackup` o caminho guardado na instalação.

```powershell
.\Windows\Iniciar-AURA.ps1 -Parar
Copy-Item -LiteralPath $auraBackup -Destination (spicetify -c).Trim() -Force -ErrorAction Stop
```

Use `spicetify apply` para reaplicar seus ajustes anteriores. Se o Spotify estava original antes da instalação, use `spicetify restore`. [Restauração do Spicetify](https://spicetify.app/docs/cli/commands#restore)

## Desenvolvimento

| Pasta | Conteúdo |
| --- | --- |
| [Themes/AURA](Themes/AURA) | Estilos e paleta do tema |
| [Extensions](Extensions) | Extensão, integração com o player, animações e letras |
| [Windows](Windows) | Iniciador e auxiliar de transparência |
| [tests](tests) | Verificações de parsing, sincronização e consulta de letras |

Rode as verificações na raiz do projeto.

```powershell
node --check .\Extensions\aura.js
node --test .\tests\lyrics.test.mjs
```

Para um teste no cliente, abra um álbum e volte pelo botão da ilha. Troque de faixa, pause e confira o vinil e a fila. Alterne os dois fundos e teste **Alt + Tab**. As escolhas de implementação estão no [histórico de decisões](docs/DECISOES.md).

## Créditos

AURA é uma personalização independente que usa [Spicetify](https://spicetify.app/) no Spotify desktop. As letras vêm do [LRCLIB](https://lrclib.net/). O módulo de letras inclui [js-yaml e sua licença](Extensions/aura-lyrics/LICENSE-js-yaml.txt).
