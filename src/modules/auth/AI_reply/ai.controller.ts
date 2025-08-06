// ai.controller.ts
import {
        Controller,
        Post,
        Body,
        Req,
        UnauthorizedException,
        BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { AI_Service } from './ai.service';

interface AuthenticatedRequest extends Request {
        user?: { user_id?: number; userId?: number; email?: string; role?: string };
}

@Controller('ai')
export class AI_Controller {
        constructor(private readonly aiService: AI_Service) {}

        @Post('ask-minto')
        async askMintoBot(@Body('question') question: string, @Req() req: AuthenticatedRequest) {
                // Kiểm tra xác thực (nếu cần)
                if (!req.user || !req.user.user_id) {
                        throw new UnauthorizedException('User not authenticated');
                }

                if (!question) {
                        throw new BadRequestException('Question is required');
                }

                // Gọi service để lấy câu trả lời từ Gemini
                const response = await this.aiService.answerAsMintoBot(question);
                return { response };
        }
}
