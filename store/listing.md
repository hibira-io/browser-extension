# Chrome Web Store listing

Copy for the developer dashboard. Chrome doesn't let extensions operate Web Store pages, so this is pasted by hand.

## Store listing tab

**Name** (from the manifest): Hibi by Hibira

**Summary** (from the manifest, 132 max): Hand repetitive web chores to Hibi. Turn it on one site at a time; every submit waits for your approval.

**Category:** Productivity → Workflow & Planning

**Languages:** English (default), 繁體中文, 简体中文, 日本語, 한국어, ไทย, Tiếng Việt. The name and summary come from the package's `_locales`. For each language, pick it in the dashboard's language menu and paste `store/description/<lang>.txt`, that language's 5 screenshots and its promo tile `store/promo/<lang>.png`.

**Description:** `store/description/<lang>.txt` (en, zh-TW, zh-CN, ja, ko, th, vi)

**Screenshots** (1280×800, one set per language, from the local demo: `npm run shots`):
`e2e/shots/store/<lang>/`, in this order:
1. `4-done-light.png`: a chore done, with the approved submit
2. `3-approval-light.png`: the approval card before a save
3. `2-site-off-light.png`: turning Hibi on for one site
4. `3-approval-dark.png`: dark mode
5. `1-signin-light.png`: sign-in

**Small promo tile** (440×280): `store/promo/<lang>.png` (`node scripts/promo.cjs`)

**Official URL:** https://hibira.io (after the site is verified in Search Console)
**Homepage URL:** https://hibira.io/secretary
**Support URL:** https://hibira.io/portal/support

## Privacy practices tab

**Single purpose:**

```
Hibi carries out web chores the user asks for in the side panel, on sites the user turns it on for: it reads the current page, clicks, types and selects options, and waits for the user's approval before any submit.
```

**Permission justifications:**

| Permission | Justification |
|---|---|
| sidePanel | Hibi's conversation and approval cards are shown in Chrome's side panel. |
| activeTab | When the user clicks the toolbar button, presses the shortcut or picks "Use Hibi on this site", the panel learns which site the tab is on so it can offer to turn Hibi on there. |
| scripting | Injects Hibi's page tools (read the page, click, type, select, scroll) into the active tab, only on sites the user turned on. |
| storage | Keeps the user's sign-in session on this device. |
| identity | Signs the user in to their Hibira account (Sign in with Hibira, OAuth with PKCE) with launchWebAuthFlow. |
| contextMenus | Adds "Use Hibi on this site" to the page's right-click menu. |
| Host permissions (optional) | Requested one origin at a time, only when the user presses "Turn on for <site>", so Hibi can work on that site. None are requested at install, and the user can turn any site off. |

**Remote code:** No, I am not using remote code. (All scripts are in the package; the server returns data only.)

**Data usage** (tick these):
- Personally identifiable information: the account email, for sign-in.
- Website content: the text and form fields of the page Hibi is working on, sent when the user asks Hibi to do something there. Passwords, card numbers and one-time codes are never read.
- User activity: the requests the user types, and which actions they approve, kept as the task log.

**Certifications** (tick all three):
- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL:** https://hibira.io/legal/privacy (its Hibi for Chrome section ships with pusher-server #1004)

## Distribution tab

- Payments: Free of charge (no in-app purchases in this version)
- Visibility: Public
- Regions: All regions

## Test instructions (for the reviewer)

```
1. Click the Hibi toolbar button to open the side panel, then "Sign in with Hibira" with the test account below.
2. Open https://demos.hibira.io/examples/northwind/ (a demo shop admin), press "Turn on for demos.hibira.io" in the panel and allow it.
3. Type: Mark order #1042 shipped with DHL, tracking JD014600.
4. Hibi opens the order, fills in the carrier and tracking number, and shows an approval card. Press Approve to save.

Test account: (Danny types the reviewer account's email and password in the dashboard; they are never stored here)
```

## Update notes for review

This update handles interrupted replies from an authorized page. If Chrome loses contact during an action, Hibi can inspect the page and requires a new user request before it sends another click, edit or navigation. This update requests zero additional Chrome permissions or host permissions. The existing permission justifications above apply.
