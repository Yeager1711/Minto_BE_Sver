// user.controller.ts
import {
        Controller,
        Get,
        Patch,
        Req,
        Body,
        UnauthorizedException,
        NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import { UserService } from './user.service';

interface AuthenticatedRequest extends Request {
        user?: { user_id?: number; userId?: number; email?: string; role?: string };
}

@Controller('users')
export class UserController {
        constructor(private readonly userService: UserService) {}

        @Get('all-users')
        async getAllUsers(@Req() req: AuthenticatedRequest) {
                if (!req.user || (!req.user.user_id && !req.user.userId)) {
                        throw new UnauthorizedException('User not authenticated');
                }

                return this.userService.getAllUsers();
        }

        @Get('profile')
        async getUserProfile(@Req() req: AuthenticatedRequest) {
                if (!req.user || (!req.user.user_id && !req.user.userId)) {
                        throw new UnauthorizedException('User not authenticated');
                }
                const userId = req.user.user_id || req.user.userId;
                return this.userService.getUserProfile(userId);
        }

        @Patch('profile/name')
        async updateUserName(
                @Req() req: AuthenticatedRequest,
                @Body('full_name') fullName: string
        ) {
                if (!req.user || (!req.user.user_id && !req.user.userId)) {
                        throw new UnauthorizedException('User not authenticated');
                }
                const userId = req.user.user_id || req.user.userId;
                return this.userService.updateUserName(userId, fullName);
        }

        @Get('check-discount-eligibility')
        async checkDiscountEligibility(@Req() req: AuthenticatedRequest) {
                if (!req.user || (!req.user.user_id && !req.user.userId)) {
                        throw new UnauthorizedException('User not authenticated');
                }
                const userId = req.user.user_id || req.user.userId;
                return this.userService.checkDiscountEligibility(userId);
        }
}
