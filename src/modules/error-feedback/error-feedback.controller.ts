import { Controller, Post, Get, Body, Req } from '@nestjs/common';
import { ErrorFeedbackService } from './error-feedback.service';

interface AuthenticatedRequest extends Request {
        user?: { user_id: number; email?: string };
}

@Controller('error-feedback')
export class ErrorFeedbackController {
        constructor(private readonly errorFeedbackService: ErrorFeedbackService) {}

        @Post('submit')
        async submitErrorFeedback(
                @Req() req: AuthenticatedRequest,
                @Body('errorMessage') errorMessage: string
        ) {
                const userId = req.user?.user_id;
                if (!userId) {
                        throw new Error('User not authenticated');
                }
                const feedback = await this.errorFeedbackService.submitErrorFeedback(
                        userId,
                        errorMessage
                );
                return { message: 'Gửi phản hồi thành công', feedback };
        }

        @Get('all-error-feedback')
        async getUserErrorFeedbacks(@Req() req: AuthenticatedRequest) {
                const userId = req.user?.user_id;
                if (!userId) {
                        throw new Error('User not authenticated');
                }
                const feedbacks = await this.errorFeedbackService.getUserErrorFeedbacks(userId);
                return { feedbacks };
        }
}
