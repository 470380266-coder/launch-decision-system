import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateBatchActualDto {
  @IsOptional()
  @IsDateString()
  actualStartAt?: string | null;

  @IsOptional()
  @IsDateString()
  actualFinishAt?: string | null;

  @IsOptional()
  @IsDateString()
  actualLaunchAt?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  actualLaunchQty?: number | null;
}
