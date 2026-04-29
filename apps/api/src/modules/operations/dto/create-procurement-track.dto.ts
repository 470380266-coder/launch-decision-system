import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateProcurementTrackDto {
  @IsString()
  productId!: string;

  @IsString()
  materialId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  requiredQty!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  orderedQty!: number;

  @IsOptional()
  @IsDateString()
  expectedShipAt?: string;

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
  note?: string;
}
