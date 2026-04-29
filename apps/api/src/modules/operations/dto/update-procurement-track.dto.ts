import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  ProcurementOrderStatus,
  ProcurementProductionStatus,
} from '@prisma/client';

export class UpdateProcurementTrackDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  orderedQty?: number;

  @IsOptional()
  @IsEnum(ProcurementOrderStatus)
  orderStatus?: ProcurementOrderStatus;

  @IsOptional()
  @IsEnum(ProcurementProductionStatus)
  productionStatus?: ProcurementProductionStatus;

  @IsOptional()
  @IsDateString()
  expectedShipAt?: string | null;

  @IsOptional()
  @IsDateString()
  inTransitAt?: string | null;

  @IsOptional()
  @IsDateString()
  expectedArriveAt?: string | null;

  @IsOptional()
  @IsDateString()
  nextFollowUpAt?: string | null;

  @IsOptional()
  @IsString()
  todoNote?: string | null;

  @IsOptional()
  @IsString()
  note?: string | null;
}
