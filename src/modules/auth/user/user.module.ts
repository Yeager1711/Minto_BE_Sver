// user.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { Users } from '../../../entities/users.entity';
import { Role } from '../../../entities/role.entity';
import { Cards } from '../../../entities/cards.entity';
import { Payments } from '../../../entities/payments.entity';
import { AuthModule } from '../register/auth.module';

@Module({
        imports: [TypeOrmModule.forFeature([Users, Role, Cards, Payments]), AuthModule],
        controllers: [UserController],
        providers: [UserService],
        exports: [UserService],
})
export class UserModule {}
