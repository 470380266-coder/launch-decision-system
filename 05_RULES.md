# 05_RULES.md
# V1 规则定义

## 一句话原则
不要写模糊中文。每条规则都要写清输入、判断条件、输出。

## 1. 预测总体原则
### 规则 1：系统是规则算法，不是 Agent 预测
输入：
- 单品配置
- 当前生效 BOM
- 到货批次
- 分配结果
- 批次状态
判断：
- 基于确定性规则计算
- 不依赖 AI 主导预测
输出：
- 可重复、可解释的预测结果

## 2. BOM 规则
### 规则 2：预测只使用当前生效 BOM 版本
输入：单品的多个 BOM 版本
判断：只读取当前 isActive = true 的 BOM 版本
输出：当前预测所使用的唯一 BOM 版本

## 3. 子料归属规则
### 规则 3：非共用子料自动归属
输入：到货批次、BomItem.isSharedMaterial = false
判断：系统自动归属到对应单品 / 待生产批次
输出：可直接参与预测的可用子料数量

### 规则 4：共用子料必须人工分配
输入：到货批次、BomItem.isSharedMaterial = true
判断：必须存在 SharedMaterialAllocation；未分配前不参与预测
输出：只有已分配数量才可进入预测

### 规则 5：未分配共用料不得参与预测
输入：共用料到货批次、分配状态
判断：isSharedMaterial = true 且无分配记录
输出：当前批次对任何生产批次预测贡献为 0

## 4. 自动成批规则
### 规则 6：系统自动形成生产批次
输入：
- 单品当前生效 BOM
- 已可参与预测的子料数量
- 单品最低开工门槛
判断：
1. 计算当前最小齐套可生产量
2. 判断该数量是否 ≥ 单品最低开工门槛
输出：
- 若达到门槛，则生成生产批次
- 若未达到门槛，则不生成批次，继续等待

### 规则 7：最小齐套可生产量计算
输入：各 BOM 子项的可用数量、各 BOM 子项单耗
判断：
- 对每个子料计算：可用数量 / 单耗
- 取最小值作为当前最小齐套可生产量
输出：当前理论最大可齐套生产数量

### 规则 8：人工不能重组系统批次
输入：系统自动生成的生产批次
判断：管理员不得新增、合并、拆分系统批次
输出：批次结构保持系统生成逻辑，管理员只能调整状态

## 5. 批次状态规则
### 规则 9：批次状态只有 3 档
允许状态：
- 待生产
- 暂缓
- 已完成

### 规则 10：项目管理可以调整批次状态
输入：生产批次、管理员人工判断
判断：允许管理员调整批次状态，不允许改底层事实对象
输出：系统在下一次重算时，基于最新状态重算结果

## 6. 时间规则
### 规则 11：预计上架时间计算
输入：
- 生产批次形成时间 / 可开工时间
- 单品标准生产周期
- 单品缓冲时间
判断：
- predictedLaunchAt = predictedStartAt + standardProductionDays + bufferDays
输出：生产批次预计上架时间

### 规则 12：V1 不计算真实产能冲突
输入：物料可开工状态、标准生产周期
判断：不考虑产线冲突、工厂日历、插单、排队
输出：先按理想正常生产条件推算预计上架时间

### 规则 13：本轮可上架量定义
输入：
- StockingRequest
- 该 StockingRequest 下已完成的 ProductionBatch
- 对应的 ActualBatchResult.actualLaunchQty

判断：
- 只统计当前备货需求下已完成并已回填实际结果的生产批次
- 使用 actualLaunchQty，不使用 predictedQty / plannedQty

输出：
- 本轮可上架量 roundLaunchQty

### 规则 13.1：剩余可分配上架量定义
输入：
- 本轮可上架量 roundLaunchQty
- 上架分配记录 LaunchAllocation

判断：
- allocatedLaunchQty = 当前 StockingRequest 下所有 LaunchAllocation.allocatedQty 合计
- remainingAllocatableQty = roundLaunchQty - allocatedLaunchQty

输出：
- 本轮剩余可分配上架量

### 规则 13.2：备货任务完结规则
输入：
- StockingRequest
- remainingAllocatableQty

判断：
- 当 remainingAllocatableQty = 0，且本轮可上架量已全部分配完成时，该备货任务可以标记为已分配完 / 已完结

输出：
- StockingRequest.status = 已分配完 / 已完结

### 规则 13.3：本系统不做长期库存扣减
输入：
- 单品历史批次
- 历史可上架量
- 销售 / 订单 / 锁货 / 退货等外部数据

判断：
- V1.1 不接销售系统
- 不记录每日销量扣减
- 不计算单品长期库存余量
- 不把历史累计已上架量当作当前库存

输出：
- 系统只围绕每一轮 StockingRequest 计算本轮可上架量和剩余可分配上架量

### 规则 14：短期新增可上架量定义
输入：当前时间、默认短期窗口天数、未来预计可上架批次
判断：统计从现在起到默认短期窗口结束前，会新增转为可上架状态的数量
输出：短期新增可上架量

### 规则 15：单品状态按当前备货任务判定

判断建议：
- 可上架：存在进行中的 StockingRequest，且 remainingAllocatableQty > 0
- 可预排：remainingAllocatableQty = 0，且 shortTermIncrementQty > 0
- 受阻：remainingAllocatableQty = 0，且 shortTermIncrementQty = 0，并存在关键缺口
- 已分配完：当前 StockingRequest 的 remainingAllocatableQty = 0，且无继续可分配数量

### 规则 16：关键数据变更后实时重算
输入：
- 单品基础配置
- 当前生效 BOM
- 备货需求
- 子料跟进记录
- 到货批次
- 共用料分配结果
- 生产批次状态
- 实际结果回填

判断：
- 当上述关键数据发生新增、修改、确认、启用、分配、状态调整时，系统立即触发对应单品结果重算

输出：
- 更新 ProductLaunchResult
- 更新当前已可上架数量
- 更新短期新增可上架量
- 更新下一批预计上架时间
- 更新单品状态
- 更新关键原因
- 记录 RecalculationLog

### 规则 17：V1 不要求消息推送式实时刷新
输入：
- 页面展示状态
- 最新计算结果

判断：
- V1 只要求数据保存后立即完成结果重算
- 页面刷新或操作完成后应展示最新结果
- 不要求 WebSocket、长连接、主动消息推送

输出：
- 用户完成关键操作后，可以看到最新计算结果


## 9. 实际结果规则
### 规则 18：实际结果必须回填
输入：已完成或已上架的生产批次
判断：管理员需回填实际时间和数量
输出：可用于预测 vs 实际对比

### 规则 19：成功标准必须可被校验
判断：
- 时间偏差是否在 ±2 天内
- 数量偏差是否在 ±10% 内

## 10. 异常规则
### 规则 20：系统只识别异常，不处理异常
输入：到货延期、数量不足、未分配共用料、批次受阻
判断：允许在结果页或详情页中标记关键原因
输出：异常识别结果

## 11. 默认参数规则
### 规则 21：短期窗口天数是系统默认参数
输入：系统配置
判断：V1 只保留一个全局默认值，不做活动场景覆盖
输出：统一的短期窗口计算范围

## 12. 禁止性规则
### 规则 22：禁止用“总到货量”替代“可参与预测量”
判断：未分配的共用料不能直接当作可用量

### 规则 23：禁止让采购承担调度动作
判断：不允许采购做共用料分配、批次状态调整、BOM 编辑

### 规则 24：禁止将历史累计已上架量当作当前库存
判断：
- 系统不追踪每日销售、锁货、退货、库存消耗
- 因此不得将历史累计已上架量展示为当前剩余库存

输出：
- 页面必须使用“本轮可上架量”“剩余可分配上架量”等任务口径
- 禁止使用“当前库存”“长期剩余库存”等容易误导运营的文案

## 备货需求规则

### 规则：采购跟进记录必须来源于备货需求
输入：
- 管理员发起的备货需求
- 当前生效 BOM
- 目标成品数量

判断：
- 系统读取当前 isActive = true 的 BOM
- 按 BOM 子项单耗计算每个子料的需求数量
- 管理员确认后，系统生成 MaterialFollowUp

输出：
- 待采购跟进的子料跟进记录

### 规则：子料需求数量计算
输入：
- targetFinishedQty
- BomItem.unitUsage

判断：
- requiredQty = targetFinishedQty × unitUsage

输出：
- 每个 BOM 子项对应的子料需求数量

### 规则：管理员可以取消不需要生成跟进的子料
输入：
- 系统生成的子料需求预览
- 管理员人工判断

判断：
- 管理员可以取消某个子料的采购跟进生成

输出：
- 被取消的子料不生成 MaterialFollowUp
- 被确认的子料生成 MaterialFollowUp

### 规则：采购不得手工创建子料跟进记录
输入：
- 采购用户操作

判断：
- 采购只能维护已有 MaterialFollowUp
- 采购不能新增 MaterialFollowUp

输出：
- 采购只负责跟进，不负责创造需求

## 备货目标达成规则

### 规则：剩余可分配量不等于备货任务完成
输入：
- roundLaunchQty
- allocatedLaunchQty
- remainingAllocatableQty
- targetFinishedQty

判断：
- remainingAllocatableQty = 0 只代表当前已形成的可上架量已经分配完
- 不代表本轮备货目标已经达成

输出：
- 系统不得仅因 remainingAllocatableQty = 0 自动将 StockingRequest 标记为已完结

### 规则：目标缺口计算
输入：
- targetFinishedQty
- roundLaunchQty

判断：
- targetGapQty = targetFinishedQty - roundLaunchQty

输出：
- 如果 targetGapQty > 0，系统必须展示目标缺口
- 如果 targetGapQty <= 0，表示本轮备货目标已达成

### 规则：正常完结条件
输入：
- targetFinishedQty
- roundLaunchQty
- remainingAllocatableQty

判断：
- roundLaunchQty >= targetFinishedQty
- 且 remainingAllocatableQty = 0

输出：
- StockingRequest.status = 正常完结

### 规则：已分配完但目标未达成
输入：
- targetFinishedQty
- roundLaunchQty
- remainingAllocatableQty

判断：
- remainingAllocatableQty = 0
- 且 roundLaunchQty < targetFinishedQty

输出：
- StockingRequest.status = 已分配完但目标未达成
- 系统展示 targetGapQty
- 系统展示关键缺口原因
- 系统不得自动正常完结

### 规则：短缺完结
输入：
- StockingRequest
- targetGapQty
- 管理员终止动作
- 终止原因

判断：
- 当 roundLaunchQty < targetFinishedQty 时，管理员可以主动终止本轮备货
- 管理员终止时必须填写原因

输出：
- StockingRequest.status = 短缺完结
- 保留 targetGapQty 和终止原因

## 采购数量规则

### 规则：采购不得修改系统需求数量
输入：
- MaterialFollowUp.requiredQty
- 采购用户操作

判断：
- requiredQty 由系统根据备货需求和 BOM 自动生成
- 采购不得修改 requiredQty

输出：
- requiredQty 保持不变

### 规则：实际下单数量低于需求数量时必须显性标记
输入：
- requiredQty
- actualOrderQty

判断：
- 如果 actualOrderQty < requiredQty，则视为部分采购

输出：
- isPartialPurchase = true
- partialPurchaseReason 必填
- 管理员备货需求页展示该异常

### 规则：部分采购不阻断流程
输入：
- 部分采购记录
- 后续到货批次

判断：
- 部分采购允许继续跟进和到货
- 系统仍按实际到货数量参与齐套计算

输出：
- 可以形成部分生产批次
- 但 StockingRequest 仍需保留目标缺口
