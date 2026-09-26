import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  prompt!: string;

  @IsOptional()
  @IsInt()
  providerId?: number;

  @IsOptional()
  @IsInt()
  conversationId?: number;
}