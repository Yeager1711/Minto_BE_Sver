import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Users } from './users.entity';
import { Templates } from './templates.entity';
import { Invitations } from './invitations.entity';
import { Payments } from './payments.entity';

@Entity('Cards')
export class Cards {
        @Column({ type: 'int', primary: true })
        card_id: number;

        @Column()
        user_id: number;

        @Column()
        template_id: number;

        @Column()
        created_at: Date;

        @Column({ type: 'json', nullable: true })
        custom_data: any;

        @Column({
                type: 'varchar',
                length: 50,
                default: 'DRAFT',
                comment: 'Trạng thái thiệp',
        })
        status: string;

        @ManyToOne(() => Users, (user) => user.cards)
        @JoinColumn({ name: 'user_id' })
        user: Users;

        @ManyToOne(() => Templates, (template) => template.cards)
        @JoinColumn({ name: 'template_id' })
        template: Templates;

        @OneToMany(() => Invitations, (invitation) => invitation.card)
        invitations: Invitations[];

        @OneToMany(() => Payments, (payment) => payment.card)
        payments: Payments[];

        static generateRandomId(): number {
                return Math.floor(100000 + Math.random() * 900000); // Tạo ID ngẫu nhiên 6 chữ số
        }
}
