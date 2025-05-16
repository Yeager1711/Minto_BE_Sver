import { Module } from '@nestjs/common';
import { AuthUserService } from './login_user.service';
import { AuthUserController } from './login_user.controller';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Users } from './../../../entities/users.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([Users]),
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'MintoInvitiOnsJWTSECRET_KEYVALUES',
            signOptions: { expiresIn: '1d' },
        }),
    ],
    controllers: [AuthUserController],
    providers: [AuthUserService, JwtStrategy],
    exports: [AuthUserService],
})
export class AuthUserLoginModule {}
