# Bilibiliwith163 文档入口

更新时间：2026-05-25

根目录只保留当前需要维护的文档；阶段性优化清单、旧方案和对话记录放入 `history/`。

## 当前维护文档

- `ARCHITECTURE.md`：当前架构、运行流程、模块职责、文件地图、主要接口、Git 保护基线和常见修改入口。
- `TODO.md`：当前待办目标、优先级、复杂度、验收标准和推荐执行顺序。
- `WORK_HISTORY.md`：已完成工作、关键决策、验证结果和当前边界。

## 历史参考

- `history/`：保留仍有参考价值的旧优化清单和阶段记录。
- `history/OPTIMIZATION-2026-05-25.md`：由旧 `docs/OPTIMIZATION.md` 迁移而来，内容已吸收到当前 `TODO.md`。

## 阅读顺序

1. 先读 `TODO.md`，确认当前要推进的目标和优先级。
2. 再读 `ARCHITECTURE.md`，定位相关代码、接口、配置和数据流。
3. 需要确认已做过什么时读 `WORK_HISTORY.md`。
4. 只有需要追溯旧优化清单或旧方案时再查 `history/`。

## 工作流程

所有文档读取都使用显式 UTF-8。每次开始工作前先判断本轮属于哪一种情况：制定 TODO 计划，或实施代码编写。

### Git 保险流程

本项目使用本地 Git 仓库作为恢复点。文档记录负责说明任务意图、边界和验证结果；Git 提交负责提供真正可恢复的代码状态。

当前仓库基线：

```text
branch: main
baseline_commit: f82a12d chore: initialize local git baseline
user.name: Bilibiliwith163 Local
user.email: bilibiliwith163-local@example.invalid
core.autocrlf: false
remote: none
```

开始任何 TODO 前：

1. 执行 `git status --short`，确认工作区状态。
2. 如果存在未提交修改，先判断是否属于上一轮遗留或用户改动；不要覆盖、删除或回退未确认的改动。
3. 阅读 `TODO.md`、`ARCHITECTURE.md`、`WORK_HISTORY.md`，确认任务目标、入口和历史边界。
4. 在 `WORK_HISTORY.md` 写入任务开始记录，包括目标、范围、预计会修改的模块或文件、风险点和验收标准。
5. 修改文件前说明将修改什么和为什么；如果修改范围扩大，同步更新任务边界。

完成任务后：

1. 同步维护 `TODO.md`：完成的移除或改写，新增发现的问题补入合适优先级。
2. 如果接口、数据流、配置、模块职责、前端状态或运行方式变化，同步维护 `ARCHITECTURE.md`。
3. 在 `WORK_HISTORY.md` 写入完成记录，包括已改文件、关键决策、验证结果、剩余边界。
4. 执行 `git diff --check`、必要的语法检查或测试。
5. 确认改动符合预期后创建提交。

推荐提交命令：

```powershell
git status --short
git add .
git commit -m "type: concise task summary"
```

常用提交类型：

```text
feat: 新功能
fix: 修复错误
docs: 文档维护
refactor: 不改变行为的重构
test: 测试补充或测试修复
chore: 工具、配置、仓库维护
```

恢复原则：

- 优先用 `git status`、`git diff`、`git log --oneline` 判断状态。
- 未经用户明确要求，不执行 `git reset --hard`、`git checkout -- <file>` 等会丢弃改动的命令。
- 如果自动化过程因中断停止，下一轮先读 `WORK_HISTORY.md` 最近一节和 `git status`，再决定继续、提交、修复或请求用户确认。

### 制定 TODO 计划

适用场景：

- 用户要求分析问题、拆目标、整理优先级、制定路线图。
- 用户明确说“先不做代码”“先规划”“先检查文档和代码”。
- 当前信息不足以直接改代码，需要先把目标、边界和验证口径梳理清楚。

执行要求：

1. 阅读 `TODO.md`、`ARCHITECTURE.md`、`WORK_HISTORY.md`，必要时再查 `history/`。
2. 对照当前代码确认目标是否已经实现、部分实现或仍未开始。
3. 将计划写入 `TODO.md`，标清优先级、复杂度、涉及模块、验收标准和建议执行顺序。
4. 如果发现已有 TODO 已完成或已过期，同步从 `TODO.md` 中移除或改写。
5. 完成后必须写入 `WORK_HISTORY.md`，说明本次计划维护了什么、哪些结论会影响后续开发。

### 实施代码编写

适用场景：

- 用户要求修复 bug、实现功能、调整前端、修改接口或重构现有逻辑。
- `TODO.md` 中已有明确目标，且当前轮次要把目标推进到代码层面。

执行要求：

1. 先读 `TODO.md`，确认要完成的目标和验收标准。
2. 再读 `ARCHITECTURE.md`，定位相关后端服务、前端模块、数据流和接口边界。
3. 修改代码时保持变更聚焦，优先沿用现有模块和调用方式。
4. 根据变更风险进行必要验证，并在最终说明中写清验证结果或未验证原因。
5. 如果目标完成、范围变化或发现新问题，必须同步维护 `TODO.md`。
6. 如果代码变更影响架构、接口、数据流、配置、前端状态或运行方式，必须同步维护 `ARCHITECTURE.md`。
7. 每次代码工作完成后必须写入 `WORK_HISTORY.md`，记录改了什么、为什么改、验证情况和剩余边界。
