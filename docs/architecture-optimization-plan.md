# 黄金矿工技术架构优化开发文档

日期：2026-05-23

## 1. 文档目的

本文档用于指导《黄金矿工》小游戏的技术架构优化。优化目标不是调整玩法规则、数值平衡或视觉风格，而是在现有功能不回退的前提下，提高代码的可维护性、可测试性、可扩展性和发布稳定性。

当前项目已经具备完整可玩的 HTML5 Canvas 原型：

- `index.html`：页面结构、HUD、按钮、商店弹层、内联图标。
- `styles.css`：页面外壳、HUD、商店、按钮样式。
- `game.js`：核心游戏状态、关卡生成、输入、物理、碰撞、绘制、DOM 更新、测试钩子。
- `audio.js`：WebAudio 合成音效和背景音乐。
- `macos/`：macOS WebView 壳和打包脚本。
- `dist/`：构建产物和缓存。

本次架构优化的核心判断是：当前项目适合作为原型，但 `game.js` 已经承担过多职责。后续如果继续添加道具、敌人、关卡机制、移动端适配、存档、排行榜或素材系统，单体文件会快速进入高风险维护阶段。

## 2. 优化原则

1. 保持玩法行为兼容
   每个阶段完成后，固定 seed 下的初始关卡布局、基础操作、得分、商店流程应保持一致，除非某次任务明确声明调整行为。

2. 渐进式拆分
   不做一次性大重写。先建立测试和模块边界，再逐步把现有函数迁移出去。

3. 核心逻辑纯净化
   游戏规则、关卡生成、碰撞、计分、DDA 等逻辑应尽量不直接访问 DOM、Canvas、AudioContext 或 `window`。

4. 表现层消费事件
   音效、粒子、HUD、屏幕震动、分数飘字等表现行为应由事件驱动，而不是散落在核心逻辑函数中直接调用。

5. 保留低门槛运行方式
   项目当前使用浏览器原生 ES module 入口，推荐通过本地静态服务器运行。架构优化不应强制引入复杂后端或重型框架，`run.command` / `start.sh` / `start.bat` 应承担一键启动本地服务器的职责。

6. 先 JavaScript 模块化，后评估 TypeScript
   第一阶段建议使用浏览器原生 ES Modules 和 JSDoc 类型约束。若后续复杂度继续提升，再迁移 TypeScript。

## 3. 当前架构问题

### 3.1 `game.js` 职责过重

`game.js` 仍是现有 browser host，包含以下职责：

- 全局状态定义。
- 几何工具函数。
- 背景 SVG 生成和加载。
- 关卡配置和随机生成。
- 行情系统。
- DDA 自适应难度。
- 道具商店。
- 输入监听。
- 钩子运动和碰撞。
- 物品运动。
- 炸药桶爆炸。
- 分数结算。
- DOM HUD 更新。
- Canvas 全量绘制。
- 粒子和视觉特效。
- 自动化测试钩子。

这会导致几个具体风险：

- 修改一个玩法函数时，容易意外影响渲染、音频或 UI。
- 测试困难，因为核心逻辑依赖浏览器全局对象。
- 新增物品类型时，需要同时改生成、碰撞、音效、绘制、文案等多个位置。
- 固定 seed 只能部分复现，因为运行期仍有一些 gameplay 相关随机使用 `Math.random()`。

### 3.2 核心逻辑和副作用耦合

例如抓取、爆炸、计分等流程会同时修改游戏状态、播放音效、创建粒子、触发屏幕震动和更新 HUD。这样的代码直接可用，但长期会限制演进。

目标状态应是：

- 核心系统修改状态并产出 `GameEvent`。
- 音频系统根据事件播放声音。
- 特效系统根据事件创建粒子、震动和闪光。
- UI 系统根据状态快照刷新 DOM。
- 测试只验证状态和事件，不需要依赖 Canvas 绘制。

### 3.3 随机流没有严格分层

关卡生成使用 seeded RNG，这是正确方向。但部分影响结果的随机仍使用 `Math.random()`，例如炸药桶立即爆炸概率。视觉粒子和音频微扰使用 `Math.random()` 没问题，但 gameplay 结果应该可复现。

### 3.4 缺少正式测试结构

当前已有 `window.render_game_to_text` 和 `window.advanceTime(ms)`，这是一个良好的自动化入口。但它还不是正式测试体系，缺少：

- 核心函数单元测试。
- 固定 seed 快照测试。
- 浏览器冒烟测试。
- 打包产物验证。

### 3.5 源码和产物边界不清晰

项目根目录同时放源码、启动脚本、构建产物、缓存和输出文件。长期看需要明确：

- 源码目录。
- 测试目录。
- 文档目录。
- 构建产物目录。
- 发布白名单。

## 4. 目标架构

推荐目标结构如下：

```text
.
├── index.html
├── styles.css
├── src/
│   ├── main.js
│   ├── core/
│   │   ├── gameState.js
│   │   ├── gameLoop.js
│   │   ├── events.js
│   │   ├── rng.js
│   │   └── geometry.js
│   ├── config/
│   │   ├── constants.js
│   │   ├── levels.js
│   │   ├── shopItems.js
│   │   └── backgrounds.js
│   ├── systems/
│   │   ├── levelSystem.js
│   │   ├── ddaSystem.js
│   │   ├── marketSystem.js
│   │   ├── hookSystem.js
│   │   ├── itemSystem.js
│   │   ├── kegSystem.js
│   │   ├── mouseSystem.js
│   │   ├── scoringSystem.js
│   │   └── fxSystem.js
│   ├── render/
│   │   ├── canvasRenderer.js
│   │   ├── backgroundRenderer.js
│   │   ├── itemRenderer.js
│   │   ├── hookRenderer.js
│   │   ├── minerRenderer.js
│   │   └── fxRenderer.js
│   ├── ui/
│   │   ├── domRefs.js
│   │   ├── hud.js
│   │   ├── overlay.js
│   │   ├── shop.js
│   │   └── input.js
│   ├── audio/
│   │   ├── audioEngine.js
│   │   ├── audioEvents.js
│   │   └── tracks.js
│   └── testing/
│       └── debugApi.js
├── tests/
│   ├── unit/
│   └── browser/
├── docs/
├── macos/
└── dist/
```

初期可以不一次性完成上述结构，但最终模块职责应向这个方向收敛。

## 5. 八项优化方案

### 5.1 拆分游戏核心与表现层

#### 目标

把游戏规则从 DOM、Canvas、音频中剥离，让核心逻辑可以独立运行和测试。

#### 当前问题

当前 `game.js` 同时负责状态、规则和表现。核心逻辑函数会直接调用 `audioPlay()`、`spawnBurst()`、`updateHud()`、`showOverlay()` 等副作用函数。

#### 设计方案

建立以下边界：

- `core/`：只处理状态、时间、事件、工具函数。
- `systems/`：处理规则，如钩子、物品、关卡、计分、DDA。
- `render/`：只处理 Canvas 绘制。
- `ui/`：只处理 DOM。
- `audio/`：只处理声音。

#### 建议迁移顺序

1. 迁移纯工具函数：`clamp`、`lerp`、`dist2`、`segmentCircleIntersect`。
2. 迁移 `createRng()` 到 `core/rng.js`。
3. 迁移关卡配置、商店配置、常量。
4. 迁移关卡生成和 DDA。
5. 迁移钩子系统和物品系统。
6. 最后迁移渲染函数。

#### 验收标准

- `src/core` 和 `src/systems` 中不直接访问 `document`、`canvas`、`ctx`、`AudioContext`、`localStorage`。
- 核心逻辑可以在 Node 或浏览器无 DOM 环境中运行单元测试。
- `game.js` 或后续 `main.js` 只负责装配系统。

### 5.2 建立事件层

#### 目标

核心系统通过事件表达“发生了什么”，表现层通过事件决定“怎么表现”。

#### 事件模型

建议定义统一事件对象：

```js
/**
 * @typedef {Object} GameEvent
 * @property {string} type
 * @property {number=} time
 * @property {Object=} payload
 */
```

建议事件类型：

```js
export const GameEventType = {
  LEVEL_STARTED: "LEVEL_STARTED",
  LEVEL_ENDED: "LEVEL_ENDED",
  HOOK_SHOT: "HOOK_SHOT",
  HOOK_EMPTY_RETRACT: "HOOK_EMPTY_RETRACT",
  ITEM_CAUGHT: "ITEM_CAUGHT",
  ITEM_DELIVERED: "ITEM_DELIVERED",
  SCORE_ADDED: "SCORE_ADDED",
  BOMB_USED: "BOMB_USED",
  KEG_DROPPED: "KEG_DROPPED",
  KEG_EXPLODED: "KEG_EXPLODED",
  SHOP_OPENED: "SHOP_OPENED",
  ITEM_BOUGHT: "ITEM_BOUGHT",
  GAME_PAUSED: "GAME_PAUSED",
  GAME_RESUMED: "GAME_RESUMED",
  GAME_FAILED: "GAME_FAILED",
  COUNTDOWN_TICK: "COUNTDOWN_TICK",
};
```

#### 事件分发方式

建议采用简单数组，不需要复杂事件总线：

```js
const events = [];
updateHookSystem(state, dt, events);
updateItemSystem(state, dt, events);
updateScoringSystem(state, dt, events);

audioSystem.handleEvents(events);
fxSystem.handleEvents(state, events);
uiSystem.render(state);
```

#### 迁移示例

当前逻辑：

```js
audioPlay("score", { amount: earned });
addScorePop(earned, color, hook);
spawnRing(...);
```

目标逻辑：

```js
events.push({
  type: GameEventType.SCORE_ADDED,
  payload: { amount: earned, itemType: item.type, hookId: hook.id, x, y },
});
```

音频和特效独立响应：

```js
audioSystem.handle(event);
fxSystem.handle(event);
```

#### 验收标准

- 核心系统不直接调用音频函数。
- 核心系统不直接创建粒子。
- 关键行为都能在测试中断言事件输出。

### 5.3 区分确定性随机和视觉随机

#### 目标

让固定 seed 能稳定复现 gameplay 结果，同时允许视觉和音频保持自然变化。

#### 随机流设计

在 `GameState` 中维护两类随机源：

```js
state.rng = {
  gameplay: createRng(seed),
  level: createRng(levelSeed),
  market: createRng(levelSeed ^ MARKET_SALT),
  visual: createRng(seed ^ VISUAL_SALT),
};
```

#### 使用规则

必须使用 gameplay RNG 的场景：

- 关卡物品生成。
- 行情倍率。
- 炸药桶是否立即爆炸。
- 老鼠是否携带物品。
- 老鼠携带钻石还是金条。
- 商店或关卡中影响分数和通关结果的随机。

可以使用 visual RNG 或 `Math.random()` 的场景：

- 粒子角度和速度。
- 屏幕震动偏移。
- 分数飘字偏移。
- 音频微扰。
- 背景闪烁。

#### 验收标准

- 同一 `?seed=` 下，相同输入序列产生相同得分、抓取结果、爆炸结果。
- 单元测试能复现炸药桶立即爆炸与不爆炸两类场景。
- 粒子和音频的随机不影响状态测试。

### 5.4 引入类型边界

#### 目标

减少字符串类型和可选字段带来的运行时错误，提高重构安全性。

#### 第一阶段：JSDoc

在不引入构建流程的前提下，先用 JSDoc 定义核心类型：

```js
/**
 * @typedef {"gold"|"rock"|"diamond"|"bag"|"bar"|"emerald"|"ruby"|"crystal"|"pouch"|"keg"|"fossil"|"mouse"} ItemType
 *
 * @typedef {Object} BaseItem
 * @property {number} id
 * @property {ItemType} type
 * @property {number} x
 * @property {number} y
 * @property {number} r
 * @property {number} value
 * @property {number} weight
 * @property {boolean} grabbed
 */
```

核心类型清单：

- `GameState`
- `HookState`
- `MinerState`
- `Item`
- `MouseData`
- `KegData`
- `LevelConfig`
- `MarketDay`
- `DdaState`
- `GameEvent`
- `Viewport`

#### 第二阶段：TypeScript 评估

当模块化完成后，可以评估是否迁移为 TypeScript：

- 若继续保持简单离线 HTML，可保留 JSDoc。
- 若计划引入构建、测试、资源管线、移动端适配，则推荐 TypeScript。

#### 验收标准

- `// @ts-check` 可用于核心模块。
- 编辑器能提示错误字段和错误事件 payload。
- 物品类型新增时，生成、渲染、音频和测试位置都有明确编译或检查提示。

### 5.5 绘制层分层

#### 目标

让 Canvas 绘制代码按对象和层级组织，避免继续扩大单文件函数区。

#### 建议渲染流水线

```js
renderer.renderFrame({
  state,
  ctx,
  viewport,
  dpr,
  now,
});
```

内部顺序：

1. 背景层。
2. 木梁层。
3. 矿工背层。
4. 绞盘层。
5. 矿工前景手臂层。
6. 物品层。
7. 钩子拖尾层。
8. 钩子层。
9. 抓取标签层。
10. 粒子和分数层。
11. 闪光和倒计时警告层。

#### 模块拆分

- `backgroundRenderer.js`：背景图、星光、尘埃、渐变。
- `itemRenderer.js`：所有物品绘制。
- `hookRenderer.js`：绳索、钩爪、拖尾、抓取标签。
- `minerRenderer.js`：矿工和绞盘。
- `fxRenderer.js`：粒子、震动、闪光、分数飘字。
- `canvasRenderer.js`：统一排序和调用。

#### 渲染函数规则

- 渲染函数不修改 gameplay 状态。
- 渲染函数可以读取 `now` 做动画。
- 渲染函数可以读取 `fxState` 并绘制，但 `fxState` 的生命周期由 `fxSystem` 更新。
- 渲染函数不调用音频、不更新 DOM、不推进时间。

#### 验收标准

- `render()` 只负责清屏、设置 transform、调用分层渲染器。
- 物品绘制新增类型时，只需要改 `itemRenderer` 和必要配置。
- Canvas 渲染可以用截图冒烟测试验证非空和无严重报错。

### 5.6 正规化测试架构

#### 目标

在重构过程中降低回归风险，让后续功能开发有基本保护网。

#### 测试分层

1. 单元测试
   面向纯函数和核心系统。

2. 集成测试
   面向 `GameState + Systems`，验证给定 seed 和输入序列后的状态。

3. 浏览器测试
   面向真实页面，验证加载、按钮、键盘、Canvas 非空、调试 API 可用。

4. 打包测试
   面向 macOS 打包脚本，验证 app bundle 内资源齐全。

#### 建议测试清单

单元测试：

- `createRng()` 同 seed 输出一致。
- `segmentCircleIntersect()` 覆盖命中、擦边、未命中。
- `createMarketDay()` 至少产生一个明显涨幅和一个明显跌幅。
- `computeDdaTuning()` 随关卡和 rating 单调变化。
- `generateLevelData()` 固定 seed 下物品数量和关键字段稳定。
- `explodeKegAt()` 正确移除范围内物品。
- `deliverAttachedItem()` 正确加分并移除物品。

浏览器测试：

- 页面能加载。
- 点击开始后出现模式选择。
- 选择单人后进入 playing。
- 调用 `window.render_game_to_text()` 返回合法 JSON。
- 调用 `window.advanceTime(1000)` 后时间减少。
- Canvas 截图非空。

#### 测试工具建议

轻量方案：

- `node:test` 或 `vitest` 做单元测试。
- `playwright` 做浏览器测试。

如果仍想保持零依赖，可以先只做浏览器内调试 API，但长期建议引入最小测试依赖。

#### 验收标准

- 当前实际验证命令至少包括 `npm run verify`。
- 页面冒烟测试命令属于后续目标；如果未来新增 `test:browser`，再把它纳入常规验收。
- 每次模块迁移后测试通过。

### 5.7 音频模块事件化

#### 目标

保留现有 WebAudio 合成能力，但让游戏逻辑不直接关心具体音效名称。

#### 当前状态

`audio.js` 已经是相对独立模块，但它暴露的是全局 `window.GameAudio`。`game.js` 通过 `audioPlay("hook_shoot")` 等字符串调用音频。

#### 设计方案

保留底层 `AudioEngine`：

```js
audioEngine.play("hook_shoot", options);
audioEngine.toggleMusic();
audioEngine.nextTrack();
```

新增 `audioEvents.js`：

```js
export function handleAudioEvent(audioEngine, event) {
  switch (event.type) {
    case "HOOK_SHOT":
      audioEngine.play("hook_shoot");
      break;
    case "ITEM_CAUGHT":
      audioEngine.play(getCatchSound(event.payload.itemType), event.payload);
      break;
    case "SCORE_ADDED":
      audioEngine.play("score", { amount: event.payload.amount });
      break;
  }
}
```

#### 音频状态边界

音频系统可以持有：

- `AudioContext`
- 音量偏好
- 当前曲目
- 音乐计时器
- WebAudio 节点

音频系统不应该持有：

- `GameState`
- 关卡物品数组
- DOM 节点引用

#### 验收标准

- 核心系统不直接调用 `GameAudio.play()`。
- 音频开关和切歌仍保持现有 UI 行为。
- BGM 按 seed 选曲逻辑可以由关卡事件驱动。

### 5.8 清理构建和发布边界

#### 目标

让源码、产物、临时文件、发布包边界清晰，降低误提交和打包遗漏风险。

#### 建议目录规则

- `src/`：源码。
- `assets/`：手工维护的静态资源。
- `docs/`：开发文档。
- `tests/`：测试。
- `macos/`：macOS 壳源码和打包脚本。
- `dist/`：构建产物，不作为源码维护。
- `tmp/`：临时输出，不作为源码维护。
- `output/`：生成素材输出，如果只是中间结果则不进正式发布。

#### `.gitignore` 建议

```gitignore
.DS_Store
dist/
tmp/
*.log
node_modules/
coverage/
```

是否忽略 `output/` 取决于其中素材是否为最终资产。如果 `output/imagegen/icon/master-1024.png` 是图标源资产，建议移动到 `assets/source/`。如果只是生成中间产物，建议忽略。

#### macOS 打包脚本建议

当前 `macos/build.command` 通过复制白名单文件生成 `.app`，这个方向是正确的。模块化后需要更新复制规则：

```text
index.html
styles.css
src/
assets/
```

不要把 `tests/`、`docs/`、`tmp/`、`dist/` 打进 app bundle。

#### 验收标准

- 清理后 `git status` 不再被 `.DS_Store`、缓存、构建产物干扰。
- macOS app bundle 可以正常加载模块化后的页面。
- 打包脚本失败时错误信息明确。

## 6. 分阶段实施计划

### Phase 0：建立基线

#### 目标

在正式拆分前建立行为基线，确保后续改动可验证。

#### 任务

- 新增 `docs/architecture-optimization-plan.md`。
- 新增 `.gitignore`。
- 记录当前固定 seed 的初始状态 JSON。
- 记录当前页面截图作为视觉参考。
- 规划测试命令和目录。

#### 交付物

- 架构文档。
- 基线快照文件。
- 最小测试脚本或测试说明。

#### 验收标准

- 使用 `?seed=12345` 能得到稳定初始状态记录。
- 当前游戏仍可直接打开运行。

### Phase 1：Runtime Module Bridge（已由 Batch 2 完成）

#### 目标

在当时不改变 `audio.js` + `game.js` classic entry 的前提下，让运行时开始消费 `src/` 中已抽离、已测试的纯模块。

#### 入口路径演进

旧方案曾建议在 Batch 2 立刻创建 `src/main.js` 并将 `index.html` 切换到 `<script type="module" src="./src/main.js"></script>`。该方案当时被 Batch 2 的低风险 bridge 方案替代，不再是 Batch 3 的前置任务；Batch 7 之后已重新引入 `src/main.js` 作为正式 module entry。

Batch 2 完成时的 canonical 顺序是：

- `index.html` 当时继续加载 classic `audio.js` 和 `game.js`。
- `game.js` 在 boot 前使用 dynamic import（动态 `import()`）加载 `src/runtime/moduleBridge.js`。
- `src/runtime/moduleBridge.js` 统一导出 `window.GoldMinerModules`。
- 保留 legacy fallback，支持 direct file launch 和 bridge 加载失败时的旧运行路径。
- `src/main.js` 和 `index.html` module entry 迁移延后到 Batch 7。

Batch 7 Task 19 之后的当前入口顺序是：

- `index.html` 继续先加载 classic `audio.js`，保留现有 WebAudio facade 兼容性。
- `index.html` 再加载 `<script type="module" src="./src/main.js"></script>`。
- `src/main.js` 负责先安装 `src/runtime/moduleBridge.js`，再 dynamic import `../game.js` 作为现有 browser host。
- `game.js` 仍保留 direct import fallback，用于兼容直接加载 host 或 bridge 安装失败的调试场景。

#### 已完成范围

- 新增 `src/runtime/moduleBridge.js`。
- `game.js` 通过 bridge 优先消费低风险纯逻辑：`geometry`、`rng`、`market`、`DDA`、`updateDdaRating`。
- `macos/build.command` 复制 `src/` 到 App Resources。

#### 验收标准

- `npm run verify` 通过。
- `./macos/build.command` 能生成包含 `src/` 的可运行 app。
- Batch 3 当时不需要提前修改 `index.html` 或创建 `src/main.js`；该迁移已在 Batch 7 执行。

### Phase 2：抽离纯核心模块

#### 目标

优先迁移无副作用代码，降低后续拆分风险。

#### 任务

- 迁移 `geometry.js`。
- 迁移 `rng.js`。
- 迁移 `constants.js`。
- 迁移 `levels.js`。
- 迁移 `shopItems.js`。
- 迁移 `marketSystem.js`。
- 迁移 `ddaSystem.js`。

#### 验收标准

- 每迁移一个模块后页面仍可运行。
- 新模块不依赖 DOM、Canvas、Audio。
- 固定 seed 初始状态不变。

### Phase 3 / Batch 3：抽离关卡和物品生成

#### 目标

让关卡生成成为可测试系统。

#### 任务

- 新建 `src/config/items.js`。
- 新建 `src/config/levels.js`。
- 新建 `src/systems/valueSystem.js`。
- 新建 `src/systems/itemFactory.js`。
- 新建 `src/systems/levelGenerator.js`。
- 迁移 level config、item spec creation、market-adjusted values 和 placement generation。
- 保留 rendering-adjacent 的 art details，除非它们已经能作为纯数据安全迁移。

#### 设计要求

以下接口方向是 Batch 3 的权威 API 契约，应与 `docs/superpowers/plans/2026-05-24-architecture-next-batches.md` 保持一致：

```js
export function getLevelConfig(level) {}
export function createItemSpec({ type, size, level, rng, marketMultipliers, levelValueMultiplier, dda }) {}
export function generateLevelData({ level, runSeed, viewport, mode, ddaRating, extraBags }) {}
```

`generateLevelData()` 应返回数据，由 `game.js` 的 adapter 应用到现有状态；它不应直接访问 DOM、Canvas、Audio 或 overlay UI。

#### 验收标准

- 关卡生成可单独测试。
- `GameState` 更新由调用方完成。
- 固定 seed 布局稳定。

### Phase 4 / Batch 4：State And Command Boundary

状态：第一阶段已完成。

#### 目标

引入显式 game state 模块和 command boundary，让输入、按钮、键盘和指针事件不再分散直接修改状态。

#### 已完成第一阶段

- 创建 `src/state/commands.js`，定义 command vocabulary、command factory 和 validation。
- 创建 `src/state/selectors.js`，提供 command availability selectors。
- 创建 `src/systems/inventorySystem.js`，抽离商店购买和库存消费 helper。
- 创建 `src/state/commandDispatcher.js`，把 command 到 runtime handler 的分发规则变成可单测的纯 adapter。
- `src/runtime/moduleBridge.js` 暴露 command、selector、inventory 和 dispatcher helper。
- `game.js` 保持 runtime host，但按钮、键盘、pointer、overlay 和 shop purchase 入口已收敛到 `dispatchCommand(rawCommand)`。

#### 仍待后续阶段推进

- `createInitialState.js` 和完整 `applyCommand(state, command)` 尚未落地。
- 现有 command handler 仍会调用 `game.js` 内部副作用函数。
- 渲染、音频、主循环、HUD、FX 和完整 state ownership 尚未迁移。

#### 后续完整阶段任务

- 创建 `src/state/createInitialState.js`。
- 创建 `src/state/applyCommand.js`。
- 将更多 runtime state mutation 从 `game.js` command handlers 迁移到可测试系统模块。

#### 最终验收标准

- Keyboard、button、pointer handler 创建 command，而不是直接调用多处 gameplay 函数。
- `applyCommand(state, command)` 可单测。
- `window.advanceTime(ms)` 仍可用。

### Phase 5 / Batch 5：Event Bus For Side Effects

状态：第一阶段已完成。

#### 目标

让玩法系统输出事件，表现层消费音频、HUD bump、overlay、particle、shake、flash、market ticker 等副作用。

#### 任务

- 创建 `src/events/eventTypes.js`。
- 创建 `src/events/eventQueue.js`。
- 创建 `src/audio/audioEvents.js`。
- 创建 `src/ui/uiEvents.js`。
- 创建 `src/fx/fxEvents.js`。
- 先迁移低风险事件，再迁移高耦合事件。

#### 已完成内容

- 新增 `src/events/eventTypes.js`，定义不可变 `GameEventType`、事件创建和验证 helper。
- 新增 `src/events/eventQueue.js`，提供隐藏内部数组的 enqueue、peek、drain、clear 和 pending 检查。
- 新增 `src/audio/audioEvents.js`、`src/ui/uiEvents.js`、`src/fx/fxEvents.js`，把音频、HUD/overlay/shop 和 FX/score-pop 事件路由到 runtime handler。
- 新增 `src/runtime/eventApplication.js`，让 bridge adapter 按事件逐个应用；如果 bridge adapter 中途失败，只把后续未处理事件交给 local fallback，避免重复副作用。
- `src/runtime/moduleBridge.js` 暴露事件 primitives、queue、adapter 和 fallback helper。
- `game.js` 新增 runtime event queue、emit helpers 和 `processGameEvents()`。
- 已迁移的路径包括：开局/继续/下一关/商店购买/暂停/商店打开/失败弹层、音频开关、放钩、空钩回收、倒计时、抓取反馈、炸弹使用、炸药桶爆炸、炸药桶掉落、得分音效/飘字/粒子。
- 增加 `tests/unit/events.test.mjs`，并扩展 runtime bridge 与 source invariant 测试。

#### 验收标准

- Audio、UI 和 FX 通过事件适配器响应。
- 核心更新函数可以在测试里只检查事件。
- 现有音频开关和音乐控制仍可用。

#### 剩余边界

- 事件 handler 仍在 `game.js` 中执行，后续 UI/audio/fx adapter 拆分时可以继续外移。
- gameplay 状态 mutation 还没有迁移到纯 reducer 或系统模块。
- 渲染和 scene generation 仍然与 runtime host 强耦合，下一批应优先做 Render Layer Split。

### Phase 6 / Batch 6：Render Layer Split

状态：第一阶段已完成。

#### 目标

把绘制函数从主逻辑中移出，形成清晰渲染流水线。

#### 任务

- 创建 `render/canvasRenderer.js`。
- 迁移 `drawBackground()`。
- 迁移 `drawItem()` 和相关物品绘制函数。
- 迁移 `drawHookTrail()`（已完成）以及 `drawHook()`、`drawCarryLabel()`。
- 迁移 `drawMinerBack()`、`drawMinerFront()`、`drawWinch()`。
- 迁移 `drawFx()`。

#### 已完成内容

- 新增 `src/render/renderPipeline.js`，抽出第一阶段 render frame orchestration。
- 新增 `createPlayerRenderOrder()`，按 pivot x 排序玩家渲染顺序，避免双人模式左右遮挡顺序漂移。
- 新增 `renderFrameWithLayers()`，统一负责清屏、DPR/shake transform、图层调用顺序、flash overlay 和倒计时红色 overlay。
- `src/runtime/moduleBridge.js` 暴露 render pipeline helper。
- `game.js` 的 `render()` 现在组装 render options 和 layer callbacks，优先通过 `GoldMinerModules.renderFrameWithLayers()` 执行；bridge helper 不可用或异常时使用本地 fallback。
- 新增 `tests/unit/render-pipeline.test.mjs`，覆盖排序、图层顺序、transform/overlay、非法 overlay 输入和可选 layer。
- 扩展 source invariant 测试，防止 `render()` 回退为完整 inline layer loop。

#### 验收标准

- `render()` 只负责组装 render options、layer callbacks 和 fallback 调用。
- 第一阶段渲染模块不访问 DOM、Audio 或 gameplay mutation API。
- 单元测试通过；浏览器 canvas / 截图 smoke 已手动验证，自动化 browser smoke 脚本后续补齐。

#### 剩余边界

- 具体 `drawBackground()`、`drawItem()`、`drawHook()`、`drawMiner*()`、`drawFx()` 仍在 `game.js`。
- 背景 asset loading 和 scene generation 仍与 runtime host 耦合。
- 后续可以继续做窄批次，把 background/item/hook/miner/fx renderer 逐个外移；如果优先推进广义批次，则进入 Batch 7 的 UI/Input/Audio/Test Harness Cleanup。

### Phase 7 / Batch 7：UI、Input、Audio 和 Main Entry Cleanup

#### 目标

让 DOM 更新、输入处理和音频适配进一步独立于游戏规则，并在前置解耦完成后再处理 main entry 迁移。

#### 任务

- 创建 `ui/domRefs.js`。
- 创建 `ui/hud.js`，迁移 `updateHud()`。
- 创建 `ui/overlay.js`，迁移弹层控制。
- 创建 `ui/shop.js`，迁移商店 DOM 渲染。
- 创建 `ui/input.js`，将键盘、按钮、指针输入转换为 command。
- 清理 `audio.js` 与事件适配层之间的边界。
- 评估并执行 `src/main.js` 与 `index.html` module entry 迁移；该迁移不得提前到 Batch 3。

#### 命令模型

输入系统不应直接修改游戏状态，而是发出命令：

```js
{ type: "DROP_HOOK", player: 1 }
{ type: "DROP_HOOK", player: 2 }
{ type: "USE_BOMB" }
{ type: "TOGGLE_PAUSE" }
{ type: "RESTART" }
{ type: "BUY_ITEM", itemId: "bomb" }
```

#### 验收标准

- 输入监听集中在 `ui/input.js`。
- 游戏核心通过 command 处理用户意图。
- DOM 模块不处理碰撞或计分。
- `src/main.js` 只负责 app bootstrapping：安装 bridge、导入现有 browser host、记录 boot error。

### Phase 8 / Batch 8：Type Safety And Regression Hardening

#### 目标

给模块化后的项目建立长期类型边界、回归保护和发布验证流程。

#### 任务

- 增加 JSDoc typedef 或 `checkJs`（后续再评估；当前先使用更广的 `node --check`）。
- 增加 dependency boundary tests（已新增 `tests/unit/dependency-boundaries.test.mjs`）。
- 增加 browser smoke tests（当前先沉淀为 `docs/testing/browser-smoke.md` 手动/MCP 清单）。
- 增加或整理 `package.json` 脚本。
- 更新 README。
- 明确发布产物清单。

#### 当前实际验证命令

当前可依赖的验证命令是：

```bash
npm run verify
./macos/build.command
```

其中 `npm run verify` 包含：

- `node --check game.js`
- `node --check audio.js`
- `node --check src/**/*.js`
- `node --check tests/unit/**/*.mjs`
- `node --test tests/unit/*.test.mjs`

浏览器 smoke 暂不作为 npm 自动化脚本提供，按 `docs/testing/browser-smoke.md` 使用 in-app Browser 或 Playwright MCP 执行。

#### 未来目标脚本

以下脚本名属于未来目标，不应在当前批次文档中被当作已可用命令：

```json
{
  "scripts": {
    "dev": "python3 -m http.server 5173",
    "test": "node --test tests/unit/*.test.js",
    "test:browser": "playwright test",
    "build:macos": "./macos/build.command"
  }
}
```

#### 验收标准

- `npm run verify` 通过。
- `./macos/build.command` 能生成可运行 app。
- README 说明当前 ES module 入口需要本地静态服务器，`run.command` / `start.sh` / `start.bat` 负责启动本地服务器后打开页面。
- 如果未来新增 `test:browser` 或 `build:macos`，README 和批次验收需同步说明它们何时可用。
- README 中运行方式与实际一致。

## 7. 数据结构建议

### 7.1 GameState

```js
/**
 * @typedef {Object} GameState
 * @property {"menu"|"playing"|"shop"|"gameOver"} phase
 * @property {boolean} paused
 * @property {"single"|"double"} mode
 * @property {number} level
 * @property {number} score
 * @property {number} target
 * @property {number} timeLeft
 * @property {number} runSeed
 * @property {number} currentSeed
 * @property {Viewport} viewport
 * @property {HookState[]} hooks
 * @property {Item[]} items
 * @property {InventoryState} inventory
 * @property {DdaState} dda
 * @property {FxState} fx
 * @property {MarketDay} market
 */
```

### 7.2 HookState

```js
/**
 * @typedef {Object} HookState
 * @property {string} id
 * @property {number} player
 * @property {"swing"|"extend"|"retract"} state
 * @property {number} angle
 * @property {number} angleDir
 * @property {number} length
 * @property {number} minLength
 * @property {number} maxLength
 * @property {number|null} attachedId
 */
```

### 7.3 GameEvent

```js
/**
 * @typedef {Object} GameEvent
 * @property {string} type
 * @property {number} frame
 * @property {Object} payload
 */
```

## 8. 开发规范

### 8.1 模块规则

- `core/` 不能依赖 `ui/`、`render/`、`audio/`。
- `systems/` 可以依赖 `core/` 和 `config/`。
- `render/` 可以依赖 `core/geometry` 和 `config/colors`，但不能改 gameplay 状态。
- `ui/` 可以读取状态快照，也可以发送 command，但不能执行规则。
- `audio/` 只消费事件和维护音频状态。

### 8.2 函数规则

- 纯函数优先返回新值或状态片段。
- 有副作用的函数名称应体现动作，例如 `applyCommand`、`renderHud`、`playEventAudio`。
- 修改 `GameState` 的系统函数应集中在 `systems/`。
- 不在渲染函数里触发 gameplay 行为。

### 8.3 新增物品类型流程

新增一个物品类型时，需要依次修改：

1. `ItemType` 类型定义。
2. 关卡生成配置。
3. 物品默认属性构建。
4. 碰撞或特殊行为系统。
5. 计分规则。
6. 音频事件映射。
7. 物品渲染函数。
8. 固定 seed 测试。

## 9. 风险和回滚策略

### 9.1 风险：模块化破坏直接打开 HTML

ES Modules 在 `file://` 下可能受浏览器限制。需要尽早验证目标浏览器和 macOS WebView。

回滚策略：

- 保留旧入口分支。
- 或提供 `run.command` 启动本地 server。

### 9.2 风险：拆分期间行为漂移

关卡生成、DDA、碰撞和计分都容易因为重构改变行为。

回滚策略：

- 每个阶段先记录固定 seed 状态。
- 每迁移一个系统就跑快照测试。
- 避免同一 PR 同时做架构拆分和玩法调整。

### 9.3 风险：事件层过度设计

小游戏不需要复杂消息队列或框架。

回滚策略：

- 事件层保持简单数组。
- 不引入全局 pub/sub 框架。
- 事件只覆盖跨系统副作用，不强迫所有内部函数事件化。

### 9.4 风险：TypeScript 迁移成本过高

如果太早迁移 TypeScript，可能先陷入构建配置问题。

回滚策略：

- 第一阶段只用 JSDoc 和 `// @ts-check`。
- 等模块边界稳定后再评估 TS。

## 10. 推荐优先级

优先级从高到低：

1. 建立基线测试和 `.gitignore`。
2. 抽离纯工具、配置、DDA、关卡生成。
3. 引入事件层，先解耦音频和 FX。
4. 修正 gameplay 随机源。
5. 拆分 Canvas 渲染层。
6. 拆分 UI 和输入命令。
7. 正规化测试和打包脚本。
8. 评估 TypeScript。

## 11. 里程碑验收

### Milestone A：安全网完成

- 有基础测试命令。
- 有固定 seed 状态快照。
- 有 `.gitignore`。
- 现有游戏可运行。

### Milestone B：核心可测试

- 关卡生成、DDA、行情、碰撞可单测。
- 核心模块无 DOM 和 Canvas 依赖。
- `game.js` 明显缩小。

### Milestone C：副作用事件化

- 音频和 FX 不再由核心逻辑直接调用。
- 关键 gameplay 事件可测试。
- 固定 seed 和输入序列可复现结果。

### Milestone D：表现层模块化

- Canvas 渲染分层。
- UI 和输入独立。
- 浏览器冒烟测试覆盖主要路径。

### Milestone E：发布流程稳定

- README 更新。
- macOS 打包脚本适配新结构。
- 构建产物不污染源码目录。

## 12. 实施批次记录

### Batch 1：Architecture Foundation

计划文件：`docs/superpowers/plans/2026-05-23-architecture-foundation.md`

范围：

- 建立 `.gitignore` 和 Node 测试脚本。
- 建立固定 seed stable baseline summary fixture。
- 抽离纯 `rng`、`geometry`、`marketSystem`、`ddaSystem` 模块。
- 增加单元测试保护这些纯模块。

明确不包含：

- 不切换 `index.html` 到 ES Modules。
- 不重写 `game.js` 调用路径。
- 不拆 Canvas 渲染层。
- 不改变玩法规则。

后续风险：

- 本批抽离模块当前仅用于测试和后续集成准备；运行时仍由 `game.js` 中的旧实现驱动。
- `game.js` 与 `src/core/rng.js`、`src/core/geometry.js`、`src/systems/marketSystem.js`、`src/config/balance.js`、`src/systems/ddaSystem.js` 暂时保留重复逻辑。后续集成任务必须逐步切换运行时调用到共享模块，并移除重复定义，避免随机、几何、行情、数值、DDA 规则或行为判断在两处漂移。

### Batch 2：Runtime Module Bridge

状态：已完成。

计划文件：`docs/superpowers/plans/2026-05-24-architecture-next-batches.md`

范围：

- 新增 `src/runtime/moduleBridge.js`，统一导出 `window.GoldMinerModules` 作为 classic runtime 消费 ES Modules 的桥接命名空间。
- `game.js` 在 boot 前使用 dynamic import（动态 `import()`）加载 bridge，而不是通过 `index.html` 增加 `<script type="module">`。
- 低风险纯逻辑优先走 bridge：`geometry`、`rng`、`market`、`DDA`、`updateDdaRating`。
- `macos/build.command` 已复制 `src/` 到 App Resources，确保 macOS WebView bundle 能加载 runtime bridge 及其依赖模块。

明确保留：

- Batch 2 当时保留 `audio.js` + `game.js` classic entry；Batch 7 Task 19 后已切换为 classic `audio.js` + module `src/main.js`。
- 保留 legacy fallback，以支持 direct file launch 和 bridge 不可用时的现有运行路径。

后续风险：

- Runtime bridge 已验证低风险共享模块可被运行时消费；Batch 3 已抽离关卡与物品生成，Batch 4 第一阶段已建立 command boundary。
- `game.js` 仍保留大量状态、渲染和副作用逻辑，后续应继续事件化和渲染拆分。

### Batch 3：Level And Item Generation Extraction

状态：已完成。

计划文件：`docs/superpowers/plans/2026-05-24-level-generation-extraction.md`

目标：

- 抽离关卡配置、物品规格、价值计算和确定性摆放生成。
- 让运行时 `game.js` 通过 `GoldMinerModules.generateLevelData()` 消费纯数据生成器。
- 当时保留 classic entry、渲染、输入、HUD、音频和场景绘制在当前 runtime host；后续入口已迁移到 `src/main.js`，但 `game.js` 仍作为 imported browser host。

完成内容：

- 新增 `src/config/levels.js` 与 `src/config/items.js`。
- 新增 `src/systems/valueSystem.js`、`src/systems/itemFactory.js`、`src/systems/levelGenerator.js`。
- `src/runtime/moduleBridge.js` 暴露 `generateLevelData()` 和相关 config/value/item helpers。
- `game.js` 的 `generateLevel()` 优先应用 `generateLevelData()` 返回的数据，legacy body 保留为 fallback。
- 固定 seed + 固定 viewport 的纯单元测试覆盖了首关 target/time/market/DDA/item 摘要。
- 高等级固定 seed 测试覆盖了第 4 关后的价值倍率分支和第 5 关后的 mouse 分支。
- 运行时接入增加 bridge generator 失败时的 legacy fallback，避免桥接路径异常中断关卡生成。

边界：

- 未拆渲染、输入、HUD、音频和 scene 生成。
- 当时未切换到 `src/main.js`；该入口迁移已在 Batch 7 Task 19 完成。
- 未删除 legacy fallback 生成逻辑。

后续风险：

- Batch 4 第一阶段已建立 state/command boundary；后续仍需要完整 state ownership 和 reducer-style mutation boundary。
- 后续测试可继续补充 dynamic import 失败和 bridge generator 失败的浏览器级集成场景。

### Batch 4：State And Command Boundary

状态：第一阶段已完成。

计划文件：`docs/superpowers/plans/2026-05-24-state-command-boundary.md`

目标：

- 建立显式 command boundary，让 UI、键盘、pointer、overlay 和 shop 入口先统一进入 command dispatcher。
- 保持 `game.js` 作为 runtime host，不在本批重写完整 state ownership、渲染、音频或主循环。

完成内容：

- 新增 `src/state/commands.js`，定义 `CommandType`、`command()`、`isCommand()`、`isCommandType()` 和 `assertCommand()`。
- 新增 `src/state/selectors.js`，提供 `canOpenModeSelect()`、`canRestart()`、`canTogglePause()`、`canFireHook()`、`canUseBomb()` 等 command availability selectors。
- 新增 `src/systems/inventorySystem.js`，抽离库存创建、计数、购买和消费 helper。
- 新增 `src/state/commandDispatcher.js`，把 command routing 和 phase guard 变成可单测的纯 adapter。
- `src/runtime/moduleBridge.js` 暴露 command、selector、inventory 和 dispatcher helper。
- `game.js` 新增 `dispatchCommand(rawCommand)`、`createRuntimeCommand()` 和 runtime command handlers；主要输入入口已改为派发 command object。
- 增加 command、selector、inventory、dispatcher、runtime bridge 和 source invariant 单元测试。

边界：

- 未迁移完整 `GameState` 初始化模块。
- 未实现完整 reducer-style `applyCommand(state, command)`。
- 未拆渲染、音频、HUD、overlay、FX 或主循环。

后续风险：

- Batch 5 第一阶段已引入事件队列，并把选定 audio、HUD、overlay、shop、FX、炸弹、抓取、得分和倒计时副作用事件化。
- 后续仍需要把更多 state mutation 从 `game.js` 内部函数迁移到可测试系统模块。

### Batch 5：Event Bus For Side Effects

状态：第一阶段已完成。

计划文件：`docs/superpowers/plans/2026-05-24-event-bus-side-effects.md`

目标：

- 建立简单事件队列，让 selected runtime side effects 通过事件对象流转。
- 让 Audio、UI、FX 先变成薄 adapter，而不是散落在 gameplay 函数中的直接调用。
- 保持 classic `audio.js` + `game.js` entry 和 legacy fallback。

完成内容：

- 新增事件类型、事件验证、事件队列和 adapter 模块。
- 新增 bridge fallback helper，避免 bridge adapter 失败时重复应用已处理事件。
- `game.js` 中新增 runtime event queue、emit helper、drain/process helper。
- 迁移了开局、继续、下一关、商店、购买、暂停、失败、音频开关、放钩、空钩回收、倒计时、抓取、炸弹、炸药桶、得分等选定副作用。
- source invariant 测试保护 migrated gameplay functions 不回退到直接 `audioPlay()`、`spawnRing()`、`spawnBurst()`、`addScorePop()` 和直接 shake/flash 写入。

边界：

- Event queue 是第一阶段边界，不是完整 ECS 或全局事件总线。
- Runtime handler 仍留在 `game.js`，因为 UI、audio、FX 和 render adapter 还没完全拆分。
- 不是所有副作用都已迁移；渲染、scene 生成、测试钩子和部分 UI 更新仍在 runtime host 内。

后续风险：

- Batch 6 第一阶段已拆出 render frame orchestration，并用单测保护基础 orchestration；浏览器 canvas / 截图 smoke 为本批手动验证，后续需补自动化入口。
- 后续可继续拆具体 renderer modules；Batch 7 已收敛 UI/input/audio/test harness adapter 并引入 `src/main.js` entry。

### Batch 6：Render Layer Split

状态：第一阶段、hook layer orchestration follow-up 和 hook trail renderer follow-up 已完成。

计划文件：`docs/superpowers/plans/2026-05-24-render-layer-split.md`

目标：

- 把 Canvas frame orchestration 从 `game.js` 移到可测试的 render pipeline 模块。
- Batch 6 当时保留 classic entry 和具体 `draw*` 函数，避免一次性大规模视觉迁移。
- 让后续 concrete renderer extraction 有明确的调用边界。

完成内容：

- 新增 `src/render/renderPipeline.js` 和 `tests/unit/render-pipeline.test.mjs`。
- 新增 `src/render/backgroundRenderer.js` 和 `tests/unit/background-renderer.test.mjs`，把 background / plank 的优先绘制路径外移到纯 Canvas renderer。
- 新增 `src/render/itemLayerRenderer.js` 和 `tests/unit/item-layer-renderer.test.mjs`，把物品层排序、被抓物后置和重复 attached id 去重外移到纯 render 模块。
- 新增 `src/render/hookLayerRenderer.js` 和 `tests/unit/hook-layer-renderer.test.mjs`，把 `hookTrail` / `hook` / `carryLabel` 的 player layer 调度和 metadata 传递外移到纯 render 模块。
- 新增 `src/render/hookTrailRenderer.js` 和 `tests/unit/hook-trail-renderer.test.mjs`，把 hook trail glow/highlight segment 绘制外移到纯 Canvas renderer。
- `src/runtime/moduleBridge.js` 暴露 `createPlayerRenderOrder()` 和 `renderFrameWithLayers()`。
- `src/runtime/moduleBridge.js` 暴露 `drawBackgroundLayer()` 和 `drawPlankLayer()`。
- `src/runtime/moduleBridge.js` 暴露 `createItemRenderOrder()` 和 `drawItemsLayer()`。
- `src/runtime/moduleBridge.js` 暴露 `drawHookPlayerLayer()` 和 `createHookLayerHandlers()`。
- `src/runtime/moduleBridge.js` 暴露 `drawHookTrailLayer()`。
- `game.js` 新增 `createRenderPlayers()`、`renderLayerHandlers()` 和 `renderFrameWithLocalLayers()`。
- `render()` 优先走 bridge render pipeline，失败时记录 `window.__goldMinerRenderPipelineError` 并回退本地 pipeline。
- `drawBackground()` 和 `drawPlank()` 现在是 runtime wrapper，优先走 bridge renderer；异常时一次性熔断并回退本地绘制。
- `drawItems()` 现在是 runtime wrapper，优先走 bridge item layer；异常时一次性熔断并回退本地排序。`drawItem()` 仍留在 `game.js`。
- `drawHookTrail()` 现在是 runtime wrapper，优先走 bridge hook trail renderer；异常时一次性熔断并回退本地绘制。hook trail 点生成、attached item lookup 和颜色选择仍留在 `game.js`。
- 测试补充 duplicate bridge import 兼容、render overlay 输入校验和 source invariant 防回退。

边界：

- 本批已迁移 background / plank、item layer、hook player layer orchestration 和 hook trail renderer；具体 `drawItem()` 几何、`drawHook()` / `drawCarryLabel()` 几何、miner、winch 和 FX 绘制仍在 `game.js`。
- Render pipeline 仍通过 layer callbacks 调用 runtime wrapper。
- Batch 6 当时未切换到 `src/main.js`，未重构 asset loading；Batch 7 Task 19 已完成入口迁移，但 asset loading 仍未重构。

后续风险：

- 继续拆 renderer 时必须每次做浏览器截图烟测。
- 具体渲染模块外移前，`game.js` 仍是视觉实现的大头。

## 13. 完成定义

本次架构优化完成时，应满足以下条件：

- `game.js` 不再是主要单体文件，职责被拆分到清晰模块。
- 核心 gameplay 系统可以在无 Canvas、无 Audio、无 DOM 的环境下测试。
- 关键系统通过事件连接表现层。
- 固定 seed 下的关卡和 gameplay 结果可复现。
- 有最小但有效的自动化测试。
- macOS 打包仍可用。
- README 反映新的运行、测试和打包方式。
- 没有为了架构优化而改变玩法规则。

## 14. 2026-05-25 当前执行状态

本轮“剩余任务一次性执行”已完成以下架构收口：

- `index.html` 入口已迁移为 classic `audio.js` + module `src/main.js`。
- `src/main.js` 只负责安装 runtime bridge、导入现有 `game.js` browser host、记录 boot error。
- `run.command`、`start.sh`、`start.bat` 改为启动本地静态服务器后打开页面，避免 `file://` module 限制。
- `src/runtime/moduleBridge.js` 公开面已收紧并由精确白名单测试保护。
- UI、input、audio、debug API、state kernel、scene/render snapshot、多个 render/system 边界已拆到 `src/` 并通过单元测试覆盖。
- `npm run verify` 已扩展为语法检查 `game.js`、`audio.js`、`src/**/*.js`、`tests/unit/**/*.mjs`，再运行 Node 单元测试。
- 新增 dependency boundary 测试，防止核心模块反向依赖 UI/render/audio/runtime/testing 等外层模块。
- 浏览器 smoke 已形成 `docs/testing/browser-smoke.md` 清单，并提供 `window.__goldMinerSmoke.enterShop({ score })` 作为可重复商店购买前置条件。

刻意延期的工作：

- `audio.js` 仍是 classic WebAudio facade，尚未模块化。
- `game.js` 仍作为 browser host 存在，继续承载部分 DOM listener、碰撞 glue、具体流程编排、asset loading 和剩余 fallback。
- 浏览器 smoke 目前是手动/MCP 清单，不是 `npm run test:browser` 自动脚本。
- TypeScript / `checkJs` 尚未引入；当前优先使用更广的 `node --check`、JSDoc 约定和边界测试控制 churn。
- 更细的宿主级 bridge failure 行为测试仍可继续补，但当前已有 source invariant、adapter 单测和最终 smoke 保护主要路径。
