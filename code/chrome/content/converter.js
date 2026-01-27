// 将 ItemTypeConverter 挂载到 Zotero 对象上
Zotero.ItemTypeConverter = {

  async convert(targetType) {
    try {
      var ZoteroPane = Zotero.getActiveZoteroPane();
      if (!ZoteroPane) {
        this.showAlert("错误", "无法获取 Zotero 面板");
        return;
      }

      var items = ZoteroPane.getSelectedItems();
      if (!items || items.length === 0) {
        this.showAlert("提示", "请先选择要转换的条目");
        return;
      }

      var targetTypeId = Zotero.ItemTypes.getID(targetType);
      if (!targetTypeId) {
        this.showAlert("错误", "无效的条目类型: " + targetType);
        return;
      }

      var convertedCount = 0;

      for (let item of items) {
        // 跳过非常规条目（如附件、笔记等）
        if (!item.isRegularItem()) continue;

        // 如果已经是目标类型，跳过
        if (item.itemTypeID === targetTypeId) continue;

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

      // 显示完成提示
      if (convertedCount > 0) {
        this.showAlert("完成", "成功转换 " + convertedCount + " 个条目");
      } else {
        this.showAlert("提示", "没有条目需要转换");
      }

    } catch (e) {
      Zotero.debug("ItemTypeConverter error: " + e);
      this.showAlert("错误", "转换失败: " + e.message);
    }
  },

  // 安全获取字段值
  getField(item, field) {
    try {
      return item.getField(field) || '';
    } catch (e) {
      return '';
    }
  },

  // 安全设置字段值
  setField(item, field, value) {
    try {
      if (value !== null && value !== undefined && value !== '') {
        item.setField(field, value);
      }
    } catch (e) {
      Zotero.debug("Failed to set field " + field + ": " + e);
    }
  },

  // 显示提示框
  showAlert(title, message) {
    var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                       .getService(Components.interfaces.nsIPromptService);
    ps.alert(null, title, message);
  }
};
