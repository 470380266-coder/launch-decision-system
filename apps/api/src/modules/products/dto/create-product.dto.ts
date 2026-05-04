import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class CreateProductBomItemDto {
  @IsString()
  materialId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  unitUsage!: number;

  @IsBoolean()
  isSharedMaterial!: boolean;
}

class CreateProductBomDto {
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
  @Type(() => CreateProductBomItemDto)
  items!: CreateProductBomItemDto[];
}

export class CreateProductDto {
  @IsString()
  productCode!: string;

  @IsString()
  productName!: string;

  @IsOptional()
  @IsString()
  productSpec?: string;

  @IsString()
  unit!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  minStartQty!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  standardProductionDays!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  bufferDays!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  shortWindowDays?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateProductBomDto)
  bom?: CreateProductBomDto;
}
