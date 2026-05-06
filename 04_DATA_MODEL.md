# 04_DATA_MODEL.md
# V1 数据模型

## 一句话原则
先定对象，再定字段。

## 1. 数据模型总览
### 主对象
- Product（单品）

### 结构对象
- BomVersion（BOM 版本）
- BomItem（BOM 子项）

### 过程对象
- StockingRequest（备货需求）
- MaterialFollowUp（子料跟进记录）

### 事实对象
- MaterialReceiptBatch（到货批次）
- ActualBatchResult（实际结果）

### 决策对象
- StockingRequest（备货需求）
- SharedMaterialAllocation（共用料分配）
- ProductionBatch（生产批次）
- ProductLaunchResult（单品结果）
- LaunchAllocation（上架分配记录）

### 系统对象
- User（用户）
- RecalculationLog（重算日志）
- ChangeHistory（关键变更历史）

### StockingRequest（备货需求）
作用：管理员发起的一轮备货任务，是采购跟进、生产批次和上架分配的业务来源。

核心字段建议：
- id
- productId
- bomVersionId
- requestNo
- targetFinishedQty
- requestedByUserId
- requestedAt
- status
- remark
- createdAt
- updatedAt

计算字段建议：
- roundLaunchQty：本轮可上架量
- allocatedLaunchQty：已分配上架量
- remainingAllocatableQty：剩余可分配上架量
- targetGapQty：目标缺口

计算说明：
- roundLaunchQty = 当前 StockingRequest 下已完成批次的 ActualBatchResult.actualLaunchQty 合计
- allocatedLaunchQty = 当前 StockingRequest 下 LaunchAllocation.allocatedQty 合计
- remainingAllocatableQty = roundLaunchQty - allocatedLaunchQty
- targetGapQty = targetFinishedQty - roundLaunchQty

状态建议：
- 待跟进
- 跟进中
- 部分到货
- 可生产
- 生产中
- 已可上架
- 可分配
- 已分配完但目标未达成
- 目标达成
- 正常完结
- 短缺完结
- 已取消


## 2. 各对象定义
### 2.1 Product（单品）
核心字段建议：
- id
- code
- name
- status
- minStartQty
- standardProductionDays
- bufferDays
- createdAt
- updatedAt

### 2.2 BomVersion（BOM 版本）
核心字段建议：
- id
- productId
- versionNo
- isActive
- effectiveAt
- remark
- createdAt
- updatedAt

### 2.3 BomItem（BOM 子项）
核心字段建议：
- id
- bomVersionId
- materialCode
- materialName
- unit
- unitUsage
- isSharedMaterial
- sortOrder
- createdAt
- updatedAt

### 2.4 MaterialFollowUp（子料跟进记录）
作用：采购工作台主对象，由备货需求生成，采购只负责跟进。

核心字段建议：
- id
- stockingRequestId
- productId
- bomVersionId
- bomItemId
- purchaserUserId
- requiredQty
- orderStatus
- productionStatus
- expectedShipAt
- inTransitAt
- expectedArriveAt
- todoNote
- nextFollowUpAt
- status
- createdAt
- updatedAt
- actualOrderQty
- isPartialPurchase
- partialPurchaseReason

字段说明：
- stockingRequestId：来源备货需求 ID
- bomVersionId：生成该跟进记录时使用的 BOM 版本
- requiredQty：按目标成品数量和 BOM 单耗计算出的子料需求数量
- stockingRequestId：该生产批次来源于哪一轮备货需求。用于计算本轮可上架量和备货任务闭环。
- requiredQty：系统根据备货目标数量和 BOM 单耗自动计算出的需求数量，采购不可修改。
- actualOrderQty：采购实际下单数量。
- isPartialPurchase：实际下单数量是否低于 requiredQty。
- partialPurchaseReason：部分采购原因。actualOrderQty < requiredQty 时必填。

### 2.5 MaterialReceiptBatch（到货批次）
作用：记录每一次到货事实
核心字段建议：
- id
- productId
- bomItemId
- materialFollowUpId
- batchNo
- receivedAt
- receivedQty
- confirmedByUserId
- isSharedMaterial
- isAllocated
- status
- createdAt
- updatedAt

### 2.6 SharedMaterialAllocation（共用料分配）
核心字段建议：
- id
- receiptBatchId
- productionBatchId
- allocatedQty
- allocatedByUserId
- allocatedAt
- remark
- createdAt
- updatedAt

### 2.7 ProductionBatch（生产批次）
核心字段建议：
- id
- productId
- batchNo
- predictedStartAt
- predictedFinishAt
- predictedLaunchAt
- predictedQty
- status
- isSystemGenerated
- createdAt
- updatedAt
- stockingRequestId

### 2.8 ProductLaunchResult（单品结果）
核心字段建议：
- id
- productId
- activeStockingRequestId
- roundLaunchQty
- allocatedLaunchQty
- remainingAllocatableQty
- shortTermIncrementQty
- nextPredictedLaunchAt
- status
- keyReason
- calculatedAt
- createdAt
- updatedAt

字段说明：
- activeStockingRequestId：当前用于运营判断的备货需求。
- roundLaunchQty：本轮可上架量。
- allocatedLaunchQty：本轮已分配上架量。
- remainingAllocatableQty：本轮剩余可分配上架量。

### 2.9 ActualBatchResult（实际结果）
核心字段建议：
- id
- productionBatchId
- actualStartAt
- actualFinishAt
- actualLaunchAt
- actualLaunchQty
- remark
- createdAt
- updatedAt

### 2.10 User（用户）
核心字段建议：
- id
- name
- email / loginName
- passwordHash
- role（ADMIN / PURCHASER / VIEWER）
- status
- createdAt
- updatedAt

### 2.11 RecalculationLog（重算日志）
核心字段建议：
- id
- startedAt
- finishedAt
- status
- affectedProductCount
- errorMessage
- createdAt

### 2.12 ChangeHistory（关键变更历史）
核心字段建议：
- id
- entityType
- entityId
- fieldName
- oldValue
- newValue
- changedByUserId
- changedAt
- reason

### 2.13 LaunchAllocation（上架分配记录）
作用：记录本轮备货形成的可上架量，被运营或管理员分配到哪里。

核心字段建议：
- id
- stockingRequestId
- productId
- allocatedQty
- allocationTarget
- allocatedByUserId
- allocatedAt
- remark
- createdAt
- updatedAt

字段说明：
- stockingRequestId：本次分配对应的备货需求。
- allocatedQty：本次分配数量。
- allocationTarget：分配去向，可填写直播间、活动、渠道或其他说明。

## 3. 关系图（文字版）
Product
→ BomVersion
→ BomItem
→ MaterialFollowUp
→ MaterialReceiptBatch
→ SharedMaterialAllocation
→ ProductionBatch
→ ProductLaunchResult
→ ActualBatchResult

## 4. 角色对对象的操作权限
| 对象 | 管理员 | 采购 | 运营 |
|---|---|---|---|
| Product | 可维护 | 不可 | 只读或不可见 |
| BomVersion / BomItem | 可维护 | 不可 | 不可 |
| MaterialFollowUp | 可校正 | 可维护 | 不可 |
| MaterialReceiptBatch | 可校正 | 可确认生成 | 不可 |
| SharedMaterialAllocation | 可维护 | 不可 | 不可 |
| ProductionBatch | 可调状态 | 不可 | 只读摘要 |
| ProductLaunchResult | 只读 | 只读 | 只读 |
| ActualBatchResult | 可回填 | 不可 | 不可 |

