import {
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { SubscriptionsService } from './subscriptions.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    email: string;
  };
}

@ApiTags('Subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user subscription' })
  @ApiResponse({
    status: 200,
    description: 'Current subscription returned successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  async getMySubscription(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.subscriptionsService.getMySubscription(
      request.user.userId,
    );
  }

  @Post('upgrade')
  @ApiOperation({ summary: 'Upgrade subscription to Premium' })
  @ApiResponse({
    status: 200,
    description: 'Subscription upgraded successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'User already has a Premium subscription.',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  async upgrade(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.subscriptionsService.upgrade(
      request.user.userId,
    );
  }

  @Post('downgrade')
  @ApiOperation({ summary: 'Downgrade subscription to Free' })
  @ApiResponse({
    status: 200,
    description: 'Subscription downgraded successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'User already has a Free subscription.',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  async downgrade(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.subscriptionsService.downgrade(
      request.user.userId,
    );
  }

  @Get('usage')
  @ApiOperation({ summary: 'Get current subscription usage' })
  @ApiResponse({
    status: 200,
    description: 'Subscription usage returned successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  async getUsage(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.subscriptionsService.getUsage(
      request.user.userId,
    );
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Get all subscriptions (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'All subscriptions returned successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  @ApiResponse({
    status: 403,
    description: 'Admin role required.',
  })
  async getAllSubscriptions() {
    return this.subscriptionsService.getAllSubscriptions();
  }
}