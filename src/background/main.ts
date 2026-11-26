// The service worker. The toolbar button, its shortcut and the page's
// right-click "Use Hibi on this site" open Hibi in the side panel; each also
// lets the panel see which site the tab is on (activeTab), so it can offer to
// turn Hibi on there. No site is granted until the person turns it on.

function setup(): void {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'hibi', title: chrome.i18n.getMessage('useOnSite'), contexts: ['page', 'selection', 'editable', 'link'] });
  });
}

chrome.runtime.onInstalled.addListener(setup);
chrome.runtime.onStartup.addListener(setup);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'hibi' || tab?.id === undefined) return;
  // open must run inside the click, before any await.
  chrome.sidePanel.open({ tabId: tab.id }).catch(() => undefined);
  chrome.runtime.sendMessage({ hibi: 'invoked', tabId: tab.id }).catch(() => undefined);
});
