import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  CalcRunStatus,
  ProductState,
  ProductionBatchStatus,
  RunType,
} from '@prisma/client';
import { PrismaService } from '../shared/prisma.service';

type ProductMaterialCapacity = {
  materialId: string;
  materialName: string;
  capacity: number;
  limiting: boolean;
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
            launchableQtyNow: 0,
            launchableQtyShortTerm: 0,
            productState: ProductState.BLOCKED,
            nextLaunchDate: null,
            reasonSummary: '缺少当前生效的 BOM',
          });
          continue;
        }

        const capacities = await this.calculateCapacities(product.id, activeBom.items);
        const plannedQty = capacities.length
          ? Math.min(...capacities.map((item) => item.capacity))
          : 0;

        const limitingMaterials = capacities
          .filter((item) => item.limiting)
          .map((item) => item.materialName);

        if (plannedQty < product.minStartQty) {
          await this.writeSnapshot(run.id, product.id, {
            launchableQtyNow: 0,
            launchableQtyShortTerm: 0,
            productState: plannedQty > 0 ? ProductState.SCHEDULABLE : ProductState.BLOCKED,
            nextLaunchDate: null,
            reasonSummary:
              plannedQty > 0
                ? `齐套量 ${plannedQty}，未达到最低开工门槛 ${product.minStartQty}`
                : `缺少可用子料，当前瓶颈：${limitingMaterials.join('、') || '待补料'}`,
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
          runId: run.id,
          plannedQty,
          predictedStartDate: now,
          predictedFinishDate,
          predictedLaunchDate,
          blockingReason: limitingMaterials.length
            ? `当前瓶颈子料：${limitingMaterials.join('、')}`
            : null,
        });

        const launchableQtyNow = await this.prisma.productionBatch.aggregate({
          where: {
            productId: product.id,
            batchStatus: ProductionBatchStatus.COMPLETED,
          },
          _sum: {
            plannedQty: true,
          },
        });

        const shortTermWindowDays = Number(
          process.env.SHORT_TERM_WINDOW_DAYS ?? product.shortWindowDays ?? 7,
        );
        const shortTermEnd = addDays(now, shortTermWindowDays);
        const shortTermIncrement = await this.prisma.productionBatch.aggregate({
          where: {
            productId: product.id,
            batchStatus: {
              in: [ProductionBatchStatus.PENDING, ProductionBatchStatus.COMPLETED],
            },
            predictedLaunchDate: {
              gt: now,
              lte: shortTermEnd,
            },
          },
          _sum: {
            plannedQty: true,
          },
        });

        await this.writeSnapshot(run.id, product.id, {
          launchableQtyNow: launchableQtyNow._sum.plannedQty ?? 0,
          launchableQtyShortTerm: shortTermIncrement._sum.plannedQty ?? 0,
          productState:
            batch.batchStatus === ProductionBatchStatus.COMPLETED
              ? ProductState.LAUNCHABLE
              : ProductState.SCHEDULABLE,
          nextLaunchDate: batch.predictedLaunchDate,
          reasonSummary:
            batch.blockingReason ?? `已形成待生产批次 ${batch.batchNo}，预计可上架`,
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

  private async calculateCapacities(
    productId: string,
    bomItems: Array<{
      materialId: string;
      unitUsage: number;
      isSharedMaterial: boolean;
      material: { materialName: string };
    }>,
  ): Promise<ProductMaterialCapacity[]> {
    const capacities: ProductMaterialCapacity[] = [];

    for (const item of bomItems) {
      let availableQty = 0;

      if (item.isSharedMaterial) {
        const allocation = await this.prisma.sharedMaterialAllocation.aggregate({
          where: {
            productionBatch: {
              productId,
              batchStatus: ProductionBatchStatus.PENDING,
            },
            receiptBatch: {
              materialId: item.materialId,
            },
          },
          _sum: {
            allocatedQty: true,
          },
        });
        availableQty = allocation._sum.allocatedQty ?? 0;
      } else {
        const link = await this.prisma.receiptBatchLink.aggregate({
          where: {
            productId,
            receiptBatch: {
              materialId: item.materialId,
            },
          },
          _sum: {
            linkedQty: true,
          },
        });
        availableQty = link._sum.linkedQty ?? 0;
      }

      capacities.push({
        materialId: item.materialId,
        materialName: item.material.materialName,
        capacity: Math.floor(availableQty / item.unitUsage),
        limiting: availableQty === 0,
      });
    }

    return capacities;
  }

  private async ensurePredictedBatch(input: {
    productId: string;
    bomVersionId: string;
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
