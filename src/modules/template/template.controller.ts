import {
        Controller,
        Post,
        Body,
        Get,
        HttpStatus,
        HttpException,
        Request,
        UseInterceptors,
        UploadedFile,
        Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TemplateService } from './template.service';
import { writeFileSync } from 'fs';
import { join, extname } from 'path';

interface AuthenticatedRequest extends Request {
        user?: { user_id?: number; userId?: number; email?: string };
}

interface CreateTemplateDto {
        template_id?: number;
        name: string;
        description?: string;
        price: string;
        category_id: string;
        status: string;
}

@Controller('templates')
export class TemplateController {
        constructor(private readonly templateService: TemplateService) {}

        @Post('add-template')
        @UseInterceptors(FileInterceptor('image'))
        async createTemplate(
                @Body() createTemplateDto: CreateTemplateDto,
                @UploadedFile() file: Express.Multer.File,
                @Request() req: AuthenticatedRequest
        ) {
                console.log('Request Body:', createTemplateDto);
                console.log('Uploaded File:', file);

                const userId = req.user?.user_id;
                if (!userId) {
                        throw new HttpException(
                                'Không tìm thấy thông tin người dùng',
                                HttpStatus.UNAUTHORIZED
                        );
                }

                if (!file) {
                        throw new HttpException('Ảnh đại diện là bắt buộc', HttpStatus.BAD_REQUEST);
                }

                if (!createTemplateDto.name) {
                        throw new HttpException('Tên mẫu là bắt buộc', HttpStatus.BAD_REQUEST);
                }

                const price = parseFloat(createTemplateDto.price);
                if (isNaN(price) || price <= 0) {
                        throw new HttpException(
                                'Giá mẫu phải là số lớn hơn 0',
                                HttpStatus.BAD_REQUEST
                        );
                }

                const categoryId = parseInt(createTemplateDto.category_id);
                if (isNaN(categoryId)) {
                        throw new HttpException('Danh mục không hợp lệ', HttpStatus.BAD_REQUEST);
                }

                if (!createTemplateDto.status) {
                        throw new HttpException('Trạng thái là bắt buộc', HttpStatus.BAD_REQUEST);
                }

                const templateId = createTemplateDto.template_id;
                if (templateId !== undefined && (isNaN(templateId) || templateId < 0)) {
                        throw new HttpException(
                                'Mã mẫu phải là số không âm',
                                HttpStatus.BAD_REQUEST
                        );
                }

                // Tạo tên file mới và lưu file vào thư mục templates (không dùng Uploads)
                const fileName = `image-${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
                const filePath = join(process.cwd(), 'template_images', fileName);
                try {
                        writeFileSync(filePath, file.buffer);
                } catch (error) {
                        throw new HttpException(
                                'Lỗi khi lưu file ảnh',
                                HttpStatus.INTERNAL_SERVER_ERROR
                        );
                }

                // Lưu tên file vào database
                const imageUrl = fileName;

                const newTemplate = await this.templateService.create({
                        template_id: templateId,
                        name: createTemplateDto.name,
                        description: createTemplateDto.description,
                        price,
                        category_id: categoryId,
                        status: createTemplateDto.status,
                        image_url: imageUrl,
                });

                return {
                        statusCode: HttpStatus.CREATED,
                        message: 'Mẫu đã được tạo thành công',
                        data: newTemplate,
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
