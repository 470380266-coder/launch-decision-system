import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { RecalculationController } from './recalculation.controller';
import { RecalculationService } from './recalculation.service';

@Module({
  imports: [ProductsModule],
  controllers: [RecalculationController],
  providers: [RecalculationService],
  exports: [RecalculationService],
})
export class RecalculationModule {}

