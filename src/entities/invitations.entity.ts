import { Column, Entity, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Cards } from './cards.entity';
import { Guests } from './guests.entity';

@Entity('Invitations')
export class Invitations {
        @Column({ type: 'int', primary: true, comment: 'Mã thông tin thiệp' })
        invitation_id: number;

        @ManyToOne(() => Cards, (card) => card.invitations, {
                nullable: false,
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
        })
        @JoinColumn({ name: 'card_id' })
        card: Cards;

        @Column({ type: 'varchar', length: 255, nullable: false, comment: 'Tên chú rể' })
        groom_name: string;

        @Column({ type: 'varchar', length: 255, nullable: false, comment: 'Tên cô dâu' })
        bride_name: string;

        @Column({ type: 'datetime', nullable: false, comment: 'Ngày cưới' })
        wedding_date: Date;

        @Column({ type: 'varchar', length: 255, nullable: false, comment: 'Ngày âm lịch' })
        lunar_day: string;

        @Column({
                type: 'varchar',
                length: 255,
                nullable: false,
                comment: 'Địa điểm tổ chức của chú rể',
        })
        venue_groom: string;

        @Column({
                type: 'varchar',
                length: 255,
                nullable: false,
                comment: 'Địa điểm tổ chức của cô dâu',
        })
        venue_bride: string;

        @Column({ type: 'text', nullable: true, comment: 'Câu chuyện chú rể' })
        story_groom: string;

        @Column({ type: 'text', nullable: true, comment: 'Câu chuyện cô dâu' })
        story_bride: string;

        @Column({
                type: 'varchar',
                length: 255,
                nullable: true,
                comment: 'Hình ảnh tùy chỉnh (nullable)',
        })
        custom_image: string;

        @OneToMany(() => Guests, (guests) => guests.invitation)
        guests: Guests[];

        static generateRandomId(): number {
                return Math.floor(100000 + Math.random() * 900000); // Tạo ID ngẫu nhiên 6 chữ số
        }
}
