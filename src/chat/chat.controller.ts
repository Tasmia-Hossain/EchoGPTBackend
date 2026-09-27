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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    email: string;
  };
}

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Send a chat message to an AI provider',
  })
  @ApiResponse({
    status: 201,
    description:
      'Message processed and AI response returned successfully.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid request or subscription request limit exceeded.',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  @ApiResponse({
    status: 404,
    description:
      'Selected provider or conversation not found.',
  })
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
  @ApiOperation({
    summary: 'Get current user conversations',
  })
  @ApiResponse({
    status: 200,
    description:
      'User conversations returned successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  async getConversations(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.chatService.getConversations(
      request.user.userId,
    );
  }

  @Get('conversations/:id')
  @ApiOperation({
    summary: 'Get a conversation by ID',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    example: 1,
    description: 'Conversation ID.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Conversation and messages returned successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  @ApiResponse({
    status: 404,
    description:
      'Conversation not found or does not belong to the current user.',
  })
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
  @ApiOperation({
    summary: 'Delete a conversation',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    example: 1,
    description: 'Conversation ID.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Conversation deleted successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required.',
  })
  @ApiResponse({
    status: 404,
    description:
      'Conversation not found or does not belong to the current user.',
  })
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