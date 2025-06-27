import { Controller, Post, Get, Body, Req, NotFoundException } from '@nestjs/common';
import { UserFeedbackService } from './user-feedback.service';

interface AuthenticatedRequest extends Request {
        user?: { user_id: number; email?: string };
}

@Controller('user-feedback')
export class UserFeedbackController {
        constructor(private readonly userFeedbackService: UserFeedbackService) {}

        @Post('submit')
        async submitFeedback(@Req() req: AuthenticatedRequest, @Body() body: any) {
                if (!req.user?.user_id) {
                        throw new NotFoundException('User not authenticated');
                }
                const userId = req.user.user_id;

                // Kiểm tra dữ liệu đầu vào
                if (!body.template_id || typeof body.template_id !== 'number') {
                        throw new NotFoundException('Template ID is required and must be a number');
                }
                if (
                        !body.rating ||
                        typeof body.rating !== 'number' ||
                        body.rating < 1 ||
                        body.rating > 5
                ) {
                        throw new NotFoundException('Rating must be a number between 1 and 5');
                }
                if (!body.comment || typeof body.comment !== 'string') {
                        throw new NotFoundException('Comment is required and must be a string');
                }

                const feedbackData = {
                        userId,
                        templateId: body.template_id,
                        rating: body.rating,
                        comment: body.comment,
                };

                try {
                        const feedback =
                                await this.userFeedbackService.createFeedback(feedbackData);
                        return { message: 'Feedback submitted successfully', feedback };
                } catch (error) {
                        throw new NotFoundException(`Failed to submit feedback: ${error.message}`);
                }
        }

        @Get('all-user-feedback')
        async getAllFeedback() {
                const feedbacks = await this.userFeedbackService.findAllFeedback();
                if (!feedbacks.length) {
                        throw new NotFoundException('No feedback found');
                }
                return feedbacks;
        }

        @Get('user-feedbacks')
        async getUserFeedbacks(@Req() req: AuthenticatedRequest) {
                if (!req.user?.user_id) {
                        throw new NotFoundException('User not authenticated');
                }
                const userId = req.user.user_id;
                const feedbacks = await this.userFeedbackService.findFeedbacksByUserId(userId);
                if (!feedbacks.length) {
                        throw new NotFoundException('No feedback found for this user');
                }
                return feedbacks;
        }
}
