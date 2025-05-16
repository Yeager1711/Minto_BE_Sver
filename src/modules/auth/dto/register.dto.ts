// src/auth/dto/register.dto.ts
import { IsEmail, IsNotEmpty, MinLength, Matches } from 'class-validator';

export class RegisterDto {
        @IsNotEmpty({ message: 'Họ và tên không được để trống' })
        full_name: string;

        @IsEmail({}, { message: 'Email không hợp lệ' })
        @IsNotEmpty({ message: 'Email không được để trống' })
        email: string;

        @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
        @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
        @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
                message: 'Mật khẩu phải chứa ít nhất một chữ hoa, một chữ thường và một số',
        })
        password: string;

        @IsNotEmpty({ message: 'Xác nhận mật khẩu không được để trống' })
        confirmPassword: string;
}
