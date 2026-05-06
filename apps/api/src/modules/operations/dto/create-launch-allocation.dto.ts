import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateLaunchAllocationDto {
  @IsString()
  stockingRequestId!: string;

  @IsString()
  allocationTarget!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  allocatedQty!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
