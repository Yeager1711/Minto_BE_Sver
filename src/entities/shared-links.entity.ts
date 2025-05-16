import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Guests } from './guests.entity';

@Entity('SharedLinks')
export class SharedLinks {
        @Column({ type: 'int', primary: true })
        link_id: number;

        @Column()
        guest_id: number;

        @Column()
        share_url: string;

        @Column()
        created_at: Date;

        @Column()
        expires_at: Date;

        @ManyToOne(() => Guests, (guest) => guest.sharedLinks)
        @JoinColumn({ name: 'guest_id' })
        guest: Guests;

        static generateRandomId(): number {
                return Math.floor(100000 + Math.random() * 900000); // Tạo ID ngẫu nhiên 6 chữ số
        }
}
