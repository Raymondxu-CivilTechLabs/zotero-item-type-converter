// Zotero Item Type Converter - 兼容 Zotero 7 / 8 / 9 / 10
//
// Zotero 8 起提供了官方菜单 API（Zotero.MenuManager），Zotero 10 继续沿用；
// 这里优先使用官方 API，在 Zotero 7.x 上回退到直接注入 XUL 菜单。

const PLUGIN_ID = 'zotero-item-type-converter@yourname.com';
const MENU_ID = 'zotero-item-type-converter-item-menu';
// 旧版 DOM 注入方式使用的元素 id（仅 Zotero 7.x 回退路径会用）
const LEGACY_MENU_ID = 'zotero-itemmenu-converter-submenu';

const ITEM_TYPES = [
    { value: 'journalArticle', label: 'Journal Article', l10nID: 'zotero-item-type-converter-type-journal-article' },
    { value: 'thesis', label: 'Thesis', l10nID: 'zotero-item-type-converter-type-thesis' },
    { value: 'book', label: 'Book', l10nID: 'zotero-item-type-converter-type-book' },
    { value: 'conferencePaper', label: 'Conference Paper', l10nID: 'zotero-item-type-converter-type-conference-paper' },
    { value: 'proceedings', label: 'Proceedings', l10nID: 'zotero-item-type-converter-type-proceedings' },
    { value: 'report', label: 'Report', l10nID: 'zotero-item-type-converter-type-report' },
    { value: 'patent', label: 'Patent', l10nID: 'zotero-item-type-converter-type-patent' }
];

var registeredMenuID = null;
var windowObserver = null;

function log(msg) {
    Zotero.debug("ZoteroItemTypeConverter: " + msg);
}

function install(data, reason) {
    log("Install triggered");
}

function uninstall(data, reason) {
    log("Uninstall triggered");
}

async function startup({ id, version, rootURI }, reason) {
    log("Startup started, version: " + version);

    try {
        // Zotero 7+ 在调用 startup 之前已完成初始化，这里只是保险
        if (Zotero.initializationPromise) {
            await Zotero.initializationPromise;
        }

        // 加载核心转换逻辑
        loadConverter(rootURI);

        // 优先使用官方菜单 API（Zotero 8+）
        if (registerMenuWithMenuManager()) {
            log("Menu registered via Zotero.MenuManager");
        }
        else {
            log("Zotero.MenuManager unavailable, falling back to DOM injection");
            addMenuToAllWindows();

            windowObserver = {
                observe: function (subject, topic) {
                    if (topic !== 'domwindowopened') {
                        return;
                    }
                    var win = subject;
                    win.addEventListener('load', function () {
                        addMenuToWindow(win);
                    }, { once: true });
                }
            };
            Services.ww.registerNotification(windowObserver);
        }

        log("Startup completed");
    }
    catch (e) {
        log("Startup error: " + e + (e.stack ? "\n" + e.stack : ""));
    }
}

function shutdown({ id, version, rootURI }, reason) {
    log("Shutdown started");

    try {
        if (registeredMenuID && Zotero.MenuManager) {
            Zotero.MenuManager.unregisterMenu(registeredMenuID);
        }
        registeredMenuID = null;
    }
    catch (e) {
        log("Error unregistering menu: " + e);
    }

    try {
        if (windowObserver) {
            Services.ww.unregisterNotification(windowObserver);
            windowObserver = null;
        }
        removeMenuFromAllWindows();
    }
    catch (e) {
        log("Error removing menus: " + e);
    }

    delete Zotero.ItemTypeConverter;

    log("Shutdown completed");
}

/* ------------------------------------------------------------------ */
/* 核心脚本加载                                                        */
/* ------------------------------------------------------------------ */

function loadConverter(rootURI) {
    try {
        Services.scriptloader.loadSubScript(rootURI + "chrome/content/converter.js");
    }
    catch (e) {
        log("Failed to load converter.js: " + e);
    }

    if (!Zotero.ItemTypeConverter) {
        log("ERROR: converter.js did not define Zotero.ItemTypeConverter");
    }
}

/* ------------------------------------------------------------------ */
/* 官方菜单 API（Zotero 8+）                                           */
/* ------------------------------------------------------------------ */

function registerMenuWithMenuManager() {
    if (!Zotero.MenuManager || typeof Zotero.MenuManager.registerMenu !== 'function') {
        return false;
    }

    try {
        registeredMenuID = Zotero.MenuManager.registerMenu({
            menuID: MENU_ID,
            pluginID: PLUGIN_ID,
            target: 'main/library/item',
            menus: [{
                menuType: 'submenu',
                l10nID: 'zotero-item-type-converter-change-type',
                onShowing: function (event, context) {
                    setFallbackLabel(context, 'Change Item Type');
                },
                menus: ITEM_TYPES.map(function (type) {
                    return {
                        menuType: 'menuitem',
                        l10nID: type.l10nID,
                        onShowing: function (event, context) {
                            setFallbackLabel(context, type.label);
                        },
                        onCommand: function (event, context) {
                            runConversion(type.value, context);
                        }
                    };
                })
            }]
        });
    }
    catch (e) {
        log("Zotero.MenuManager registration failed: " + e);
        registeredMenuID = null;
        return false;
    }

    return !!registeredMenuID;
}

// 本地化字符串尚未生效时，退回内置英文标签
function setFallbackLabel(context, label) {
    try {
        var elem = context && context.menuElem;
        if (elem && !elem.getAttribute('label')) {
            elem.setAttribute('label', label);
        }
    }
    catch (e) {
        log("setFallbackLabel failed: " + e);
    }
}

function runConversion(targetType, context) {
    try {
        var converter = Zotero.ItemTypeConverter;
        if (!converter || typeof converter.convert !== 'function') {
            log("ERROR: ItemTypeConverter.convert not found");
            showAlert("Converter function not loaded. Please restart Zotero.");
            return;
        }

        var items = context && Array.isArray(context.items) ? context.items : null;
        converter.convert(targetType, items);
    }
    catch (e) {
        log("Conversion error: " + e);
        showAlert("Conversion failed: " + e.message);
    }
}

function showAlert(message) {
    try {
        if (typeof Services !== 'undefined' && Services.prompt) {
            Services.prompt.alert(null, "Zotero Item Type Converter", message);
            return;
        }
    }
    catch (e) {
        // 继续尝试窗口 alert
    }

    try {
        var win = typeof Zotero.getMainWindow === 'function' ? Zotero.getMainWindow() : null;
        if (win) {
            win.alert(message);
        }
    }
    catch (e) {
        log("showAlert failed: " + e);
    }
}

/* ------------------------------------------------------------------ */
/* 旧版 DOM 注入（Zotero 7.x 回退路径）                                */
/* ------------------------------------------------------------------ */

function getMainWindows() {
    if (typeof Zotero.getMainWindows === 'function') {
        return Zotero.getMainWindows();
    }

    var windows = [];
    var enumerator = Services.wm.getEnumerator('navigator:browser');
    while (enumerator.hasMoreElements()) {
        windows.push(enumerator.getNext());
    }
    return windows;
}

function createXULElement(doc, tag) {
    if (typeof doc.createXULElement === 'function') {
        return doc.createXULElement(tag);
    }
    return doc.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', tag);
}

function addMenuToAllWindows() {
    for (var win of getMainWindows()) {
        addMenuToWindow(win);
    }
}

function removeMenuFromAllWindows() {
    for (var win of getMainWindows()) {
        removeMenuFromWindow(win);
    }
}

function addMenuToWindow(win) {
    if (!win || !win.ZoteroPane || !win.document) {
        return;
    }

    var doc = win.document;
    var itemMenu = doc.getElementById('zotero-itemmenu');
    if (!itemMenu) {
        log("Could not find zotero-itemmenu in window");
        return;
    }

    if (doc.getElementById(LEGACY_MENU_ID)) {
        return;
    }

    try {
        var subMenu = createXULElement(doc, 'menu');
        subMenu.setAttribute('id', LEGACY_MENU_ID);
        subMenu.setAttribute('label', 'Change Item Type');
        subMenu.setAttribute('class', 'menu-iconic');

        var subMenuPopup = createXULElement(doc, 'menupopup');
        subMenu.appendChild(subMenuPopup);

        for (let type of ITEM_TYPES) {
            var menuItem = createXULElement(doc, 'menuitem');
            menuItem.setAttribute('label', type.label);
            menuItem.setAttribute('data-item-type', type.value);
            menuItem.setAttribute('class', 'menuitem-iconic');

            menuItem.addEventListener('command', function () {
                runConversion(type.value, {
                    items: win.ZoteroPane && typeof win.ZoteroPane.getSelectedItems === 'function'
                        ? win.ZoteroPane.getSelectedItems()
                        : null
                });
            });

            subMenuPopup.appendChild(menuItem);
        }

        itemMenu.appendChild(subMenu);
        log("Menu injected into window");
    }
    catch (e) {
        log("Error adding menu to window: " + e + (e.stack ? "\n" + e.stack : ""));
    }
}

function removeMenuFromWindow(win) {
    if (!win || !win.document) {
        return;
    }

    var doc = win.document;
    var menu = doc.getElementById(LEGACY_MENU_ID);

    if (menu && menu.parentNode) {
        var separator = menu.nextSibling;
        if (separator && separator.nodeName === 'menuseparator') {
            separator.remove();
        }
        menu.remove();
        log("Menu removed from window");
    }
}
