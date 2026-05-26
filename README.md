# 黄金矿工（HTML5 Canvas）

一个基于原生 HTML5 Canvas 的《黄金矿工》小游戏项目。当前版本已经从早期卡通原型升级为写实素描纸蜡笔风格，包含完整可玩的单人/双人模式、关卡生成、商店道具、行情系统、自适应难度、WebAudio 音效/BGM、浏览器调试钩子和 macOS WebView 打包流程。

项目不依赖后端服务，也不依赖前端框架。浏览器端入口由 `index.html`、classic `audio.js` 和 ES module `src/main.js` 组成，核心宿主仍由 `game.js` 装配，规则、渲染、UI、音频、测试边界已逐步拆入 `src/` 下的可测试模块。

![黄金矿工游戏界面截图](./assets/screenshots/gameplay.png)

## 当前特性

- 经典黄金矿工核心循环：钩爪摆动、放钩、抓取、回收、计分、倒计时、过关或失败。
- 单人和双人模式：单人使用一条钩索；双人使用两名矿工和两条钩索，目标分数提高 30%。
- 写实素描纸蜡笔视觉：矿洞背景、木梁、矿工、绞盘、钩爪、矿石、道具和 UI 都接入 `assets/art/crayon/` 资产。
- 完整可抓取物品：金块、岩石、钻石、金条、祖母绿、红宝石、水晶簇、古钱币袋、化石、幸运袋、炸药桶、小老鼠及背货老鼠。
- 商店与道具：炸药、加速、幸运袋，过关后可用当前分数购买。
- 行情系统：每关开局生成当日行情，影响金条、钻石、祖母绿、红宝石、水晶簇等物品价值。
- 固定种子复现：支持 `?seed=12345` 固定关卡布局、行情和关键 gameplay 随机流。
- 阶段性与自适应难度：根据关卡进度和上一关超额表现调整目标、时间、物品组成和压力曲线。
- WebAudio 合成声音：包含钩索、抓取、回收、爆炸、购买、倒计时等音效，以及 10 首合成背景音乐。
- 浏览器自动化调试 API：提供文本快照、虚拟时间推进和商店 smoke 前置状态。
- macOS 桌面应用打包：内置 Swift/WebKit WebView 壳，可生成 `.app`、`.zip` 或 `.dmg`。
- 测试保护：Node 单元测试、源码约束测试、依赖边界测试和固定 seed baseline。

## 快速开始

推荐通过本地静态服务器运行。当前入口使用 ES module，直接双击 `index.html` 可能会被浏览器的 `file://` module 限制拦截。

### macOS

```bash
./run.command
```

`run.command` 会启动本地 `http.server` 并打开浏览器。如果当前环境不能自动打开 GUI，它会打印可手动访问的 URL。

### macOS / Linux

```bash
./start.sh
```

### Windows

```bat
start.bat
```

### 手动启动

```bash
python3 -m http.server 5173 --bind 127.0.0.1
```

然后打开：

```text
http://127.0.0.1:5173/
```

固定种子示例：

```text
http://127.0.0.1:5173/?seed=12345
```

当前蜡笔风格入口也可以显式带上 UI 标记：

```text
http://127.0.0.1:5173/?seed=12345&ui=crayon
```

## 操作说明

| 操作 | 单人模式 | 双人模式 |
| --- | --- | --- |
| 放钩 | 空格 / 点击画面 | 玩家 1：空格 / 点击画面；玩家 2：回车 |
| 暂停 / 继续 | `P` | `P` |
| 使用炸药 | `X` | `X` |
| 音乐开关 | `M` | `M` |
| 音效开关 | `S` | `S` |
| 切换下一首音乐 | `N` | `N` |

游戏启动后会先显示模式选择。单人模式保持经典玩法；双人模式同时出现两名矿工，两条钩索可以分别出钩，目标分数会提高。

## 玩法系统

### 关卡与目标

关卡数据由固定配置和 seeded 随机生成共同驱动。基础关卡会控制目标分数、剩余时间、物品密度和物品权重；第 5 关起启用更明显的压力曲线，重物比例、目标倍率、小老鼠速度等会逐步上升。

### 物品价值与行情

物品价值来自 `src/config/items.js` 与 `src/systems/valueSystem.js`。第 4 关起会生成关卡级价值倍率，行情系统还会对特定贵重物品施加独立涨跌，并在顶部行情栏展示。例如固定 seed 下会出现类似：

```text
当日行情[淘金观望日] 金条↑13% 钻石↑34% 祖母绿↓2% 红宝石↑11% 水晶簇↓7%
```

### 炸药桶

炸药桶是危险物。抓到后有确定性概率立即爆炸；如果没有立即爆炸，会在回收途中脱钩下坠，碰到任何物品后爆炸并清理范围内物品。该概率已接入 gameplay 随机流，固定 seed 下可复现。

### 小老鼠

第 5 关后可能出现小老鼠。它们会水平折返移动，部分老鼠会背着钻石或金条。老鼠移动和携带物显示都走当前的蜡笔资产渲染。

### 商店与道具

过关后进入商店，可购买：

- 炸药：抓住物品时可按 `X` 清除当前抓取物。
- 加速：下一关拉回速度提高 35%。
- 幸运袋：下一关额外生成 1 个幸运袋。

商店购买逻辑由 `src/systems/inventorySystem.js` 和宿主 UI 共同处理，测试中提供固定前置状态用于稳定验证。

## 视觉与资源

当前视觉方向是“写实素描纸蜡笔”：纸张颗粒、炭笔线条、温暖矿洞光、手绘矿石和金属钩爪。主要资产位置：

```text
assets/
├── art/crayon/
│   ├── backgrounds/      # 蜡笔矿洞背景
│   ├── icons/            # HUD 道具图标
│   ├── sprites/          # 矿工、钩爪、矿物、老鼠、道具
│   ├── textures/         # 纸张、UI 纸面、木梁纹理
│   └── ART_PROMPTS.md    # 资产生成提示词和风格约束记录
├── icons/                # favicon、PWA/网页图标
└── screenshots/          # README 截图
```

网页图标和 macOS 图标也已同步到当前美术风格：

- `assets/icons/favicon.ico`
- `assets/icons/favicon-16x16.png`
- `assets/icons/favicon-32x32.png`
- `assets/icons/apple-touch-icon.png`
- `assets/icons/icon-192.png`
- `assets/icons/icon-512.png`
- `assets/icons/icon-1024.png`
- `macos/AppIcon.icns`
- `macos/AppIcon.iconset/`

## 技术架构

项目仍保持“无构建工具即可运行”的低门槛结构，但核心逻辑已逐步模块化。`src/runtime/moduleBridge.js` 会安装 `window.GoldMinerModules`，`game.js` 通过 bridge-first、fallback-second 的方式优先调用模块实现，模块异常时熔断并回退宿主逻辑。

### 入口层

```text
index.html
├── audio.js              # classic script，安装 window.GameAudio
└── src/main.js           # ES module，安装模块桥接后加载 game.js
```

### 主要目录

```text
src/
├── audio/                # 音频事件适配器
├── config/               # 关卡、平衡、物品配置
├── core/                 # 几何、RNG、随机流
├── events/               # runtime event 类型与队列
├── fx/                   # 视觉特效事件
├── render/               # Canvas 渲染管线和具体图层渲染器
├── runtime/              # module bridge 与事件应用
├── state/                # command、selector、初始状态和状态 kernel
├── systems/              # 关卡、行情、DDA、钩索、物品、炸药桶、计分等纯逻辑
├── testing/              # 浏览器调试 API
└── ui/                   # DOM HUD、输入和 UI 事件适配器
```

### 设计原则

- 规则模块尽量保持纯函数，不直接访问 `window`、`document`、Canvas 或 AudioContext。
- 渲染模块只消费快照和资源，不修改玩法状态。
- UI 和音频通过事件或快照适配器更新。
- 固定 seed 相关 gameplay 随机使用 deterministic stream；纯视觉抖动可以继续使用环境随机。
- 旧宿主逻辑仍保留 fallback，方便渐进拆分和浏览器兼容。

## 调试与自动化 API

浏览器运行时会暴露几个测试入口，供 smoke test 或手动排查使用：

```js
window.render_game_to_text();
```

返回当前游戏状态 JSON 字符串，包括 phase、mode、level、score、target、market、DDA、hooks、items、inventory 等摘要。

```js
window.advanceTime(1000);
```

按固定 60fps 步长推进虚拟时间，适合在测试中稳定触发倒计时、钩索运动和状态变化。

```js
window.__goldMinerSmoke.enterShop({ score: 500 });
```

进入可重复的商店测试前置状态，用于验证购买逻辑。

常用控制台探针：

```js
(() => {
  const text = JSON.parse(window.render_game_to_text());
  return {
    ready: window.__goldMinerModulesReady,
    bootError: window.__goldMinerBootError ?? null,
    phase: text.phase,
    level: text.level,
    score: text.score,
    inventory: text.inventory,
    hooks: text.hooks?.length ?? 0,
    errors: Object.keys(window).filter((key) => /^__goldMiner.*Error$/.test(key)),
  };
})();
```

## 测试与验证

安装 Node 后可以运行：

```bash
npm run verify
```

该命令会执行：

```bash
npm run check:syntax
npm test
```

当前测试套件覆盖：

- JavaScript 语法检查。
- 核心几何、RNG、随机流。
- 关卡生成、行情、DDA、价值和物品工厂。
- 命令分发、选择器、库存和商店逻辑。
- 钩索、物品运动、炸药桶、计分、FX 状态系统。
- Canvas 渲染器、渲染管线、蜡笔资产注册表。
- DOM UI、输入、音频适配器。
- runtime bridge 公开面、源码不变量和依赖边界。
- 固定 seed baseline fixture。

浏览器冒烟检查见：

```text
docs/testing/browser-smoke.md
```

推荐在影响启动、渲染、输入、Canvas、浏览器全局对象或打包流程时执行该清单。

## macOS 应用打包

项目内置 Swift/WebKit WebView 壳：

```text
macos/
├── GoldMinerApp.swift
├── Info.plist
├── AppIcon.icns
├── AppIcon.iconset/
└── build.command
```

生成 `.app`：

```bash
./macos/build.command
```

生成 `.zip`：

```bash
./macos/build.command --zip
```

生成 `.dmg`：

```bash
./macos/build.command --dmg
```

输出目录：

```text
dist/macos/
```

默认生成的是未签名应用。分发到其他 Mac 时可能被 Gatekeeper 拦截，可在 Finder 中右键 App 后选择“打开”。正式分发需要 Developer ID 证书、`codesign` 和 `notarytool` 公证。

## 项目结构速览

```text
.
├── index.html                  # 页面结构、HUD、弹层、入口脚本
├── styles.css                  # 蜡笔纸面 UI 样式
├── game.js                     # 浏览器宿主、游戏装配、fallback 逻辑
├── audio.js                    # WebAudio 合成音效和 BGM facade
├── src/                        # 模块化规则、渲染、UI、音频、测试边界
├── assets/                     # 美术资产、图标和截图
├── tests/                      # Node 单元测试与 baseline fixture
├── docs/                       # 架构记录、执行计划、浏览器 smoke 文档
├── macos/                      # macOS WebView 壳和打包脚本
├── run.command                 # macOS 一键启动本地服务器
├── start.sh                    # macOS/Linux 启动脚本
├── start.bat                   # Windows 启动脚本
├── package.json                # Node 测试脚本
└── progress.md                 # 项目迭代记录
```

## 开发注意事项

- 不要依赖直接打开 `index.html`，请使用本地服务器。
- 修改 gameplay 逻辑时优先补充或更新 `tests/unit/` 中的纯模块测试。
- 修改浏览器入口、渲染、输入、UI、音频或 debug API 后，至少运行 `npm run verify`。
- 修改 macOS 打包相关文件后，运行 `./macos/build.command`。
- 修改视觉资产后，检查 `assets/art/crayon/` 资产注册、README 截图、favicon 和 macOS AppIcon 是否仍一致。
- 固定 seed 行为是重要回归保护。涉及关卡、行情、随机、物品生成或炸药桶概率时，需要确认 baseline 是否应更新。

## 许可证

见 [LICENSE](./LICENSE)。
