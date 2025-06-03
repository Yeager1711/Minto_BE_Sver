import { Column, Entity, ManyToOne, OneToMany, PrimaryColumn, JoinColumn } from 'typeorm';
import { Role } from './role.entity';
import { Cards } from './cards.entity';
import { Payments } from './payments.entity';
import { QR_Users } from './qr-users.entity'; 
import { Error_Feedbacks } from './error-feedbacks.entity'; 

@Entity('Users')
export class Users {
        @PrimaryColumn({ comment: 'Mã định danh người dùng' })
        user_id: number;

        @Column({ type: 'varchar', length: 255, nullable: false, comment: 'Họ và tên' })
        full_name: string;

        @Column({
                type: 'varchar',
                length: 255,
                nullable: false,
                unique: true,
                comment: 'Email người dùng',
        })
        email: string;

        @Column({ type: 'varchar', length: 20, nullable: true, comment: 'Số điện thoại' })
        phone: string;

        @Column({ type: 'varchar', length: 255, nullable: true, comment: 'Địa chỉ' })
        address: string;

        @Column({ type: 'varchar', length: 255, nullable: false, comment: 'Mật khẩu (đã mã hóa)' })
        password: string;

        @ManyToOne(() => Role, (role) => role.users, {
                nullable: false,
                onDelete: 'RESTRICT',
                onUpdate: 'CASCADE',
        })
        @JoinColumn({ name: 'role_id' })
        role: Role;

        @OneToMany(() => Cards, (cards) => cards.user)
        cards: Cards[];

        @OneToMany(() => Payments, (payments) => payments.user)
        payments: Payments[];

        @OneToMany(() => QR_Users, (qrUsers) => qrUsers.user, {
                cascade: true, // Tùy chọn, cho phép cascade khi thêm/sửa QR
        })
        qrUsers: QR_Users[]; // Danh sách các mã QR của người dùng

        @OneToMany(() => Error_Feedbacks, (errorFeedbacks) => errorFeedbacks.user, {
                cascade: true, // Tùy chọn, cho phép cascade khi thêm/sửa phản hồi
        })
        errorFeedbacks: Error_Feedbacks[]; // Danh sách các phản hồi lỗi của người dùng
}
