import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QRController } from './qr.controller';
import { QRService } from './qr.service';
import { QR_Users } from '../../entities/qr-users.entity';

@Module({
        imports: [
                TypeOrmModule.forFeature([QR_Users]), 
        ],
        controllers: [QRController],
        providers: [QRService],
})
export class QRModule {}
