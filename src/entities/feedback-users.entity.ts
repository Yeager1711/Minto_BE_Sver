import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Users } from './users.entity';
import { Templates } from './templates.entity';

@Entity('Feedback_Users')
export class Feedback_Users {
        @PrimaryColumn({ type: 'int', comment: 'Mã định danh phản hồi người dùng' })
        feedback_id: number; // Bạn cần tự sinh ID ở backend khi insert

        @ManyToOne(() => Users, (user) => user.feedbacks, {
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
                nullable: false,
        })
        @JoinColumn({ name: 'user_id' })
        user: Users;

        @ManyToOne(() => Templates, (template) => template.feedbacks, {
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
                nullable: false,
        })
        @JoinColumn({ name: 'template_id' })
        template: Templates;

        @Column({ type: 'int', nullable: false, comment: 'Số sao đánh giá (1-5)' })
        rating: number;

        @Column({ type: 'text', nullable: true, comment: 'Mô tả, nhận xét từ người dùng' })
        comment: string;

        @CreateDateColumn({ comment: 'Thời gian gửi phản hồi' })
        submitted_at: Date;
}
