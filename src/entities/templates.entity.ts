// src/entities/templates.entity.ts
import { Column, Entity, ManyToOne, OneToMany, PrimaryColumn, JoinColumn } from 'typeorm';
import { Category } from './category.entity';
import { Thumbnails } from './thumbnails.entity';
import { Cards } from './cards.entity';

@Entity('Templates')
export class Templates {
        @PrimaryColumn({
                type: 'int',
                comment: 'Mã mẫu thiệp (do người dùng cung cấp)',
                generated: false, // Không tự động tăng
        })
        template_id: number;

        @Column({ type: 'varchar', length: 100, nullable: false, comment: 'Tên mẫu thiệp' })
        name: string;

        @Column({ type: 'text', nullable: true, comment: 'Mô tả mẫu' })
        description: string;

        @Column({ type: 'varchar', length: 255, nullable: false, comment: 'Ảnh đại diện của mẫu' })
        image_url: string;

        @Column({
                type: 'decimal',
                precision: 10,
                scale: 2,
                nullable: false,
                comment: 'Giá mẫu thiệp',
        })
        price: number;

        @Column({
                type: 'varchar',
                length: 50,
                nullable: false,
                comment: 'Trạng thái mẫu thiệp (Sẵn sàng, Đang được cập nhật)',
        })
        status: string;

        @ManyToOne(() => Category, (category) => category.templates, {
                nullable: false,
                onDelete: 'RESTRICT',
                onUpdate: 'CASCADE',
        })
        @JoinColumn({ name: 'category_id' })
        category: Category;

        @OneToMany(() => Thumbnails, (thumbnails) => thumbnails.template)
        thumbnails: Thumbnails[];

        @OneToMany(() => Cards, (cards) => cards.template)
        cards: Cards[];

        // Hàm tạo ID ngẫu nhiên (dùng khi người dùng không cung cấp ID)
        static generateRandomId(): number {
                return Math.floor(100000 + Math.random() * 900000); // Tạo ID ngẫu nhiên 6 chữ số
        }
}
