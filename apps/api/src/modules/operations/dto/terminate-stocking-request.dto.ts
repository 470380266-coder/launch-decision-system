import { IsString } from 'class-validator';

export class TerminateStockingRequestDto {
  @IsString()
  reason!: string;
}
