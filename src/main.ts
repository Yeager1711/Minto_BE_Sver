import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as bodyParser from 'body-parser';
import { join } from 'path';
import * as fs from 'fs';

async function bootstrap() {
        const app = await NestFactory.create<NestExpressApplication>(AppModule);

        // Ensure upload directories exist
        const bannerUploadDir = './Uploads/companyBanners';
        const logoUploadDir = './Uploads/companyLogos';
        const templateUploadDir = './Uploads/templates';
        if (!fs.existsSync(bannerUploadDir)) {
                fs.mkdirSync(bannerUploadDir, { recursive: true });
        }
        if (!fs.existsSync(logoUploadDir)) {
                fs.mkdirSync(logoUploadDir, { recursive: true });
        }
        if (!fs.existsSync(templateUploadDir)) {
                fs.mkdirSync(templateUploadDir, { recursive: true });
        }

        // Get configuration from ConfigService
        const configService = app.get(ConfigService);
        const port = configService.get<number>('PORT') || 10000; // Giá trị mặc định là số
        console.log('Log Port:', port);
        const allowedOrigins = configService.get<string>('CORS_ORIGINS')?.split(',') || [
                'https://mintoinvitions.netlify.app/', // Bỏ localhost nếu không cần
        ];

        // Configure CORS
        app.enableCors({
                origin: (origin, callback) => {
                        if (!origin || allowedOrigins.includes(origin)) {
                                callback(null, true);
                        } else {
                                callback(new Error('Not allowed by CORS'));
                        }
                },
                credentials: true,
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
                allowedHeaders: 'Content-Type, Authorization, ngrok-skip-browser-warning',
        });

        // Configure static file serving from 'Uploads' directory
        app.useStaticAssets(join(__dirname, '..', 'Uploads'), {
                prefix: '/uploads',
        });

        // Increase request size limit to 10MB
        app.use(bodyParser.json({ limit: '10mb' }));
        app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

        // Listen on configured port
        await app.listen(port);
        console.log(`Application is running on port: ${port}`);
        console.log(`Live URL: https://minto-sver.onrender.com`); // Log URL live để dễ kiểm tra
}

bootstrap();

// // main.ts
// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app.module';
// import { ConfigService } from '@nestjs/config';
// import { NestExpressApplication } from '@nestjs/platform-express';
// import * as bodyParser from 'body-parser';
// import { join } from 'path';
// import * as fs from 'fs';

// async function bootstrap() {
//         const app = await NestFactory.create<NestExpressApplication>(AppModule);

//         // Ensure upload directories exist
//         const bannerUploadDir = './Uploads/companyBanners';
//         const logoUploadDir = './Uploads/companyLogos';
//         const templateUploadDir = './Uploads/templates';
//         if (!fs.existsSync(bannerUploadDir)) {
//                 fs.mkdirSync(bannerUploadDir, { recursive: true });
//         }
//         if (!fs.existsSync(logoUploadDir)) {
//                 fs.mkdirSync(logoUploadDir, { recursive: true });
//         }
//         if (!fs.existsSync(templateUploadDir)) {
//                 fs.mkdirSync(templateUploadDir, { recursive: true });
//         }

//         // Get configuration from ConfigService
//         const configService = app.get(ConfigService);
//         const port = configService.get<number>('PORT') || 10000;
//         const allowedOrigins = configService.get<string>('CORS_ORIGINS')?.split(',') || [
//                 'http://localhost:9000',
//                 'https://mintoinvitions.netlify.app/',
//         ];

//         // Configure CORS
//         app.enableCors({
//                 origin: (origin, callback) => {
//                         if (!origin || allowedOrigins.includes(origin)) {
//                                 callback(null, true);
//                         } else {
//                                 callback(new Error('Not allowed by CORS'));
//                         }
//                 },
//                 credentials: true,
//                 methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
//                 allowedHeaders: 'Content-Type, Authorization, ngrok-skip-browser-warning',
//         });

//         // Configure static file serving from 'Uploads' directory
//         app.useStaticAssets(join(__dirname, '..', 'Uploads'), {
//                 prefix: '/uploads',
//         });

//         // Increase request size limit to 10MB
//         app.use(bodyParser.json({ limit: '10mb' }));
//         app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

//         // Listen on configured port
//         await app.listen(port);
//         console.log(`Application is running on: http://localhost:${port}`);
// }

// bootstrap();
