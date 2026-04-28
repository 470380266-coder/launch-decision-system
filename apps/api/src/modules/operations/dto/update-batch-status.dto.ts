import { IsEnum } from 'class-validator';
import { ProductionBatchStatus } from '@prisma/client';

export class UpdateBatchStatusDto {
  @IsEnum(ProductionBatchStatus)
  batchStatus!: ProductionBatchStatus;
}

