import {
        Controller,
        Post,
        Body,
        Patch,
        Param,
        Request,
        UnauthorizedException,
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
}
