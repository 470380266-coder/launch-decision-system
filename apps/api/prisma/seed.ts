import { PrismaClient, ProductionBatchStatus, RunType, CalcRunStatus, ProductState, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.sharedMaterialAllocation.deleteMany();
  await prisma.productionBatchActual.deleteMany();
  await prisma.productSnapshot.deleteMany();
  await prisma.productionBatch.deleteMany();
  await prisma.receiptBatchLink.deleteMany();
  await prisma.materialReceiptBatch.deleteMany();
  await prisma.bomItem.deleteMany();
  await prisma.bomVersion.deleteMany();
  await prisma.material.deleteMany();
  await prisma.product.deleteMany();
  await prisma.calcRun.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      name: '系统管理员',
      username: 'admin',
      passwordHash: 'dev-only',
      role: UserRole.ADMIN,
    },
  });

  const purchaser = await prisma.user.create({
    data: {
      name: '采购A',
      username: 'purchaser_a',
      passwordHash: 'dev-only',
      role: UserRole.PURCHASER,
    },
  });

  const [bottle, cap, outerBox, commonSticker] = await Promise.all([
    prisma.material.create({
      data: { materialCode: 'MAT-BOTTLE', materialName: '瓶身', unit: 'pcs' },
    }),
    prisma.material.create({
      data: { materialCode: 'MAT-CAP', materialName: '瓶盖', unit: 'pcs' },
    }),
    prisma.material.create({
      data: { materialCode: 'MAT-BOX', materialName: '彩盒', unit: 'pcs' },
    }),
    prisma.material.create({
      data: { materialCode: 'MAT-STICKER', materialName: '通用贴纸', unit: 'pcs' },
    }),
  ]);

  const product = await prisma.product.create({
    data: {
      productCode: 'SKU-LIVE-001',
      productName: '直播爆品精华水',
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

  await prisma.receiptBatchLink.createMany({
    data: [
      { receiptBatchId: receiptBottle.id, productId: product.id, linkedQty: 300 },
      { receiptBatchId: receiptCap.id, productId: product.id, linkedQty: 260 },
      { receiptBatchId: receiptBox.id, productId: product.id, linkedQty: 180 },
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

  await prisma.sharedMaterialAllocation.create({
    data: {
      receiptBatchId: receiptSticker.id,
      productionBatchId: batch.id,
      allocatedQty: 150,
      allocatedByUserId: admin.id,
      allocatedAt: new Date('2026-04-28T00:30:00.000Z'),
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
