import { IsOptional, IsString } from 'class-validator';

export class CreateMaterialDto {
  @IsString()
  materialCode!: string;

  @IsString()
  materialName!: string;

  @IsOptional()
  @IsString()
  materialSpec?: string;

  @IsString()
  unit!: string;
}
