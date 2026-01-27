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
        // 创建子菜单
        var subMenu = doc.createXULElement('menu');
        subMenu.setAttribute('id', menuId);
        subMenu.setAttribute('label', 'Type Converter');
        
        var subMenuPopup = doc.createXULElement('menupopup');
        subMenu.appendChild(subMenuPopup);
        
        // 定义类型列表
        var types = [
            { label: '期刊文章 (Journal Article)', value: 'journalArticle' },
            { label: '学位论文 (Thesis)', value: 'thesis' },
            { label: '图书 (Book)', value: 'book' },
            { label: '会议论文 (Conf. Paper)', value: 'conferencePaper' },
            { label: '会议期刊 (Proceedings)', value: 'proceedings' },
            { label: '报告 (Report)', value: 'report' },
            { label: '专利 (Patent)', value: 'patent' }
        ];
        
        // 创建菜单项
        types.forEach(function(type) {
            var menuItem = doc.createXULElement('menuitem');
            menuItem.setAttribute('label', type.label);
            menuItem.setAttribute('data-item-type', type.value);
            
            menuItem.addEventListener('command', function() {
                try {
                    if (Zotero.ItemTypeConverter && typeof Zotero.ItemTypeConverter.convert === 'function') {
                        Zotero.ItemTypeConverter.convert(type.value);
                    } else {
                        log("ERROR: ItemTypeConverter.convert not found!");
                        win.alert("转换功能未正确加载，请重启 Zotero");
                    }
                } catch (e) {
                    log("Error in menu command: " + e);
                    win.alert("转换失败: " + e.message);
                }
            });
            
            subMenuPopup.appendChild(menuItem);
        });
        
        // 添加分隔符（可选，使菜单更美观）
        var separator = doc.createXULElement('menuseparator');
        itemMenu.insertBefore(separator, itemMenu.firstChild);
        
        // 添加到右键菜单的最前面
        itemMenu.insertBefore(subMenu, separator);
        
        log("Menu added successfully to window");
    } catch (e) {
        log("Error adding menu to window: " + e);
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
