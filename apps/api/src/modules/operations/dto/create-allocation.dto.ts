import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateAllocationDto {
  @IsString()
  receiptBatchId!: string;

  @IsString()
  productionBatchId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  allocatedQty!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
