import {
  CalcRunStatus,
  PrismaClient,
  ProcurementOrderStatus,
  ProcurementProductionStatus,
  ProductState,
  ProductionBatchStatus,
  RunType,
  UserRole,
} from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const saltRounds = 12;

const seedUsers = [
  {
    name: '系统管理员',
    username: 'admin',
    password: 'Admin@123456',
    role: UserRole.ADMIN,
  },
  {
    name: '采购A',
    username: 'purchaser_a',
    password: 'Purchaser@123456',
    role: UserRole.PURCHASER,
  },
  {
    name: '采购B',
    username: 'purchaser_b',
    password: 'PurchaserB@123456',
    role: UserRole.PURCHASER,
  },
  {
    name: '运营查看',
    username: 'operator',
    password: 'Viewer@123456',
    role: UserRole.VIEWER,
  },
] as const;

async function main() {
  await prisma.sharedMaterialAllocation.deleteMany();
  await prisma.productionBatchActual.deleteMany();
  await prisma.productSnapshot.deleteMany();
  await prisma.productionBatch.deleteMany();
  await prisma.procurementTrackReceipt.deleteMany();
  await prisma.materialProcurementTrack.deleteMany();
  await prisma.receiptBatchLink.deleteMany();
  await prisma.materialReceiptBatch.deleteMany();
  await prisma.bomItem.deleteMany();
  await prisma.bomVersion.deleteMany();
  await prisma.material.deleteMany();
  await prisma.product.deleteMany();
  await prisma.calcRun.deleteMany();
  await prisma.user.deleteMany();

  const [
    adminPasswordHash,
    purchaserPasswordHash,
    purchaserBPasswordHash,
    viewerPasswordHash,
  ] =
    await Promise.all(seedUsers.map((user) => bcrypt.hash(user.password, saltRounds)));

  const admin = await prisma.user.create({
    data: {
      name: seedUsers[0].name,
      username: seedUsers[0].username,
      passwordHash: adminPasswordHash,
      role: seedUsers[0].role,
    },
  });

  const purchaser = await prisma.user.create({
    data: {
      name: seedUsers[1].name,
      username: seedUsers[1].username,
      passwordHash: purchaserPasswordHash,
      role: seedUsers[1].role,
    },
  });

  await prisma.user.create({
    data: {
      name: seedUsers[2].name,
      username: seedUsers[2].username,
      passwordHash: purchaserBPasswordHash,
      role: seedUsers[2].role,
    },
  });

  await prisma.user.create({
    data: {
      name: seedUsers[3].name,
      username: seedUsers[3].username,
      passwordHash: viewerPasswordHash,
      role: seedUsers[3].role,
    },
  });

  const [bottle, cap, outerBox, commonSticker] = await Promise.all([
    prisma.material.create({
      data: { materialCode: 'MAT-BOTTLE', materialName: '瓶身', materialSpec: '120ml PET', unit: 'pcs' },
    }),
    prisma.material.create({
      data: { materialCode: 'MAT-CAP', materialName: '瓶盖', materialSpec: '24/410 白色', unit: 'pcs' },
    }),
    prisma.material.create({
      data: { materialCode: 'MAT-BOX', materialName: '彩盒', materialSpec: '精华水单支装', unit: 'pcs' },
    }),
    prisma.material.create({
      data: { materialCode: 'MAT-STICKER', materialName: '通用贴纸', materialSpec: '直播渠道通用', unit: 'pcs' },
    }),
  ]);

  const product = await prisma.product.create({
    data: {
      productCode: 'SKU-LIVE-001',
      productName: '直播爆品精华水',
      productSpec: '净含量 120ml',
      unit: '瓶',
      minStartQty: 100,
      standardProductionDays: 5,
      bufferDays: 2,
      shortWindowDays: 7,
    },
  });

  const bom = await prisma.bomVersion.create({
    data: {
      productId: product.id,
      versionNo: 'BOM-V1',
      effectiveFrom: new Date('2026-04-01T00:00:00.000Z'),
      isActive: true,
      items: {
        create: [
          { materialId: bottle.id, unitUsage: 1, isSharedMaterial: false },
          { materialId: cap.id, unitUsage: 1, isSharedMaterial: false },
          { materialId: outerBox.id, unitUsage: 1, isSharedMaterial: false },
          { materialId: commonSticker.id, unitUsage: 1, isSharedMaterial: true },
        ],
      },
    },
    include: {
      items: true,
    },
  });

  const [receiptBottle, receiptCap, receiptBox, receiptSticker] = await Promise.all([
    prisma.materialReceiptBatch.create({
      data: {
        materialId: bottle.id,
        receiptBatchNo: 'RB-BOTTLE-001',
        arrivedQty: 300,
        arrivedAt: new Date('2026-04-26T08:00:00.000Z'),
        purchaserUserId: purchaser.id,
        sourceType: 'PURCHASE',
      },
    }),
    prisma.materialReceiptBatch.create({
      data: {
        materialId: cap.id,
        receiptBatchNo: 'RB-CAP-001',
        arrivedQty: 260,
        arrivedAt: new Date('2026-04-26T08:00:00.000Z'),
        purchaserUserId: purchaser.id,
        sourceType: 'PURCHASE',
      },
    }),
    prisma.materialReceiptBatch.create({
      data: {
        materialId: outerBox.id,
        receiptBatchNo: 'RB-BOX-001',
        arrivedQty: 180,
        arrivedAt: new Date('2026-04-27T08:00:00.000Z'),
        purchaserUserId: purchaser.id,
        sourceType: 'PURCHASE',
      },
    }),
    prisma.materialReceiptBatch.create({
      data: {
        materialId: commonSticker.id,
        receiptBatchNo: 'RB-STICKER-001',
        arrivedQty: 150,
        arrivedAt: new Date('2026-04-27T08:00:00.000Z'),
        purchaserUserId: purchaser.id,
        sourceType: 'PURCHASE',
      },
    }),
  ]);

  const [receiptStickerExtra] = await Promise.all([
    prisma.materialReceiptBatch.create({
      data: {
        materialId: commonSticker.id,
        receiptBatchNo: 'RB-STICKER-002',
        arrivedQty: 220,
        arrivedAt: new Date('2026-04-29T09:00:00.000Z'),
        purchaserUserId: purchaser.id,
        sourceType: 'PURCHASE',
        note: '用于测试多批次共用料分配',
      },
    }),
    prisma.materialReceiptBatch.create({
      data: {
        materialId: commonSticker.id,
        receiptBatchNo: 'RB-STICKER-003',
        arrivedQty: 80,
        arrivedAt: new Date('2026-04-30T09:00:00.000Z'),
        purchaserUserId: purchaser.id,
        sourceType: 'PURCHASE',
        note: '用于测试共用料余量',
      },
    }),
  ]);

  await prisma.receiptBatchLink.createMany({
    data: [
      { receiptBatchId: receiptBottle.id, productId: product.id, linkedQty: 300 },
      { receiptBatchId: receiptCap.id, productId: product.id, linkedQty: 260 },
      { receiptBatchId: receiptBox.id, productId: product.id, linkedQty: 180 },
    ],
  });

  const trackInputs = [
    {
        productId: product.id,
        materialId: bottle.id,
        purchaserUserId: purchaser.id,
        supplier: '华东包材一厂',
        purchaseOrderNo: 'PO-BOTTLE-001',
        requiredQty: 300,
        orderedQty: 300,
        arrivedQty: 300,
        orderStatus: ProcurementOrderStatus.COMPLETED,
        productionStatus: ProcurementProductionStatus.ARRIVED,
        orderedAt: new Date('2026-04-22T08:00:00.000Z'),
        expectedShipAt: new Date('2026-04-24T08:00:00.000Z'),
        transitDays: 2,
        expectedArriveAt: new Date('2026-04-26T08:00:00.000Z'),
        actualArriveAt: new Date('2026-04-26T08:00:00.000Z'),
        receiptBatchId: receiptBottle.id,
        receiptBatchNo: receiptBottle.receiptBatchNo,
      },
      {
        productId: product.id,
        materialId: cap.id,
        purchaserUserId: purchaser.id,
        supplier: '瓶盖供应商A',
        purchaseOrderNo: 'PO-CAP-001',
        requiredQty: 260,
        orderedQty: 260,
        arrivedQty: 260,
        orderStatus: ProcurementOrderStatus.COMPLETED,
        productionStatus: ProcurementProductionStatus.ARRIVED,
        orderedAt: new Date('2026-04-22T08:00:00.000Z'),
        expectedShipAt: new Date('2026-04-24T08:00:00.000Z'),
        transitDays: 2,
        expectedArriveAt: new Date('2026-04-26T08:00:00.000Z'),
        actualArriveAt: new Date('2026-04-26T08:00:00.000Z'),
        receiptBatchId: receiptCap.id,
        receiptBatchNo: receiptCap.receiptBatchNo,
      },
      {
        productId: product.id,
        materialId: outerBox.id,
        purchaserUserId: purchaser.id,
        supplier: '彩盒彩印厂',
        purchaseOrderNo: 'PO-BOX-001',
        requiredQty: 180,
        orderedQty: 180,
        arrivedQty: 180,
        orderStatus: ProcurementOrderStatus.COMPLETED,
        productionStatus: ProcurementProductionStatus.ARRIVED,
        orderedAt: new Date('2026-04-23T08:00:00.000Z'),
        expectedShipAt: new Date('2026-04-25T08:00:00.000Z'),
        transitDays: 2,
        expectedArriveAt: new Date('2026-04-27T08:00:00.000Z'),
        actualArriveAt: new Date('2026-04-27T08:00:00.000Z'),
        receiptBatchId: receiptBox.id,
        receiptBatchNo: receiptBox.receiptBatchNo,
      },
      {
        productId: product.id,
        materialId: commonSticker.id,
        purchaserUserId: purchaser.id,
        supplier: '标签供应商',
        purchaseOrderNo: 'PO-STICKER-001',
        requiredQty: 150,
        orderedQty: 150,
        arrivedQty: 150,
        orderStatus: ProcurementOrderStatus.COMPLETED,
        productionStatus: ProcurementProductionStatus.ARRIVED,
        orderedAt: new Date('2026-04-23T08:00:00.000Z'),
        expectedShipAt: new Date('2026-04-25T08:00:00.000Z'),
        transitDays: 2,
        expectedArriveAt: new Date('2026-04-27T08:00:00.000Z'),
        actualArriveAt: new Date('2026-04-27T08:00:00.000Z'),
        receiptBatchId: receiptSticker.id,
        receiptBatchNo: receiptSticker.receiptBatchNo,
      },
  ];
  const tracks = await Promise.all(
    trackInputs.map((data) => prisma.materialProcurementTrack.create({ data })),
  );
  await prisma.procurementTrackReceipt.createMany({
    data: [
      { procurementTrackId: tracks[0].id, receiptBatchId: receiptBottle.id, arrivedQty: 300 },
      { procurementTrackId: tracks[1].id, receiptBatchId: receiptCap.id, arrivedQty: 260 },
      { procurementTrackId: tracks[2].id, receiptBatchId: receiptBox.id, arrivedQty: 180 },
      { procurementTrackId: tracks[3].id, receiptBatchId: receiptSticker.id, arrivedQty: 150 },
    ],
  });

  const run = await prisma.calcRun.create({
    data: {
      runType: RunType.MANUAL,
      startedAt: new Date('2026-04-28T01:00:00.000Z'),
      finishedAt: new Date('2026-04-28T01:01:00.000Z'),
      status: CalcRunStatus.SUCCESS,
    },
  });

  const batch = await prisma.productionBatch.create({
    data: {
      productId: product.id,
      bomVersionId: bom.id,
      batchNo: 'PB-0001',
      plannedQty: 150,
      batchStatus: ProductionBatchStatus.PENDING,
      predictedStartDate: new Date('2026-04-28T01:00:00.000Z'),
      predictedFinishDate: new Date('2026-05-03T01:00:00.000Z'),
      predictedLaunchDate: new Date('2026-05-05T01:00:00.000Z'),
      generatedByRunId: run.id,
      blockingReason: '当前瓶颈子料：通用贴纸',
    },
  });

  const [batch2] = await Promise.all([
    prisma.productionBatch.create({
      data: {
        productId: product.id,
        bomVersionId: bom.id,
        batchNo: 'PB-0002',
        plannedQty: 80,
        batchStatus: ProductionBatchStatus.PENDING,
        predictedStartDate: new Date('2026-04-30T02:00:00.000Z'),
        predictedFinishDate: new Date('2026-05-05T02:00:00.000Z'),
        predictedLaunchDate: new Date('2026-05-07T02:00:00.000Z'),
        generatedByRunId: run.id,
        blockingReason: '待分配通用贴纸',
      },
    }),
    prisma.productionBatch.create({
      data: {
        productId: product.id,
        bomVersionId: bom.id,
        batchNo: 'PB-0003',
        plannedQty: 120,
        batchStatus: ProductionBatchStatus.PAUSED,
        predictedStartDate: new Date('2026-05-01T02:00:00.000Z'),
        predictedFinishDate: new Date('2026-05-06T02:00:00.000Z'),
        predictedLaunchDate: new Date('2026-05-08T02:00:00.000Z'),
        generatedByRunId: run.id,
        blockingReason: '等待瓶盖补料确认',
      },
    }),
    prisma.productionBatch.create({
      data: {
        productId: product.id,
        bomVersionId: bom.id,
        batchNo: 'PB-0004',
        plannedQty: 200,
        batchStatus: ProductionBatchStatus.PENDING,
        predictedStartDate: new Date('2026-05-02T02:00:00.000Z'),
        predictedFinishDate: new Date('2026-05-07T02:00:00.000Z'),
        predictedLaunchDate: new Date('2026-05-09T02:00:00.000Z'),
        generatedByRunId: run.id,
        blockingReason: '大促加单批次，待确认共用料',
      },
    }),
  ]);

  await prisma.sharedMaterialAllocation.create({
    data: {
      receiptBatchId: receiptSticker.id,
      productionBatchId: batch.id,
      allocatedQty: 150,
      allocatedByUserId: admin.id,
      allocatedAt: new Date('2026-04-28T00:30:00.000Z'),
    },
  });

  await prisma.sharedMaterialAllocation.create({
    data: {
      receiptBatchId: receiptStickerExtra.id,
      productionBatchId: batch2.id,
      allocatedQty: 60,
      allocatedByUserId: admin.id,
      allocatedAt: new Date('2026-04-29T10:00:00.000Z'),
      note: '测试预分配 60',
    },
  });

  await prisma.productSnapshot.create({
    data: {
      productId: product.id,
      calcRunId: run.id,
      launchableQtyNow: 0,
      launchableQtyShortTerm: 150,
      nextLaunchDate: new Date('2026-05-05T01:00:00.000Z'),
      productState: ProductState.SCHEDULABLE,
      reasonSummary: '已形成待生产批次 PB-0001，等待生产完成',
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
