// Novel Studio Connector — Background Service Worker (PC Version)
// Optimized for Desktop Chrome using minimized windows.

chrome.runtime.onMessageExternal.addListener((request, _sender, sendResponse) => {
  if (request.type === "PING") {
    sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
    return false;
  }

  if (request.type === "FETCH") {
    handleFetch(request.url, request.waitSelector, request.clickSelector, request.timeout || 15000)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; 
  }
  return false;
});

async function handleFetch(url, waitSelector, clickSelector, timeout) {
  const logs = [];
  const log = (msg) => logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);

  // PC: create minimized window
  const win = await chrome.windows.create({ url, state: "minimized" });
  const tabId = win.tabs[0].id;
  const windowId = win.id;
  log(`tab created (minimized window)`);

  try {
    await waitForTabLoad(tabId, 30000);
    log(`page loaded`);

    // Anti-bot delay
    const initialDelay = 1000 + Math.random() * 1500;
    await delay(initialDelay);
    log(`waited ${Math.round(initialDelay)}ms (anti-bot)`);

    // Anti-bot interaction
    await injectHumanBehavior(tabId);
    log(`injected human behavior`);

    let timedOut = false;
    if (clickSelector && waitSelector) {
      timedOut = await clickAndWait(tabId, clickSelector, waitSelector, timeout, log);
    } else if (clickSelector) {
      await robustClick(tabId, clickSelector);
      log(`clicked: ${clickSelector}`);
    } else if (waitSelector) {
      timedOut = await waitForSelector(tabId, waitSelector, timeout, 200);
      log(timedOut ? `wait timeout: ${waitSelector}` : `content ready: ${waitSelector}`);
    } else {
      await waitForStableContent(tabId, timeout);
      log(`content stabilized`);
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId },
      args: [waitSelector || null],
      func: (sel) => {
        const html = "<!DOCTYPE html><html>" + document.head.outerHTML + "<body>" + document.body.innerHTML + "</body></html>";
        let contentText = null;
        if (sel) {
          const el = document.querySelector(sel);
          if (el) contentText = el.innerText;
        }
        return { html, contentText };
      },
    });

    const data = results?.[0]?.result;
    if (!data) throw new Error("Failed to extract page content");

    return { html: data.html, contentText: data.contentText, timedOut, logs };
  } catch (err) {
    throw Object.assign(err, { logs });
  } finally {
    try { await chrome.windows.remove(windowId); } catch {}
  }
}

async function injectHumanBehavior(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        window.scrollBy(0, Math.floor(Math.random() * 300) + 100);
        document.dispatchEvent(new MouseEvent("mousemove", {
          clientX: Math.floor(Math.random() * window.innerWidth),
          clientY: Math.floor(Math.random() * window.innerHeight),
          bubbles: true,
        }));
      },
    });
  } catch {}
  await delay(300 + Math.random() * 500);
}

async function clickAndWait(tabId, clickSel, waitSel, timeout, log) {
  const maxRetries = 3;
  const perAttemptTimeout = Math.floor(timeout / maxRetries);
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    await robustClick(tabId, clickSel);
    if (!(await waitForSelector(tabId, waitSel, perAttemptTimeout, 200))) return false;
    await delay(500 + Math.random() * 1000);
  }
  return true;
}

async function robustClick(tabId, selector) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      args: [selector],
      func: (sel) => {
        const el = document.querySelector(sel);
        if (!el) return;
        el.click();
        const opts = { bubbles: true, cancelable: true, view: window };
        el.dispatchEvent(new MouseEvent("mousedown", opts));
        el.dispatchEvent(new MouseEvent("mouseup", opts));
        el.dispatchEvent(new MouseEvent("click", opts));
      },
    });
  } catch {}
  await delay(500);
}

async function waitForSelector(tabId, selector, maxWait, minLength) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        args: [selector],
        func: (sel) => {
          const el = document.querySelector(sel);
          if (!el) return 0;
          const clone = el.cloneNode(true);
          clone.querySelectorAll("script, style, noscript").forEach((s) => s.remove());
          return clone.textContent.trim().length;
        },
      });
      if ((results?.[0]?.result ?? 0) > minLength) return false;
    } catch {}
    await delay(500);
  }
  return true;
}

async function waitForStableContent(tabId, maxWait) {
  const start = Date.now();
  let lastLength = 0, stableCount = 0;
  await delay(1500);
  while (Date.now() - start < maxWait) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const clone = document.body.cloneNode(true);
          clone.querySelectorAll("script,style,noscript").forEach((el) => el.remove());
          return clone.textContent.trim().length;
        },
      });
      const len = results?.[0]?.result ?? 0;
      if (len === lastLength && len > 0) {
        stableCount++;
        if (stableCount >= 2) return;
      } else stableCount = 0;
      lastLength = len;
    } catch {}
    await delay(500);
  }
}

function waitForTabLoad(tabId, timeoutMs) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, timeoutMs);
    function listener(id, info) {
      if (id === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        clearTimeout(timeout);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }
