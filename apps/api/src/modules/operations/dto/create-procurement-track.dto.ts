import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateProcurementTrackDto {
  @IsString()
  productId!: string;

  @IsString()
  materialId!: string;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsString()
  purchaseOrderNo?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  requiredQty!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  orderedQty!: number;

  @IsOptional()
  @IsDateString()
  orderedAt?: string;

  @IsOptional()
  @IsDateString()
  expectedShipAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  transitDays?: number;

  @IsOptional()
  @IsDateString()
  expectedArriveAt?: string;

  @IsOptional()
  @IsDateString()
  nextFollowUpAt?: string;

  @IsOptional()
  @IsString()
  todoNote?: string;

  @IsOptional()
  @IsString()
  exceptionNote?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
