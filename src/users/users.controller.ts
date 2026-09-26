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

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.getProfile(
      request.user.userId,
    );
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
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
  async deleteAccount(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.deleteAccount(
      request.user.userId,
    );
  }

  @Get('admin-test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async adminTest() {
    return {
      message: 'Admin access granted',
    };
  }
}