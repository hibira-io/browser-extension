# Hibi for Chrome

Hibi in Chrome's side panel: hand repetitive web chores to Hibi, one site at a time, with your approval before anything is submitted.

- **One site at a time.** The extension asks for no website access at install. Turn Hibi on for a site from the panel, and Chrome grants that site only. Turn it off any time.
- **Reads, clicks and types for you.** Menus, tabs, search, filters, typing and paging run without asking at each step.
- **Asks before it submits.** A save, send, pay or delete is filled in and then waits for your Approve.
- **Never on sign-in pages.** Sign-in, sign-up and robot-check pages are yours. Hibi never reads or types passwords, card numbers or one-time codes.
- **Plain pricing.** A free monthly allowance of tasks, then a small price per task. One task is one request of up to 20 steps.

## Develop

```bash
npm install
npm run build          # dist/, talks to https://hibira.io
npm run typecheck
npm test               # unit tests (the core has its own in pusher-server)
```

Load `dist/` at `chrome://extensions` with Developer mode on (Load unpacked).

### Local demo

A made-up shop admin and a scripted stand-in for the Hibira API, for development and store screenshots. It never touches production.

```bash
HIBIRA_BASE=http://localhost:5174 HIBIRA_DEMO=1 npm run build
node demo/server.mjs &
node e2e/run.cjs                    # LANG_TAG=zh-TW SCHEME=dark for other variants
python3 scripts/stitch.py           # 1280×800 store screenshots in e2e/shots/store
```

The demo build adds the `tabs` permission and grants `northwind.example` up front, since an automated run can't click the toolbar button or accept Chrome's permission prompt. Store builds never include either.

## Layout

| Path | What it is |
|------|------------|
| `vendor/` | The Secretary core from pusher-server (agent loop, page tools, policy), copied by `scripts/sync-core.sh`; `vendor/SOURCE` names the commit. Change it in pusher-server, not here. |
| `src/content/` | The content script: hosts the core's `LocalPage`, injected only into sites the person turned on |
| `src/chrome/` | `ExtensionPage` (the core's `PageAdapter` over the content script), sign-in, per-site permissions |
| `src/panel/` | The side panel |
| `public/` | Manifest, panel HTML/CSS, icons, `_locales` |
| `store/` | Chrome Web Store listing copy and privacy answers |

## Sign-in

"Sign in with Hibira" (OAuth 2.0 + PKCE, `scope=email`) through `chrome.identity.launchWebAuthFlow`. hibira.io treats the extension as a first-party client, so there is no consent page: the person only signs in to hibira.io, in Chrome's own window. The code is traded for a single-use sign-in token, then for a 30-day session on the person's own Hibi workspace (`POST /secretary/v1/extension/session`). On pusher-server, set `SECRETARY_EXTENSION_IDS` to the store item's ID.

## Release

Bump `version` in `package.json` and `public/manifest.json`, then publish a GitHub Release `vX.Y.Z`. CI attaches `hibi-extension-X.Y.Z.zip` to the release for the Chrome Web Store upload.

## 中文摘要

Hibi 的 Chrome 擴充功能：在側邊欄把重複的網頁雜事交給 Hibi。安裝時不要求任何網站權限，使用者逐一開啟網站；一般操作（選單、分頁、搜尋、篩選、輸入、換頁）直接執行，送出、儲存、付款、刪除會先填好再等使用者同意；登入、註冊、機器人驗證頁完全不碰，也不讀寫密碼、卡號、驗證碼。免費每月任務額度，之後按任務計費（每任務最多 20 步）。`npm run build` 建置，共用 SDK 核心（`vendor/`，由 `scripts/sync-core.sh` 從 pusher-server 同步），`demo/` 是本機 demo（虛構商店後台＋腳本化 API，不碰正式環境），`e2e/run.cjs` 跑端對端測試並產生商店截圖。發布：更新兩處版本號後建立 GitHub Release，CI 產生上架用 zip。
