import {
  Controller,
  Body,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  getSchemaPath,
  ApiParam,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { SubscriptionsService } from './subscriptions.service';
import { AdminSubscriptionResponseDto } from './dto/admin-subscription-response.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import { UpdateSubscriptionStatusDto } from './dto/update-subscription-status.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginationMetaDto } from '../common/dto/paginated-response.dto';

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
  @ApiOperation({
    summary: 'Get current user subscription',
  })
  @ApiResponse({
    status: 200,
    description:
      'Current subscription returned successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  @ApiResponse({
    status: 404,
    description: 'Active subscription not found.',
  })
  async getMySubscription(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.subscriptionsService.getMySubscription(
      request.user.userId,
    );
  }

  @Post('upgrade')
  @ApiOperation({
    summary: 'Upgrade current subscription to Premium',
  })
  @ApiResponse({
    status: 200,
    description:
      'Subscription upgraded to Premium successfully.',
  })
  @ApiResponse({
    status: 400,
    description:
      'User already has a Premium subscription.',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  @ApiResponse({
    status: 404,
    description: 'Active subscription not found.',
  })
  async upgrade(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.subscriptionsService.upgrade(
      request.user.userId,
    );
  }

  @Post('downgrade')
  @ApiOperation({
    summary: 'Downgrade current subscription to Free',
  })
  @ApiResponse({
    status: 200,
    description:
      'Subscription downgraded to Free successfully.',
  })
  @ApiResponse({
    status: 400,
    description:
      'User already has a Free subscription.',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  @ApiResponse({
    status: 404,
    description: 'Active subscription not found.',
  })
  async downgrade(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.subscriptionsService.downgrade(
      request.user.userId,
    );
  }

  @Get('usage')
  @ApiOperation({
    summary: 'Get current subscription usage',
  })
  @ApiResponse({
    status: 200,
    description:
      'Subscription usage returned successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  @ApiResponse({
    status: 404,
    description: 'Active subscription not found.',
  })
  async getUsage(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.subscriptionsService.getUsage(
      request.user.userId,
    );
  }

  @Get('admin')
  @ApiExtraModels(PaginationMetaDto, AdminSubscriptionResponseDto)
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'List user subscriptions (Admin only)',
    description:
      'Returns subscription usage and basic user details. Password hashes, sessions, and provider credentials are never included.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1, minimum: 1, maximum: 2147483647, description: 'One-based page; defaults to 1.' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20, minimum: 1, maximum: 100, description: 'Page size; defaults to 20.' })
  @ApiResponse({
    status: 200,
    description:
      'Paginated subscriptions with page metadata.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(AdminSubscriptionResponseDto) },
        },
        meta: { $ref: getSchemaPath(PaginationMetaDto) },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  @ApiResponse({
    status: 403,
    description: 'Admin role required.',
  })
  @ApiResponse({ status: 400, description: 'Page or limit is invalid.' })
  async getAllSubscriptions(@Query() pagination: PaginationQueryDto) {
    return this.subscriptionsService.getAllSubscriptions(pagination);
  }

  @Get('admin/users/:userId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'View a user subscription (Admin only)',
    description:
      'Returns the latest active subscription for the user, or their latest subscription when none are active.',
  })
  @ApiParam({ name: 'userId', type: Number, description: 'Positive user ID' })
  @ApiResponse({
    status: 200,
    description: 'Subscription returned successfully.',
    type: AdminSubscriptionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'User ID is invalid.' })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({ status: 403, description: 'Admin role required.' })
  @ApiResponse({ status: 404, description: 'User or subscription not found.' })
  async getUserSubscription(
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.subscriptionsService.getAdminSubscriptionForUser(userId);
  }

  @Patch('admin/users/:userId/plan')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Change a user subscription plan (Admin only)',
    description:
      'Changes the selected subscription plan and corresponding request limit. Usage and period dates are preserved.',
  })
  @ApiParam({ name: 'userId', type: Number, description: 'Positive user ID' })
  @ApiResponse({
    status: 200,
    description: 'Subscription plan updated successfully.',
    type: AdminSubscriptionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'User ID or request body is invalid.' })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({ status: 403, description: 'Admin role required.' })
  @ApiResponse({ status: 404, description: 'User or subscription not found.' })
  async updateUserPlan(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpdateSubscriptionPlanDto,
  ) {
    return this.subscriptionsService.updateUserPlan(userId, dto.plan);
  }

  @Patch('admin/users/:userId/status')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Activate or deactivate a user subscription (Admin only)',
    description:
      'INACTIVE disables all currently active subscription rows for the user. ACTIVE activates the selected latest subscription without creating a new row.',
  })
  @ApiParam({ name: 'userId', type: Number, description: 'Positive user ID' })
  @ApiResponse({
    status: 200,
    description: 'Subscription status updated successfully.',
    type: AdminSubscriptionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'User ID or request body is invalid.' })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({ status: 403, description: 'Admin role required.' })
  @ApiResponse({ status: 404, description: 'User or subscription not found.' })
  async updateUserStatus(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpdateSubscriptionStatusDto,
  ) {
    return this.subscriptionsService.updateUserStatus(userId, dto.status);
  }
}
