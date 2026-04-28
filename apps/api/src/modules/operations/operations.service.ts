import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductionBatchStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../shared/prisma.service';
import { CreateAllocationDto } from './dto/create-allocation.dto';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { UpdateBatchStatusDto } from './dto/update-batch-status.dto';

@Injectable()
export class OperationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getBootstrapData(user: { role: UserRole }) {
    const [materials, products, purchasers, admins, pendingBatches, sharedReceipts] =
      await Promise.all([
        this.prisma.material.findMany({
          where: { status: 'ACTIVE' },
          orderBy: { materialCode: 'asc' },
        }),
        this.prisma.product.findMany({
          where: { status: 'ACTIVE' },
          orderBy: { productCode: 'asc' },
        }),
        this.prisma.user.findMany({
          where: { role: UserRole.PURCHASER, status: 'ACTIVE' },
          orderBy: { username: 'asc' },
        }),
        this.prisma.user.findMany({
          where: { role: UserRole.ADMIN, status: 'ACTIVE' },
          orderBy: { username: 'asc' },
        }),
        this.prisma.productionBatch.findMany({
          where: {
            batchStatus: {
              in: [ProductionBatchStatus.PENDING, ProductionBatchStatus.PAUSED],
            },
          },
          include: {
            product: true,
            bomVersion: {
              include: {
                items: {
                  include: { material: true },
                },
              },
            },
            sharedAllocations: {
              include: {
                receiptBatch: true,
              },
            },
          },
          orderBy: [{ predictedLaunchDate: 'asc' }, { createdAt: 'asc' }],
        }),
        this.prisma.materialReceiptBatch.findMany({
          include: {
            material: true,
            sharedAllocations: true,
          },
          orderBy: { arrivedAt: 'desc' },
        }),
      ]);

    const sharedMaterialIds = new Set<string>();
    pendingBatches.forEach((batch) => {
      batch.bomVersion.items.forEach((item) => {
        if (item.isSharedMaterial) {
          sharedMaterialIds.add(item.materialId);
        }
      });
    });

    return {
      materials: materials.map((material) => ({
        id: material.id,
        code: material.materialCode,
        name: material.materialName,
        unit: material.unit,
      })),
      products: products.map((product) => ({
        id: product.id,
        code: product.productCode,
        name: product.productName,
      })),
      purchasers: purchasers.map((user) => ({
        id: user.id,
        name: user.name,
        username: user.username,
      })),
      admins:
        user.role === UserRole.ADMIN
          ? admins.map((admin) => ({
              id: admin.id,
              name: admin.name,
              username: admin.username,
            }))
          : [],
      pendingBatches: pendingBatches.map((batch) => {
        const allocationsByMaterialId = new Map<string, number>();
        batch.sharedAllocations.forEach((allocation) => {
          const materialId = allocation.receiptBatch.materialId;
          const current = allocationsByMaterialId.get(materialId) ?? 0;
          allocationsByMaterialId.set(materialId, current + allocation.allocatedQty);
        });

        const sharedRequirements = batch.bomVersion.items
          .filter((item) => item.isSharedMaterial)
          .map((item) => {
            const allocatedQty = allocationsByMaterialId.get(item.materialId) ?? 0;

            return {
              materialId: item.materialId,
              materialName: item.material.materialName,
              requiredQty: item.unitUsage * batch.plannedQty,
              allocatedQty,
              remainingQty: Math.max(item.unitUsage * batch.plannedQty - allocatedQty, 0),
            };
          });

        return {
          id: batch.id,
          batchNo: batch.batchNo,
          productId: batch.productId,
          productName: batch.product.productName,
          status: batch.batchStatus,
          plannedQty: batch.plannedQty,
          predictedLaunchDate: batch.predictedLaunchDate,
          blockingReason: batch.blockingReason,
          sharedRequirements,
        };
      }),
      sharedReceiptBatches: sharedReceipts
        .filter((receipt) => sharedMaterialIds.has(receipt.materialId))
        .map((receipt) => {
          const allocatedQty = receipt.sharedAllocations.reduce(
            (sum, allocation) => sum + allocation.allocatedQty,
            0,
          );

          return {
            id: receipt.id,
            batchNo: receipt.receiptBatchNo,
            materialId: receipt.materialId,
            materialName: receipt.material.materialName,
            arrivedQty: receipt.arrivedQty,
            arrivedAt: receipt.arrivedAt,
            allocatedQty,
            remainingQty: Math.max(receipt.arrivedQty - allocatedQty, 0),
          };
        }),
    };
  }

  async createReceipt(
    dto: CreateReceiptDto,
    currentUser: { id: string; role: UserRole },
  ) {
    const material = await this.prisma.material.findUnique({
      where: { id: dto.materialId },
    });

    if (!material) {
      throw new NotFoundException('Material not found');
    }

    if (
      currentUser.role !== UserRole.ADMIN &&
      currentUser.role !== UserRole.PURCHASER
    ) {
      throw new BadRequestException('Current user cannot create receipts');
    }

    const bomCandidates = await this.prisma.bomItem.findMany({
      where: {
        materialId: dto.materialId,
        bomVersion: {
          isActive: true,
        },
      },
      include: {
        bomVersion: {
          include: {
            product: true,
          },
        },
      },
    });

    const hasSharedUsage = bomCandidates.some((item) => item.isSharedMaterial);
    const nonSharedCandidates = bomCandidates.filter((item) => !item.isSharedMaterial);

    if (!hasSharedUsage && nonSharedCandidates.length > 0 && !dto.productId) {
      throw new BadRequestException('Non-shared materials require a target product');
    }

    if (dto.productId) {
      const hasMatchingNonShared = nonSharedCandidates.some(
        (item) => item.bomVersion.productId === dto.productId,
      );
      if (!hasMatchingNonShared) {
        throw new BadRequestException('Selected product does not match a non-shared BOM item');
      }
    }

    const receipt = await this.prisma.materialReceiptBatch.create({
      data: {
        materialId: dto.materialId,
        receiptBatchNo: dto.receiptBatchNo,
        arrivedQty: dto.arrivedQty,
        arrivedAt: new Date(dto.arrivedAt),
        purchaserUserId: currentUser.id,
        sourceType: dto.sourceType,
        note: dto.note,
      },
    });

    if (dto.productId) {
      await this.prisma.receiptBatchLink.create({
        data: {
          receiptBatchId: receipt.id,
          productId: dto.productId,
          linkedQty: dto.arrivedQty,
        },
      });
    }

    return {
      id: receipt.id,
      autoLinkedProductId: dto.productId ?? null,
    };
  }

  async createAllocation(
    dto: CreateAllocationDto,
    currentUser: { id: string; role: UserRole },
  ) {
    if (currentUser.role !== UserRole.ADMIN) {
      throw new BadRequestException('Current user cannot allocate shared materials');
    }

    const [receipt, batch] = await Promise.all([
      this.prisma.materialReceiptBatch.findUnique({
        where: { id: dto.receiptBatchId },
        include: {
          sharedAllocations: true,
        },
      }),
      this.prisma.productionBatch.findUnique({
        where: { id: dto.productionBatchId },
        include: {
          bomVersion: {
            include: {
              items: true,
            },
          },
          sharedAllocations: {
            include: {
              receiptBatch: true,
            },
          },
        },
      }),
    ]);

    if (!receipt) {
      throw new NotFoundException('Receipt batch not found');
    }
    if (!batch) {
      throw new NotFoundException('Production batch not found');
    }
    if (batch.batchStatus !== ProductionBatchStatus.PENDING) {
      throw new BadRequestException('Only pending batches can receive shared allocations');
    }

    const sharedRequirement = batch.bomVersion.items.find(
      (item) => item.isSharedMaterial && item.materialId === receipt.materialId,
    );
    if (!sharedRequirement) {
      throw new BadRequestException('Receipt material is not a shared BOM item for this batch');
    }

    const receiptAllocatedQty = receipt.sharedAllocations.reduce(
      (sum, allocation) => sum + allocation.allocatedQty,
      0,
    );
    const receiptRemaining = receipt.arrivedQty - receiptAllocatedQty;
    if (dto.allocatedQty > receiptRemaining) {
      throw new BadRequestException('Allocation exceeds remaining receipt quantity');
    }

    const batchAllocatedQty = batch.sharedAllocations
      .filter((allocation) => allocation.receiptBatch.materialId === receipt.materialId)
      .reduce((sum, allocation) => sum + allocation.allocatedQty, 0);
    const batchRequiredQty = sharedRequirement.unitUsage * batch.plannedQty;
    const batchRemaining = batchRequiredQty - batchAllocatedQty;
    if (dto.allocatedQty > batchRemaining) {
      throw new BadRequestException('Allocation exceeds the batch shared-material requirement');
    }

    const allocation = await this.prisma.sharedMaterialAllocation.create({
      data: {
        receiptBatchId: dto.receiptBatchId,
        productionBatchId: dto.productionBatchId,
        allocatedQty: dto.allocatedQty,
        allocatedByUserId: currentUser.id,
        allocatedAt: new Date(),
        note: dto.note,
      },
    });

    return allocation;
  }

  async updateBatchStatus(id: string, dto: UpdateBatchStatusDto) {
    const batch = await this.prisma.productionBatch.findUnique({
      where: { id },
    });

    if (!batch) {
      throw new NotFoundException('Production batch not found');
    }

    return this.prisma.productionBatch.update({
      where: { id },
      data: {
        batchStatus: dto.batchStatus,
      },
    });
  }
}
