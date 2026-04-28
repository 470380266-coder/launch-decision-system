import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductState, ProductionBatchStatus } from '@prisma/client';
import { PrismaService } from '../shared/prisma.service';

const productSnapshotInclude = {
  snapshots: {
    orderBy: {
      createdAt: 'desc',
    },
    take: 1,
  },
  productionBatches: {
    orderBy: {
      predictedLaunchDate: 'asc',
    },
    include: {
      sharedAllocations: {
        include: {
          receiptBatch: {
            include: {
              material: true,
            },
          },
        },
      },
      actual: true,
    },
  },
  bomVersions: {
    where: {
      isActive: true,
    },
    include: {
      items: {
        include: {
          material: true,
        },
      },
    },
  },
} satisfies Prisma.ProductInclude;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async listProducts() {
    const products = await this.prisma.product.findMany({
      include: {
        snapshots: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return products.map((product) => {
      const snapshot = product.snapshots[0];

      return {
        id: product.id,
        code: product.productCode,
        name: product.productName,
        minStartQty: product.minStartQty,
        standardProductionDays: product.standardProductionDays,
        bufferDays: product.bufferDays,
        status: snapshot?.productState ?? ProductState.BLOCKED,
        launchableQtyNow: snapshot?.launchableQtyNow ?? 0,
        shortTermIncrementQty: snapshot?.launchableQtyShortTerm ?? 0,
        nextLaunchDate: snapshot?.nextLaunchDate ?? null,
        reasonSummary: snapshot?.reasonSummary ?? '等待首轮重算结果',
      };
    });
  }

  async getProductDetail(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: productSnapshotInclude,
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const snapshot = product.snapshots[0];
    const activeBom = product.bomVersions[0];

    return {
      id: product.id,
      code: product.productCode,
      name: product.productName,
      state: snapshot?.productState ?? ProductState.BLOCKED,
      launchableQtyNow: snapshot?.launchableQtyNow ?? 0,
      shortTermIncrementQty: snapshot?.launchableQtyShortTerm ?? 0,
      nextLaunchDate: snapshot?.nextLaunchDate ?? null,
      reasonSummary: snapshot?.reasonSummary ?? '等待首轮重算结果',
      bom: activeBom
        ? {
            version: activeBom.versionNo,
            effectiveFrom: activeBom.effectiveFrom,
            items: activeBom.items.map((item) => ({
              id: item.id,
              materialCode: item.material.materialCode,
              materialName: item.material.materialName,
              unitUsage: item.unitUsage,
              isSharedMaterial: item.isSharedMaterial,
            })),
          }
        : null,
      productionBatches: product.productionBatches.map((batch) => ({
        id: batch.id,
        batchNo: batch.batchNo,
        plannedQty: batch.plannedQty,
        status: batch.batchStatus,
        predictedStartDate: batch.predictedStartDate,
        predictedFinishDate: batch.predictedFinishDate,
        predictedLaunchDate: batch.predictedLaunchDate,
        blockingReason: batch.blockingReason,
        actual: batch.actual
          ? {
              startAt: batch.actual.actualStartAt,
              finishAt: batch.actual.actualFinishAt,
              launchAt: batch.actual.actualLaunchAt,
              launchQty: batch.actual.actualLaunchQty,
            }
          : null,
        sharedAllocations: batch.sharedAllocations.map((allocation) => ({
          id: allocation.id,
          materialName: allocation.receiptBatch.material.materialName,
          allocatedQty: allocation.allocatedQty,
          arrivedAt: allocation.receiptBatch.arrivedAt,
        })),
      })),
      blockedBatches: product.productionBatches
        .filter(
          (batch) =>
            batch.batchStatus === ProductionBatchStatus.PENDING &&
            batch.blockingReason,
        )
        .map((batch) => ({
          id: batch.id,
          batchNo: batch.batchNo,
          blockingReason: batch.blockingReason,
          predictedLaunchDate: batch.predictedLaunchDate,
        })),
    };
  }
}

