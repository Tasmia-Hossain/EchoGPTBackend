import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { Request } from 'express';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    email: string;
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  @Post('register')
  async register(
    @Body() registerDto: RegisterDto,
  ) {
    return this.authService.register(
      registerDto.email,
      registerDto.password,
      registerDto.name,
    );
  }

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
  ) {
    return this.authService.login(
      loginDto.email,
      loginDto.password,
    );
  }

  @Post('refresh')
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
  ) {
    return this.authService.refresh(
      refreshTokenDto.refreshToken,
    );
  }

  @Post('logout')
  async logout(
    @Body() logoutDto: LogoutDto,
  ) {
    return this.authService.logout(
      logoutDto.refreshToken,
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.authService.getCurrentUser(
      request.user.userId,
    );
  }
}
