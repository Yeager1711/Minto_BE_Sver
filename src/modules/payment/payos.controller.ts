import {
        Controller,
        Post,
        Body,
        Patch,
        Param,
        Request,
        UnauthorizedException,
        Get,
        Query,
} from '@nestjs/common';
import { PayOSService } from './payos.service';

interface AuthenticatedRequest extends Request {
        user?: { user_id: number };
}

interface CreatePaymentBody {
        totalAmount: number;
        description?: string;
        templateId: string;
        inviteeNames: string[]; // Thêm trường inviteeNames
}

@Controller('payos')
export class PayOSController {
        constructor(private readonly payosService: PayOSService) {}

        @Post('create-payment')
        async createPaymentLink(
                @Request() req: AuthenticatedRequest,
                @Body() body: CreatePaymentBody
        ) {
                const userId = req.user?.user_id;
                if (!userId) {
                        throw new UnauthorizedException('User ID not found in token');
                }
                const { totalAmount, description, templateId, inviteeNames } = body;
                const result = await this.payosService.createPaymentLink(
                        userId,
                        totalAmount,
                        description,
                        templateId,
                        inviteeNames // Truyền inviteeNames
                );
                return result;
        }

        @Post('webhook')
        async handlePayOSWebhook(@Body() webhookData: any) {
                const result = await this.payosService.handleWebhook(webhookData);
                return result;
        }

        @Patch('status/:orderCode')
        async checkPaymentStatus(
                @Request() req: AuthenticatedRequest,
                @Param('orderCode') orderCode: string
        ) {
                const userId = req.user?.user_id;
                if (!userId) {
                        throw new UnauthorizedException('User not authenticated');
                }
                const result = await this.payosService.checkPaymentStatus(orderCode, userId);
                return result;
        }

        @Get('statistics')
        async getAllStatistics(
                @Request() req: AuthenticatedRequest,
                @Query('startDate') startDate?: string,
                @Query('endDate') endDate?: string
        ) {
                const userId = req.user?.user_id;
                const user = await this.payosService.getUser(userId);
                if (!user || user.role.name !== 'admin') {
                        throw new UnauthorizedException(
                                'Administrative privileges are required to view system-wide analytics.'
                        );
                }
                return await this.payosService.getAllStatistics(startDate, endDate);
        }
}
