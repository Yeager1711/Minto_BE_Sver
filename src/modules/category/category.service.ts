import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../../entities/category.entity';

@Injectable()
export class CategoryService {
        constructor(
                @InjectRepository(Category)
                private categoryRepository: Repository<Category>
        ) {}

        async create(categoryData: Partial<Category>) {
                const existingCategory = await this.categoryRepository.findOneBy({
                        category_id: categoryData.category_id,
                });
                if (existingCategory) {
                        categoryData.category_id = Category.generateRandomId();
                        return this.create(categoryData);
                }

                const category = this.categoryRepository.create(categoryData);
                return await this.categoryRepository.save(category);
        }

        async findAll(): Promise<Category[]> {
                return await this.categoryRepository.find();
        }
}
