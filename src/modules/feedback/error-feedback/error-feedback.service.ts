import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Error_Feedbacks } from '../../../entities/error-feedbacks.entity';
import { Users } from '../../../entities/users.entity';

@Injectable()
export class ErrorFeedbackService {
        constructor(
                @InjectRepository(Error_Feedbacks)
                private errorFeedbackRepository: Repository<Error_Feedbacks>,
                @InjectRepository(Users)
                private usersRepository: Repository<Users>
        ) {}

        async submitErrorFeedback(userId: number, errorMessage: string): Promise<Error_Feedbacks> {
                const user = await this.usersRepository.findOneOrFail({
                        where: { user_id: userId },
                });

                let feedbackId: number;
                let isUnique = false;
                const min = 1000;
                const max = 9999;

                while (!isUnique) {
                        feedbackId = Math.floor(Math.random() * (max - min + 1)) + min;
                        const existingFeedback = await this.errorFeedbackRepository.findOne({
                                where: { feedback_id: feedbackId },
                        });
                        isUnique = !existingFeedback;
                }

                const feedback = this.errorFeedbackRepository.create({
                        feedback_id: feedbackId,
                        user,
                        error_message: errorMessage,
                        submitted_at: new Date(),
                        status: 'PENDING',
                });

                return this.errorFeedbackRepository.save(feedback);
        }

        async getAllErrorFeedbacks(): Promise<Error_Feedbacks[]> {
                const feedbacks = await this.errorFeedbackRepository.find({
                        select: {
                                feedback_id: true,
                                error_message: true,
                                submitted_at: true,
                                status: true,
                                resolved_at: true,
                                resolution_notes: true,
                                user: {
                                        user_id: true,
                                        full_name: true,
                                        email: true,
                                },
                        },
                        relations: ['user'],
                        order: { submitted_at: 'DESC' },
                });

                if (!feedbacks || feedbacks.length === 0) {
                        throw new NotFoundException('No error feedbacks found');
                }

                return feedbacks;
        }

        async getUserErrorFeedbacks(userId: number): Promise<Error_Feedbacks[]> {
                const feedbacks = await this.errorFeedbackRepository.find({
                        where: { user: { user_id: userId } },
                        select: {
                                feedback_id: true,
                                error_message: true,
                                submitted_at: true,
                                status: true,
                                resolved_at: true,
                                resolution_notes: true,
                                user: {
                                        user_id: true,
                                        full_name: true,
                                        email: true,
                                },
                        },
                        relations: ['user'],
                        order: { submitted_at: 'DESC' },
                });

                if (!feedbacks || feedbacks.length === 0) {
                        throw new NotFoundException(
                                `Không tìm thấy phản hồi lỗi nào cho user ${userId}`
                        );
                }

                return feedbacks;
        }

        async updateErrorFeedbackStatus(
                feedbackId: number,
                status: string,
                resolutionNotes?: string
        ): Promise<Error_Feedbacks> {
                // Validate status
                const validStatuses = ['PENDING', 'RESOLVED', 'IGNORED'];
                if (!validStatuses.includes(status)) {
                        throw new BadRequestException(
                                'Trạng thái không hợp lệ. Chỉ được phép là PENDING, RESOLVED hoặc IGNORED'
                        );
                }

                // Find the feedback
                const feedback = await this.errorFeedbackRepository.findOne({
                        where: { feedback_id: feedbackId },
                        relations: ['user'],
                });

                if (!feedback) {
                        throw new NotFoundException(`Không tìm thấy phản hồi với ID ${feedbackId}`);
                }

                // Update status and related fields
                feedback.status = status;
                if (status === 'RESOLVED' || status === 'IGNORED') {
                        feedback.resolved_at = new Date();
                        feedback.resolution_notes =
                                resolutionNotes || feedback.resolution_notes || 'Đã xử lý';
                } else {
                        feedback.resolved_at = null;
                        feedback.resolution_notes = null;
                }

                return this.errorFeedbackRepository.save(feedback);
        }
}
