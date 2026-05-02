// Novel Studio Connector v4.1 — Clean Handshake
// Flow: App gọi → Extension trả content → App gọi tiếp → Extension chuyển chương + trả
console.log("%c🚀 Novel Studio Connector v4.1", "color:lime;font-size:16px");

const contentCache = new Map();

// Content.js gửi nội dung → cache
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === "STV_CONTENT_READY" && sender.tab) {
    console.log(`[BG] ✅ Cache: ${msg.length} chars — ${msg.url}`);
    contentCache.set(sender.tab.id, {
      content: msg.content, title: msg.title,
      url: msg.url, length: msg.length, timestamp: Date.now()
    });
  }
  if (msg.type === "STV_PAGE_LOADED" && sender.tab) {
    console.log(`[BG] Page loaded: ${msg.url}`);
  }
});

// ====================== WEB APP MESSAGES ======================
chrome.runtime.onMessageExternal.addListener((request, _sender, sendResponse) => {
  if (request.type === "PING" || request.action === "ping") {
    sendResponse({ ok: true, version: chrome.runtime.getManifest().version, success: true, status: "online" });
    return false;
  }
  if (request.action === "downloadChapter") {
    stvFetchChapter(request.payload, sendResponse);
    return true;
  }
  if (request.action === "downloadAllSequential") {
    downloadAllSequential(request.payload, sendResponse);
    return true;
  }
  if (request.type === "FETCH") {
    handleFetch(request.url, request.waitSelector, request.clickSelector, request.timeout || 15000)
      .then((r) => sendResponse({ ok: true, ...r }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  return false;
});

// ====================== STV CHAPTER FETCH ======================
// Handshake: App gọi → lấy content hiện tại → chuyển chương → respond
// Lần gọi tiếp: cache đã có chương mới → lấy → chuyển → respond

async function findSTVTab() {
  const tabs = await chrome.tabs.query({ url: "*://sangtacviet.com/*" });
  return tabs.length > 0 ? tabs[0].id : null;
}

async function stvFetchChapter(payload, sendResponse) {
  try {
    const tabId = await findSTVTab();
    if (!tabId) {
      sendResponse({ success: false, error: "Mở 1 tab SangTacViet trước!" });
      return;
    }

    // 1. Lấy content từ cache (content.js đã auto-extract khi page load)
    let content = '', title = '';

    // Đợi cache (tối đa 20s)
    for (let i = 0; i < 40; i++) {
      const cached = contentCache.get(tabId);
      if (cached && cached.length > 200) {
        content = cached.content;
        title = cached.title;
        contentCache.delete(tabId);
        break;
      }
      // Sau 3s không có cache, thử hỏi trực tiếp
      if (i === 6) {
        try {
          const resp = await chrome.tabs.sendMessage(tabId, { type: "EXTRACT_NOW" });
          if (resp && resp.length > 200) {
            content = resp.content;
            title = resp.title;
            break;
          }
        } catch {}
      }
      await delay(500);
    }

    console.log(`[STV] Got ${content.length} chars for current page`);

    // 2. Click "Chương sau" → chuẩn bị cho lần gọi tiếp
    contentCache.delete(tabId);
    try {
      await chrome.tabs.sendMessage(tabId, { type: "GO_NEXT" });
      // Đợi trang mới load + content.js extract
      await waitForTabLoad(tabId, 25000);
      // Đợi cache được fill bởi content.js
      for (let i = 0; i < 30; i++) {
        if (contentCache.has(tabId)) {
          console.log("[STV] ✅ Next page cached!");
          break;
        }
        await delay(500);
      }
    } catch (e) {
      console.log("[STV] GO_NEXT:", e.message || "no next chapter");
    }

    // 3. Trả kết quả
    sendResponse({
      success: true, content, contentText: content,
      data: '', length: content.length,
      title, timedOut: content.length < 200
    });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function downloadAllSequential({ chapters, delay: d = 1000 }, sendResponse) {
  const results = [];
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    console.log(`[${i+1}/${chapters.length}] ${ch.title}`);
    const res = await new Promise(r => stvFetchChapter({ chapterUrl: ch.url }, r));
    results.push({ chapter: ch, ...res });
  }
  sendResponse({ success: true, results });
}

// ====================== STANDARD FETCH (non-STV) ======================
async function handleFetch(url, waitSelector, clickSelector, timeout) {
  const tab = await chrome.tabs.create({ url, active: false });
  const tabId = tab.id;
  try {
    await waitForTabLoad(tabId, 30000);
    await injectStealth(tabId);
    await delay(1000 + Math.random() * 1500);
    let timedOut = false;
    if (clickSelector && waitSelector) {
      for (let i = 0; i < 3; i++) {
        try {
          await chrome.scripting.executeScript({ target: { tabId }, args: [clickSelector], func: (s) => {
            const el = document.querySelector(s); if (el) el.click();
          }});
        } catch {}
        if (!(await waitForSelector(tabId, waitSelector, Math.floor(timeout/3), 200))) { timedOut = false; break; }
        timedOut = true; await delay(500);
      }
    } else if (waitSelector) {
      timedOut = await waitForSelector(tabId, waitSelector, timeout, 200);
    } else {
      await waitForStableContent(tabId, timeout);
    }
    const results = await chrome.scripting.executeScript({
      target: { tabId }, args: [waitSelector || null],
      func: (s) => {
        const html = "<!DOCTYPE html><html>" + document.head.outerHTML + "<body>" + document.body.innerHTML + "</body></html>";
        let contentText = null;
        if (s) { const el = document.querySelector(s); if (el) contentText = el.innerText; }
        return { html, contentText };
      },
    });
    const data = results?.[0]?.result;
    if (!data) throw new Error("Failed to extract");
    return { html: data.html, contentText: data.contentText, timedOut };
  } finally { try { await chrome.tabs.remove(tabId); } catch {} }
}

// ====================== HELPERS ======================
async function injectStealth(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId }, world: "MAIN",
      func: () => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined, configurable: true });
        Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
        Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
        Document.prototype.hasFocus = () => true;
        document.addEventListener('visibilitychange', e => e.stopImmediatePropagation(), true);
      },
    });
  } catch {}
}
async function waitForSelector(tabId, sel, maxWait, minLen) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const r = await chrome.scripting.executeScript({ target: { tabId }, args: [sel], func: (s) => {
        const el = document.querySelector(s); if (!el) return 0;
        const c = el.cloneNode(true); c.querySelectorAll("script,style,noscript").forEach(x => x.remove());
        return c.textContent.trim().length;
      }});
      if ((r?.[0]?.result ?? 0) > minLen) return false;
    } catch {}
    await delay(500);
  }
  return true;
}
async function waitForStableContent(tabId, maxWait) {
  const start = Date.now(); let last = 0, stable = 0;
  await delay(1500);
  while (Date.now() - start < maxWait) {
    try {
      const r = await chrome.scripting.executeScript({ target: { tabId }, func: () => {
        const c = document.body.cloneNode(true); c.querySelectorAll("script,style,noscript").forEach(e => e.remove());
        return c.textContent.trim().length;
      }});
      const len = r?.[0]?.result ?? 0;
      if (len === last && len > 0) { stable++; if (stable >= 2) return; } else stable = 0;
      last = len;
    } catch {}
    await delay(500);
  }
}
function waitForTabLoad(tabId, ms) {
  return new Promise(resolve => {
    const t = setTimeout(() => { chrome.tabs.onUpdated.removeListener(fn); resolve(); }, ms);
    function fn(id, info) {
      if (id === tabId && info.status === "complete") { chrome.tabs.onUpdated.removeListener(fn); clearTimeout(t); resolve(); }
    }
    chrome.tabs.onUpdated.addListener(fn);
  });
}
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

chrome.tabs.onRemoved.addListener((tabId) => { contentCache.delete(tabId); });
