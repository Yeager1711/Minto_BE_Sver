import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Users } from '../../../entities/users.entity';
import { LoginDto } from '../dto/login.dto';
import { OAuth2Client } from 'google-auth-library';
import { Role } from '../../../entities/role.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthUserService {
        private googleClient: OAuth2Client;

        constructor(
                @InjectRepository(Users) private readonly userRepository: Repository<Users>,
                private readonly jwtService: JwtService
        ) {
                this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
        }

        async loginWithGoogle(idToken: string) {
                const ticket = await this.googleClient.verifyIdToken({
                        idToken,
                        audience: process.env.GOOGLE_CLIENT_ID,
                });

                const payload = ticket.getPayload();
                if (!payload) {
                        throw new UnauthorizedException('Token Google không hợp lệ');
                }

                const { email, name, picture } = payload;

                let user = await this.userRepository.findOne({
                        where: { email },
                        relations: ['role'],
                });

                if (!user) {
                        user = this.userRepository.create({
                                user_id: Date.now(), 
                                email,
                                full_name: name,
                                password: '',
                                role: { role_id: 2 } as Role,
                        });
                        await this.userRepository.save(user);
                }

                const systemPayload = {
                        userId: user.user_id,
                        role: user.role.name,
                };
                const accessToken = this.jwtService.sign(systemPayload, { expiresIn: '30d' });

                return {
                        message: 'Đăng nhập Google thành công',
                        user,
                        accessToken,
                };
        }

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
                        role: user.role.name,
                };
                const accessToken = this.jwtService.sign(payload, { expiresIn: '30d' });

                return { accessToken, user };
        }
}
