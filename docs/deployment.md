# 部署指南

[返回 README](../README.md) · [维护与扩展指南](maintenance.md)

## 安装

来一桌通过 [GitHub Releases](https://github.com/Linguage/dsh-lai-yi-zhuo/releases/latest) 提供可直接安装的 `dsh-lai-yi-zhuo-<版本>.tgz`。宿主范围以包内 `engines.dsh` 为准。v0.3.1 的范围是 `>=0.2.0-0 <0.3.0`，实际验证宿主为 DSH 0.2.2-rc.1。

1. 下载所需版本的 `.tgz` 和同页的 `SHA256SUMS`。在下载目录运行 `shasum -a 256 -c SHA256SUMS`，确认该包显示 `OK`。
2. 在目标 DSH profile 打开「插件 → 添加插件」，填写 `.tgz` 的绝对路径。安装并启用后，从侧栏打开「来一桌」。
3. 进入棋桌开始五子棋，落一子，确认人机应手。返回大厅后可再检查牌桌和麻将桌的入口。

有 DSH CLI 时，也可安装到指定 profile。以下为 Web 示例：

```sh
dsh plugin --profile web add /absolute/path/to/dsh-lai-yi-zhuo-0.3.1.tgz
dsh web
```

## 更新与存档

- 更新同名插件时，按 DSH 插件页的提示在原 profile 卸载旧版，再安装新版本的 Release 包。若 DSH 提示重启，重启后核对插件版本和侧栏。
- 从 0.3.0 的 `dsh-board-games` 迁移时，先卸载旧包，再安装 `dsh-lai-yi-zhuo`。两个包共用游戏路由。v0.3.1 已实测在同一 DSH 地址和浏览器中读取旧局。
- 对局和显示偏好保存在浏览器。换浏览器、清理站点数据、改变地址或端口会影响续局。独立预览与 DSH 的浏览器存档分别保存。

## 安装故障

| 提示 | 排查和处理 |
| --- | --- |
| `ERR_MODULE_NOT_FOUND`，缺少 `lib/index.js` | 若安装来源为 `github:Linguage/dsh-lai-yi-zhuo` 或仓库首页，DSH 取到的是源码。下载 Release **Assets** 下的 `dsh-lai-yi-zhuo-*.tgz`，用其绝对路径替换源码安装。v0.3.1 已在 DSH 桌面版 0.2.2-rc.1 实测替换成功。 |
| 「无法从依赖变更中确定安装了哪一个包」 | 先在插件列表检查是否已有同名条目。若来源仍是仓库，改用 Release 包安装。界面无法替换时，在目标 profile 通过插件页卸载失败条目，再安装 `.tgz`。 |
| 找不到侧栏入口 | 检查当前运行的 profile、包名、插件启用状态和宿主兼容范围。出现重启提示时重启 DSH。 |
| 入口打开后空白 | 核对安装包的 SHA256，确认安装了对应版本，且包内有 `web/index.html` 和 `web/assets/`。若仍失败，请在 [Issues](https://github.com/Linguage/dsh-lai-yi-zhuo/issues) 附宿主版本和脱敏报错。 |

插件随包提供界面和本地计算，宿主安装后即可运行。
