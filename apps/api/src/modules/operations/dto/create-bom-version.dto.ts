import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class CreateBomItemDto {
  @IsString()
  materialId!: string;

  @IsInt()
  @Min(1)
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
