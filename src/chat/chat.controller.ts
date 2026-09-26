import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    email: string;
  };
}

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
  ) {}

  @Post()
  async sendMessage(
    @Req() request: AuthenticatedRequest,
    @Body() sendMessageDto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(
      request.user.userId,
      sendMessageDto.prompt,
      sendMessageDto.providerId,
      sendMessageDto.conversationId,
    );
  }

  @Get('conversations')
  async getConversations(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.chatService.getConversations(
      request.user.userId,
    );
  }

  @Get('conversations/:id')
  async getConversation(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.chatService.getConversation(
      request.user.userId,
      id,
    );
  }

  @Delete('conversations/:id')
  async deleteConversation(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.chatService.deleteConversation(
      request.user.userId,
      id,
    );
  }
}