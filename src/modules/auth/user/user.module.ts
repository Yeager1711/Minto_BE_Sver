import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { Users } from '../../../entities/users.entity';
import { Role } from '../../../entities/role.entity';
import { AuthModule } from '../register/auth.module';
// import { PayOSService } from '../payment/payos/payos.service';

@Module({
        imports: [TypeOrmModule.forFeature([Users, Role]), AuthModule],
        controllers: [UserController],
        // providers: [UserService, PayOSService],
        providers: [UserService],
        exports: [UserService],
})
export class UserModule {}
