# Zotero Item Type Converter

一个用于 Zotero 7 / 8 / 9 / 10 的条目类型转换插件。

## 功能特点

- 支持将 Zotero 条目转换为 7 种不同类型
- 智能保留和迁移字段数据
- 保护作者、摘要、日期等重要信息不丢失

## 支持的转换类型

1. 期刊文章 (Journal Article)
2. 学位论文 (Thesis)
3. 图书 (Book)
4. 会议论文 (Conference Paper)
5. 会议期刊 (Proceedings)
6. 报告 (Report)
7. 专利 (Patent)

## 字段映射规则

### 通用字段（所有类型都保留）
- 标题 (title)
- 日期 (date)
- 摘要 (abstractNote)
- DOI
- URL
- 额外信息 (extra)
- 作者 (creators)

### 特殊字段映射
- **期刊文章**: publicationTitle ← publisher
- **学位论文**: university ← publisher
- **图书**: publisher, place
- **会议论文**: proceedingsTitle ← publisher
- **会议期刊**: publisher, place
- **报告**: institution ← publisher
- **专利**: assignee ← publisher

## 安装方法

1. 下载 `zotero-item-type-converter.xpi` 文件
2. 打开 Zotero（7 及以上版本）
3. 进入 `工具` → `插件`
4. 点击右上角齿轮图标 → `Install Add-on From File...`
5. 选择下载的 XPI 文件
6. 重启 Zotero

## 使用方法

1. 在 Zotero 文献库中选中一个或多个条目
2. 右键点击选中的条目
3. 选择 `转换条目类型 (Convert Type)` 子菜单
4. 点击目标类型
5. 等待转换完成提示

## 兼容性

- Zotero 7.0 – 10.0.x
- Zotero 8 及以上使用官方菜单 API `Zotero.MenuManager`，Zotero 7.x 自动回退到 legacy DOM 注入

## 注意事项

- 转换前建议备份数据
- 附件和笔记不会被转换
- 已经是目标类型的条目会被跳过
- 不兼容的字段会被安全忽略

## 开发信息

- 版本: 2.0.0
- 作者: Your Name
- 许可: MIT

## 更新日志

### v2.0.0 (2026-11-15)
- 适配 Zotero 10.0.8
- 菜单改用官方 `Zotero.MenuManager` API，旧版 Zotero 7 自动回退
- 修复已废弃的 `nsIPromptService` 调用导致转换后无提示
- 补充中英文界面翻译

### v1.0.0 (2025-01-27)
- 初始版本
- 支持 7 种条目类型转换
- 智能字段映射
- Zotero 7 兼容
