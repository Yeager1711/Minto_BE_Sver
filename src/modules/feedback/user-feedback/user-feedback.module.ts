import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserFeedbackService } from './user-feedback.service';
import { UserFeedbackController } from './user-feedback.controller';
import { Feedback_Users } from '../../../entities/feedback-users.entity';
import { Users } from '../../../entities/users.entity';
import { Templates } from '../../../entities/templates.entity';

@Module({
        imports: [TypeOrmModule.forFeature([Feedback_Users, Users, Templates])],
        providers: [UserFeedbackService],
        controllers: [UserFeedbackController],
})
export class UserFeedbackModule {}
