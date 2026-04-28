import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateReceiptDto {
  @IsString()
  materialId!: string;

  @IsString()
  receiptBatchNo!: string;

  @IsInt()
  @Min(1)
  arrivedQty!: number;

  @IsDateString()
  arrivedAt!: string;

  @IsString()
  sourceType!: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  productId?: string;
}
