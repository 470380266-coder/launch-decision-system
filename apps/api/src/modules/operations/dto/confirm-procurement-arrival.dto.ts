import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ConfirmProcurementArrivalDto {
  @IsString()
  receiptBatchNo!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  arrivedQty!: number;

  @IsDateString()
  arrivedAt!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
