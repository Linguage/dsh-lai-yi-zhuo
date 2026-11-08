# 部署指南

[返回 README](../README.md) · [维护与扩展指南](maintenance.md)

## 从仓库安装

在目标 DSH profile 打开「插件 → 添加插件」，粘贴完整的 GitHub 仓库地址。

```text
https://github.com/Linguage/dsh-lai-yi-zhuo
```

安装后点击「立即启用」，从侧栏打开「来一桌」。进入棋桌开始五子棋，落一子即可检查人机应手。宿主兼容范围以包内 `engines.dsh` 为准，当前为 `>=0.2.0-0 <0.3.0`。

仓库提供编译后的宿主入口、界面和计算线程，可直接安装。以下是 CLI 的 Web profile 示例：

```sh
dsh plugin --profile web add https://github.com/Linguage/dsh-lai-yi-zhuo
dsh web
```

## 从 Release 安装

在 [GitHub Releases](https://github.com/Linguage/dsh-lai-yi-zhuo/releases/latest) 的 **Assets** 下下载所需版本的 `dsh-lai-yi-zhuo-<版本>.tgz` 和同页的 `SHA256SUMS`。在下载目录运行 `shasum -a 256 -c SHA256SUMS`，确认该包显示 `OK`。在 DSH 的添加插件对话框填写下载文件的绝对路径。

## 更新与存档

- 插件列表已有同名包时，先在原 profile 卸载旧条目，再用仓库地址或新版本的 Release 包安装。若 DSH 提示重启，重启后核对侧栏和版本。
- 对局和显示偏好保存在浏览器。卸载后在同一浏览器、同一 DSH 地址重新安装，可以继续保留的对局。换浏览器、清理站点数据、改变地址或端口会影响续局。

跨包名迁移见 [v0.3.1 发行记录](https://github.com/Linguage/dsh-lai-yi-zhuo/releases/tag/v0.3.1)。

## 安装故障

| 提示 | 排查和处理 |
| --- | --- |
| 「无法从依赖变更中确定安装了哪一个包」 | 在插件列表查找同名条目。已有同一仓库来源时，DSH 可能找不到新的依赖变更。先卸载该条目，再粘贴仓库地址安装。 |
| `ERR_MODULE_NOT_FOUND`，缺少 `lib/index.js` | 核对已安装版本。早于 v0.3.2 的 GitHub 快照缺少运行文件。卸载旧条目后重新粘贴仓库地址，可取到当前主分支。 |
| 找不到侧栏入口 | 检查当前运行的 profile、包名、插件启用状态和宿主兼容范围。出现重启提示时重启 DSH。 |
| 入口打开后空白 | 核对版本和包内的 `web/index.html`、`web/assets/`。若仍失败，请在 [Issues](https://github.com/Linguage/dsh-lai-yi-zhuo/issues) 附宿主版本和脱敏报错。 |
