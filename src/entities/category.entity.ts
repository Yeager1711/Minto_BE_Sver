import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { Templates } from './templates.entity';

@Entity('Category')
export class Category {
    @PrimaryColumn({
        type: 'int',
        comment: 'Mã danh mục (ngẫu nhiên)',
        generated: false, // Không tự động tăng
    })
    category_id: number;

    @Column({
        type: 'varchar',
        length: 100,
        nullable: false,
        comment: 'Tên danh mục (truyền thống, hiện đại, tối giản...)',
    })
    category_name: string;

    @OneToMany(() => Templates, (templates) => templates.category)
    templates: Templates[];

    // Hàm tạo ID ngẫu nhiên (khi chưa có trong DB)
    static generateRandomId(): number {
        return Math.floor(100000 + Math.random() * 900000); // Tạo ID ngẫu nhiên 6 chữ số
    }
}