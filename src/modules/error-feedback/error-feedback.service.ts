import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Error_Feedbacks } from '../../entities/error-feedbacks.entity';
import { Users } from '../../entities/users.entity';

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
                        feedback_id: feedbackId, // Assign the random feedback_id
                        user,
                        error_message: errorMessage,
                        submitted_at: new Date(),
                        status: 'PENDING',
                });

                return this.errorFeedbackRepository.save(feedback);
        }

        async getUserErrorFeedbacks(userId: number): Promise<Error_Feedbacks[]> {
                return this.errorFeedbackRepository.find({
                        where: { user: { user_id: userId } },
                        relations: ['user'],
                        order: { submitted_at: 'DESC' },
                });
        }
}
