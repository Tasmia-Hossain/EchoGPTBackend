import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
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

import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    email: string;
  };
}

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  // =========================
  // Current User
  // =========================

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get current user profile',
  })
  @ApiResponse({
    status: 200,
    description:
      'Current user profile returned successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found.',
  })
  async getProfile(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.getProfile(
      request.user.userId,
    );
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Update current user profile',
  })
  @ApiResponse({
    status: 200,
    description:
      'User profile updated successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found.',
  })
  @ApiResponse({
    status: 409,
    description: 'Email already registered.',
  })
  async updateProfile(
    @Req() request: AuthenticatedRequest,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(
      request.user.userId,
      updateProfileDto,
    );
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Change current user password',
  })
  @ApiResponse({
    status: 200,
    description:
      'Password changed successfully.',
  })
  @ApiResponse({
    status: 401,
    description:
      'Authentication required or current password is incorrect.',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found.',
  })
  async changePassword(
    @Req() request: AuthenticatedRequest,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(
      request.user.userId,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
    );
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Delete current user account',
  })
  @ApiResponse({
    status: 200,
    description:
      'User account deleted successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found.',
  })
  async deleteAccount(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.deleteAccount(
      request.user.userId,
    );
  }

  // =========================
  // Admin
  // =========================

  @Get('admin-test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Test admin role access',
  })
  @ApiResponse({
    status: 200,
    description: 'Admin access granted.',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  @ApiResponse({
    status: 403,
    description: 'Admin role required.',
  })
  async adminTest() {
    return {
      message: 'Admin access granted',
    };
  }

  @Get('admin/users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Get all active users (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description:
      'List of all active users returned successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  @ApiResponse({
    status: 403,
    description: 'Admin role required.',
  })
  async getAllUsers() {
    return this.usersService.getAllUsers();
  }

  @Get('admin/dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Get admin dashboard statistics (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Admin dashboard statistics returned successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  @ApiResponse({
    status: 403,
    description: 'Admin role required.',
  })
  async getAdminDashboardStats() {
    return this.usersService.getAdminDashboardStats();
  }

  @Get('admin/usage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Get API usage analytics (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description:
      'API usage analytics returned successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  @ApiResponse({
    status: 403,
    description: 'Admin role required.',
  })
  async getAdminUsageAnalytics() {
    return this.usersService.getAdminUsageAnalytics();
  }

  @Get('admin/logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Get latest API request logs (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Latest API request logs returned successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  @ApiResponse({
    status: 403,
    description: 'Admin role required.',
  })
  async getAdminRequestLogs() {
    return this.usersService.getAdminRequestLogs();
  }

  @Get('admin/health')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Get system health information (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description:
      'System health information returned successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  @ApiResponse({
    status: 403,
    description: 'Admin role required.',
  })
  async getAdminSystemHealth() {
    return this.usersService.getAdminSystemHealth();
  }
}