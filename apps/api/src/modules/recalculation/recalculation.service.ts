import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  CalcRunStatus,
  ProductState,
  ProductionBatchStatus,
  RunType,
  StockingRequestStatus,
} from '@prisma/client';
import { PrismaService } from '../shared/prisma.service';

type ProductMaterialCapacity = {
  materialName: string;
  capacity: number;
  limiting: boolean;
};

type CandidateBatchPlan = {
  plannedQty: number;
  nonSharedCapacities: ProductMaterialCapacity[];
};

@Injectable()
export class RecalculationService {
  private readonly logger = new Logger(RecalculationService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async runScheduled() {
    await this.run(RunType.SCHEDULED);
  }

  async run(runType: RunType) {
    const run = await this.prisma.calcRun.create({
      data: {
        runType,
        status: CalcRunStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    try {
      const products = await this.prisma.product.findMany({
        include: {
          bomVersions: {
            where: { isActive: true },
            include: {
              items: {
                include: {
                  material: true,
                },
              },
            },
          },
          productionBatches: true,
        },
      });

      for (const product of products) {
        const activeBom = product.bomVersions[0];

        if (!activeBom) {
          await this.writeSnapshot(run.id, product.id, {
            stockingRequestId: null,
            launchableQtyNow: 0,
            launchableQtyShortTerm: 0,
            roundLaunchQty: 0,
            allocatedLaunchQty: 0,
            remainingAllocatableQty: 0,
            productState: ProductState.BLOCKED,
            nextLaunchDate: null,
            reasonSummary: '缺少当前生效的 BOM',
          });
          continue;
        }

        const currentStockingRequest = await this.prisma.stockingRequest.findFirst({
          where: {
            productId: product.id,
            bomVersionId: activeBom.id,
            status: {
              not: StockingRequestStatus.CANCELLED,
            },
          },
          include: {
            launchAllocations: true,
            productionBatches: {
              include: {
                actual: true,
              },
            },
          },
          orderBy: {
            requestedAt: 'desc',
          },
        });

        if (!currentStockingRequest) {
          await this.writeSnapshot(run.id, product.id, {
            stockingRequestId: null,
            launchableQtyNow: 0,
            launchableQtyShortTerm: 0,
            roundLaunchQty: 0,
            allocatedLaunchQty: 0,
            remainingAllocatableQty: 0,
            productState: ProductState.BLOCKED,
            nextLaunchDate: null,
            reasonSummary: '暂无本轮备货任务',
          });
          continue;
        }

        const roundLaunchQty = currentStockingRequest.productionBatches.reduce(
          (sum, batch) =>
            batch.batchStatus === ProductionBatchStatus.COMPLETED
              ? sum + (batch.actual?.actualLaunchQty ?? 0)
              : sum,
          0,
        );
        const allocatedLaunchQty = currentStockingRequest.launchAllocations.reduce(
          (sum, allocation) => sum + allocation.allocatedQty,
          0,
        );
        const remainingAllocatableQty = Math.max(roundLaunchQty - allocatedLaunchQty, 0);
        const targetGapQty = Math.max(
          currentStockingRequest.targetFinishedQty - roundLaunchQty,
          0,
        );

        if (roundLaunchQty > 0) {
          const productState =
            remainingAllocatableQty > 0
              ? ProductState.LAUNCHABLE
              : targetGapQty <= 0
                ? ProductState.COMPLETED
                : currentStockingRequest.status === StockingRequestStatus.SHORT_CLOSED
                  ? ProductState.SHORT_CLOSED
                  : ProductState.TARGET_SHORTFALL;

          await this.writeSnapshot(run.id, product.id, {
            stockingRequestId: currentStockingRequest.id,
            launchableQtyNow: remainingAllocatableQty,
            launchableQtyShortTerm: 0,
            roundLaunchQty,
            allocatedLaunchQty,
            remainingAllocatableQty,
            productState,
            nextLaunchDate: null,
            reasonSummary:
              remainingAllocatableQty > 0
                ? `本轮备货 ${currentStockingRequest.requestNo} 剩余可分配上架量 ${remainingAllocatableQty}`
                : targetGapQty <= 0
                  ? `本轮备货 ${currentStockingRequest.requestNo} 目标达成并已分配完`
                  : currentStockingRequest.status === StockingRequestStatus.SHORT_CLOSED
                    ? `本轮备货 ${currentStockingRequest.requestNo} 短缺完结，目标缺口 ${targetGapQty}`
                    : `本轮备货 ${currentStockingRequest.requestNo} 已分配完但目标未达成，目标缺口 ${targetGapQty}`,
          });
          continue;
        }

        const batchPlan = await this.calculateCandidateBatchPlan(
          product.id,
          currentStockingRequest.id,
          product.minStartQty,
          activeBom.items,
        );
        const plannedQty = batchPlan.plannedQty;

        const limitingMaterials = batchPlan.nonSharedCapacities
          .filter((item) => item.limiting)
          .map((item) => item.materialName);

        if (plannedQty < product.minStartQty) {
          await this.writeSnapshot(run.id, product.id, {
            stockingRequestId: currentStockingRequest.id,
            launchableQtyNow: 0,
            launchableQtyShortTerm: 0,
            roundLaunchQty,
            allocatedLaunchQty,
            remainingAllocatableQty,
            productState: plannedQty > 0 ? ProductState.SCHEDULABLE : ProductState.BLOCKED,
            nextLaunchDate: null,
            reasonSummary:
              plannedQty > 0
                ? `齐套量 ${plannedQty}，未达到最低开工门槛 ${product.minStartQty}`
                : `缺少可用非共用料，当前瓶颈：${
                    limitingMaterials.join('、') || '待补料'
                  }`,
          });
          continue;
        }

        const now = new Date();
        const predictedFinishDate = addDays(now, product.standardProductionDays);
        const predictedLaunchDate = addDays(
          predictedFinishDate,
          product.bufferDays,
        );

        const batch = await this.ensurePredictedBatch({
          productId: product.id,
          bomVersionId: activeBom.id,
          stockingRequestId: currentStockingRequest.id,
          runId: run.id,
          plannedQty,
          predictedStartDate: now,
          predictedFinishDate,
          predictedLaunchDate,
          blockingReason: null,
        });
        const batchWithSharedReason = await this.syncSharedMaterialBlockingReason(
          batch.id,
          activeBom.items,
          plannedQty,
        );
        const hasSharedMaterialBlock = Boolean(batchWithSharedReason.blockingReason);

        const shortTermWindowDays = Number(
          process.env.SHORT_TERM_WINDOW_DAYS ?? product.shortWindowDays ?? 7,
        );
        const shortTermEnd = addDays(now, shortTermWindowDays);
        const shortTermIncrement = await this.prisma.productionBatch.aggregate({
          where: {
            productId: product.id,
            stockingRequestId: currentStockingRequest.id,
            batchStatus: {
              in: [ProductionBatchStatus.PENDING, ProductionBatchStatus.COMPLETED],
            },
            predictedLaunchDate: {
              gt: now,
              lte: shortTermEnd,
            },
            blockingReason: null,
          },
          _sum: {
            plannedQty: true,
          },
        });

        await this.writeSnapshot(run.id, product.id, {
          stockingRequestId: currentStockingRequest.id,
          launchableQtyNow: remainingAllocatableQty,
          launchableQtyShortTerm: shortTermIncrement._sum.plannedQty ?? 0,
          roundLaunchQty,
          allocatedLaunchQty,
          remainingAllocatableQty,
          productState:
            remainingAllocatableQty > 0
              ? ProductState.LAUNCHABLE
              : hasSharedMaterialBlock
                ? ProductState.BLOCKED
              : ProductState.SCHEDULABLE,
          nextLaunchDate: hasSharedMaterialBlock
            ? null
            : batchWithSharedReason.predictedLaunchDate,
          reasonSummary:
            batchWithSharedReason.blockingReason ??
            `已形成待生产批次 ${batchWithSharedReason.batchNo}，预计可上架`,
        });
      }

      await this.prisma.calcRun.update({
        where: { id: run.id },
        data: {
          status: CalcRunStatus.SUCCESS,
          finishedAt: new Date(),
        },
      });

      return { runId: run.id, status: 'success' };
    } catch (error) {
      this.logger.error(error);
      await this.prisma.calcRun.update({
        where: { id: run.id },
        data: {
          status: CalcRunStatus.FAILED,
          finishedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  private async calculateCandidateBatchPlan(
    productId: string,
    stockingRequestId: string,
    minimumCandidateQty: number,
    bomItems: Array<{
      materialId: string;
      unitUsage: number;
      isSharedMaterial: boolean;
      material: { materialName: string };
    }>,
  ): Promise<CandidateBatchPlan> {
    const nonSharedItems = bomItems.filter((item) => !item.isSharedMaterial);

    if (!nonSharedItems.length) {
      return {
        plannedQty: bomItems.length ? minimumCandidateQty : 0,
        nonSharedCapacities: [],
      };
    }

    const capacities: ProductMaterialCapacity[] = [];

    for (const item of nonSharedItems) {
      const link = await this.prisma.receiptBatchLink.aggregate({
        where: {
          productId,
          receiptBatch: {
            materialId: item.materialId,
            materialFollowUp: {
              stockingRequestId,
            },
          },
        },
        _sum: {
          linkedQty: true,
        },
      });
      const availableQty = link._sum.linkedQty ?? 0;

      capacities.push({
        materialName: item.material.materialName,
        capacity: Math.floor(availableQty / item.unitUsage),
        limiting: Math.floor(availableQty / item.unitUsage) < minimumCandidateQty,
      });
    }

    return {
      plannedQty: Math.min(...capacities.map((item) => item.capacity)),
      nonSharedCapacities: capacities,
    };
  }

  private async syncSharedMaterialBlockingReason(
    batchId: string,
    bomItems: Array<{
      materialId: string;
      unitUsage: number;
      isSharedMaterial: boolean;
      material: { materialName: string };
    }>,
    plannedQty: number,
  ) {
    const sharedItems = bomItems.filter((item) => item.isSharedMaterial);

    if (!sharedItems.length) {
      return this.prisma.productionBatch.update({
        where: { id: batchId },
        data: { blockingReason: null },
      });
    }

    const allocations = await this.prisma.sharedMaterialAllocation.findMany({
      where: {
        productionBatchId: batchId,
      },
      include: {
        receiptBatch: {
          select: {
            materialId: true,
          },
        },
      },
    });
    const allocatedByMaterialId = new Map<string, number>();
    allocations.forEach((allocation) => {
      const materialId = allocation.receiptBatch.materialId;
      allocatedByMaterialId.set(
        materialId,
        (allocatedByMaterialId.get(materialId) ?? 0) + allocation.allocatedQty,
      );
    });

    const gaps = sharedItems
      .map((item) => {
        const requiredQty = item.unitUsage * plannedQty;
        const allocatedQty = allocatedByMaterialId.get(item.materialId) ?? 0;

        return {
          materialName: item.material.materialName,
          remainingQty: Math.max(requiredQty - allocatedQty, 0),
        };
      })
      .filter((item) => item.remainingQty > 0);

    return this.prisma.productionBatch.update({
      where: { id: batchId },
      data: {
        blockingReason: gaps.length
          ? `待分配共用料：${gaps
              .map((item) => `${item.materialName}缺${item.remainingQty}`)
              .join('、')}`
          : null,
      },
    });
  }

  private async ensurePredictedBatch(input: {
    productId: string;
    bomVersionId: string;
    stockingRequestId: string;
    runId: string;
    plannedQty: number;
    predictedStartDate: Date;
    predictedFinishDate: Date;
    predictedLaunchDate: Date;
    blockingReason: string | null;
  }) {
    const existingPending = await this.prisma.productionBatch.findFirst({
      where: {
        productId: input.productId,
        stockingRequestId: input.stockingRequestId,
        batchStatus: ProductionBatchStatus.PENDING,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (existingPending) {
      return this.prisma.productionBatch.update({
        where: { id: existingPending.id },
        data: {
          bomVersionId: input.bomVersionId,
          stockingRequestId: input.stockingRequestId,
          plannedQty: input.plannedQty,
          predictedStartDate: input.predictedStartDate,
          predictedFinishDate: input.predictedFinishDate,
          predictedLaunchDate: input.predictedLaunchDate,
          blockingReason: input.blockingReason,
          generatedByRunId: input.runId,
        },
      });
    }

    const sequence = await this.prisma.productionBatch.count({
      where: {
        productId: input.productId,
      },
    });

    return this.prisma.productionBatch.create({
      data: {
        productId: input.productId,
        bomVersionId: input.bomVersionId,
        stockingRequestId: input.stockingRequestId,
        batchNo: `PB-${String(sequence + 1).padStart(4, '0')}`,
        plannedQty: input.plannedQty,
        batchStatus: ProductionBatchStatus.PENDING,
        predictedStartDate: input.predictedStartDate,
        predictedFinishDate: input.predictedFinishDate,
        predictedLaunchDate: input.predictedLaunchDate,
        blockingReason: input.blockingReason,
        generatedByRunId: input.runId,
      },
    });
  }

  private async writeSnapshot(
    runId: string,
    productId: string,
    data: {
      launchableQtyNow: number;
      launchableQtyShortTerm: number;
      stockingRequestId: string | null;
      roundLaunchQty: number;
      allocatedLaunchQty: number;
      remainingAllocatableQty: number;
      productState: ProductState;
      nextLaunchDate: Date | null;
      reasonSummary: string;
    },
  ) {
    await this.prisma.productSnapshot.create({
      data: {
        calcRunId: runId,
        productId,
        ...data,
      },
    });
  }
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
