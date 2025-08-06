import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';

interface AuthenticatedRequest extends Request {
        user?: { user_id?: number; userId?: number; email?: string };
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
        constructor(private readonly jwtService: JwtService) {}

        async use(req: AuthenticatedRequest, res: Response, next: NextFunction) {
                const authHeader = req.headers.authorization;
                if (!authHeader || !authHeader.startsWith('Bearer ')) {
                        throw new UnauthorizedException('Unauthorized: No token provided');
                }

                const token = authHeader.split(' ')[1];
                console.log('Access_Token:', token);

                try {
                        const payload = await this.jwtService.verifyAsync(token);
                        console.log('Payload:', payload);

                        if (!payload.user_id && !payload.userId) {
                                throw new UnauthorizedException(
                                        'Invalid payload: user_id or userId required'
                                );
                        }

                        // Chuẩn hóa payload để gán vào req.user
                        req.user = {
                                user_id: payload.user_id || payload.userId,
                        };
                        next();
                } catch (error) {
                        console.error('Token verification error:', error.message);
                        if (error.name === 'TokenExpiredError') {
                                throw new UnauthorizedException('Unauthorized: Token has expired');
                        }
                        if (error.name === 'JsonWebTokenError') {
                                throw new UnauthorizedException(
                                        `Unauthorized: Invalid token - ${error.message}`
                                );
                        }
                        throw new UnauthorizedException(`Unauthorized: ${error.message}`);
                }
        }
}
