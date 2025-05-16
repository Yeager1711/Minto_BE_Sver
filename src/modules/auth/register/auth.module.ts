// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Users } from '../../../entities/users.entity';
import { Role } from '../../../entities/role.entity';
import { JwtModule } from '@nestjs/jwt';

@Module({
        imports: [
                TypeOrmModule.forFeature([Users, Role]),
                JwtModule.register({
                        secret: process.env.JWT_SECRET || 'your_jwt_secret',
                        signOptions: { expiresIn: '1d' },
                }),
        ],
        providers: [AuthService],
        controllers: [AuthController],
})
export class AuthModule {}
