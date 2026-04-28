import { Controller, Post } from '@nestjs/common';
import { RunType } from '@prisma/client';
import { RecalculationService } from './recalculation.service';

@Controller('recalculation')
export class RecalculationController {
  constructor(private readonly recalculationService: RecalculationService) {}

  @Post('run')
  runNow() {
    return this.recalculationService.run(RunType.MANUAL);
  }
}
