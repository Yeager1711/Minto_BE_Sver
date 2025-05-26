import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PayOSController } from './payos.controller';
import { PayOSService } from './payos.service';
import { Payments } from '../../entities/payments.entity';
import { Cards } from '../../entities/cards.entity';
import { Users } from '../../entities/users.entity';
import { Role } from '../../entities/role.entity'; // Import Role entity
import { UserService } from '../auth/user/user.service';
import { JwtService } from '@nestjs/jwt'; // Thêm JwtService
import { Guests } from 'src/entities/guests.entity';
import { Templates } from 'src/entities/templates.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payments, Cards, Users, Role, Guests, Templates]), // Thêm Role
  ],
  controllers: [PayOSController],
  providers: [PayOSService, UserService, JwtService], // Thêm JwtService
  exports: [PayOSService],
})
export class PayOSModule {}