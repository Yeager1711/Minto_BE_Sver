// src/modules/template/template.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Templates } from '../../entities/templates.entity';
import { Category } from '../../entities/category.entity';
import { TemplateController } from './template.controller';
import { TemplateService } from './template.service';

@Module({
        imports: [TypeOrmModule.forFeature([Templates, Category])],
        controllers: [TemplateController],
        providers: [TemplateService],
        exports: [TemplateService],
})
export class TemplateModule {}
