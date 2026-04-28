import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateAllocationDto {
  @IsString()
  receiptBatchId!: string;

  @IsString()
  productionBatchId!: string;

  @IsInt()
  @Min(1)
  allocatedQty!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
