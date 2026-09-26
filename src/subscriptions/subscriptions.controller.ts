import {
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { Request } from 'express';

import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    email: string;
  };
}

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Get('me')
  async getMySubscription(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.subscriptionsService.getMySubscription(
      request.user.userId,
    );
  }

  @Post('upgrade')
  async upgrade(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.subscriptionsService.upgrade(
      request.user.userId,
    );
  }

  @Post('downgrade')
  async downgrade(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.subscriptionsService.downgrade(
      request.user.userId,
    );
  }

  @Get('usage')
  async getUsage(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.subscriptionsService.getUsage(
      request.user.userId,
    );
  }
}