// Zotero Item Type Converter - 兼容 Zotero 7.0.32+

var menuId = 'zotero-itemmenu-converter-submenu';

function log(msg) {
    Zotero.debug("ZoteroItemTypeConverter: " + msg);
}

function install(data, reason) {
    log("Install triggered");
}

function uninstall(data, reason) {
    log("Uninstall triggered");
}

async function startup({ id, version, rootURI }) {
    log("Startup started, version: " + version);
    
    // 等待 Zotero 完全初始化
    await Zotero.initializationPromise;
    
    // 加载核心转换逻辑
    Services.scriptloader.loadSubScript(
        rootURI + "chrome/content/converter.js"
    );
    log("Converter script loaded");
    
    // 添加菜单到主窗口
    addMenuToAllWindows();
    
    // 监听新窗口打开
    Services.ww.registerNotification(windowObserver);
    
    log("Startup completed");
}

function shutdown({ id, version, rootURI }) {
    log("Shutdown started");
    
    // 取消监听窗口
    Services.ww.unregisterNotification(windowObserver);
    
    // 从所有窗口移除菜单
    removeMenuFromAllWindows();
    
    // 清理全局对象
    if (Zotero.ItemTypeConverter) {
        delete Zotero.ItemTypeConverter;
    }
    
    log("Shutdown completed");
}

// 窗口观察器
var windowObserver = {
    observe: function(subject, topic, data) {
        if (topic === 'domwindowopened') {
            subject.addEventListener('load', function() {
                addMenuToWindow(subject);
            }, { once: true });
        }
    }
};

// 给所有已打开的窗口添加菜单
function addMenuToAllWindows() {
    var windows = Services.wm.getEnumerator('navigator:browser');
    while (windows.hasMoreElements()) {
        var win = windows.getNext();
        addMenuToWindow(win);
    }
}

// 从所有窗口移除菜单
function removeMenuFromAllWindows() {
    var windows = Services.wm.getEnumerator('navigator:browser');
    while (windows.hasMoreElements()) {
        var win = windows.getNext();
        removeMenuFromWindow(win);
    }
}

// 给单个窗口添加菜单
function addMenuToWindow(win) {
    // 确保这是 Zotero 主窗口
    if (!win.ZoteroPane) {
        return;
    }
    
    var doc = win.document;
    var itemMenu = doc.getElementById('zotero-itemmenu');
    
    if (!itemMenu) {
        log("Could not find zotero-itemmenu in window");
        return;
    }
    
    // 防止重复添加
    if (doc.getElementById(menuId)) {
        log("Menu already exists in this window");
        return;
    }
    
    try {
        // 创建子菜单 - 使用更兼容的方式
        var subMenu;
        if (doc.createXULElement) {
            subMenu = doc.createXULElement('menu');
        } else {
            subMenu = doc.createElement('menu');
        }
        subMenu.setAttribute('id', menuId);
        subMenu.setAttribute('label', 'Change Item Type');
        subMenu.setAttribute('class', 'menu-iconic');
        
        var subMenuPopup;
        if (doc.createXULElement) {
            subMenuPopup = doc.createXULElement('menupopup');
        } else {
            subMenuPopup = doc.createElement('menupopup');
        }
        subMenu.appendChild(subMenuPopup);
        
        log("Created submenu and popup");
        
        // 定义类型列表
        var types = [
            { label: 'Journal Article', value: 'journalArticle' },
            { label: 'Thesis', value: 'thesis' },
            { label: 'Book', value: 'book' },
            { label: 'Conference Paper', value: 'conferencePaper' },
            { label: 'Proceedings', value: 'proceedings' },
            { label: 'Report', value: 'report' },
            { label: 'Patent', value: 'patent' }
        ];
        
        // 创建菜单项
        var itemCount = 0;
        types.forEach(function(type) {
            var menuItem;
            if (doc.createXULElement) {
                menuItem = doc.createXULElement('menuitem');
            } else {
                menuItem = doc.createElement('menuitem');
            }
            menuItem.setAttribute('label', type.label);
            menuItem.setAttribute('data-item-type', type.value);
            menuItem.setAttribute('class', 'menuitem-iconic');
            
            menuItem.addEventListener('command', function() {
                try {
                    log("Menu item clicked: " + type.value);
                    if (Zotero.ItemTypeConverter && typeof Zotero.ItemTypeConverter.convert === 'function') {
                        Zotero.ItemTypeConverter.convert(type.value);
                    } else {
                        log("ERROR: ItemTypeConverter.convert not found!");
                        win.alert("Converter function not loaded. Please restart Zotero.");
                    }
                } catch (e) {
                    log("Error in menu command: " + e);
                    win.alert("Conversion failed: " + e.message);
                }
            });
            
            subMenuPopup.appendChild(menuItem);
            itemCount++;
        });
        
        log("Created " + itemCount + " menu items");
        
        // 添加到右键菜单
        itemMenu.appendChild(subMenu);
        
        // 验证菜单已添加
        var verifyMenu = doc.getElementById(menuId);
        if (verifyMenu) {
            var verifyPopup = verifyMenu.querySelector('menupopup');
            if (verifyPopup) {
                var verifyItems = verifyPopup.querySelectorAll('menuitem');
                log("✓ Menu verified: " + verifyItems.length + " items in popup");
            } else {
                log("✗ WARNING: Popup not found after adding!");
            }
        }
        
        log("Menu added successfully to window");
    } catch (e) {
        log("Error adding menu to window: " + e);
        log("Stack: " + e.stack);
    }
}

// 从单个窗口移除菜单
function removeMenuFromWindow(win) {
    if (!win.document) return;
    
    var doc = win.document;
    var menu = doc.getElementById(menuId);
    
    if (menu && menu.parentNode) {
        // 同时移除我们添加的分隔符
        var separator = menu.nextSibling;
        if (separator && separator.nodeName === 'menuseparator') {
            separator.remove();
        }
        menu.remove();
        log("Menu removed from window");
    }
}
