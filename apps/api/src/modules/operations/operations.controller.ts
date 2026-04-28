import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateAllocationDto } from './dto/create-allocation.dto';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { UpdateBatchStatusDto } from './dto/update-batch-status.dto';
import { OperationsService } from './operations.service';

@Controller('operations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OperationsController {
  constructor(private readonly operationsService: OperationsService) {}

  @Get('bootstrap')
  @Roles(UserRole.ADMIN, UserRole.PURCHASER)
  getBootstrap(@Req() req: Request) {
    return this.operationsService.getBootstrapData(req.user as { role: UserRole });
  }

  @Post('receipts')
  @Roles(UserRole.ADMIN, UserRole.PURCHASER)
  createReceipt(@Body() dto: CreateReceiptDto, @Req() req: Request) {
    return this.operationsService.createReceipt(
      dto,
      req.user as { id: string; role: UserRole },
    );
  }

  @Post('allocations')
  @Roles(UserRole.ADMIN)
  createAllocation(@Body() dto: CreateAllocationDto, @Req() req: Request) {
    return this.operationsService.createAllocation(
      dto,
      req.user as { id: string; role: UserRole },
    );
  }

  @Patch('production-batches/:id/status')
  @Roles(UserRole.ADMIN)
  updateBatchStatus(
    @Param('id') id: string,
    @Body() dto: UpdateBatchStatusDto,
  ) {
    return this.operationsService.updateBatchStatus(id, dto);
  }
}
