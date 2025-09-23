import { Controller, Get, Post, Body, Req } from '@nestjs/common';
import { DynamicService } from './dynamic.service';

interface AuthenticatedRequest extends Request {
        user?: { user_id: number; email?: string };
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
        updateState(
                @Req() req: AuthenticatedRequest,
                @Body() body: { state: 'minimal' | 'compact' | 'expanded'; [key: string]: any }
        ) {
                const userId = req.user?.user_id;
                if (!userId) {
                        return { error: 'Unauthorized' };
                }
                const { state, ...data } = body;
                return this.dynamicService.setState(userId, state, data);
        }
}
