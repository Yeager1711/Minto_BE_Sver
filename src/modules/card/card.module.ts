import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { CardController } from './card.controller';
import { CardService } from './card.service';
import { AuthMiddleware } from '../../middlewares/auth/auth.middleware';
import { Cards } from '../../entities/cards.entity';
import { Invitations } from '../../entities/invitations.entity';
import { Guests } from '../../entities/guests.entity';
import { Thumbnails } from '../../entities/thumbnails.entity';
import { Templates } from '../../entities/templates.entity';
import { Payments } from '../../entities/payments.entity';
import { Users } from '../../entities/users.entity';
import { JwtModule } from '@nestjs/jwt';

@Module({
        imports: [
                TypeOrmModule.forFeature([
                        Cards,
                        Invitations,
                        Guests,
                        Thumbnails,
                        Templates,
                        Payments,
                        Users,
                ]),
                MulterModule.register({
                        dest: './uploads/wedding-images',
                }),
                JwtModule,
        ],
        controllers: [CardController],
        providers: [CardService],
})
export class CardModule implements NestModule {
        configure(consumer: MiddlewareConsumer) {
                consumer.apply(AuthMiddleware).forRoutes('cards/save-card');
        }
}
