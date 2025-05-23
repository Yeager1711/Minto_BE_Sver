import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Templates } from './templates.entity';

@Entity('Thumbnails')
export class Thumbnails {
        @Column({ type: 'int', primary: true })
        thumbnail_id: number;

        @Column({ type: 'longtext', nullable: false })
        image_url: string;

        @Column({ type: 'varchar', length: 50, nullable: true })
        position: string;

        @Column({ type: 'text', nullable: true })
        description: string;

        @Column({
                type: 'int',
                nullable: true,
                comment: 'ID của card liên quan (không phải relationship)',
        })
        card_id: number;

        @ManyToOne(() => Templates, (template) => template.thumbnails, {
                nullable: false,
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
        })
        @JoinColumn({ name: 'template_id' })
        template: Templates;

        static generateRandomId(): number {
                return Math.floor(100000 + Math.random() * 900000); // Tạo ID ngẫu nhiên 6 chữ số
        }
}
