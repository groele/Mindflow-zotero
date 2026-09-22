/// <reference types="chrome"/>

// Initialize Context Menus on install
chrome.runtime.onInstalled.addListener(() => {
  // Context menu for selected text to Inbox
  chrome.contextMenus.create({
    id: 'mindflow_add_selection_inbox',
    title: '📥 收集摘录「%s」到收集箱',
    contexts: ['selection']
  });

  // Context menu for selected text directly to active map
  chrome.contextMenus.create({
    id: 'mindflow_add_selection_doc',
    title: '➕ 立即添加至当前导图分支',
    contexts: ['selection']
  });

  // Context menu for current page
  chrome.contextMenus.create({
    id: 'mindflow_add_page_inbox',
    title: '🌐 收集当前网页至收集箱',
    contexts: ['page']
  });

  // Context menu to open side panel
  chrome.contextMenus.create({
    id: 'mindflow_open_sidepanel',
    title: '📖 打开侧边栏伴读模式',
    contexts: ['action', 'page']
  });
});

// Handle Context Menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'mindflow_open_sidepanel' && tab?.id) {
    if ('sidePanel' in chrome && chrome.sidePanel && chrome.sidePanel.open) {
      chrome.sidePanel.open({ tabId: tab.id });
    }
    return;
  }

  if (info.menuItemId === 'mindflow_add_selection_inbox' && info.selectionText) {
    await addToInbox(info.selectionText.trim(), tab?.title, tab?.url, tab?.favIconUrl);
    notifyBadge('+1');
  }

  if (info.menuItemId === 'mindflow_add_selection_doc' && info.selectionText) {
    await appendTextToActiveDoc(info.selectionText.trim(), tab?.url);
    notifyBadge('✓');
  }

  if (info.menuItemId === 'mindflow_add_page_inbox' && tab) {
    await addToInbox(tab.title || '网页链接', tab.title, tab.url, tab.favIconUrl);
    notifyBadge('+1');
  }
});

// Save to Inbox
async function addToInbox(text: string, title?: string, url?: string, favIconUrl?: string) {
  try {
    const res = await chrome.storage.local.get(['mindflow_inbox_items']);
    const raw = res.mindflow_inbox_items as string | undefined;
    const items = raw ? JSON.parse(raw) : [];
    items.unshift({
      id: 'inbox_' + Math.random().toString(36).substring(2, 9),
      text: text.substring(0, 300),
      title: title?.trim(),
      url: url?.trim(),
      favIconUrl,
      createdAt: Date.now(),
      isProcessed: false,
    });
    await chrome.storage.local.set({ mindflow_inbox_items: JSON.stringify(items) });
    chrome.runtime.sendMessage({ type: 'INBOX_UPDATED' }).catch(() => {});
  } catch (err) {
    console.error('Failed to add to inbox', err);
  }
}

// Append quick item to active document in chrome.storage.local
async function appendTextToActiveDoc(text: string, link?: string) {
  try {
    const res = await chrome.storage.local.get(['mindflow_active_doc_id']);
    const activeId = res.mindflow_active_doc_id as string | undefined;
    if (!activeId) return;

    const docKey = 'mindflow_doc_' + activeId;
    const docRes = await chrome.storage.local.get([docKey]);
    const rawDoc = docRes[docKey] as string | undefined;
    if (!rawDoc) return;

    const doc = JSON.parse(rawDoc);
    const newNode = {
      id: 'node_' + Math.random().toString(36).substring(2, 9),
      text: text.substring(0, 120),
      note: text.length > 120 ? text : undefined,
      link: link,
      isExpanded: true,
      children: []
    };

    if (!doc.root.children) doc.root.children = [];
    doc.root.children.push(newNode);
    doc.updatedAt = Date.now();

    await chrome.storage.local.set({ [docKey]: JSON.stringify(doc) });

    // Notify open sidepanels or tabs
    chrome.runtime.sendMessage({ type: 'DOC_UPDATED', docId: activeId }).catch(() => {});
  } catch (err) {
    console.error('Failed to append to active doc', err);
  }
}

function notifyBadge(text = '✓') {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
  setTimeout(() => {
    chrome.action.setBadgeText({ text: '' });
  }, 2000);
}

// Handle messages from UI components
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_FULLSCREEN') {
    chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
    sendResponse({ success: true });
  } else if (message.type === 'OPEN_SIDEPANEL') {
    if (sender.tab?.id && 'sidePanel' in chrome && chrome.sidePanel && chrome.sidePanel.open) {
      chrome.sidePanel.open({ tabId: sender.tab.id });
    }
    sendResponse({ success: true });
  } else if (message.type === 'GET_CURRENT_TAB_INFO') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        sendResponse({
          title: tabs[0].title,
          url: tabs[0].url,
          favIconUrl: tabs[0].favIconUrl
        });
      } else {
        sendResponse(null);
      }
    });
    return true; // Keep channel open for async response
  }
});
