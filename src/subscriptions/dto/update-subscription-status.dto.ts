import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export type SubscriptionStatus = 'ACTIVE' | 'INACTIVE';

export class UpdateSubscriptionStatusDto {
  @ApiProperty({
    description:
      'ACTIVE enables the subscription; INACTIVE disables all active subscriptions for the user.',
    enum: ['ACTIVE', 'INACTIVE'],
    example: 'INACTIVE',
  })
  @IsIn(['ACTIVE', 'INACTIVE'])
  status!: SubscriptionStatus;
}
