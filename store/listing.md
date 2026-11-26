# Chrome Web Store listing

Copy for the developer dashboard. Chrome doesn't let extensions operate Web Store pages, so this is pasted by hand.

## Store listing tab

**Name** (from the manifest): Hibi by Hibira

**Summary** (from the manifest, 132 max): Hand repetitive web chores to Hibi. Turn it on one site at a time; every submit waits for your approval.

**Category:** Productivity → Workflow & Planning

**Language:** English (the package also ships 繁體中文, 简体中文, 日本語, 한국어)

**Description:**

```
Hibi takes the repetitive part of web work off your hands: filling the same form again and again, copying details from one page to another, clicking through a list one row at a time.

Open Hibi in the side panel, say what you need in your own words, and watch it happen in your own tab.

ONE SITE AT A TIME
Hibi asks for no website access when you install it. You turn it on for a site from the panel, and Chrome grants that site only. Turn it off whenever you like.

YOU APPROVE EVERY SUBMIT
Hibi reads the page, clicks, types and picks options for you. Before anything is saved, sent, paid for or deleted, it fills in the form and stops, showing you what will be submitted. Nothing is submitted until you press Approve.

YOUR SIGN-INS STAY YOURS
Hibi never works on sign-in, sign-up or robot-check pages, and it never reads or types passwords, card numbers or one-time codes. It works only as you, in your own browser, so it can't do anything you couldn't.

SIMPLE PRICING
Every Hibira account gets 50 free tasks each month. One task is one request.

HOW TO START
1. Click the Hibi button in the toolbar (or press Alt+Shift+H).
2. Sign in with your Hibira account.
3. Turn Hibi on for the site you're on, and tell it what to do.

Questions: support@hibira.io

Hibira
```

**Screenshots** (1280×800, English, from the local demo): `e2e/shots/store/`
1. `4-done-en-US-light.png`: a chore done, with the approved submit
2. `3-approval-en-US-light.png`: the approval card before a save
3. `2-site-off-en-US-light.png`: turning Hibi on for one site
4. `3-approval-en-US-dark.png`: dark mode
5. `1-signin-en-US-light.png`: sign-in

**Small promo tile** (440×280): `store/promo-440x280.png`

**Official URL:** https://hibira.io (after the site is verified in Search Console)
**Homepage URL:** https://hibira.io/secretary/extension
**Support URL:** https://hibira.io/support

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

**Privacy policy URL:** https://hibira.io/privacy (it must have the browser-extension section before submitting)

## Distribution tab

- Payments: Free of charge (no in-app purchases in this version)
- Visibility: Public
- Regions: All regions

## Test instructions (for the reviewer)

```
1. Click the Hibi toolbar button to open the side panel, then "Sign in with Hibira" with the test account below.
2. Open https://demos.hibira.io/northwind/orders (a demo shop admin), press "Turn on for demos.hibira.io" in the panel and allow it.
3. Type: Mark order #1042 shipped with DHL, tracking JD014600.
4. Hibi opens the order, fills in the carrier and tracking number, and shows an approval card. Press Approve to save.

Test account: <email> / <password>
```
