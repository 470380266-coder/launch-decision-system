import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class CreateBomItemDto {
  @IsString()
  materialId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  unitUsage!: number;

  @IsBoolean()
  isSharedMaterial!: boolean;
}

export class CreateBomVersionDto {
  @IsString()
  productId!: string;

  @IsString()
  versionNo!: string;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsBoolean()
  activate?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateBomItemDto)
  items!: CreateBomItemDto[];
}
