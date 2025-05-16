import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Users } from '../../../entities/users.entity';
import { LoginDto } from '../dto/login.dto';
@Injectable()
export class AuthUserService {
        constructor(
                @InjectRepository(Users) private readonly userRepository: Repository<Users>,
                private readonly jwtService: JwtService
        ) {}

        async validateUser(loginDto: LoginDto) {
                const { email, password } = loginDto;

                const user = await this.userRepository.findOne({
                        where: { email },
                        relations: ['role'],
                });

                if (!user) {
                        throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
                }

                const isPasswordValid = await bcrypt.compare(password, user.password);
                if (!isPasswordValid) {
                        throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
                }

                const payload = {
                        userId: user.user_id,
                };
                const accessToken = this.jwtService.sign(payload, { expiresIn: '30d' });

                return { accessToken, user }; // Trả về cả user để controller sử dụng
        }
}
