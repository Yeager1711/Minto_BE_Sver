import { Controller, Get, Req, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { Request } from 'express';
import { UserService } from './user.service';
import { AuthMiddleware } from '../../../middlewares/auth/auth.middleware';

interface AuthenticatedRequest extends Request {
        user?: { user_id?: number; userId?: number; email?: string };
}

@Controller('users')
export class UserController {
        constructor(private readonly userService: UserService) {}

        @Get('profile')
        async getUserProfile(@Req() req: AuthenticatedRequest) {
                if (!req.user || (!req.user.user_id && !req.user.userId)) {
                        throw new UnauthorizedException('User not authenticated');
                }
                const userId = req.user.user_id || req.user.userId;
                return this.userService.getUserProfile(userId);
        }
}
