import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Templates } from '../../entities/templates.entity';
import { Category } from '../../entities/category.entity';

@Injectable()
export class TemplateService {
        constructor(
                @InjectRepository(Templates)
                private templateRepository: Repository<Templates>,
                @InjectRepository(Category)
                private categoryRepository: Repository<Category>
        ) {}

        async create(templateData: {
                template_id?: number;
                name: string;
                description?: string;
                price: number;
                category_id: number;
                status: string;
                image_url: string;
        }) {
                console.log('Template Data:', templateData);

                // Kiểm tra trùng tên mẫu
                const existingTemplateByName = await this.templateRepository.findOneBy({
                        name: templateData.name,
                });
                if (
                        existingTemplateByName &&
                        existingTemplateByName.template_id !== templateData.template_id
                ) {
                        throw new HttpException('Tên mẫu đã tồn tại', HttpStatus.BAD_REQUEST);
                }

                // Kiểm tra trùng template_id
                const templateId = templateData.template_id || Templates.generateRandomId();
                const existingTemplateById = await this.templateRepository.findOneBy({
                        template_id: templateId,
                });
                if (existingTemplateById) {
                        if (templateData.template_id) {
                                throw new HttpException(
                                        'Mã mẫu đã tồn tại',
                                        HttpStatus.BAD_REQUEST
                                );
                        }
                        return this.create({
                                ...templateData,
                                template_id: Templates.generateRandomId(),
                        });
                }

                // Kiểm tra danh mục tồn tại
                const category = await this.categoryRepository.findOneBy({
                        category_id: templateData.category_id,
                });
                if (!category) {
                        throw new HttpException('Danh mục không tồn tại', HttpStatus.BAD_REQUEST);
                }

                try {
                        const template = this.templateRepository.create({
                                template_id: templateId,
                                name: templateData.name,
                                description: templateData.description,
                                price: templateData.price,
                                status: templateData.status,
                                image_url: templateData.image_url,
                                category,
                        });
                        return await this.templateRepository.save(template);
                } catch (error) {
                        throw new HttpException(
                                'Lỗi khi tạo mẫu thiệp',
                                HttpStatus.INTERNAL_SERVER_ERROR
                        );
                }
        }

        async update(
                template_id: number,
                templateData: {
                        name?: string;
                        description?: string;
                        price?: number;
                        category_id?: number;
                        status?: string;
                }
        ): Promise<Templates> {
                // Kiểm tra template tồn tại
                const template = await this.templateRepository.findOne({
                        where: { template_id },
                        relations: ['category'], // Load category to keep existing value if not updated
                });
                if (!template) {
                        throw new HttpException('Không tìm thấy mẫu thiệp', HttpStatus.NOT_FOUND);
                }

                // Kiểm tra trùng tên mẫu (nếu cung cấp)
                if (templateData.name) {
                        const existingTemplateByName = await this.templateRepository.findOneBy({
                                name: templateData.name,
                        });
                        if (
                                existingTemplateByName &&
                                existingTemplateByName.template_id !== template_id
                        ) {
                                throw new HttpException(
                                        'Tên mẫu đã tồn tại',
                                        HttpStatus.BAD_REQUEST
                                );
                        }
                }

                // Kiểm tra danh mục tồn tại (nếu cung cấp)
                let category: Category | undefined;
                if (templateData.category_id) {
                        category = await this.categoryRepository.findOneBy({
                                category_id: templateData.category_id,
                        });
                        if (!category) {
                                throw new HttpException(
                                        'Danh mục không tồn tại',
                                        HttpStatus.BAD_REQUEST
                                );
                        }
                }

                try {
                        // Cập nhật chỉ các trường được cung cấp
                        await this.templateRepository.update(template_id, {
                                name: templateData.name ?? template.name,
                                description:
                                        templateData.description !== undefined
                                                ? templateData.description
                                                : template.description,
                                price: templateData.price ?? template.price,
                                status: templateData.status ?? template.status,
                                category: category ?? template.category, // Use new category if provided, else keep existing
                        });

                        // Lấy lại template sau khi cập nhật
                        const updatedTemplate = await this.templateRepository.findOne({
                                where: { template_id },
                                relations: ['category'],
                        });
                        if (!updatedTemplate) {
                                throw new HttpException(
                                        'Lỗi khi cập nhật mẫu thiệp',
                                        HttpStatus.INTERNAL_SERVER_ERROR
                                );
                        }

                        return updatedTemplate;
                } catch (error) {
                        throw new HttpException(
                                'Lỗi khi cập nhật mẫu thiệp',
                                HttpStatus.INTERNAL_SERVER_ERROR
                        );
                }
        }

        async getTemplates(): Promise<Templates[]> {
                try {
                        return await this.templateRepository.find({
                                relations: ['category'],
                                select: {
                                        template_id: true,
                                        name: true,
                                        description: true,
                                        price: true,
                                        status: true,
                                        image_url: true,
                                        category: {
                                                category_id: true,
                                                category_name: true,
                                        },
                                },
                        });
                } catch (error) {
                        throw new HttpException(
                                'Lỗi khi lấy danh sách mẫu thiệp',
                                HttpStatus.INTERNAL_SERVER_ERROR
                        );
                }
        }

        async getTemplateById(template_id: number): Promise<Templates | null> {
                try {
                        const template = await this.templateRepository.findOne({
                                where: { template_id },
                                relations: ['category'],
                                select: {
                                        template_id: true,
                                        name: true,
                                        description: true,
                                        price: true,
                                        status: true,
                                        image_url: true,
                                        category: {
                                                category_id: true,
                                                category_name: true,
                                        },
                                },
                        });
                        return template || null;
                } catch (error) {
                        throw new HttpException(
                                'Lỗi khi lấy thông tin mẫu thiệp',
                                HttpStatus.INTERNAL_SERVER_ERROR
                        );
                }
        }
}
