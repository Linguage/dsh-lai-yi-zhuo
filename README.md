# 来一桌

来一桌是 DeepSeek Harness 的本地棋牌陪练插件。一个人也可以开棋桌、牌桌或麻将桌，由电脑应手。游戏无需配置模型账号，未结束的对局保存在本机。

[项目主页](https://linguista.cn/workshop/lai-yi-zhuo/) · [对局演示](https://linguista.cn/build/lai-yi-zhuo-overview/) · [版本记录与安装包](https://github.com/Linguage/dsh-lai-yi-zhuo/releases)

![来一桌大厅，三张桌面分别通往棋桌、牌桌和麻将桌](docs/images/lobby.webp)

## 安装

1. 在 DeepSeek Harness 打开「插件 → 添加插件」，粘贴仓库地址。

   ```text
   https://github.com/Linguage/dsh-lai-yi-zhuo
   ```

2. 安装后点击「立即启用」，从侧栏打开「来一桌」。

兼容 DeepSeek Harness `>=0.2.0-0 <0.3.0`。需要安装包或更新插件，见[部署指南](docs/deployment.md)。

## 开一桌

| 桌面 | 玩法 |
| --- | --- |
| 棋桌 | 五子棋、围棋、中国象棋、国际象棋 |
| 牌桌 | 掼蛋、斗地主、升级、双扣 |
| 麻将桌 | 基础麻将、川麻血战到底、川麻血流成河、广东推倒胡 |

第一次玩可以选 0 档，边看规则提示边练。0 档可连续回退两次自己的操作，1 档可回退一次。1、2 档可以打开建议。棋桌的实验胜率可以单独开关。

退出对局后，可以回到相同玩法继续。五子棋和围棋共用一个存档槽，新开一局会替换存档。各玩法采用的规则见[玩法与陪练档位](docs/game-rules.md)。

## 维护与许可

开发、测试与发版见[维护与扩展指南](docs/maintenance.md)。

自有代码许可标记为 [UNLICENSED](LICENSE)。国际象棋规则使用 chess.js（BSD-2-Clause），界面使用 React、React DOM 和 Scheduler（MIT）。[第三方许可声明](THIRD_PARTY_NOTICES.txt)
