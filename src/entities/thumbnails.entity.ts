import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Templates } from './templates.entity';

@Entity('Thumbnails')
export class Thumbnails {
        @Column({ type: 'int', primary: true })
        thumbnail_id: number;

        @Column({ type: 'varchar', length: 255, nullable: false })
        image_url: string;

        @Column({ type: 'varchar', length: 50, nullable: true })
        position: string;

        @Column({ type: 'text', nullable: true })
        description: string;

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
