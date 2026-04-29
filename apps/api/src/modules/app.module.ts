import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppConfigModule } from '../config/app-config.module';
import { AuthModule } from './auth/auth.module';
import { OperationsModule } from './operations/operations.module';
import { ProductsModule } from './products/products.module';
import { RecalculationModule } from './recalculation/recalculation.module';
import { PrismaModule } from './shared/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    ScheduleModule.forRoot(),
    AppConfigModule,
    AuthModule,
    PrismaModule,
    OperationsModule,
    ProductsModule,
    RecalculationModule,
  ],
})
export class AppModule {}
