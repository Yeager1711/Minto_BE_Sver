import {
        Controller,
        Post,
        Body,
        Get,
        Patch,
        Param,
        HttpStatus,
        HttpException,
        Request,
} from '@nestjs/common';
import { TemplateService } from './template.service';

interface AuthenticatedRequest extends Request {
        user?: { user_id?: number; userId?: number; email?: string };
}

interface CreateTemplateDto {
        template_id?: number;
        name?: string;
        description?: string;
        price?: string;
        category_id?: string;
        status?: string;
        image_url?: string;
}

@Controller('templates')
export class TemplateController {
        constructor(private readonly templateService: TemplateService) {}

        @Post('add-template')
        async createTemplate(
                @Body() createTemplateDto: CreateTemplateDto,
                @Request() req: AuthenticatedRequest
        ) {
                const userId = req.user?.user_id;
                if (!userId) {
                        throw new HttpException(
                                'Không tìm thấy thông tin người dùng',
                                HttpStatus.UNAUTHORIZED
                        );
                }

                if (!createTemplateDto.name) {
                        throw new HttpException('Tên mẫu là bắt buộc', HttpStatus.BAD_REQUEST);
                }

                const price = createTemplateDto.price
                        ? parseFloat(createTemplateDto.price)
                        : undefined;
                if (price !== undefined && (isNaN(price) || price <= 0)) {
                        throw new HttpException(
                                'Giá mẫu phải là số lớn hơn 0',
                                HttpStatus.BAD_REQUEST
                        );
                }

                const categoryId = createTemplateDto.category_id
                        ? parseInt(createTemplateDto.category_id)
                        : undefined;
                if (categoryId !== undefined && isNaN(categoryId)) {
                        throw new HttpException('Danh mục không hợp lệ', HttpStatus.BAD_REQUEST);
                }

                if (!createTemplateDto.status) {
                        throw new HttpException('Trạng thái là bắt buộc', HttpStatus.BAD_REQUEST);
                }

                if (!createTemplateDto.image_url) {
                        throw new HttpException(
                                'URL ảnh đại diện là bắt buộc',
                                HttpStatus.BAD_REQUEST
                        );
                }

                const templateId = createTemplateDto.template_id;
                if (templateId !== undefined && (isNaN(templateId) || templateId < 0)) {
                        throw new HttpException(
                                'Mã mẫu phải là số không âm',
                                HttpStatus.BAD_REQUEST
                        );
                }

                const newTemplate = await this.templateService.create({
                        template_id: templateId,
                        name: createTemplateDto.name,
                        description: createTemplateDto.description,
                        price: price!,
                        category_id: categoryId!,
                        status: createTemplateDto.status,
                        image_url: createTemplateDto.image_url,
                });

                return {
                        statusCode: HttpStatus.CREATED,
                        message: 'Mẫu đã được tạo thành công',
                        data: newTemplate,
                };
        }

        @Patch('update-template/:template_id')
        async updateTemplate(
                @Param('template_id') template_id: string,
                @Body() updateTemplateDto: CreateTemplateDto,
                @Request() req: AuthenticatedRequest
        ) {
                const userId = req.user?.user_id;
                if (!userId) {
                        throw new HttpException(
                                'Không tìm thấy thông tin người dùng',
                                HttpStatus.UNAUTHORIZED
                        );
                }

                const templateId = parseInt(template_id);
                if (isNaN(templateId)) {
                        throw new HttpException('Mã mẫu không hợp lệ', HttpStatus.BAD_REQUEST);
                }

                // Kiểm tra xem có ít nhất một trường được cung cấp
                if (
                        !updateTemplateDto.name &&
                        !updateTemplateDto.description &&
                        !updateTemplateDto.price &&
                        !updateTemplateDto.category_id &&
                        !updateTemplateDto.status
                ) {
                        throw new HttpException(
                                'Cần cung cấp ít nhất một trường để cập nhật',
                                HttpStatus.BAD_REQUEST
                        );
                }

                const price = updateTemplateDto.price
                        ? parseFloat(updateTemplateDto.price)
                        : undefined;
                if (price !== undefined && (isNaN(price) || price <= 0)) {
                        throw new HttpException(
                                'Giá mẫu phải là số lớn hơn 0',
                                HttpStatus.BAD_REQUEST
                        );
                }

                const categoryId = updateTemplateDto.category_id
                        ? parseInt(updateTemplateDto.category_id)
                        : undefined;
                if (categoryId !== undefined && isNaN(categoryId)) {
                        throw new HttpException('Danh mục không hợp lệ', HttpStatus.BAD_REQUEST);
                }

                const updatedTemplate = await this.templateService.update(templateId, {
                        name: updateTemplateDto.name,
                        description: updateTemplateDto.description,
                        price,
                        category_id: categoryId,
                        status: updateTemplateDto.status,
                });

                return {
                        statusCode: HttpStatus.OK,
                        message: 'Cập nhật mẫu thiệp thành công',
                        data: updatedTemplate,
                };
        }

        @Get('getTemplate')
        async getTemplates() {
                try {
                        const templates = await this.templateService.getTemplates();
                        return {
                                statusCode: HttpStatus.OK,
                                message: 'Lấy danh sách mẫu thiệp thành công',
                                data: templates,
                        };
                } catch (error) {
                        throw new HttpException(
                                'Lỗi khi lấy danh sách mẫu thiệp',
                                HttpStatus.INTERNAL_SERVER_ERROR
                        );
                }
        }

        @Get('getTemplate/:template_id')
        async getTemplateById(@Param('template_id') template_id: string) {
                try {
                        const templateId = parseInt(template_id);
                        if (isNaN(templateId)) {
                                throw new HttpException(
                                        'Mã mẫu không hợp lệ',
                                        HttpStatus.BAD_REQUEST
                                );
                        }

                        const template = await this.templateService.getTemplateById(templateId);
                        if (!template) {
                                throw new HttpException(
                                        'Không tìm thấy mẫu thiệp',
                                        HttpStatus.NOT_FOUND
                                );
                        }

                        return {
                                statusCode: HttpStatus.OK,
                                message: 'Lấy thông tin mẫu thiệp thành công',
                                data: template,
                        };
                } catch (error) {
                        if (error instanceof HttpException) {
                                throw error;
                        }
                        throw new HttpException(
                                'Lỗi khi lấy thông tin mẫu thiệp',
                                HttpStatus.INTERNAL_SERVER_ERROR
                        );
                }
        }
}
