// src/auth/auth.controller.ts
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from '../dto/register.dto';

@Controller('auth')
export class AuthController {
        constructor(private readonly authService: AuthService) {}

        @Post('register')
        @HttpCode(HttpStatus.CREATED)
        async register(@Body() registerDto: RegisterDto) {
                const { user, token } = await this.authService.register(registerDto);
                const { password, ...userWithoutPassword } = user; // Loại bỏ mật khẩu từ user.user
                return {
                        message: 'Đăng ký tài khoản thành công',
                        user: userWithoutPassword,
                        token, // Trả về token để client sử dụng
                };
        }
}
