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
import { ConfirmProcurementArrivalDto } from './dto/confirm-procurement-arrival.dto';
import { CreateAllocationDto } from './dto/create-allocation.dto';
import { CreateBomVersionDto } from './dto/create-bom-version.dto';
import { CreateProcurementTrackDto } from './dto/create-procurement-track.dto';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { UpdateBatchActualDto } from './dto/update-batch-actual.dto';
import { UpdateBatchStatusDto } from './dto/update-batch-status.dto';
import { UpdateProcurementTrackDto } from './dto/update-procurement-track.dto';
import { OperationsService } from './operations.service';

@Controller('operations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OperationsController {
  constructor(private readonly operationsService: OperationsService) {}

  @Get('bootstrap')
  @Roles(UserRole.ADMIN, UserRole.PURCHASER)
  getBootstrap(@Req() req: Request) {
    return this.operationsService.getBootstrapData(
      req.user as { id: string; role: UserRole },
    );
  }

  @Post('receipts')
  @Roles(UserRole.ADMIN, UserRole.PURCHASER)
  createReceipt(@Body() dto: CreateReceiptDto, @Req() req: Request) {
    return this.operationsService.createReceipt(
      dto,
      req.user as { id: string; role: UserRole },
    );
  }

  @Post('procurement-tracks')
  @Roles(UserRole.ADMIN, UserRole.PURCHASER)
  createProcurementTrack(
    @Body() dto: CreateProcurementTrackDto,
    @Req() req: Request,
  ) {
    return this.operationsService.createProcurementTrack(
      dto,
      req.user as { id: string; role: UserRole },
    );
  }

  @Patch('procurement-tracks/:id')
  @Roles(UserRole.ADMIN, UserRole.PURCHASER)
  updateProcurementTrack(
    @Param('id') id: string,
    @Body() dto: UpdateProcurementTrackDto,
    @Req() req: Request,
  ) {
    return this.operationsService.updateProcurementTrack(
      id,
      dto,
      req.user as { id: string; role: UserRole },
    );
  }

  @Post('procurement-tracks/:id/arrival')
  @Roles(UserRole.ADMIN, UserRole.PURCHASER)
  confirmProcurementArrival(
    @Param('id') id: string,
    @Body() dto: ConfirmProcurementArrivalDto,
    @Req() req: Request,
  ) {
    return this.operationsService.confirmProcurementArrival(
      id,
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

  @Post('bom-versions')
  @Roles(UserRole.ADMIN)
  createBomVersion(@Body() dto: CreateBomVersionDto) {
    return this.operationsService.createBomVersion(dto);
  }

  @Patch('production-batches/:id/status')
  @Roles(UserRole.ADMIN)
  updateBatchStatus(
    @Param('id') id: string,
    @Body() dto: UpdateBatchStatusDto,
  ) {
    return this.operationsService.updateBatchStatus(id, dto);
  }

  @Patch('production-batches/:id/actual')
  @Roles(UserRole.ADMIN)
  updateBatchActual(
    @Param('id') id: string,
    @Body() dto: UpdateBatchActualDto,
  ) {
    return this.operationsService.updateBatchActual(id, dto);
  }
}
