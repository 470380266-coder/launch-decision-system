import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ProcurementOrderStatus,
  ProcurementProductionStatus,
  ProductionBatchStatus,
  RunType,
  UserRole,
} from '@prisma/client';
import { RecalculationService } from '../recalculation/recalculation.service';
import { PrismaService } from '../shared/prisma.service';
import { ConfirmProcurementArrivalDto } from './dto/confirm-procurement-arrival.dto';
import { CreateAllocationDto } from './dto/create-allocation.dto';
import { CreateBomVersionDto } from './dto/create-bom-version.dto';
import { CreateMaterialDto } from './dto/create-material.dto';
import { CreateProcurementTrackDto } from './dto/create-procurement-track.dto';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { CreateStockingRequestDto } from './dto/create-stocking-request.dto';
import { UpdateBatchActualDto } from './dto/update-batch-actual.dto';
import { UpdateBatchStatusDto } from './dto/update-batch-status.dto';
import { UpdateProcurementTrackDto } from './dto/update-procurement-track.dto';

@Injectable()
export class OperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recalculationService: RecalculationService,
  ) {}

  async getBootstrapData(user: { id: string; role: UserRole }) {
    const [
      materials,
      products,
      purchasers,
      admins,
      activeBoms,
      bomVersions,
      procurementTracks,
      pendingBatches,
      sharedReceipts,
    ] =
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
        this.prisma.bomVersion.findMany({
          where: { isActive: true },
          include: {
            product: true,
            items: {
              include: {
                material: true,
              },
              orderBy: {
                createdAt: 'asc',
              },
            },
          },
          orderBy: [{ product: { productCode: 'asc' } }, { versionNo: 'asc' }],
        }),
        this.prisma.bomVersion.findMany({
          include: {
            product: true,
            items: {
              include: {
                material: true,
              },
              orderBy: {
                createdAt: 'asc',
              },
            },
          },
          orderBy: [
            { product: { productCode: 'asc' } },
            { effectiveFrom: 'desc' },
            { createdAt: 'desc' },
          ],
        }),
        this.prisma.materialProcurementTrack.findMany({
          where:
            user.role === UserRole.PURCHASER
              ? { purchaserUserId: user.id }
              : undefined,
          include: {
            product: true,
            material: true,
            purchaser: true,
            stockingRequest: true,
            bomVersion: true,
            receiptBatch: true,
            receiptLinks: {
              include: {
                receiptBatch: true,
              },
              orderBy: {
                createdAt: 'desc',
              },
            },
          },
          orderBy: [
            { nextFollowUpAt: 'asc' },
            { expectedArriveAt: 'asc' },
            { updatedAt: 'desc' },
          ],
        }),
        this.prisma.productionBatch.findMany({
          where: {
            batchStatus: {
              in: [
                ProductionBatchStatus.PENDING,
                ProductionBatchStatus.PAUSED,
                ProductionBatchStatus.COMPLETED,
              ],
            },
          },
          include: {
            actual: true,
            product: {
              include: {
                receiptBatchLinks: {
                  include: {
                    receiptBatch: true,
                  },
                },
              },
            },
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
        spec: material.materialSpec,
        unit: material.unit,
      })),
      products: products.map((product) => ({
        id: product.id,
        code: product.productCode,
        name: product.productName,
        spec: product.productSpec,
        unit: product.unit,
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
      activeBoms: activeBoms.map((bom) => ({
        id: bom.id,
        productId: bom.productId,
        productCode: bom.product.productCode,
        productName: bom.product.productName,
        versionNo: bom.versionNo,
        effectiveFrom: bom.effectiveFrom,
        remark: bom.remark,
        items: bom.items.map((item) => ({
          id: item.id,
          materialId: item.materialId,
          materialCode: item.material.materialCode,
          materialName: item.material.materialName,
          materialSpec: item.material.materialSpec,
          materialUnit: item.material.unit,
          unitUsage: item.unitUsage,
          isSharedMaterial: item.isSharedMaterial,
        })),
      })),
      bomVersions: bomVersions.map((bom) => ({
        id: bom.id,
        productId: bom.productId,
        productCode: bom.product.productCode,
        productName: bom.product.productName,
        versionNo: bom.versionNo,
        effectiveFrom: bom.effectiveFrom,
        effectiveTo: bom.effectiveTo,
        isActive: bom.isActive,
        remark: bom.remark,
        itemCount: bom.items.length,
        items: bom.items.map((item) => ({
          id: item.id,
          materialId: item.materialId,
          materialCode: item.material.materialCode,
          materialName: item.material.materialName,
          materialSpec: item.material.materialSpec,
          materialUnit: item.material.unit,
          unitUsage: item.unitUsage,
          isSharedMaterial: item.isSharedMaterial,
        })),
      })),
      procurementTracks: procurementTracks.map((track) => ({
        id: track.id,
        productId: track.productId,
        productCode: track.product.productCode,
        productName: track.product.productName,
        productSpec: track.product.productSpec,
        productUnit: track.product.unit,
        materialId: track.materialId,
        materialCode: track.material.materialCode,
        materialName: track.material.materialName,
        materialSpec: track.material.materialSpec,
        materialUnit: track.material.unit,
        purchaserName: track.purchaser.name,
        supplier: track.supplier,
        purchaseOrderNo: track.purchaseOrderNo,
        requiredQty: track.requiredQty,
        orderedQty: track.orderedQty,
        arrivedQty: track.arrivedQty,
        orderStatus: track.orderStatus,
        productionStatus: track.productionStatus,
        orderedAt: track.orderedAt,
        expectedShipAt: track.expectedShipAt,
        inTransitAt: track.inTransitAt,
        transitDays: track.transitDays,
        expectedArriveAt: track.expectedArriveAt,
        actualArriveAt: track.actualArriveAt,
        receiptBatchNo: track.receiptBatchNo,
        todoNote: track.todoNote,
        nextFollowUpAt: track.nextFollowUpAt,
        exceptionNote: track.exceptionNote,
        note: track.note,
        stockingRequestId: track.stockingRequestId,
        stockingRequestNo: track.stockingRequest?.requestNo ?? null,
        bomVersionId: track.bomVersionId,
        bomVersionNo: track.bomVersion?.versionNo ?? null,
        receiptBatchId: track.receiptBatchId,
        receiptBatches: track.receiptLinks.map((link) => ({
          id: link.receiptBatchId,
          batchNo: link.receiptBatch.receiptBatchNo,
          arrivedQty: link.arrivedQty,
          arrivedAt: link.receiptBatch.arrivedAt,
          sourceType: link.receiptBatch.sourceType,
          note: link.receiptBatch.note,
        })),
      })),
      pendingBatches: pendingBatches.map((batch) => {
        const allocationsByMaterialId = new Map<string, number>();
        batch.sharedAllocations.forEach((allocation) => {
          const materialId = allocation.receiptBatch.materialId;
          const current = allocationsByMaterialId.get(materialId) ?? 0;
          allocationsByMaterialId.set(materialId, current + allocation.allocatedQty);
        });
        const linkedQtyByMaterialId = new Map<string, number>();
        batch.product.receiptBatchLinks.forEach((link) => {
          const materialId = link.receiptBatch.materialId;
          const current = linkedQtyByMaterialId.get(materialId) ?? 0;
          linkedQtyByMaterialId.set(materialId, current + link.linkedQty);
        });

        const sharedRequirements = batch.bomVersion.items
          .map((item) => {
            const allocatedQty = allocationsByMaterialId.get(item.materialId) ?? 0;
            const linkedQty = linkedQtyByMaterialId.get(item.materialId) ?? 0;

            return {
              materialId: item.materialId,
              materialName: item.material.materialName,
              materialSpec: item.material.materialSpec,
              materialUnit: item.material.unit,
              isSharedMaterial: item.isSharedMaterial,
              requiredQty: item.unitUsage * batch.plannedQty,
              allocatedQty: item.isSharedMaterial ? allocatedQty : 0,
              linkedQty: item.isSharedMaterial ? 0 : linkedQty,
              remainingQty: item.isSharedMaterial
                ? Math.max(item.unitUsage * batch.plannedQty - allocatedQty, 0)
                : 0,
              procurementTracks: procurementTracks
                .filter(
                  (track) =>
                    track.productId === batch.productId &&
                    track.materialId === item.materialId,
                )
                .map((track) => ({
                  id: track.id,
                  supplier: track.supplier,
                  purchaseOrderNo: track.purchaseOrderNo,
                  orderedQty: track.orderedQty,
                  arrivedQty: track.arrivedQty,
                  orderStatus: track.orderStatus,
                  productionStatus: track.productionStatus,
                  expectedArriveAt: track.expectedArriveAt,
                  exceptionNote: track.exceptionNote,
                })),
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
          actual: batch.actual
            ? {
                startAt: batch.actual.actualStartAt,
                finishAt: batch.actual.actualFinishAt,
                launchAt: batch.actual.actualLaunchAt,
                launchQty: batch.actual.actualLaunchQty,
              }
            : null,
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
            materialSpec: receipt.material.materialSpec,
            materialUnit: receipt.material.unit,
            arrivedQty: receipt.arrivedQty,
            arrivedAt: receipt.arrivedAt,
            allocatedQty,
            remainingQty: Math.max(receipt.arrivedQty - allocatedQty, 0),
          };
        })
        .filter((receipt) => receipt.remainingQty > 0),
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
    const targetBomItem = dto.productId
      ? nonSharedCandidates.find((item) => item.bomVersion.productId === dto.productId)
      : null;

    const receipt = await this.prisma.materialReceiptBatch.create({
      data: {
        materialId: dto.materialId,
        bomItemId: targetBomItem?.id,
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

    await this.recalculateNow();

    return {
      id: receipt.id,
      autoLinkedProductId: dto.productId ?? null,
    };
  }

  async createProcurementTrack(
    dto: CreateProcurementTrackDto,
    currentUser: { id: string; role: UserRole },
  ) {
    const [product, material] = await Promise.all([
      this.prisma.product.findUnique({ where: { id: dto.productId } }),
      this.prisma.material.findUnique({ where: { id: dto.materialId } }),
    ]);

    if (!product) {
      throw new NotFoundException('Product not found');
    }
    if (!material) {
      throw new NotFoundException('Material not found');
    }
    const bomUsage = await this.prisma.bomItem.findFirst({
      where: {
        materialId: dto.materialId,
        bomVersion: {
          productId: dto.productId,
          isActive: true,
        },
      },
    });

    return this.prisma.materialProcurementTrack.create({
      data: {
        productId: dto.productId,
        materialId: dto.materialId,
        bomItemId: bomUsage?.id,
        bomVersionId: bomUsage?.bomVersionId,
        purchaserUserId: currentUser.id,
        supplier: dto.supplier,
        purchaseOrderNo: dto.purchaseOrderNo,
        requiredQty: dto.requiredQty,
        orderedQty: dto.orderedQty,
        orderStatus:
          dto.orderedQty > 0
            ? ProcurementOrderStatus.ORDERED
            : ProcurementOrderStatus.NOT_ORDERED,
        productionStatus: ProcurementProductionStatus.NOT_STARTED,
        orderedAt: parseOptionalDate(dto.orderedAt),
        expectedShipAt: parseOptionalDate(dto.expectedShipAt),
        transitDays: dto.transitDays,
        expectedArriveAt: parseOptionalDate(dto.expectedArriveAt),
        nextFollowUpAt: parseOptionalDate(dto.nextFollowUpAt),
        todoNote: dto.todoNote,
        exceptionNote: dto.exceptionNote,
        note: dto.note,
      },
    });
  }

  async createStockingRequest(
    dto: CreateStockingRequestDto,
    currentUser: { id: string; role: UserRole },
  ) {
    const activeBom = await this.prisma.bomVersion.findFirst({
      where: {
        productId: dto.productId,
        isActive: true,
      },
      include: {
        product: true,
        items: {
          include: {
            material: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!activeBom) {
      throw new BadRequestException('当前单品没有生效 BOM，无法发起备货需求');
    }

    const selectedIds = new Set(dto.selectedBomItemIds);
    const selectedItems = activeBom.items.filter((item) => selectedIds.has(item.id));

    if (selectedItems.length !== selectedIds.size) {
      throw new BadRequestException('存在不属于当前生效 BOM 的子料');
    }

    const purchaser = await this.prisma.user.findFirst({
      where: {
        role: UserRole.PURCHASER,
        status: 'ACTIVE',
      },
      orderBy: {
        username: 'asc',
      },
    });
    const purchaserUserId = purchaser?.id ?? currentUser.id;
    const requestedAt = new Date();
    const requestNo = makeStockingRequestNo(requestedAt);

    return this.prisma.$transaction(async (tx) => {
      const stockingRequest = await tx.stockingRequest.create({
        data: {
          productId: activeBom.productId,
          bomVersionId: activeBom.id,
          requestNo,
          targetFinishedQty: dto.targetFinishedQty,
          requestedByUserId: currentUser.id,
          requestedAt,
          remark: dto.remark,
        },
      });

      await tx.materialProcurementTrack.createMany({
        data: selectedItems.map((item) => ({
          productId: activeBom.productId,
          materialId: item.materialId,
          bomItemId: item.id,
          stockingRequestId: stockingRequest.id,
          bomVersionId: activeBom.id,
          purchaserUserId,
          requiredQty: dto.targetFinishedQty * item.unitUsage,
          orderedQty: 0,
          orderStatus: ProcurementOrderStatus.NOT_ORDERED,
          productionStatus: ProcurementProductionStatus.NOT_STARTED,
          note: dto.remark,
        })),
      });

      return {
        id: stockingRequest.id,
        requestNo: stockingRequest.requestNo,
        productId: stockingRequest.productId,
        bomVersionId: stockingRequest.bomVersionId,
        createdTrackCount: selectedItems.length,
      };
    });
  }

  async updateProcurementTrack(
    id: string,
    dto: UpdateProcurementTrackDto,
    currentUser: { id: string; role: UserRole },
  ) {
    const track = await this.prisma.materialProcurementTrack.findUnique({
      where: { id },
    });

    if (!track) {
      throw new NotFoundException('Procurement track not found');
    }
    if (
      currentUser.role === UserRole.PURCHASER &&
      track.purchaserUserId !== currentUser.id
    ) {
      throw new BadRequestException('Current user cannot update this procurement track');
    }

    const nextOrderedQty = dto.orderedQty ?? track.orderedQty;

    return this.prisma.materialProcurementTrack.update({
      where: { id },
      data: {
        supplier: dto.supplier,
        purchaseOrderNo: dto.purchaseOrderNo,
        orderedQty: dto.orderedQty,
        orderStatus: deriveOrderStatus(
          track.arrivedQty,
          nextOrderedQty,
          dto.orderStatus,
        ),
        productionStatus: deriveProductionStatus(
          track.arrivedQty,
          nextOrderedQty,
          dto.productionStatus,
        ),
        orderedAt: parseOptionalDate(dto.orderedAt),
        expectedShipAt: parseOptionalDate(dto.expectedShipAt),
        inTransitAt: parseOptionalDate(dto.inTransitAt),
        transitDays: dto.transitDays,
        expectedArriveAt: parseOptionalDate(dto.expectedArriveAt),
        nextFollowUpAt: parseOptionalDate(dto.nextFollowUpAt),
        todoNote: dto.todoNote,
        exceptionNote: dto.exceptionNote,
        note: dto.note,
      },
    });
  }

  async confirmProcurementArrival(
    id: string,
    dto: ConfirmProcurementArrivalDto,
    currentUser: { id: string; role: UserRole },
  ) {
    const track = await this.prisma.materialProcurementTrack.findUnique({
      where: { id },
      include: {
        material: true,
      },
    });

    if (!track) {
      throw new NotFoundException('Procurement track not found');
    }
    if (
      currentUser.role === UserRole.PURCHASER &&
      track.purchaserUserId !== currentUser.id
    ) {
      throw new BadRequestException('Current user cannot confirm this procurement track');
    }

    const bomUsage = track.bomItemId
      ? await this.prisma.bomItem.findUnique({ where: { id: track.bomItemId } })
      : await this.prisma.bomItem.findFirst({
          where: {
            materialId: track.materialId,
            bomVersion: {
              productId: track.productId,
              isActive: true,
            },
          },
        });

    const trackUpdate = await this.prisma.$transaction(async (tx) => {
      const receipt = await tx.materialReceiptBatch.create({
        data: {
          materialId: track.materialId,
          bomItemId: bomUsage?.id,
          materialFollowUpId: track.id,
          receiptBatchNo: dto.receiptBatchNo,
          arrivedQty: dto.arrivedQty,
          arrivedAt: new Date(dto.arrivedAt),
          purchaserUserId: currentUser.id,
          sourceType: 'PURCHASE',
          note: dto.note,
        },
      });

      if (bomUsage && !bomUsage.isSharedMaterial) {
        await tx.receiptBatchLink.create({
          data: {
            receiptBatchId: receipt.id,
            productId: track.productId,
            linkedQty: dto.arrivedQty,
          },
        });
      }

      await tx.procurementTrackReceipt.create({
        data: {
          procurementTrackId: id,
          receiptBatchId: receipt.id,
          arrivedQty: dto.arrivedQty,
        },
      });

      const nextArrivedQty = track.arrivedQty + dto.arrivedQty;

      return tx.materialProcurementTrack.update({
        where: { id },
        data: {
          receiptBatchId: receipt.id,
          receiptBatchNo: dto.receiptBatchNo,
          arrivedQty: nextArrivedQty,
          actualArriveAt: new Date(dto.arrivedAt),
          productionStatus: deriveProductionStatus(
            nextArrivedQty,
            track.orderedQty,
            track.productionStatus,
          ),
          orderStatus: deriveOrderStatus(nextArrivedQty, track.orderedQty),
          note: dto.note ?? track.note,
        },
      });
    });

    await this.recalculateNow();

    return trackUpdate;
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

    await this.recalculateNow();

    return allocation;
  }

  async createBomVersion(dto: CreateBomVersionDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const materialIds = [...new Set(dto.items.map((item) => item.materialId))];
    if (materialIds.length !== dto.items.length) {
      throw new BadRequestException('BOM cannot contain duplicate materials');
    }

    const materials = await this.prisma.material.findMany({
      where: {
        id: {
          in: materialIds,
        },
        status: 'ACTIVE',
      },
    });

    if (materials.length !== materialIds.length) {
      throw new BadRequestException('BOM contains unknown or inactive materials');
    }

    const existingBomCount = await this.prisma.bomVersion.count({
      where: { productId: dto.productId },
    });
    const activate = existingBomCount === 0 || dto.activate === true;
    const effectiveFrom = new Date(dto.effectiveFrom);

    const bom = await this.prisma.$transaction(async (tx) => {
      if (activate) {
        await tx.bomVersion.updateMany({
          where: {
            productId: dto.productId,
            isActive: true,
          },
          data: {
            isActive: false,
            effectiveTo: effectiveFrom,
          },
        });
      }

      return tx.bomVersion.create({
        data: {
          productId: dto.productId,
          versionNo: dto.versionNo,
          effectiveFrom,
          isActive: activate,
          remark: dto.remark,
          items: {
            create: dto.items.map((item) => ({
              materialId: item.materialId,
              unitUsage: item.unitUsage,
              isSharedMaterial: item.isSharedMaterial,
            })),
          },
        },
        include: {
          items: {
            include: {
              material: true,
            },
          },
        },
      });
    });

    if (activate) {
      await this.recalculateNow();
    }

    return bom;
  }

  async activateBomVersion(id: string) {
    const target = await this.prisma.bomVersion.findUnique({
      where: { id },
    });

    if (!target) {
      throw new NotFoundException('BOM version not found');
    }

    const activatedAt = new Date();
    const activated = await this.prisma.$transaction(async (tx) => {
      await tx.bomVersion.updateMany({
        where: {
          productId: target.productId,
          id: { not: target.id },
          isActive: true,
        },
        data: {
          isActive: false,
          effectiveTo: activatedAt,
        },
      });

      return tx.bomVersion.update({
        where: { id: target.id },
        data: {
          isActive: true,
          effectiveTo: null,
        },
      });
    });

    await this.recalculateNow();

    return activated;
  }

  async createMaterial(dto: CreateMaterialDto) {
    const material = await this.prisma.material.create({
      data: {
        materialCode: dto.materialCode,
        materialName: dto.materialName,
        materialSpec: dto.materialSpec,
        unit: dto.unit,
      },
    });

    return {
      id: material.id,
      code: material.materialCode,
      name: material.materialName,
      spec: material.materialSpec,
      unit: material.unit,
    };
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

  async updateBatchActual(id: string, dto: UpdateBatchActualDto) {
    const batch = await this.prisma.productionBatch.findUnique({
      where: { id },
    });

    if (!batch) {
      throw new NotFoundException('Production batch not found');
    }

    const actualData = {
      actualStartAt: parseOptionalDate(dto.actualStartAt),
      actualFinishAt: parseOptionalDate(dto.actualFinishAt),
      actualLaunchAt: parseOptionalDate(dto.actualLaunchAt),
      actualLaunchQty: dto.actualLaunchQty,
    };

    return this.prisma.productionBatchActual.upsert({
      where: { productionBatchId: id },
      create: {
        productionBatchId: id,
        ...actualData,
      },
      update: actualData,
    });
  }

  private async recalculateNow() {
    await this.recalculationService.run(RunType.MANUAL);
  }
}

function parseOptionalDate(value: string | null | undefined) {
  if (value === undefined) {
    return undefined;
  }

  return value ? new Date(value) : null;
}

function makeStockingRequestNo(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  const stamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');

  return `SR-${stamp}-${date.getMilliseconds().toString().padStart(3, '0')}`;
}

function deriveOrderStatus(
  arrivedQty: number,
  orderedQty: number,
  fallback?: ProcurementOrderStatus,
) {
  if (arrivedQty <= 0) {
    return fallback;
  }

  return arrivedQty < orderedQty
    ? ProcurementOrderStatus.PARTIAL
    : ProcurementOrderStatus.COMPLETED;
}

function deriveProductionStatus(
  arrivedQty: number,
  orderedQty: number,
  fallback?: ProcurementProductionStatus,
) {
  if (orderedQty > 0 && arrivedQty >= orderedQty) {
    return ProcurementProductionStatus.ARRIVED;
  }

  if (arrivedQty > 0 && fallback === ProcurementProductionStatus.ARRIVED) {
    return ProcurementProductionStatus.SHIPPED;
  }

  return fallback;
}
