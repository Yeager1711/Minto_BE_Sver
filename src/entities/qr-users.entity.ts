import { Column, Entity, ManyToOne, PrimaryColumn, JoinColumn } from 'typeorm';
import { Users } from './users.entity';

@Entity('QR_Users')
export class QR_Users {
        @PrimaryColumn({ type: 'int', comment: 'Mã định danh của QR' })
        qr_id: number;

        @ManyToOne(() => Users, (user) => user.qrUsers, {
                nullable: false,
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
        })
        @JoinColumn({ name: 'user_id' })
        user: Users;

        @Column({
                type: 'varchar',
                length: 255,
                nullable: true,
                comment: 'Tên ngân hàng (có thể để null nếu không chọn)',
        })
        bank: string;

        @Column({ type: 'varchar', length: 50, nullable: false, comment: 'Số tài khoản' })
        account_number: string;

        @Column({ type: 'varchar', length: 255, nullable: false, comment: 'Tên chủ tài khoản' })
        account_holder: string;

        @Column({ type: 'longtext', nullable: false, comment: 'URL của mã QR' })
        qr_code_url: string;

        @Column({ type: 'datetime', nullable: false, comment: 'Thời gian tạo QR' })
        created_at: Date;

        @Column({
                type: 'varchar',
                length: 50,
                nullable: false,
                default: 'SUCCESS',
                comment: 'Trạng thái QR ( SUCCESS, ACTIVE, INACTIVE)',
        })
        status: string;
}
