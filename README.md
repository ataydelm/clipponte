# ClipPonte — clipboard partilhado entre PC e telemóvel

App web instalável (PWA) para guardar texto, links, imagens e ficheiros copiados e
colá-los noutro programa ou noutro dispositivo. Sem servidor nem base de dados: o
histórico fica numa pasta do teu OneDrive.

## O que faz

| Função | PC (Chrome/Edge) | Android | iPhone/iPad |
|---|---|---|---|
| Histórico de texto, links, imagens, ficheiros | ✅ | ✅ | ✅ |
| Tocar num item → vai para o clipboard → colar noutro lado | ✅ | ✅ | ✅ |
| Favoritos (★), pesquisa, filtros | ✅ | ✅ | ✅ |
| 📌 Sempre visível por cima das outras janelas | ✅ janela flutuante | ❌ o sistema não deixa | ❌ o sistema não deixa |
| Ocultar (fica uma barra pequena) e Mostrar | ✅ | ✅ | ✅ |
| Captura automática ao voltar à janela da app | ✅ | ⚠️ pede autorização | ⚠️ pede autorização |
| Arrastar ficheiros / Ctrl+V dentro da app | ✅ | — | — |
| Partilhar de outra app → ClipPonte | — | ✅ (app instalada) | ❌ |
| Sincronização | pasta do OneDrive | conta Microsoft | conta Microsoft |

Os itens são apagados ao fim de 7 dias (configurável), exceto os favoritos.

**Como colar:** clica no item (ou prime o número 1–9) e depois Ctrl+V / ⌘V no programa
onde queres colar. Imagens vão como imagem. Ficheiros (PDF, etc.) não podem ir para o
clipboard a partir do navegador: no PC são descarregados, no telemóvel abre o menu
"Partilhar".

**Atalhos no PC:** `1`–`9` copiar · `↑` `↓` escolher · `Enter` copiar · `F` favorito ·
`Del` apagar · `/` pesquisar · `Ctrl+V` adicionar · `Esc` limpar pesquisa.

## 1. Publicar a app (uma vez, ~5 minutos)

O telemóvel precisa de abrir a app a partir de um endereço `https://`. O mais simples é o
GitHub Pages (gratuito):

1. Cria uma conta em github.com (se não tiveres).
2. Novo repositório chamado `clipponte`, público.
3. **Add file → Upload files** e arrasta todos os ficheiros desta pasta
   (`index.html`, `app.js`, `storage.js`, `sw.js`, `manifest.webmanifest`, pasta `icons`).
4. **Settings → Pages → Branch: main → / (root) → Save.**
5. Ao fim de 1–2 minutos a app fica em `https://<o-teu-utilizador>.github.io/clipponte/`.

## 2. Ligar a pasta partilhada

### No PC (Windows ou macOS)
1. Abre o endereço no **Chrome ou Edge** e clica no ícone ⬇ para instalar.
2. ⚙ **Definições → Pasta partilhada (PC) → Escolher pasta…**
3. Cria/escolhe `OneDrive/ClipPonte` e autoriza (escolhe "Permitir sempre", se aparecer).
4. Dá um nome ao dispositivo (ex.: "PC gabinete").

### No telemóvel (OneDrive)
O navegador do telemóvel não deixa aceder a pastas, por isso a app entra no OneDrive.
É preciso registar a app na Microsoft **uma vez** (gratuito):

1. Vai a **portal.azure.com** → procura **"Registos de aplicações"** → **Novo registo**.
2. Nome: `ClipPonte`.
3. Tipos de conta: **"Contas em qualquer diretório organizacional e contas Microsoft pessoais"**.
4. URI de redirecionamento: plataforma **"Aplicação de página única (SPA)"** e o endereço
   da app, ex.: `https://<o-teu-utilizador>.github.io/clipponte/` (com a barra final).
5. **Registar** e copia o **"ID da aplicação (cliente)"**.
6. No telemóvel abre a app → ⚙ → **OneDrive (conta Microsoft)** → cola o ID →
   pasta `ClipPonte` → **Entrar na Microsoft**.
7. Instala: Android → menu ⋮ → **Instalar app**; iPhone (Safari) → **Partilhar →
   Adicionar ao ecrã principal**.

> Usa a **mesma conta** do OneDrive que está no PC. Se for a conta institucional da U.Porto,
> a universidade pode exigir aprovação do administrador; com a conta pessoal funciona logo.
> O modo OneDrive também funciona no PC, em qualquer navegador.

## Dispositivos

Em ⚙ **Dispositivos** vês todos os dispositivos ligados à pasta, quando foram vistos pela
última vez e podes:
- desligar a caixa para **esconder** os itens de um dispositivo;
- **remover** um dispositivo (apaga também os itens que ele copiou);
- em "Este dispositivo", **pausar a sincronização**.

## Limitações honestas da versão web

- **Captura automática no PC** só acontece quando voltas à janela do ClipPonte (ou à
  janela flutuante). Uma captura contínua em segundo plano e a exclusão automática de
  gestores de palavras-passe exigem uma app nativa (próxima fase).
- A janela "sempre visível" usa o *Document Picture-in-Picture* (Chrome/Edge 116+).
- No iPhone, nenhuma app pode ficar por cima de outras.

## Estrutura da pasta partilhada

```
ClipPonte/
  devices/<id>.json   nome e plataforma de cada dispositivo
  items/<id>.json     um ficheiro por item (texto, origem, data, favorito)
  blobs/<id>.png|pdf  conteúdo das imagens e ficheiros
```
Cada item é um ficheiro separado, por isso o OneDrive não cria conflitos.
