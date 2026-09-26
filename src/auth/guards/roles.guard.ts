import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES_KEY } from '../decorators/roles.decorator';

interface AuthenticatedRequest {
  user: {
    userId: number;
    email: string;
  };
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();

    const userId = request.user.userId;

    const userRoles = await this.prisma.userRole.findMany({
      where: {
        userId,
      },
      include: {
        role: true,
      },
    });

    const hasRequiredRole = userRoles.some((userRole) =>
      requiredRoles.includes(userRole.role.name),
    );

    if (!hasRequiredRole) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}