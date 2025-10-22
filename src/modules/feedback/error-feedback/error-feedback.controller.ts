import { Controller, Post, Get, Patch, Body, Param, Req, NotFoundException } from '@nestjs/common';
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
        async getAllErrorFeedbacks() {
                const feedbacks = await this.errorFeedbackService.getAllErrorFeedbacks();
                return { feedbacks };
        }

        @Get('user-feedbacks')
        async getUserErrorFeedbacks(@Req() req: AuthenticatedRequest) {
                const userId = req.user?.user_id;
                if (!userId) {
                        throw new Error('User not authenticated');
                }
                const feedbacks = await this.errorFeedbackService.getUserErrorFeedbacks(userId);
                return { feedbacks };
        }

        // ✅ API MỚI: Lấy phản hồi đã được admin xử lý hoặc xem qua
        @Get('user-feedbacks/processed')
        async getProcessedUserErrorFeedbacks(@Req() req: AuthenticatedRequest) {
                const userId = req.user?.user_id;
                if (!userId) throw new Error('User not authenticated');

                const feedbacks =
                        await this.errorFeedbackService.getProcessedUserErrorFeedbacks(userId);
                return { feedbacks };
        }

        // ✅  Cập nhật trạng thái is_read của feedback
        @Patch(':id/read')
        async markFeedbackAsRead(@Param('id') feedbackId: string) {
                const feedback = await this.errorFeedbackService.markFeedbackAsRead(
                        parseInt(feedbackId)
                );
                return { message: 'Đánh dấu phản hồi là đã đọc thành công', feedback };
        }

        @Patch(':id')
        async updateErrorFeedbackStatus(
                @Param('id') feedbackId: string,
                @Body('status') status: string,
                @Body('resolutionNotes') resolutionNotes?: string
        ) {
                const feedback = await this.errorFeedbackService.updateErrorFeedbackStatus(
                        parseInt(feedbackId),
                        status,
                        resolutionNotes
                );
                return { message: 'Cập nhật trạng thái thành công', feedback };
        }
}
