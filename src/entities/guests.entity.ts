import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Invitations } from './invitations.entity';
import { Cards } from './cards.entity';

@Entity('Guests')
export class Guests {
        @Column({ type: 'int', primary: true })
        guest_id: number;

        @Column({ nullable: true }) // Cho phép null vì invitation_id được gán sau
        invitation_id: number;

        @Column()
        full_name: string;

        @Column({ nullable: true }) // Cột card_id đã có
        card_id: number;

        @ManyToOne(() => Invitations, (invitation) => invitation.guests, {
                nullable: true,
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
        })
        @JoinColumn({ name: 'invitation_id' })
        invitation: Invitations;

        @ManyToOne(() => Cards, (card) => card.invitations, {
                nullable: true,
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
        })
        @JoinColumn({ name: 'card_id' })
        card: Cards;

        static generateRandomId(): number {
                return Math.floor(100000 + Math.random() * 900000); // Tạo ID ngẫu nhiên 6 chữ số
        }
}
