import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErrorFeedbackService } from './error-feedback.service';
import { ErrorFeedbackController } from './error-feedback.controller';
import { Error_Feedbacks } from '../../entities/error-feedbacks.entity';
import { Users } from '../../entities/users.entity';

@Module({
        imports: [TypeOrmModule.forFeature([Error_Feedbacks, Users])],
        providers: [ErrorFeedbackService],
        controllers: [ErrorFeedbackController],
})
export class ErrorFeedbackModule {}
