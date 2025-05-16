import { Controller, Post, Body, HttpStatus, HttpException, Request, Get } from '@nestjs/common';
import { CategoryService } from './category.service';
import { Category } from '../../entities/category.entity';

interface AuthenticatedRequest extends Request {
        user?: { user_id?: number; userId?: number; email?: string };
}

@Controller('categories')
export class CategoryController {
        constructor(private readonly categoryService: CategoryService) {}

        @Post('add-template')
        async createCategory(
                @Body() createCategoryDto: { category_name: string },
                @Request() req: AuthenticatedRequest
        ) {
                const userId = req.user?.user_id;

                if (!userId) {
                        throw new HttpException(
                                'Không tìm thấy thông tin người dùng',
                                HttpStatus.UNAUTHORIZED
                        );
                }

                if (!createCategoryDto.category_name) {
                        throw new HttpException('Tên danh mục là bắt buộc', HttpStatus.BAD_REQUEST);
                }

                const categoryId = Category.generateRandomId();
                const newCategory = await this.categoryService.create({
                        category_id: categoryId,
                        category_name: createCategoryDto.category_name,
                });

                return {
                        statusCode: HttpStatus.CREATED,
                        message: 'Danh mục đã được tạo thành công',
                        data: newCategory,
                };
        }

        @Get('getCategories')
        async getCategories() {
                const categories = await this.categoryService.findAll();
                return {
                        statusCode: HttpStatus.OK,
                        message: 'Danh sách danh mục',
                        data: categories,
                };
        }
}
