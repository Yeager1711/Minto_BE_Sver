import { Column, Entity, ManyToOne, PrimaryColumn, JoinColumn } from 'typeorm';
import { Users } from './users.entity';

@Entity('Error_Feedbacks')
export class Error_Feedbacks {
        @PrimaryColumn({ type: 'int', comment: 'Mã định danh phản hồi lỗi' })
        feedback_id: number;

        @ManyToOne(() => Users, (user) => user.errorFeedbacks, {
                nullable: false,
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
        })
        @JoinColumn({ name: 'user_id' })
        user: Users;

        @Column({ type: 'text', nullable: false, comment: 'Nội dung lỗi mà người dùng gặp phải' })
        error_message: string;

        @Column({ type: 'datetime', nullable: false, comment: 'Thời gian gửi phản hồi' })
        submitted_at: Date;

        @Column({
                type: 'varchar',
                length: 50,
                nullable: false,
                default: 'PENDING',
                comment: 'Trạng thái xử lý (PENDING, RESOLVED, IGNORED)',
        })
        status: string;

        @Column({ type: 'datetime', nullable: true, comment: 'Thời gian giải quyết lỗi' })
        resolved_at: Date;

        @Column({ type: 'text', nullable: true, comment: 'Ghi chú giải quyết lỗi' })
        resolution_notes: string;

        // 🟢 Thêm cột này
        @Column({
                type: 'tinyint',
                width: 1,
                default: 0,
                nullable: false,
                comment: 'Trạng thái xem thông báo (0 = chưa xem, 1 = đã xem)',
        })
        is_read: number;
}
