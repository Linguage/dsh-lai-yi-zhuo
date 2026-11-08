# 维护与扩展指南

[返回 README](../README.md) · [部署指南](deployment.md) · [玩法与陪练档位](game-rules.md)

## 构建和检查

用 Node.js 24 在仓库根目录执行：

```sh
npm ci --ignore-scripts
npm run check
npm run serve
```

预览地址为 `http://127.0.0.1:7346/board-games/`，可用 `PORT` 改端口。`npm run check` 执行类型检查、规则测试和生产构建。HTTP 测试会监听本机临时端口。

浏览器验证需要 Playwright 和 Chromium。可用 `PLAYWRIGHT_MODULE` 指定 Playwright 模块，`CHROME_PATH` 指定 Chrome 可执行文件。服务运行后，按改动执行 `npm run test:browser`、`npm run test:tables-browser` 或 `npm run test:variants-browser`。打包后运行 `npm run test:package`，在隔离目录验证宿主与客户端注册、界面和四类计算线程。结果写入 `artifacts/qa/`。

## 修改规则与界面

| 文件 | 用途 |
| --- | --- |
| `src/index.mjs`、`src/client.js`、`cordis.patch.yml` | 注册 DSH 路由、侧栏及插件配置 |
| `src/http.mjs` | 提供 `/board-games/` 下的静态资源 |
| `ui/TablesApp.tsx`、`ui/App.tsx`、`ui/RoyalGame.tsx`、`ui/AddedCardGame.tsx` | 大厅、对局和操作流程 |
| `ui/game.ts`、`ui/royal.ts` | 棋类规则和走法 |
| `ui/guandan.ts`、`ui/climbing.ts`、`ui/tractor.ts`、`ui/mahjong.ts` | 纸牌与麻将规则 |
| `ui/*.worker.ts` | 在后台计算应手及建议 |
| `ui/storage.ts`、`ui/table-session.ts`、`ui/cards-session.ts` | 保存、重放与回退 |

扩展规则时，把合法性检查留在规则模块，由界面复核 Worker 回传的动作。纸牌和麻将的 Worker 只接收自己的手牌、公开牌和合法操作。修改存档格式前，用旧版日志验证回放、刷新续局和回退。

浏览器 `localStorage` 沿用 `dsh-board-games-*-v1` 与 `dsh-four-preferences`；部分棋类共用棋桌存档，新增棋种、纸牌与地方麻将有各自的键。四人玩法记录随机种子和动作，读回时重放。旧包迁移依赖同一游戏地址和兼容的存档键，包名与存档键分别维护。

## 打包与发行

1. 确定新版本，用 `npm version patch --no-git-tag-version` 等命令更新 manifest 与锁文件。在 `release-notes/v<版本>.md` 写明变化和更新要求。
2. 跑完整检查和 `npm run package`。检查 `dist/dsh-lai-yi-zhuo-<版本>.tgz` 的入口、四个 Worker、许可及 `SHA256SUMS`，再做解包及 DSH 实装测试。发行包包含编译产物，演示图片、用户数据和开发依赖留在包外。
3. 将版本提交推送到 `main`，再推送与 manifest 对齐的 `v<版本>` 标签。[发行工作流](../.github/workflows/release.yml)在 GitHub Actions 上从该标签构建并创建 Release。如果标签未触发运行，可在 Actions 手动选择同一个已推送的标签。
4. 匿名下载实际附件，与 Release 的 `SHA256SUMS` 比对，再按[部署指南](deployment.md)从 DSH 侧栏打开验证。已发布附件需要变化时发新版本。

首个公开版本的[发行记录](https://github.com/Linguage/dsh-lai-yi-zhuo/releases/tag/v0.3.1)保留原包和校验文件。文档更新可随 `main` 发布。
