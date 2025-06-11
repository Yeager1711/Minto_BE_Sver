import {
        Controller,
        Post,
        Body,
        Get,
        HttpCode,
        Req,
        Patch,
        Param,
        ParseIntPipe,
        BadRequestException,
} from '@nestjs/common';
import { QRService } from './qr.service';

interface AuthenticatedRequest extends Request {
        user?: { user_id: number; email?: string };
}

@Controller('qr')
export class QRController {
        constructor(private readonly qrService: QRService) {}

        @Post('create')
        @HttpCode(201)
        async createQr(
                @Body()
                body: {
                        bank: string;
                        accountNumber: string;
                        accountHolder: string;
                        qrCodeUrl: string;
                        representative?: string;
                },
                @Req() req: AuthenticatedRequest
        ) {
                const userId = req.user?.user_id;
                if (!userId) {
                        throw new Error('User ID not found in request');
                }
                return this.qrService.createQr(userId, body);
        }

        @Get('my-qrs')
        async getMyQrs(@Req() req: AuthenticatedRequest) {
                const userId = req.user?.user_id;
                if (!userId) {
                        throw new Error('User ID not found in request');
                }
                return this.qrService.getQrsByUser(userId);
        }

        @Get('public/qrs/:userId')
        async getPublicQrs(@Param('userId', ParseIntPipe) userId: number) {
                return this.qrService.getPublicQrsByUser(userId);
        }

        @Patch(':qrId/status')
        @HttpCode(200)
        async updateQrStatus(
                @Param('qrId', ParseIntPipe) qrId: number, 
                @Body('status') status: 'SUCCESS' | 'ACTIVE',
                @Req() req: AuthenticatedRequest
        ) {
                const userId = req.user?.user_id;
                if (!userId) {
                        throw new Error('User ID not found in request');
                }
                if (!status || !['SUCCESS', 'ACTIVE'].includes(status)) {
                        throw new BadRequestException(
                                'Trạng thái không hợp lệ. Phải là SUCCESS hoặc ACTIVE.'
                        );
                }
                return this.qrService.updateQrStatus(userId, status); // Pass only userId and status
        }
}
