import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ConfirmProcurementArrivalDto {
  @IsString()
  receiptBatchNo!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  arrivedQty!: number;

  @IsDateString()
  arrivedAt!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
