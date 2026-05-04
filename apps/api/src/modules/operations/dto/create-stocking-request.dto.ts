import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateStockingRequestDto {
  @IsString()
  productId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  targetFinishedQty!: number;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  selectedBomItemIds!: string[];

  @IsOptional()
  @IsString()
  remark?: string;
}
