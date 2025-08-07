// ai.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AI_Controller } from './ai.controller';
import { AI_Service } from './ai.service';
import { Users } from '../../../entities/users.entity';
import { AuthModule } from '../register/auth.module';
import { Templates } from 'src/entities/templates.entity';

@Module({
        imports: [
                ConfigModule.forRoot({ isGlobal: true }),
                TypeOrmModule.forFeature([Users, Templates]),
                AuthModule,
        ],
        controllers: [AI_Controller],
        providers: [AI_Service],
        exports: [AI_Service],
})
export class AI_Module {}
