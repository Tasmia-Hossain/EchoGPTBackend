import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export type SubscriptionPlan = 'FREE' | 'PREMIUM';

export class UpdateSubscriptionPlanDto {
  @ApiProperty({
    description: 'Plan to assign to the user subscription.',
    enum: ['FREE', 'PREMIUM'],
    example: 'PREMIUM',
  })
  @IsIn(['FREE', 'PREMIUM'])
  plan!: SubscriptionPlan;
}
