# AURA

AURA é um tema e uma extensão para o Spotify desktop no Windows. A janela normal reúne a navegação em uma ilha, três painéis e um player flutuante. O modo imersivo tem o disco com a capa, letras e controles próprios.

## Compatibilidade

O AURA foi aplicado ao Spotify desktop **1.3.9.2055** no Windows com o Spicetify **2.46.7**. Essa versão do Spicetify declara suporte ao Spotify para Windows até **1.3.9**. Confira a compatibilidade da sua instalação antes de aplicar. [Notas oficiais de compatibilidade](https://github.com/spicetify/cli/releases/tag/v2.46.7)

O AURA usa a API do Spicetify v2 e pode ser copiado diretamente para a instalação. O Node é necessário para rodar as verificações de desenvolvimento. [Desenvolvimento de extensões](https://spicetify.app/docs/development/extensions)

## Ativar o AURA

Em uma instalação compatível, instale o Spicetify pelo guia oficial se ele ainda estiver ausente. A instalação via WinGet é uma das opções documentadas. Depois de instalar, reabra o PowerShell. [Instalação no Windows](https://spicetify.app/docs/getting-started#windows)

**PowerShell · instalar o Spicetify com WinGet**

```powershell
winget install --id Spicetify.Spicetify --exact
```

**PowerShell · primeira execução do Spicetify**

Em uma instalação nova, abra o Spotify e entre na sua conta antes de gerar a configuração e fazer o backup inicial do cliente. As instalações que já usam Spicetify normalmente têm esse backup. [Comandos do Spicetify](https://spicetify.app/docs/cli/commands)

```powershell
spicetify --version
spicetify
spicetify backup
```

**PowerShell · copiar e ativar o AURA**

Execute na raiz deste projeto. O bloco guarda o `config-xpui.ini` em um arquivo datado no diretório temporário e evita sobrescrever uma cópia do AURA que já esteja no destino. Guarde o caminho impresso para desfazer a ativação.

```powershell
$auraData = (spicetify path userdata).Trim()
$auraConfig = (spicetify -c).Trim()
if (!(Test-Path -LiteralPath $auraConfig -PathType Leaf)) {
    throw 'Execute spicetify para gerar config-xpui.ini antes de continuar.'
}

$auraThemes = Join-Path $auraData 'Themes'
$auraExtensions = Join-Path $auraData 'Extensions'
$auraTheme = Join-Path $auraThemes 'AURA'
$auraExtension = Join-Path $auraExtensions 'aura.js'
$auraModules = Join-Path $auraExtensions 'node_modules'
$auraLyrics = Join-Path $auraModules 'aura-lyrics'
$auraNative = Join-Path $auraModules 'aura-native'
if ((Test-Path -LiteralPath $auraTheme) -or (Test-Path -LiteralPath $auraExtension) -or
    (Test-Path -LiteralPath $auraLyrics) -or (Test-Path -LiteralPath $auraNative)) {
    throw 'Já existe uma cópia do AURA no destino. Guarde os arquivos existentes antes de substituí-los.'
}

$auraBackup = Join-Path ([IO.Path]::GetTempPath()) ("AURA-config-" + (Get-Date -Format 'yyyyMMdd-HHmmssfff') + ".ini")
Copy-Item -LiteralPath $auraConfig -Destination $auraBackup -ErrorAction Stop
Write-Output $auraBackup

New-Item -ItemType Directory -Force -Path $auraThemes, $auraModules -ErrorAction Stop | Out-Null
Copy-Item -LiteralPath '.\Themes\AURA' -Destination $auraTheme -Recurse -ErrorAction Stop
Copy-Item -LiteralPath '.\Extensions\aura.js' -Destination $auraExtension -ErrorAction Stop
Copy-Item -LiteralPath '.\Extensions\aura-lyrics' -Destination $auraLyrics -Recurse -ErrorAction Stop
Copy-Item -LiteralPath '.\Extensions\aura-native' -Destination $auraNative -Recurse -ErrorAction Stop

spicetify config extensions 'aura.js'
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível ativar a extensão AURA.' }
spicetify config current_theme AURA color_scheme Vinil inject_css 1 replace_colors 1 expose_apis 1
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível selecionar o tema AURA.' }
spicetify apply
```

O botão **AURA · Modo imersivo** tem ícone de disco e fica nos controles à direita da barra de reprodução. Se a barra não aceitar o botão, procure **AURA · Modo imersivo** no menu do perfil. O atalho inicial é **Ctrl + Alt + A**, com o Alt esquerdo no teclado ABNT2. [Temas](https://spicetify.app/docs/customization/themes) · [Extensões](https://spicetify.app/docs/customization/extensions)

Para atualizar, guarde cópias de `aura.js`, `Themes/AURA/user.css` e dos módulos já instalados. Atualize esses arquivos e copie os módulos `aura-lyrics` e `aura-native` para `Extensions/node_modules` na pasta de configuração do Spicetify. Preserve o `bridge-config.mjs` gerado dentro de `aura-native`, se existir. Execute `spicetify apply` para disponibilizar os arquivos ao Spotify. [Módulos do Spicetify](https://spicetify.app/docs/development/js-modules)

## Painéis na janela normal

O ícone do AURA na ilha de navegação ou **AURA · Layout em painéis** no perfil alterna o layout normal. A biblioteca usa a lista do Spotify, com os filtros **Playlists** e **Álbuns**. As capas e os botões têm movimentos curtos ao receber o mouse ou o foco. **Reduzir movimento** nos ajustes do AURA também vale para a janela normal.

Escolha **AURA · Papel de parede** no menu do perfil para alternar o fundo da janela normal. As mesmas opções estão em **Modo imersivo → Ajustes → Janela normal do Spotify → Fundo da janela**. **Papel de parede** mostra a imagem do AURA ou a capa do álbum atrás dos painéis. **Desktop ao vivo** revela os apps e o desktop nos vãos.

O auxiliar usa Python 3 pelo iniciador `py.exe`. No Spotify 1.3.9.2055 do instalador desktop, ele arredonda as áreas dos controles nativos e conserva o recorte durante **Alt + Tab**. O modo imersivo e as janelas estreitas usam a janela completa. Com o auxiliar desligado, os vãos mostram o fundo do AURA. [Regiões de janela do Windows](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowrgn)

**PowerShell · abrir o Spotify e iniciar o recorte**

```powershell
.\Windows\Iniciar-AURA.ps1
```

Se o Spotify já estava aberto na primeira ativação do auxiliar, feche e abra o Spotify uma vez para carregar a configuração local. Pare o auxiliar para restaurar a janela completa.

**PowerShell · parar o auxiliar e restaurar a janela**

```powershell
.\Windows\Iniciar-AURA.ps1 -Parar
```

## HUD e ajustes

O painel da direita mostra até cinco faixas da fila. A barra flutuante controla a reprodução, a posição na faixa, o volume, o modo aleatório, a repetição e as curtidas. Os controles ficam visíveis por padrão. Ative **Recolher controles** em **Ajustes** para ocultar a barra durante a reprodução após alguns segundos sem interação.

Em **Ajustes**, escolha o fundo, o escurecimento e a cor de destaque. A cor automática vem dos pixels da capa. A composição tem ajustes de tamanho do disco, profundidade 3D, brilho decorativo, relógio e fila. Janelas estreitas empilham os painéis. A opção **Reduzir movimento** pausa a animação do disco e do brilho e retira o movimento com o mouse. **Restaurar visual do AURA** mantém a imagem local, o atalho e o atraso das letras.

## Letras

Abra **Letras** na navegação do AURA. Escolha o painel lateral ou a posição abaixo do disco em **Ajustes → Letras**. Enquanto esse painel estiver aberto, a extensão consulta o LRCLIB com o título, o artista principal, o álbum e a duração da faixa. A fonte aparece junto da letra. [API do LRCLIB](https://lrclib.net/docs)

A indicação **Por linha**, **Por palavra** ou **Sem sincronização** acompanha o formato retornado. A extensão confere título, artista e duração antes de exibir a letra. Uma indicação separada identifica instrumentais e resultados indisponíveis. Se a rede falhar, **Tentar novamente** fica disponível depois da espera. [Formato Lyricsfile](https://lrclib.net/lyricsfile)

Em **Ajustes → Letras**, um atraso positivo faz a letra aparecer mais tarde. Um valor negativo adianta a letra, e **Zerar** restaura a sincronização original. O ajuste é mantido ao reiniciar.

## O que testar com o Spotify aberto

1. Toque uma música e abra o AURA pelo botão. Confira o título, o artista, o álbum e a capa com a faixa que realmente está tocando.
2. Pause e retome, primeiro no AURA e depois pelo teclado multimídia ou pelo Spotify. Confira que o disco congela no mesmo ângulo ao pausar. Avance e volte uma faixa e confira a atualização dos dados, da fila e do fundo. Ative **Recolher controles**, aguarde cerca de quatro segundos em reprodução e mova o mouse para trazer a barra de volta.
3. Clique e arraste na linha do tempo. Confira se a reprodução passa para a posição escolhida e se o tempo continua avançando. Ajuste o volume e confirme no player nativo depois de sair. Use Tab e as setas para repetir o teste com teclado.
4. Abra **Ajustes**, mude o atalho e escolha uma imagem JPG, PNG, WebP, AVIF ou BMP de até 18 MiB. Reinicie o Spotify e confira se a imagem e o novo atalho foram mantidos. Use **Usar capa do álbum** para voltar ao fundo automático. Esc volta dos ajustes para o modo imersivo e um segundo Esc retorna ao Spotify.
5. Digite uma busca no painel esquerdo e confirme com Enter. A busca abre o resultado no Spotify. Teste **Biblioteca**, que leva à barra lateral ou a **Músicas curtidas**, e o atalho direto **Músicas curtidas**.
6. Redimensione a janela e repita com a escala do Windows em 125% ou 150%. Confira se a fonte, o disco, a linha do tempo e o botão Sair continuam alcançáveis. Repita com uma faixa de nome longo e com uma faixa sem capa.
7. Abra **Letras** em uma faixa com sincronização. Avance e volte pela linha do tempo e confira se o destaque acompanha a posição. Troque de faixa com o painel aberto e confira que a letra muda junto.
8. Ajuste o atraso para `+1000 ms` e depois `-1000 ms`. Confira o atraso, o adiantamento e a persistência após reiniciar. Confira também uma faixa instrumental ou sem dados e a recuperação após uma falha de rede.
9. Mude a profundidade, a cor e a posição das letras. Confira a fila, o relógio e os botões de aleatório, repetição, curtir e silenciar. Ative **Reduzir movimento** e confira o disco parado enquanto a faixa toca.

## Voltar à configuração anterior

No mesmo PowerShell da ativação, `$auraBackup` ainda aponta para a cópia datada. Se reabriu o terminal, atribua à variável o caminho exibido na ativação.

**PowerShell · restaurar o arquivo de configuração**

```powershell
$auraConfig = (spicetify -c).Trim()
Copy-Item -LiteralPath $auraBackup -Destination $auraConfig -Force -ErrorAction Stop
```

**PowerShell · reaplicar as personalizações anteriores**

```powershell
spicetify apply
```

Se o Spotify estava no estado original antes do teste, use o comando de restauração do cliente depois de restaurar o arquivo de configuração. [Restauração do Spicetify](https://spicetify.app/docs/cli/commands#restore)

**PowerShell · restaurar o cliente original**

```powershell
spicetify restore
```

## Verificações realizadas

**PowerShell · verificar a extensão na raiz do projeto**

```powershell
node --check .\Extensions\aura.js
node --test .\tests\lyrics.test.mjs
```

O Edge executou o tema e a extensão em uma página temporária com a interface do Spicetify simulada. Foram verificados controles, eventos de faixa e pausa, recuperação do estado da faixa sem evento, Esc e foco, navegação, importação de imagem, persistência, dados corrompidos, movimento reduzido e quatro tamanhos de janela. O AURA também foi aplicado ao Spotify 1.3.9.2055 com o Spicetify 2.46.7. O roteiro acima cobre os testes de reprodução no cliente. [Decisões técnicas](docs/DECISOES.md)
