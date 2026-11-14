// Zotero Item Type Converter - 核心转换逻辑
// 由 bootstrap.js 通过 loadSubScript 加载，挂载到 Zotero.ItemTypeConverter

Zotero.ItemTypeConverter = {

  /**
   * 转换选中条目的类型
   * @param {string} targetType - 目标类型（如 'journalArticle'）
   * @param {Zotero.Item[]} [items] - 待转换条目，省略时使用当前选中条目
   */
  async convert(targetType, items) {
    try {
      if (!items || !items.length) {
        var ZoteroPane = this.getZoteroPane();
        if (!ZoteroPane || typeof ZoteroPane.getSelectedItems !== 'function') {
          this.showAlert("Error", "Unable to get Zotero pane");
          return;
        }
        items = ZoteroPane.getSelectedItems();
      }

      if (!items || items.length === 0) {
        this.showAlert("Notice", "Please select items to convert");
        return;
      }

      var targetTypeId = Zotero.ItemTypes.getID(targetType);
      if (!targetTypeId) {
        this.showAlert("Error", "Invalid item type: " + targetType);
        return;
      }

      var convertedCount = 0;
      var skippedCount = 0;
      var alreadyTargetType = 0;
      var totalSelected = items.length;

      for (let item of items) {
        // 跳过非常规条目（附件、笔记、批注等）
        // Zotero 10 起 setType() 在常规条目与附件/笔记之间转换会抛错
        if (typeof item.isRegularItem === 'function' && !item.isRegularItem()) {
          skippedCount++;
          continue;
        }

        // 如果已经是目标类型，跳过
        if (this.getItemTypeName(item) === targetType) {
          alreadyTargetType++;
          continue;
        }

        /* =========================
           1. 安全备份所有字段
           ========================= */
        var backup = {
          title: this.getField(item, 'title'),
          date: this.getField(item, 'date'),
          abstractNote: this.getField(item, 'abstractNote'),
          publisher: this.getField(item, 'publisher'),
          publicationTitle: this.getField(item, 'publicationTitle'),
          university: this.getField(item, 'university'),
          institution: this.getField(item, 'institution'),
          assignee: this.getField(item, 'assignee'),
          proceedingsTitle: this.getField(item, 'proceedingsTitle'),
          place: this.getField(item, 'place'),
          DOI: this.getField(item, 'DOI'),
          url: this.getField(item, 'url'),
          extra: this.getField(item, 'extra'),
          creators: item.getCreators()
        };

        // 保存原始的 publisher 相关字段（用于智能映射）
        var sourcePublisher = backup.publisher ||
                            backup.publicationTitle ||
                            backup.university ||
                            backup.institution ||
                            backup.assignee ||
                            backup.proceedingsTitle ||
                            '';

        /* =========================
           2. 执行类型转换
           ========================= */
        item.setType(targetTypeId);

        /* =========================
           3. 回填通用字段
           ========================= */
        this.setField(item, 'title', backup.title);
        this.setField(item, 'date', backup.date);
        this.setField(item, 'abstractNote', backup.abstractNote);
        this.setField(item, 'DOI', backup.DOI);
        this.setField(item, 'url', backup.url);
        this.setField(item, 'extra', backup.extra);

        /* =========================
           4. 智能字段映射
           ========================= */
        switch (targetType) {
          case 'journalArticle':
            this.setField(item, 'publicationTitle', sourcePublisher);
            break;

          case 'thesis':
            this.setField(item, 'university', sourcePublisher);
            break;

          case 'book':
            this.setField(item, 'publisher', sourcePublisher);
            this.setField(item, 'place', backup.place);
            break;

          case 'conferencePaper':
            this.setField(item, 'proceedingsTitle', sourcePublisher);
            this.setField(item, 'place', backup.place);
            break;

          case 'proceedings':
            this.setField(item, 'publisher', sourcePublisher);
            this.setField(item, 'place', backup.place);
            break;

          case 'report':
            this.setField(item, 'institution', sourcePublisher);
            this.setField(item, 'place', backup.place);
            break;

          case 'patent':
            this.setField(item, 'assignee', sourcePublisher);
            this.setField(item, 'place', backup.place);
            break;
        }

        /* =========================
           5. 回填作者信息（最重要）
           ========================= */
        if (backup.creators && backup.creators.length > 0) {
          item.setCreators(backup.creators);
        }

        // 保存条目
        await item.saveTx();
        convertedCount++;
      }

      // 显示详细的完成提示
      var targetTypeName = Zotero.ItemTypes.getLocalizedString(targetTypeId);
      var messages = [];

      messages.push("Selected: " + totalSelected + " item(s)");

      if (convertedCount > 0) {
        messages.push("✓ Converted: " + convertedCount + " item(s)");
      }

      if (alreadyTargetType > 0) {
        messages.push("○ Already " + targetTypeName + ": " + alreadyTargetType + " (skipped)");
      }

      if (skippedCount > 0) {
        messages.push("⊗ Non-regular items: " + skippedCount + " (skipped)");
      }

      if (convertedCount > 0) {
        this.showAlert("Conversion Complete", messages.join("\n"));
      }
      else {
        this.showAlert("Notice", "No items converted\n\n" + messages.join("\n"));
      }

    }
    catch (e) {
      Zotero.debug("ItemTypeConverter error: " + e);
      this.showAlert("Error", "Conversion failed: " + e.message);
    }
  },

  // 获取当前 Zotero 主窗格（兼容不同版本的取法）
  getZoteroPane() {
    try {
      if (typeof Zotero.getActiveZoteroPane === 'function') {
        var pane = Zotero.getActiveZoteroPane();
        if (pane) {
          return pane;
        }
      }
    }
    catch (e) {
      // 忽略，尝试下一种方式
    }

    try {
      var win = typeof Zotero.getMainWindow === 'function' ? Zotero.getMainWindow() : null;
      if (win && win.ZoteroPane) {
        return win.ZoteroPane;
      }
    }
    catch (e) {
      // 忽略
    }

    return null;
  },

  // 获取条目类型名称（字符串）
  getItemTypeName(item) {
    try {
      if (typeof item.itemType === 'string' && item.itemType) {
        return item.itemType;
      }
    }
    catch (e) {
      // 忽略
    }

    try {
      if (item.itemTypeID) {
        return Zotero.ItemTypes.getName(item.itemTypeID);
      }
    }
    catch (e) {
      // 忽略
    }

    return '';
  },

  // 安全获取字段值
  getField(item, field) {
    try {
      return item.getField(field) || '';
    }
    catch (e) {
      return '';
    }
  },

  // 安全设置字段值
  setField(item, field, value) {
    try {
      if (value !== null && value !== undefined && value !== '') {
        item.setField(field, value);
      }
    }
    catch (e) {
      Zotero.debug("Failed to set field " + field + ": " + e);
    }
  },

  // 显示提示框（nsIPromptService 已废弃，改用 Services.prompt）
  showAlert(title, message) {
    try {
      if (typeof Services !== 'undefined' && Services.prompt) {
        Services.prompt.alert(null, title, message);
        return;
      }
    }
    catch (e) {
      // 继续尝试窗口 alert
    }

    try {
      var win = typeof Zotero.getMainWindow === 'function' ? Zotero.getMainWindow() : null;
      if (win) {
        win.alert(title + "\n\n" + message);
      }
    }
    catch (e) {
      Zotero.debug("ItemTypeConverter: showAlert failed: " + e);
    }
  }
};
