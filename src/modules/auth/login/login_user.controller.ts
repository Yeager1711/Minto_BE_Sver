import {
        Controller,
        Post,
        Body,
        HttpCode,
        HttpStatus,
        UsePipes,
        ValidationPipe,
} from '@nestjs/common';
import { AuthUserService } from './login_user.service';
import { LoginDto } from '../dto/login.dto';

@Controller('auth')
export class AuthUserController {
        constructor(private readonly authUserService: AuthUserService) {}

        @Post('login')
        @HttpCode(HttpStatus.OK)
        @UsePipes(new ValidationPipe({ transform: true }))
        async login(@Body() loginDto: LoginDto) {
                const { accessToken, user } = await this.authUserService.validateUser(loginDto);
                const { password, ...userWithoutPassword } = user;
                return {
                        message: 'Đăng nhập thành công',
                        user: userWithoutPassword,
                        accessToken,
                };
        }
}
