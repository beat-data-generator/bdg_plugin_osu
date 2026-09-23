# osu!mania 导出插件 (bdg_plugin_osu)

**Beat Data Generator** 插件：把踩点导出为 **osu!mania** 谱面（`.osu`）。

编辑器的轨道按顺序映射到 mania 的列，每条轨道上的踩点成为该列的音符；
**同一时刻落在不同列上的踩点自动写成多押（Chord）**。面板里可填写元数据、
选择 7K / 8K / 16K 等键数，并逐条调整轨道到列的映射。

## 功能

- **导出面板**：菜单「插件 → 打开 osu!mania 导出面板」（或快捷键 `Alt+3`）。
- **表单化元数据**：Title / Artist / Creator / Version / Source / Tags / AudioFilename 等。
- **键数可选**：`4–10`、`16`、`18`，直接写入 `CircleSize`。
- **轨道 → 列映射**：每条轨道一个下拉框（可「跳过」），默认按轨道顺序自动分配；
  同列被多轨占用会在面板上给出警告。
- **多押**：不同轨道映射到不同列，同一 `timeMs` 生成多个同刻 HitObject，天然成押。
- **8K 刮盘样式**：勾选后写 `SpecialStyle:1`（左侧第一列为刮盘，对齐 IIDX 8K 习惯）。
- **隐藏轨开关**：默认不导出隐藏轨。
- 零 npm 依赖，编解码全部在 `renderer.js` 内自实现，无需构建。

## 安装

把本插件文件夹放入宿主的插件目录：

- 用户目录 `<userData>/plugins`
- 开发模式下也可放入宿主工程根目录的 `plugins/`

重启编辑器后，在设置/插件页看到 `dev.bdg.osu-export` 即加载成功。

## 使用

1. 打开导出面板（插件菜单或 `Alt+3`，也可走「导出 → 插件导出 → osu!mania 谱面 (.osu)」）。
2. 填写元数据；`AudioFilename` 默认取当前加载音频的文件名。
3. 选择键数（如 `7K` / `8K` / `16K`）。
4. 在「轨道 → 列」表里确认映射，若某条轨道不导出就设为「跳过」。
5. 点「导出 .osu」，选择保存位置。默认文件名为 `Artist - Title [Version].osu`。

> 导出的 `.osu` 需要同名音频文件才能游玩；后续可扩展为把音频一起打包成 `.osz`。

## 轨道映射与多押

默认按轨道自上而下映射到第 1、2、3… 列。示例（4 轨 → 7K）：

| 轨道 | 映射列 |
| --- | --- |
| Melody | 列 1 |
| Bass | 列 2 |
| Drums | 列 3 |
| Fx | 跳过 |

若第 1 拍 Melody 与 Bass 同时有踩点，则导出为同一时刻、不同列的两个音符，即一次双押：

```
36,192,500,1,0,0:0:0:0:
109,192,500,1,0,0:0:0:0:
```

## .osu 转换规则

参考 [QingQiz/iidx2osu](https://github.com/QingQiz/iidx2osu) 的做法：

- 文件头固定 `osu file format v14`，`Mode: 3`（mania），`SampleSet: Soft`。
- **列坐标** `x = floor((col + 0.5) * 512 / keys)`，`y` 取 192。
  例如 7K 为 `36 109 182 256 329 402 475`，8K 为 `32 96 … 480`，16K 为 `16 48 … 496`。
- **音符**：当前全部为单点（`type = 1`），时间取踩点的 `timeMs`（四舍五入到毫秒）。
- **时间点**（`[TimingPoints]`）：由工程的基准 BPM、偏移与 BPM 点经 `bpmAtBeat` / `timeOfBeat`
  换算，连续相同 BPM 自动去重，写成 uninherited（`beatLength = 60000 / bpm`）。
- `[Metadata]` / `[Difficulty]` 取自面板表单与键数。

## 目录

```text
├── manifest.json       # 插件元信息 (id: dev.bdg.osu-export)
├── main.js             # 主进程入口（提供 info 处理器，最小实现）
├── renderer.js         # 渲染侧：导出面板 + .osu 编码器
├── plugin-api.d.ts     # 宿主插件 API 类型声明
└── README.md
```

## 已知限制 / 待办

- 仅支持导出，暂不支持从 `.osu` 反向导入。
- 目前所有音符都是单点；长条（LN）需要踩点带时长信息，暂未支持。
- 未打包 `.osz`（音频随谱面一同压缩）——可借助 `main.js` 的 Node 能力扩展。
- 同一列同一时刻若被多条轨道占用会生成重叠音符；面板会警告但不会阻止导出。

## 许可

- 本插件版权归作者所有，可自行选择开源协议。
- 宿主编辑器 **Beat Data Generator** 以 **GNU GPL v3** 发布（作者 BUGJI）。
  分发本插件时建议注明与宿主的关联。
