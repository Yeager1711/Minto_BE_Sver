import {
        Controller,
        Post,
        Req,
        Body,
        UploadedFiles,
        UseInterceptors,
        UnauthorizedException,
        BadRequestException,
        Logger,
        Get,
        InternalServerErrorException,
        ParseIntPipe,
        Param,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { CardService } from './card.service';

interface AuthenticatedRequest extends Request {
        user?: { user_id: number; email?: string };
}

interface SaveCardBody {
        templateId: string | number;
        weddingData: string | object;
        inviteeNames: string | string[];
        positions?: string | string[];
        totalPrice: string | number; // Thêm totalPrice
}

interface WeddingImage {
        position: string;
        url: string;
}

interface ParsedSaveCardData {
        templateId: number;
        weddingData: object;
        inviteeNames: string[];
        weddingImages: WeddingImage[];
        totalPrice: number; // Thêm totalPrice
}

@Controller('cards')
export class CardController {
        private readonly logger = new Logger(CardController.name);

        constructor(private readonly cardService: CardService) {}

        @Post('save-card')
        @UseInterceptors(
                FileFieldsInterceptor([{ name: 'weddingImages', maxCount: 20 }], {
                        storage: diskStorage({
                                destination: './uploads/wedding-images',
                                filename: (req, file, cb) => {
                                        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
                                        cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
                                },
                        }),
                        fileFilter: (req, file, cb) => {
                                const allowedMimes = ['image/jpeg', 'image/png', 'image/gif'];
                                if (!allowedMimes.includes(file.mimetype)) {
                                        cb(
                                                new BadRequestException(
                                                        'Chỉ hỗ trợ định dạng ảnh JPEG, PNG, hoặc GIF'
                                                ),
                                                false
                                        );
                                }
                                cb(null, true);
                        },
                        limits: {
                                fileSize: 5 * 1024 * 1024,
                        },
                })
        )
        async saveCard(
                @Req() req: AuthenticatedRequest,
                @Body() body: SaveCardBody,
                @UploadedFiles() files: { weddingImages?: Express.Multer.File[] }
        ) {
                this.logger.log('Nhận yêu cầu lưu thiệp');
                this.logger.debug(`Body: ${JSON.stringify(body, null, 2)}`);
                this.logger.debug(`Files: ${JSON.stringify(files, null, 2)}`);

                const userId = req.user?.user_id;
                if (!userId) {
                        this.logger.error('Không tìm thấy ID người dùng trong yêu cầu');
                        throw new UnauthorizedException(
                                'Không tìm thấy ID người dùng trong yêu cầu'
                        );
                }

                try {
                        const parsedData = this.parseRequestData(body, files);
                        this.logger.debug(
                                `Dữ liệu đã phân tích: ${JSON.stringify(parsedData, null, 2)}`
                        );

                        const result = await this.cardService.saveCard(userId, parsedData);
                        this.logger.log(
                                `Lưu thiệp thành công cho người dùng ${userId}, ID thiệp: ${result.card_id}`
                        );

                        return result;
                } catch (error) {
                        this.logger.error(`Lỗi khi lưu thiệp: ${error.message}`);
                        throw error instanceof BadRequestException
                                ? error
                                : new BadRequestException('Lỗi khi lưu thiệp, vui lòng thử lại');
                }
        }

        private parseRequestData(
                body: SaveCardBody,
                files: { weddingImages?: Express.Multer.File[] }
        ): ParsedSaveCardData {
                const templateId =
                        typeof body.templateId === 'string'
                                ? parseInt(body.templateId, 10)
                                : body.templateId;
                if (isNaN(templateId) || templateId <= 0) {
                        this.logger.error('templateId không hợp lệ');
                        throw new BadRequestException('templateId không hợp lệ');
                }

                let weddingData: object;
                try {
                        weddingData =
                                typeof body.weddingData === 'string'
                                        ? JSON.parse(body.weddingData)
                                        : body.weddingData;
                } catch (error) {
                        this.logger.error(`Lỗi phân tích weddingData: ${error.message}`);
                        throw new BadRequestException('Định dạng weddingData không hợp lệ');
                }

                if (!weddingData['groom'] || !weddingData['bride'] || !weddingData['weddingDate']) {
                        this.logger.error('Thiếu các trường bắt buộc trong weddingData');
                        throw new BadRequestException(
                                'Thiếu thông tin chú rể, cô dâu hoặc ngày cưới trong weddingData'
                        );
                }

                let inviteeNames: string[];
                try {
                        inviteeNames =
                                typeof body.inviteeNames === 'string'
                                        ? JSON.parse(body.inviteeNames)
                                        : body.inviteeNames;
                        if (
                                !Array.isArray(inviteeNames) ||
                                inviteeNames.some((name) => !name.trim())
                        ) {
                                throw new Error('Định dạng inviteeNames không hợp lệ');
                        }
                } catch (error) {
                        this.logger.error(`Lỗi phân tích inviteeNames: ${error.message}`);
                        throw new BadRequestException('Định dạng inviteeNames không hợp lệ');
                }

                const positions = Array.isArray(body.positions)
                        ? body.positions
                        : body.positions
                          ? [body.positions]
                          : [];
                const weddingImages: WeddingImage[] = (files.weddingImages || []).map(
                        (file, index) => ({
                                position: positions[index] || `image_${index}`,
                                url: `/uploads/wedding-images/${file.filename}`,
                        })
                );

                if (files.weddingImages && files.weddingImages.length !== positions.length) {
                        this.logger.warn('Số lượng file ảnh và vị trí không khớp');
                        throw new BadRequestException('Số lượng file ảnh và vị trí không khớp');
                }

                const totalPrice =
                        typeof body.totalPrice === 'string'
                                ? parseFloat(body.totalPrice)
                                : body.totalPrice;
                if (isNaN(totalPrice) || totalPrice <= 0) {
                        this.logger.error('totalPrice không hợp lệ');
                        throw new BadRequestException('totalPrice không hợp lệ');
                }

                return {
                        templateId,
                        weddingData,
                        inviteeNames,
                        weddingImages,
                        totalPrice,
                };
        }

        // src/controllers/card.controller.ts
        @Get('user-templates')
        async getUserTemplates(@Req() req: AuthenticatedRequest) {
                this.logger.log('Nhận yêu cầu lấy danh sách template đã sử dụng');

                const userId = req.user?.user_id;
                if (!userId || !Number.isInteger(userId) || userId <= 0) {
                        this.logger.error('ID người dùng không hợp lệ', { userId });
                        throw new UnauthorizedException('ID người dùng không hợp lệ');
                }

                try {
                        const templates = await this.cardService.getUserPaidTemplates(userId);
                        this.logger.log(
                                `Lấy danh sách template thành công cho người dùng ${userId}`
                        );
                        return templates;
                } catch (error) {
                        this.logger.error(`Lỗi khi lấy danh sách template: ${error.message}`, {
                                stack: error.stack,
                                userId,
                        });
                        throw error instanceof BadRequestException
                                ? error
                                : new InternalServerErrorException(
                                          'Lỗi khi lấy danh sách template'
                                  );
                }
        }

        @Get('guest/:template_id/:guest_id/:invitation_id')
        async getGuestAndCardByGuestIdAndInvitationId(
                @Param('template_id', ParseIntPipe) template_id: number,
                @Param('guest_id', ParseIntPipe) guest_id: number,
                @Param('invitation_id', ParseIntPipe) invitation_id: number
        ) {
                this.logger.log(
                        `Nhận yêu cầu lấy thông tin khách mời và thiệp cưới với template_id ${template_id}, guest_id ${guest_id}, và invitation_id ${invitation_id}`
                );
                return this.cardService.getGuestAndCardByGuestIdAndInvitationId(
                        template_id,
                        guest_id,
                        invitation_id
                );
        }
}