// Novel Studio Connector — Background Service Worker
// v0.2.0: Anti-bot improvements + Kiwi Browser (mobile) support

// ─── Kiwi Browser Compatibility ──────────────────────────────
// Kiwi Browser on Android doesn't support chrome.windows API.
// We detect this and use tab-based approach instead.

let isKiwi = false;
try {
  // Kiwi doesn't have chrome.windows.create
  if (!chrome.windows || typeof chrome.windows.create !== "function") {
    isKiwi = true;
  }
} catch { isKiwi = true; }

// ─── Anti-Bot: Random User Behavior ─────────────────────────

function randomDelay(min, max) {
  return new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));
}

// ─── Message Listener ────────────────────────────────────────

chrome.runtime.onMessageExternal.addListener(
  (request, _sender, sendResponse) => {
    if (request.type === "PING") {
      sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
      return false;
    }

    if (request.type === "FETCH") {
      handleFetch(
        request.url,
        request.waitSelector,
        request.clickSelector,
        request.timeout || 15000,
      )
        .then((result) => sendResponse({ ok: true, ...result }))
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      return true; // keep channel open for async response
    }

    sendResponse({ ok: false, error: "Unknown message type" });
    return false;
  },
);

// ─── Also support internal messages (for Kiwi popup/content scripts) ──
chrome.runtime.onMessage.addListener(
  (request, _sender, sendResponse) => {
    if (request.type === "PING") {
      sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
      return false;
    }

    if (request.type === "FETCH") {
      handleFetch(
        request.url,
        request.waitSelector,
        request.clickSelector,
        request.timeout || 15000,
      )
        .then((result) => sendResponse({ ok: true, ...result }))
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      return true;
    }

    sendResponse({ ok: false, error: "Unknown message type" });
    return false;
  },
);

// ─── Main Fetch Handler ──────────────────────────────────────

async function handleFetch(url, waitSelector, clickSelector, timeout) {
  const logs = [];
  const log = (msg) => { logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`); };

  let tabId, windowId;

  if (isKiwi) {
    // Kiwi Browser: create tab with active:true so it ACTUALLY navigates
    const createdTab = await chrome.tabs.create({ url, active: true });
    tabId = createdTab.id;
    windowId = null;
    log(`tab created (Kiwi mode, active tab, id=${tabId})`);

    // Force navigation in case tab didn't navigate
    await delay(500);
    try {
      const tabInfo = await chrome.tabs.get(tabId);
      log(`tab url after create: ${tabInfo.url}`);
      if (!tabInfo.url || tabInfo.url.startsWith("chrome://") || tabInfo.url === "about:blank") {
        log(`tab stuck on internal URL, forcing navigation...`);
        await chrome.tabs.update(tabId, { url });
        log(`forced navigation to ${url}`);
      }
    } catch (e) {
      log(`tab check failed: ${e.message}`);
    }
  } else {
    // Desktop Chrome: create minimized window
    const win = await chrome.windows.create({ url, state: "minimized" });
    tabId = win.tabs[0].id;
    windowId = win.id;
    log(`tab created (minimized window)`);
  }

  try {
    // Wait for the REAL page to load (not chrome://newtab)
    await waitForRealPage(tabId, url, 60000, log);
    log(`page loaded`);

    // Anti-bot: simulate human-like delay before interaction
    const initialDelay = 1000 + Math.random() * 1500;
    await delay(initialDelay);
    log(`waited ${Math.round(initialDelay)}ms (anti-bot)`);

    // Anti-bot: scroll the page slightly to seem human
    await safeExecute(tabId, () => {
      window.scrollBy(0, Math.floor(Math.random() * 300) + 100);
      const event = new MouseEvent("mousemove", {
        clientX: Math.floor(Math.random() * window.innerWidth),
        clientY: Math.floor(Math.random() * window.innerHeight),
        bubbles: true,
      });
      document.dispatchEvent(event);
    });
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

    // Final extraction
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      args: [waitSelector || null],
      func: (sel) => {
        const html =
          "<!DOCTYPE html><html>" +
          document.head.outerHTML +
          "<body>" +
          document.body.innerHTML +
          "</body></html>";

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

    log(`extracted: html=${data.html.length} contentText=${data.contentText?.length ?? 0}${timedOut ? " (TIMEOUT)" : ""}`);
    return { html: data.html, contentText: data.contentText, timedOut, logs };
  } catch (err) {
    log(`error: ${err.message}`);
    throw Object.assign(err, { logs });
  } finally {
    try {
      if (windowId) {
        await chrome.windows.remove(windowId);
      } else if (tabId) {
        await chrome.tabs.remove(tabId);
      }
    } catch {}
  }
}

// ─── Safe Script Execution ───────────────────────────────────
// Wraps executeScript with URL check to avoid chrome:// errors

async function safeExecute(tabId, func, args) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url && (tab.url.startsWith("chrome://") || tab.url.startsWith("about:") || tab.url.startsWith("edge://"))) {
      return null; // Skip — can't inject into internal pages
    }
  } catch { return null; }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func,
      args: args || [],
    });
    return results?.[0]?.result ?? null;
  } catch {
    return null;
  }
}

// ─── Wait for Real Page ──────────────────────────────────────
// Polls until the tab URL is a real website (not chrome://) AND status is complete

async function waitForRealPage(tabId, targetUrl, timeoutMs, log) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const tab = await chrome.tabs.get(tabId);

      if (tab.url && !tab.url.startsWith("chrome://") && !tab.url.startsWith("about:") && tab.status === "complete") {
        log(`tab navigated to: ${tab.url.substring(0, 80)}`);
        return;
      }

      // If tab is stuck on chrome:// for more than 5 seconds, force navigate
      if (Date.now() - start > 5000 && tab.url && (tab.url.startsWith("chrome://") || tab.url === "about:blank")) {
        log(`tab still on ${tab.url}, forcing navigation again...`);
        await chrome.tabs.update(tabId, { url: targetUrl });
      }
    } catch {
      // Tab might not exist yet
    }

    await delay(1000);
  }

  log(`waitForRealPage timeout after ${timeoutMs}ms`);
}

// ─── Click + Wait with Retry ────────────────────────────────

async function clickAndWait(tabId, clickSel, waitSel, timeout, log) {
  const maxRetries = 3;
  const perAttemptTimeout = Math.floor(timeout / maxRetries);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    await robustClick(tabId, clickSel);
    log(`click attempt ${attempt + 1}/${maxRetries}`);

    const timedOut = await waitForSelector(tabId, waitSel, perAttemptTimeout, 200);

    if (!timedOut) {
      log(`content loaded after attempt ${attempt + 1}`);
      return false;
    }

    log(`attempt ${attempt + 1} timeout — retrying`);
    await randomDelay(500, 1500);
  }

  log("all click attempts exhausted");
  return true;
}

// ─── Robust Click ────────────────────────────────────────────

async function robustClick(tabId, selector) {
  await safeExecute(tabId, (sel) => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.click();
    const opts = { bubbles: true, cancelable: true, view: window };
    el.dispatchEvent(new MouseEvent("mousedown", opts));
    el.dispatchEvent(new MouseEvent("mouseup", opts));
    el.dispatchEvent(new MouseEvent("click", opts));
    if (typeof el.focus === "function") el.focus();
  }, [selector]);
  await delay(500);
}

// ─── Wait for Selector ───────────────────────────────────────

async function waitForSelector(tabId, selector, maxWait, minLength) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const len = await safeExecute(tabId, (sel) => {
      const el = document.querySelector(sel);
      if (!el) return 0;
      const clone = el.cloneNode(true);
      clone.querySelectorAll("script, style, noscript").forEach((s) => s.remove());
      return clone.textContent.trim().length;
    }, [selector]);
    if (len && len > minLength) return false;
    await delay(500);
  }
  return true;
}

// ─── Wait for Stable Content ─────────────────────────────────

async function waitForStableContent(tabId, maxWait) {
  const start = Date.now();
  let lastLength = 0;
  let stableCount = 0;
  await delay(2000);
  while (Date.now() - start < maxWait) {
    const len = await safeExecute(tabId, () => {
      const clone = document.body.cloneNode(true);
      clone.querySelectorAll("script,style,noscript").forEach((el) => el.remove());
      return clone.textContent.trim().length;
    });
    if (len !== null) {
      if (len === lastLength && len > 0) {
        stableCount++;
        if (stableCount >= 2) return;
      } else stableCount = 0;
      lastLength = len;
    }
    await delay(500);
  }
}

// ─── Utility ─────────────────────────────────────────────────

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
