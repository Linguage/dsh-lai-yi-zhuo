# 来一桌

来一桌（`dsh-lai-yi-zhuo`）是 DeepSeek Harness 的本地人机陪练插件。一个人可以开棋桌、牌桌或麻将桌，由本机程序应手。安装后从 DSH 侧栏进入，游戏无需模型账号或 API Key。

[项目主页](https://linguista.cn/workshop/lai-yi-zhuo/) · [GitHub Releases](https://github.com/Linguage/dsh-lai-yi-zhuo/releases/latest)

![来一桌大厅，提供棋桌、牌桌和麻将桌](docs/images/lobby.webp)

## 安装与更新

1. 在 DSH 的「插件 → 添加插件」中粘贴下面的仓库地址。

   ```text
   https://github.com/Linguage/dsh-lai-yi-zhuo
   ```

2. 安装后点击「立即启用」，从侧栏打开「来一桌」。插件声明兼容 DSH `>=0.2.0-0 <0.3.0`。
3. 如果插件列表已有「来一桌」，先在同一 DSH profile 卸载旧条目，再粘贴仓库地址安装。之前失败的 Git 安装也可能留下同名条目。

需要固定版本或离线安装时，可从 [GitHub Releases](https://github.com/Linguage/dsh-lai-yi-zhuo/releases/latest) 下载 **Assets** 下的 `dsh-lai-yi-zhuo-*.tgz`，在 DSH 填写下载文件的绝对路径。

从旧包 `dsh-board-games` 迁移时，同样先卸载旧包。同一浏览器、同一 DSH 地址下保留的旧局可继续。版本校验和故障处理见[部署指南](docs/deployment.md)。

## 开一桌

| 入口 | 玩法 |
| --- | --- |
| 棋桌 | 五子棋、围棋、中国象棋、国际象棋 |
| 牌桌 | 掼蛋、斗地主、升级、双扣 |
| 麻将桌 | 基础麻将、川麻血战到底、川麻血流成河、广东推倒胡 |

选好玩法和难度即可开始。五子棋和围棋点空位落子，象棋先点棋子再选目标格。纸牌点选手牌后出牌，麻将可以点牌弃牌。

0档有规则提示，可连续回退两次自己的决定。1档可回退一次。1、2档可开启建议，3、4档关闭建议。每次合法新操作后，连续回退次数重新计算。棋桌可选的胜率显示为实验估算，难度档位尚未与人类段位对应。

未结束的对局和设置保存在本机浏览器。开始新局会替换当前存档槽的旧局，五子棋与围棋共用一个存档槽。围棋需要玩家在终局确认死子，升级目前为单副练习，地方麻将采用简化计分。各桌的规则入口和[玩法与陪练档位](docs/game-rules.md)列有具体约定。

## 文档与许可

- [部署指南](docs/deployment.md)介绍安装、更新、存档和故障处理。
- [维护与扩展指南](docs/maintenance.md)介绍开发、检查、打包和发行。
- 插件内置 Skills 数量为 0，对局从侧栏开始。
- 项目源码公开，项目自有代码的许可标记为 [UNLICENSED](LICENSE)。chess.js 用于国际象棋规则，采用 BSD-2-Clause。React、React DOM 和 Scheduler 用于界面，采用 MIT。详见[第三方许可声明](THIRD_PARTY_NOTICES.txt)。
