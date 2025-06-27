import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Feedback_Users } from '../../../entities/feedback-users.entity';
import { Users } from '../../../entities/users.entity';
import { Templates } from '../../../entities/templates.entity';

interface FeedbackData {
        userId: number;
        templateId: number;
        rating: number;
        comment: string;
}

@Injectable()
export class UserFeedbackService {
        constructor(
                @InjectRepository(Feedback_Users)
                private feedbackRepository: Repository<Feedback_Users>,
                @InjectRepository(Users)
                private userRepository: Repository<Users>,
                @InjectRepository(Templates)
                private templateRepository: Repository<Templates>
        ) {}

        private generateRandomFeedbackId(): number {
                // Tạo ID ngẫu nhiên 6 chữ số (từ 100000 đến 999999)
                const min = 100000;
                const max = 999999;
                return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        async createFeedback(feedbackData: FeedbackData): Promise<Feedback_Users> {
                const { userId, templateId, rating, comment } = feedbackData;

                // Kiểm tra user
                const user = await this.userRepository.findOne({ where: { user_id: userId } });
                if (!user) {
                        throw new NotFoundException(`User with ID ${userId} not found`);
                }

                // Kiểm tra template
                const template = await this.templateRepository.findOne({
                        where: { template_id: templateId },
                });
                if (!template) {
                        throw new NotFoundException(`Template with ID ${templateId} not found`);
                }

                // Tạo feedback_id ngẫu nhiên và kiểm tra tính duy nhất
                let feedbackId: number;
                let existingFeedback: Feedback_Users | null;

                do {
                        feedbackId = this.generateRandomFeedbackId();
                        existingFeedback = await this.feedbackRepository.findOne({
                                where: { feedback_id: feedbackId },
                        });
                } while (existingFeedback); // Lặp lại nếu ID đã tồn tại

                // Tạo feedback
                const feedback = this.feedbackRepository.create({
                        feedback_id: feedbackId, // Gán ID ngẫu nhiên
                        user: { user_id: userId } as Users,
                        template: { template_id: templateId } as Templates,
                        rating,
                        comment,
                });

                return await this.feedbackRepository.save(feedback);
        }

        async findAllFeedback(): Promise<Feedback_Users[]> {
                const feedbacks = await this.feedbackRepository.find({
                        relations: ['user', 'template'],
                });
                return feedbacks;
        }

        async findFeedbacksByUserId(userId: number): Promise<Feedback_Users[]> {
                const feedbacks = await this.feedbackRepository.find({
                        where: { user: { user_id: userId } },
                        relations: ['user', 'template'],
                });
                return feedbacks;
        }
}
