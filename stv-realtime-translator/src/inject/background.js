/**
 * Chrome Extension Background Script for Vietnamese Novel Translation
 * Handles context menus, URL pattern matching, and browser automation
 */

// Constants and Configuration
const SANGTACVIET_BASE_URL = "https://sangtacviet.com/truyen/";
const ADDNAME_WINDOW_PATH = "/src/browser_action/addname_window.html";

const CONTEXT_MENU_IDS = {
    COPY_ORIGINAL: "contextMenu_2",
    ADD_NAME: "contextMenu_3", 
    TRANSLATE_IMAGE: "contextMenu_4"
};

const SUPPORTED_NOVEL_SITES = {
    "uukanshu": [
        "uukanshu.com\\/b\\/(\\d+)\\/(\\d+)?(.html)?",
        "sj.uukanshu.com\\/\\/?book(?:_amp)?.aspx\\?id=(\\d+)",
        "sj.uukanshu.com\\/\\/?read.aspx\\?tid=(\\d+)&sid=(\\d+)"
    ],
    "69shu": ["69shu.com\\/(?:txt\\/)?(\\d+)\\/?(?:(\\d+))?"],
    "69shuorg": ["69shu.org\\/book[_\\/](\\d+)\\/(\\d+)?"],
    "shu008": ["--shu008.com\\/(?:book|\\d+)\\/(\\d+)\\/(\\d+)?"],
    "xinyushuwu": ["xinyushuwu.com\\/\\d+\\/(\\d+)\\/(\\d+)?"],
    "xiaoqiangwx": ["xiaoqiangwx.org\\/(?:\\d+|book)\\/(\\d+)\\/?(?:(\\d+))?(.html)?"],
    "cuiweijux": ["cuiweijux.com\\/files\\/article\\/html\\/\\d+\\/(\\d+)\\/(\\d+)?(.html)?"],
    "aikanshu": ["aikanshu8.com\\/book\\/(\\d+)\\.html"],
    "kygnew": ["kygnew.com\\/\\d+\\/(\\d+)\\/(\\d+)?(.html)?"],
    "aikanshuba": ["aikanshuba.net\\/(?:\\d+|book)\\/(\\d+)\\/(\\d+)?(.html)?"],
    "biquge": ["biquge.com.cn\\/book\\/(\\d+)\\/(\\d+)?(.html)?"],
    "trxs": ["trxs.cc\\/tongren\\/(\\d+)\\/?(?:(\\d+))?(.html)?"],
    "ikshu8": ["ikshu8.com\\/book\\/(\\d+)\\/?(?:(\\d+))?(.html)?"],
    "shulinw": ["shulinw.com\\/(?:shu\\/|yuedu\\/|book\\/|\\d+\\/|modules\\/article\\/articleinfo.php\\?id=)(\\d+)(?:\\/)?([\\d]*)(\.html)?"],
    "wuxia1": ["wuxia1.com\\/(?:shu\\/|yuedu\\/|book\\/|\\d+\\/|modules\\/article\\/articleinfo.php\\?id=)(\\d+)(?:\\/)?([\\d]*)(\.html)?"],
    "shu05": ["shu05\\.com\\/\\d+[\\_\\/](\\d+)\\/([\\d]*)(\.html)?"],
    "kuhu168": ["kuhu168.com\\/\\d+[\\_\\/](\\d+)\\/([\\d]*)(\.html)?"],
    "2kxs": ["2kxs.org\\/\\d+[\\_\\/](\\d+)\\/([\\d]*)(\.html)?"],
    "yikanxiaoshuo": ["yikanxiaoshuo.com\\/\\d+[\\_\\/](\\d+)\\/([\\d]*)(\.html)?"],
    "8zwdu": ["8zwdu.com\\/\\d+[\\_\\/](\\d+)\\/([\\d]*)(\.html)?"],
    "kanmaoxian": ["kanmaoxian.com\\/(?:book|\\d+)\\/(\\d+)\\/?([\\d]*)(\.html)?"],
    "kayegenet": ["kayege.net\\/(?:book|\\d+)[\\_\\/](\\d+)\\/?([\\d]*)(\.html)?"],
    "4gxsw": ["4gxsw.com\\/(?:book|html\\/\\d+)\\/(\\d+)\\/?([\\d]*)(\.html)?"],
    "qinqinxsw": ["qinqinxsw.com\\/(?:book|\\d+)[\\_\\/](\\d+)\\/?([\\d]*)(\.html)?"],
    "read8": ["read8.net\\/(?:dushu)\\/(\\d+)\\/([\\d]*)(\.html)?"],
    "ciweimao": ["ciweimao.com\\/book\\/(\\d+)"],
    "wkkshu": ["wkkshu.com\\/(?:xs\\/\\d+\\/|\\d+_)(\\d+)\\/([\\d]*)(\.html)?"],
    "168kanshu": ["168kanshu.com\\/(?:xs\\/\\d+\\/|\\d+_)(\\d+)\\/([\\d]*)(\.html)?"],
    "wanbentxt": ["wanbentxt.com\\/(\\d+)\\/([\\d_]*)(\.html)?"],
    "38kanshu": ["mijiashe.com\\/(\\d+)\\/([\\d_]*)(\.html)?"],
    "duanqingsi": ["duanqingsi.com\\/(\\d+)\\/([\\d_]*)(\.html)?"],
    "faloo": [".faloo.com\\/[pfboklithtm]+\\/(\\d+)(?:\\.html|\\/(\\d+).html)?"],
    "qiuxiaoshuo": ["qiuxiaoshuo.com\\/(?:book|read)[\\/\\-](\\d+)[\\/\\-]?([\\d]*)"],
    "dibaqu123": ["dibaqu123.com\\/\\d+\\/(\\d+)\\/?([\\d]*)(\.html)?"],
    "jiacuan": ["jiacuan.com\\/\\d+\\/(\\d+)\\/?([\\d]*)(\.html)?"],
    "shubaow": ["shubaow.net\\/\\d+_(\\d+)\\/([\\d]*)(\.html)?"],
    "biqugeinfo": ["biquge.info\\/\\d+_(\\d+)\\/([\\d]*)(\.html)?"],
    "shumilou": ["shumilou.net\\/\\d+\\/(\\d+)\\/([\\d]*)(\.html)?"],
    "xbiquge": ["xbiquge.cc\\/book\\/(\\d+)\\/([\\d]*)(\.html)?"],
    "paoshu8": ["paoshu8.com\\/\\d+_(\\d+)\\/([\\d]*)(\.html)?"],
    "duokan8": ["duokan8.com\\/\\d+_(\\d+)\\/([\\d]*)(\.html)?"],
    "biqugecom": ["biquge.com\\/\\d+_(\\d+)\\/([\\d]*)(\.html)?"],
    "hetushu": ["hetushu.com\\/book\\/(\\d+)\\/([\\d]*)(\.html)?"],
    "nofff": ["nofff.com\\/(\\d+)\\/([\\d]*)\\/?\?"],
    "uuxs": ["uuxs.tw\\/ls\\/\\d+_(\\d+)\\/([\\d]*)(\.html)?"],
    "ranwenla": ["ranwen.la\\/files\\/article\\/\\d+\\/(\\d+)\\/([\\d]*)(\.html)?"],
    "66wx": ["66wx.com\\/(\\d+)_\\d+\\/read([\\d]*)(\.html)?"],
    "biqugexs": ["biqugexs.com\\/\\d+_(\\d+)\\/([\\d]*)(\.html)?"],
    "230book": ["230book.com\\/book\\/(\\d+)\\/([\\d]*)(\.html)?"],
    "shumiloutw": ["shumilou.cotw\\/book_(\\d+)\\/([\\d]*)(\.html)?"],
    "biqubu": ["biqubu.com\\/book_(\\d+)\\/([\\d]*)(\.html)?"],
    "521danmei": ["521danmei.org\\/read\\/(\\d+)\\/([\\d]*)\\/?\?"],
    "bxwxorg": ["bxwxorg.com\\/read\\/(\\d+)\\/([\\d]*)(\.html)?"],
    "qidian": ["qidian.com\\/(?:book|info)\\/(\\d+)"],
    "zwdu": ["zwdu.com\\/book\\/(\\d+)\\/([\\d]*)(\.html)?"],
    "xingeweb": ["xingeweb.com\\/ddxs\\/169164\\/([\\d]*)(\.html)?"],
    "zongheng": [
        "book.zongheng.com\\/chapter\\/(\\d+)\\/([\\d]*)(\.html)?",
        "book.zongheng.com\\/book\\/(\\d+)(?:\\.html)?"
    ],
    "biqugese": ["biquge.se\\/(\\d+)\\/([\\d]*)(\.html)?"],
    "qiushubang": ["qiushubang.com\\/(\\d+)\\/([\\d]*)(\.html)?"],
    "xinshuhaige": ["xinshuhaige.com\\/(\\d+)\\/([\\d]*)(\.html)?"],
    "oldtimescc": ["oldtimescc.cc\\/go\\/(\\d+)\\/([\\d]*)(\.html)?"],
    "sinodan": ["sinodan.cc\\/view\\/([\\d]*)(\.html)?"],
    "wuwuxs": ["wuwuxs.com\\/\\d+_(\\d+)\\/([\\d]*)(\.html)?"],
    "hs313": ["hs313.net\\/book\\/(\\d+)\\/([\\d]*)(\.html)?"],
    "shuchong": ["shuchong.info\\/chapter\\/(\\d+)\\/([\\d]*)(\.html)?"],
    "shucw": ["shucw.com\\/html\\/\\d+\\/(\\d+)\\/([\\d]*)(\.html)?"],
    "shumizu": ["shumizu.com\\/\\d+\\/(\\d+)\\/([\\d]*)(\.html)?"],
    "tadu": ["tadu.com\\/book\\/(\\d+)\\/?([\\d]*)\\/?\?"],
    "ptwxz": [
        "ptwxz.com\\/bookinfo\\/\\d+\\/(\\d+)\\.html",
        "ptwxz.com\\/html\\/\\d+\\/(\\d+)\\/(\\d+)\\.html",
        "ptwxz.com\\/html\\/\\d+\\/(\\d+)\\/"
    ]
};

// URL Pattern Matching
/**
 * Tests if a URL matches any supported novel site pattern
 * @param {string} url - The URL to test
 * @returns {Object|false} Match object with host, bookid, and optional chapterid
 */
function parseNovelUrl(url) {
    if (!isValidUrl(url)) {
        return false;
    }

    for (const [hostname, patterns] of Object.entries(SUPPORTED_NOVEL_SITES)) {
        for (const pattern of patterns) {
            const regex = new RegExp(pattern, 'i');
            const match = regex.exec(url);
            
            if (match) {
                const result = { host: hostname, bookid: match[1] };
                
                if (match[2] && match[2] !== match[1] && /^[\d_\-]+$/.test(match[2])) {
                    result.chapterid = match[2];
                }
                
                return result;
            }
        }
    }
    
    return false;
}

/**
 * Validates if a string contains a valid URL
 * @param {string} str - String to validate
 * @returns {boolean} True if valid URL
 */
function isValidUrl(str) {
    const urlIndicators = ['.com', '.net', '.cn', '.org', '.vn', '.us', '.tk', '.cc', 'http'];
    return urlIndicators.some(indicator => str.includes(indicator));
}

// Novel Site Integration
/**
 * Opens a novel URL in SangTacViet translation site
 * @param {string} url - Original novel URL
 * @param {Object} tab - Chrome tab object
 */
function openNovelInSangTacViet(url, tab) {
    if (!isValidUrl(url)) {
        showAlert(tab.id, "Không phải liên kết");
        return;
    }

    const parseResult = parseNovelUrl(url);
    
    if (!parseResult) {
        showAlert(tab.id, "Nguồn truyện không hỗ trợ hoặc không phải nguồn truyện.");
        return;
    }

    const { host, bookid, chapterid } = parseResult;
    const translationUrl = chapterid 
        ? `${SANGTACVIET_BASE_URL}${host}/1/${bookid}/${chapterid}/`
        : `${SANGTACVIET_BASE_URL}${host}/1/${bookid}/`;

    chrome.tabs.create({ url: translationUrl });
}

// Context Menu Setup
function initializeContextMenus() {
    const menuItems = [
        {
            id: CONTEXT_MENU_IDS.COPY_ORIGINAL,
            title: "Sao chép văn bản gốc",
            contexts: ["all"]
        },
        {
            id: CONTEXT_MENU_IDS.ADD_NAME,
            title: "Thêm name",
            contexts: ["all"]
        },
        {
            id: CONTEXT_MENU_IDS.TRANSLATE_IMAGE,
            title: "Dịch hình ảnh này",
            contexts: ["image"]
        }
    ];

    menuItems.forEach(item => chrome.contextMenus.create(item));
}

// Context Menu Handlers
const contextMenuHandlers = {
    [CONTEXT_MENU_IDS.COPY_ORIGINAL]: handleCopyOriginalText,
    [CONTEXT_MENU_IDS.ADD_NAME]: handleAddName,
    [CONTEXT_MENU_IDS.TRANSLATE_IMAGE]: handleTranslateImage
};

/**
 * Handles copying original text from selection
 */
function handleCopyOriginalText(info, tab) {
    chrome.tabs.sendMessage(tab.id, "copySelected", { frameId: info.frameId }, (data) => {
        if (data?.value) {
            executeScriptInTab(tab.id, copyTextToClipboard, JSON.stringify(data.value));
        }
    });
}

/**
 * Handles adding names to translation database
 */
function handleAddName(info, tab) {
    chrome.tabs.sendMessage(tab.id, "copyName", { frameId: info.frameId }, (data) => {
        if (!data?.chi || !data?.vi) return;

        const chineseText = data.chi.trim();
        if (chineseText.length >= 20) return;

        const vietnameseText = data.vi.trim();
        const query = `?text=${encodeURIComponent(chineseText)}&trans=${encodeURIComponent(toTitleCase(vietnameseText))}`;
        const windowUrl = chrome.runtime.getURL(ADDNAME_WINDOW_PATH + query);

        chrome.windows.create({
            url: windowUrl,
            type: 'popup',
            width: 520,
            height: 100
        });
    });
}

/**
 * Handles image translation requests
 */
function handleTranslateImage(info, tab) {
    console.log("Translate image context menu clicked", info, tab);
    chrome.tabs.sendMessage(tab.id, {
        type: "translateImage",
        imageUrl: info.srcUrl,
    }, {
        frameId: info.frameId
    }, () => {});
}

// Utility Functions
/**
 * Converts string to title case
 * @param {string} str - Input string
 * @returns {string} Title case string
 */
function toTitleCase(str) {
    return str.toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Copies text to clipboard in the specified tab
 * @param {string} text - Text to copy
 */
function copyTextToClipboard(text) {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.value = text;
    textarea.focus();
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
}

/**
 * Shows an alert in the specified tab
 * @param {number} tabId - Tab ID
 * @param {string} message - Alert message
 */
function showAlert(tabId, message) {
    executeScriptInTab(tabId, function(msg) { alert(msg); }, message);
}

/**
 * Executes a script in the specified tab
 * @param {number} tabId - Tab ID
 * @param {Function} func - Function to execute
 * @param {*} args - Arguments to pass to the function
 */
function executeScriptInTab(tabId, func, args) {
    chrome.scripting.executeScript({
        target: { tabId },
        function: func,
        args: [args]
    });
}

// Screen Capture Handler
chrome.runtime.onMessage.addListener((message, sender, callback) => {
    switch (message.type) {
        case 'getScreen':
            chrome.desktopCapture.chooseDesktopMedia(
                [chrome.desktopCapture.DesktopCaptureSourceType.TAB],
                (streamId) => {
                    callback({
                        video: {
                            mandatory: {
                                chromeMediaSource: 'desktop',
                                chromeMediaSourceId: streamId
                            }
                        }
                    });
                }
            );
            return true; // Keep callback for async response

        case 'cancelGetScreen':
            chrome.desktopCapture.cancelChooseDesktopMedia(message.request);
            callback({ ...message, type: 'canceledGetScreen' });
            return false;
    }
});

// Event Listeners
chrome.contextMenus.onClicked.addListener((info, tab) => {
    const handler = contextMenuHandlers[info.menuItemId];
    if (handler) {
        handler(info, tab);
    }
});

// Initialize
initializeContextMenus();