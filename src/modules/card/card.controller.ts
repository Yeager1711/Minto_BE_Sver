import {
        Controller,
        Post,
        Get,
        Request,
        Param,
        Body,
        UnauthorizedException,
        BadRequestException,
        InternalServerErrorException,
        ParseIntPipe,
        Logger,
        NotFoundException,
} from '@nestjs/common';
import { CardService } from './card.service';

interface AuthenticatedRequest extends Request {
        user?: { user_id: number; email?: string };
}

// Cập nhật interface SaveCardBody để chấp nhận weddingImages là object hoặc mảng
interface SaveCardBody {
        orderCode: string;
        weddingData: string | object;
        weddingImages:
                | { [key: string]: { position: string; url: string; fileName?: string } }
                | string
                | { position: string; url: string }[];
}

interface ParsedSaveCardData {
        orderCode: string;
        weddingData: object;
        weddingImages: { position: string; url: string }[];
}

@Controller('cards')
export class CardController {
        private readonly logger = new Logger(CardController.name);

        constructor(private readonly cardService: CardService) {}

        @Post('save-card')
        async saveCard(@Request() req: AuthenticatedRequest, @Body() body: SaveCardBody) {
                this.logger.log('Nhận yêu cầu lưu thiệp');
                this.logger.debug(`Body: ${JSON.stringify(body, null, 2)}`);

                const userId = req.user?.user_id;
                if (!userId) {
                        this.logger.error('Không tìm thấy ID người dùng trong yêu cầu');
                        throw new UnauthorizedException(
                                'Không tìm thấy ID người dùng trong yêu cầu'
                        );
                }

                try {
                        const parsedData = this.parseRequestData(body);
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

        private parseRequestData(body: SaveCardBody): ParsedSaveCardData {
                const { orderCode, weddingData, weddingImages } = body;

                if (!orderCode) {
                        this.logger.error('orderCode không hợp lệ');
                        throw new BadRequestException('orderCode không hợp lệ');
                }

                let parsedWeddingData: object;
                try {
                        parsedWeddingData =
                                typeof weddingData === 'string'
                                        ? JSON.parse(weddingData)
                                        : weddingData;
                } catch (error) {
                        this.logger.error(`Lỗi phân tích weddingData: ${error.message}`);
                        throw new BadRequestException('Định dạng weddingData không hợp lệ');
                }

                if (
                        !parsedWeddingData['groom'] ||
                        !parsedWeddingData['bride'] ||
                        !parsedWeddingData['weddingDate'] ||
                        !parsedWeddingData['groomAddress'] ||
                        !parsedWeddingData['brideAddress'] ||
                        !parsedWeddingData['lunarDay']
                ) {
                        this.logger.error('Thiếu các trường bắt buộc trong weddingData');
                        throw new BadRequestException(
                                'Thiếu thông tin chú rể, cô dâu, ngày cưới, địa điểm chú rể, địa điểm cô dâu hoặc ngày âm lịch trong weddingData'
                        );
                }

                let parsedWeddingImages: { position: string; url: string }[];
                try {
                        if (typeof weddingImages === 'string') {
                                parsedWeddingImages = JSON.parse(weddingImages);
                        } else if (Array.isArray(weddingImages)) {
                                parsedWeddingImages = weddingImages;
                        } else if (weddingImages && typeof weddingImages === 'object') {
                                // Chuyển đổi object weddingImages thành mảng
                                parsedWeddingImages = Object.values(weddingImages).map(
                                        (img: any) => ({
                                                position: img.position,
                                                url: img.url,
                                        })
                                );
                        } else {
                                parsedWeddingImages = [];
                        }

                        if (
                                !Array.isArray(parsedWeddingImages) ||
                                parsedWeddingImages.some((img) => !img.position || !img.url)
                        ) {
                                throw new Error('Định dạng weddingImages không hợp lệ');
                        }
                } catch (error) {
                        this.logger.error(`Lỗi phân tích weddingImages: ${error.message}`);
                        throw new BadRequestException('Định dạng weddingImages không hợp lệ');
                }

                return {
                        orderCode,
                        weddingData: parsedWeddingData,
                        weddingImages: parsedWeddingImages,
                };
        }

        @Get('user-templates')
        async getUserTemplates(@Request() req: AuthenticatedRequest) {
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

        @Get(':template_id/:guest_id/:invitation_id/:card_id')
        async getGuestAndCardByGuestIdAndInvitationId(
                @Param('template_id', ParseIntPipe) template_id: number,
                @Param('guest_id', ParseIntPipe) guest_id: number,
                @Param('invitation_id', ParseIntPipe) invitation_id: number,
                @Param('card_id', ParseIntPipe) card_id: number
        ) {
                this.logger.log(
                        `Nhận yêu cầu lấy thông tin khách mời và thiệp cưới với template_id ${template_id}, guest_id ${guest_id}, invitation_id ${invitation_id}, card_id ${card_id}`
                );

                // Loại bỏ kiểm tra userId vì đây là link share
                return this.cardService.getGuestAndCardByGuestIdAndInvitationId(
                        template_id,
                        guest_id,
                        invitation_id,
                        card_id
                );
        }
}
