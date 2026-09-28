import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminSubscriptionUserDto {
  @ApiProperty({ example: 42 })
  id!: number;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiPropertyOptional({ example: 'Alex User', nullable: true })
  name!: string | null;
}

export class AdminSubscriptionResponseDto {
  @ApiProperty({ example: 7 })
  id!: number;

  @ApiProperty({ example: 42 })
  userId!: number;

  @ApiProperty({ enum: ['FREE', 'PREMIUM'], example: 'PREMIUM' })
  plan!: string;

  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'], example: 'ACTIVE' })
  status!: string;

  @ApiProperty({ example: 1000 })
  requestLimit!: number;

  @ApiProperty({ example: 18 })
  usedRequests!: number;

  @ApiProperty({ example: 982 })
  remainingRequests!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  currentPeriodStart!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  currentPeriodEnd!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: AdminSubscriptionUserDto })
  user!: AdminSubscriptionUserDto;
}
