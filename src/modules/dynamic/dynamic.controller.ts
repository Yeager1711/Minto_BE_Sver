import { Controller, Get, Post, Body, Req } from '@nestjs/common';
import { DynamicService } from './dynamic.service';

interface AuthenticatedRequest extends Request {
        user?: { user_id: number; email?: string };
}

interface DynamicPayload {
        state: 'minimal' | 'compact' | 'expanded';
        TypeContextCollapsed?: boolean;
        action: 'success' | 'failure';
        actionTitle?: string;
        describle?: string;
        time?: string;
        type?: string;
        duration?: number;
        [key: string]: any; // Cho phép mở rộng trường tùy chọn trong tương lai
}

@Controller('dynamic')
export class DynamicController {
        constructor(private readonly dynamicService: DynamicService) {}

        @Get('status')
        getStatus(@Req() req: AuthenticatedRequest) {
                const userId = req.user?.user_id;
                if (!userId) {
                        return { error: 'Unauthorized' };
                }
                return this.dynamicService.getStatus(userId);
        }

        @Post('update')
        updateState(@Req() req: AuthenticatedRequest, @Body() body: DynamicPayload) {
                const userId = req.user?.user_id;
                if (!userId) {
                        return { error: 'Unauthorized' };
                }
                const {
                        state,
                        TypeContextCollapsed = false,
                        action,
                        actionTitle,
                        describle,
                        time,
                        type,
                        duration,
                        ...extraData
                } = body;
                const payload: DynamicPayload = {
                        state,
                        TypeContextCollapsed,
                        action,
                        actionTitle,
                        describle,
                        time: time || new Date().toISOString(), // Mặc định là thời gian hiện tại nếu không có
                        type: type || 'notification', // Mặc định là 'notification' nếu không có
                        duration: duration || 3500, // Mặc định là 3500ms nếu không có
                        ...extraData,
                };
                return this.dynamicService.setState(userId, payload);
        }
}
