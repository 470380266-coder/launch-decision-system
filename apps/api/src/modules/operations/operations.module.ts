import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RecalculationModule } from '../recalculation/recalculation.module';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';

@Module({
  imports: [AuthModule, RecalculationModule],
  controllers: [OperationsController],
  providers: [OperationsService],
  exports: [OperationsService],
})
export class OperationsModule {}
