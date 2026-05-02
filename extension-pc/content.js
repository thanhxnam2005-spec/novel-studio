// content.js v4.1 — Clean Handshake Mode
// Chỉ extract + gửi 1 lần duy nhất khi page load
// Nhận GO_NEXT → click "Chương sau" → trang mới load → extract lại
(function() {
  'use strict';
  let sent = false;

  const cleanText = (text) => {
    return (text || '')
      .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
      .replace(/@Bạn đang đọc bản lưu trong hệ thống/g, '')
      .replace(/Đang tải nội dung chương\.\.\./g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  const doExtract = () => {
    const box = document.querySelector('#content-container .contentbox');
    if (!box) return '';
    const inner = cleanText(box.innerText);
    let obf = '';
    box.querySelectorAll('i').forEach(el => {
      if ((el.id && el.id.startsWith('ran')) || el.id?.startsWith('exran') ||
          el.hasAttribute('h') || el.hasAttribute('t') || el.hasAttribute('v')) {
        obf += el.textContent;
      }
    });
    obf = cleanText(obf);
    return obf.length > inner.length ? obf : inner;
  };

  const sendToBackground = (content) => {
    if (sent || content.length < 200) return;
    sent = true;
    const title = (document.title || '').split(/\s+-\s+/)[0]?.trim() || '';
    chrome.runtime.sendMessage({
      type: "STV_CONTENT_READY",
      content, title, url: location.href, length: content.length
    });
    console.log(`%c[Extractor] ✅ ${content.length} ký tự — ${title}`, "color:lime;font-size:14px");
  };

  // Click "Chương sau >" — link CÓ SẴN trên trang STV
  const clickNextChapter = () => {
    const links = document.querySelectorAll('a');
    for (const a of links) {
      const text = (a.textContent || '').trim();
      if (text.includes('Chương sau')) {
        console.log(`[Extractor] Click "Chương sau" → ${a.href}`);
        a.click();
        return true;
      }
    }
    return false;
  };

  // Auto-extract khi page load (CHỈ 1 LẦN)
  const autoExtract = () => {
    if (sent) return;
    const content = doExtract();
    if (content.length > 200) {
      sendToBackground(content);
    }
  };

  // Polling: thử extract nhiều lần cho đến khi có nội dung
  const startPolling = () => {
    for (let i = 0; i < 15; i++) {
      setTimeout(autoExtract, 1500 + i * 1000);
    }
  };

  startPolling();

  // ========== LISTEN FOR COMMANDS ==========
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    // Background yêu cầu extract
    if (msg.type === "EXTRACT_NOW") {
      sent = false; // Reset để cho phép extract lại
      const tryExtract = (n) => {
        if (n <= 0) { sendResponse({ content: '', length: 0 }); return; }
        const content = doExtract();
        if (content.length > 200) {
          const title = (document.title || '').split(/\s+-\s+/)[0]?.trim() || '';
          sendResponse({ content, title, length: content.length, url: location.href });
        } else {
          setTimeout(() => tryExtract(n - 1), 1000);
        }
      };
      setTimeout(() => tryExtract(12), 1500);
      return true; // Async response
    }

    // Background yêu cầu chuyển chương
    if (msg.type === "GO_NEXT") {
      console.log("[Extractor] → GO_NEXT");
      const ok = clickNextChapter();
      sendResponse({ ok });
      return false;
    }
  });

  // Báo page đã load
  chrome.runtime.sendMessage({ type: "STV_PAGE_LOADED", url: location.href });
  console.log('%c[Extractor] v4.1 ready!', 'color:cyan;font-size:14px');
})();
