import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { Cards } from './cards.entity';
import { Users } from './users.entity';

@Entity('Payments')
export class Payments {
        @Column({ type: 'int', primary: true, comment: 'Mã thanh toán' })
        payment_id: number;

        @ManyToOne(() => Cards, (card) => card.payments, {
                nullable: true,
                onDelete: 'SET NULL',
                onUpdate: 'CASCADE',
        })
        @JoinColumn({ name: 'card_id' })
        card: Cards;

        @ManyToOne(() => Users, (user) => user.payments, {
                nullable: false,
                onDelete: 'RESTRICT',
                onUpdate: 'CASCADE',
        })
        @JoinColumn({ name: 'user_id' })
        user: Users;

        @Column({
                type: 'decimal',
                precision: 10,
                scale: 2,
                nullable: false,
                comment: 'Số tiền thanh toán',
        })
        amount: number;

        @Column({ type: 'datetime', nullable: false, comment: 'Ngày thanh toán' })
        payment_date: Date;

        @Column({
                type: 'varchar',
                length: 50,
                nullable: false,
                comment: 'Phương thức thanh toán',
        })
        payment_method: string;

        @Column({
                type: 'varchar',
                length: 50,
                default: 'PENDING',
                nullable: false,
                comment: 'Trạng thái thanh toán',
        })
        status: string;

        @Column({
                type: 'varchar',
                length: 255,
                nullable: true,
                comment: 'Mã giao dịch từ cổng thanh toán (nullable)',
        })
        transaction_id: string;

        static generateRandomId(): number {
                return Math.floor(100000 + Math.random() * 900000); // Tạo ID ngẫu nhiên 6 chữ số
        }
}
