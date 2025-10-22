import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { readFileSync } from 'fs';
import { ScheduleModule } from '@nestjs/schedule';
import * as crypto from 'crypto';

if (!(global as any).crypto) {
        (global as any).crypto = crypto;
}

// Entities
import { Users } from './entities/users.entity';
import { Role } from './entities/role.entity';
import { Category } from './entities/category.entity';
import { Templates } from './entities/templates.entity';
import { Thumbnails } from './entities/thumbnails.entity';
import { Cards } from './entities/cards.entity';
import { Invitations } from './entities/invitations.entity';
import { Guests } from './entities/guests.entity';
import { Payments } from './entities/payments.entity';
import { QR_Users } from './entities/qr-users.entity';
import { Error_Feedbacks } from './entities/error-feedbacks.entity';
import { Feedback_Users } from './entities/feedback-users.entity';

// Middleware
import { AuthMiddleware } from './middlewares/auth/auth.middleware';
import { ImageKitController } from './imagekit/imagekit.controller';

// Modules
import { UserModule } from './modules/auth/user/user.module';
import { CategoryModule } from './modules/category/category.module';
import { TemplateModule } from './modules/template/template.module';
import { AuthModule } from './modules/auth/register/auth.module';
import { AuthUserLoginModule } from './modules/auth/login/login_user.module';
import { CardModule } from './modules/card/card.module';
import { PayOSModule } from './modules/payment/payos.module';
import { QRModule } from './modules/QR_code/qr.module';
import { ErrorFeedbackModule } from './modules/feedback/error-feedback/error-feedback.module';
import { UserFeedbackModule } from './modules/feedback/user-feedback/user-feedback.module';
import { AI_Module } from './modules/auth/AI_reply/ai.module';
import { DynamicModule } from './modules/dynamic/dynamic.module';

const uploadDir = join(__dirname, '..', 'Uploads', 'templates');

@Module({
        imports: [
                ScheduleModule.forRoot(),
                ConfigModule.forRoot({
                        isGlobal: true,
                        envFilePath: '.env',
                }),
                TypeOrmModule.forRoot({
                        type: 'mysql',
                        host: process.env.DB_HOST || '',
                        port: parseInt(process.env.DB_PORT, 10),
                        username: process.env.DB_USER || '',
                        password: process.env.DB_PASSWORD || '', // Thay bằng mật khẩu thực tế từ Aiven
                        database: process.env.DB_NAME || 'minto',
                        entities: [
                                Users,
                                Role,
                                Category,
                                Templates,
                                Thumbnails,
                                Cards,
                                Invitations,
                                Guests,
                                Payments,
                                QR_Users,
                                Error_Feedbacks,
                                Feedback_Users,
                        ],
                        synchronize: true,
                        ssl: {
                                ca: readFileSync(join(__dirname, '..', 'ca.pem')), // Đường dẫn đến tệp CA certificate từ Aiven
                                rejectUnauthorized: false,
                        },
                        driver: require('mysql2'), // Sử dụng mysql2 để hỗ trợ tốt hơn
                }),
                JwtModule.register({
                        global: true,
                        secret: process.env.JWT_SECRET || 'MintoInvitiOnsJWTSECRET_KEYVALUES',
                        signOptions: { expiresIn: '1d' },
                }),
                MulterModule.register({
                        storage: diskStorage({
                                destination: uploadDir,
                                filename: (req, file, callback) => {
                                        const uniqueSuffix =
                                                Date.now() + '-' + Math.round(Math.random() * 1e9);
                                        const ext = extname(file.originalname);
                                        callback(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
                                },
                        }),
                        fileFilter: (req, file, callback) => {
                                if (!file.mimetype.match(/image\/(jpg|jpeg|png|gif)$/)) {
                                        return callback(
                                                new Error(
                                                        'Chỉ chấp nhận file ảnh (jpg, jpeg, png, gif)'
                                                ),
                                                false
                                        );
                                }
                                callback(null, true);
                        },
                        limits: {
                                fileSize: 5 * 1024 * 1024, // Giới hạn 5MB
                        },
                }),
                AuthModule,
                AuthUserLoginModule,
                UserModule,
                CategoryModule,
                TemplateModule,
                CardModule,
                PayOSModule,
                QRModule,
                ErrorFeedbackModule,
                UserFeedbackModule,
                AI_Module,
                DynamicModule,
        ],
        controllers: [ImageKitController], // Thêm ImageKitController vào đây
})
export class AppModule implements NestModule {
        configure(consumer: MiddlewareConsumer) {
                consumer.apply(AuthMiddleware)
                        .exclude(
                                { path: 'auth/register', method: RequestMethod.POST },
                                { path: 'auth/login', method: RequestMethod.POST },
                                { path: 'categories/getCategories', method: RequestMethod.GET },
                                {
                                        path: 'templates/getTemplate/:template_id',
                                        method: RequestMethod.GET,
                                },
                                {
                                        path: 'cards/:template_id/:guest_id/:invitation_id/:card_id',
                                        method: RequestMethod.GET,
                                },
                                {
                                        path: 'templates/getTemplate',
                                        method: RequestMethod.GET,
                                },

                                { path: 'qr/public/qrs/:userId', method: RequestMethod.GET },
                                {
                                        path: 'user-feedback/all-user-feedback',
                                        method: RequestMethod.GET,
                                }
                        )
                        .forRoutes(
                                { path: 'users/profile', method: RequestMethod.GET },
                                { path: 'users/all-users', method: RequestMethod.GET },
                                { path: 'categories/add-template', method: RequestMethod.POST },
                                { path: 'templates/add-template', method: RequestMethod.POST },
                                { path: 'cards/save-card', method: RequestMethod.POST },
                                { path: 'cards/user-templates', method: RequestMethod.GET },
                                { path: 'payos/create-payment', method: RequestMethod.POST },
                                { path: 'payos/status/:orderCode', method: RequestMethod.PATCH },
                                { path: 'payos/statistics', method: RequestMethod.GET },
                                { path: 'users/profile/name', method: RequestMethod.PATCH },
                                { path: 'qr/create', method: RequestMethod.POST },
                                { path: 'qr/my-qrs', method: RequestMethod.GET },
                                { path: 'qr/:qrId/status', method: RequestMethod.PATCH },
                                { path: 'error-feedback/submit', method: RequestMethod.POST },
                                {
                                        path: 'error-feedback/all-error-feedback',
                                        method: RequestMethod.GET,
                                },
                                {
                                        path: 'error-feedback/:id',
                                        method: RequestMethod.PATCH,
                                },
                                {
                                        path: 'error-feedback/user-feedbacks',
                                        method: RequestMethod.GET,
                                },
                                {
                                        path: 'users/check-discount-eligibility',
                                        method: RequestMethod.GET,
                                },
                                {
                                        path: 'user-feedback/submit',
                                        method: RequestMethod.POST,
                                },
                                {
                                        path: 'templates/update-template/:template_id',
                                        method: RequestMethod.PATCH,
                                },
                                {
                                        path: 'ai/ask-minto',
                                        method: RequestMethod.POST,
                                },
                                {
                                        path: 'ai/end-session',
                                        method: RequestMethod.POST,
                                },
                                {
                                        path: 'templates/update-all-prices',
                                        method: RequestMethod.PATCH,
                                },
                                {
                                        path: 'qr/edit/:qrId',
                                        method: RequestMethod.PATCH,
                                },
                                { path: 'dynamic/status', method: RequestMethod.GET },
                                { path: 'dynamic/update', method: RequestMethod.POST }
                        );
        }
}

if (process.env.NODE_ENV !== 'production') {
        console.log('DB Config:', {
                host: process.env.DB_HOST,
                port: process.env.DB_PORT,
                username: process.env.DB_USER,
                database: process.env.DB_NAME,
        });
        console.log('SSL Config Enabled:', true);
        console.log('JWT_SECRET:', process.env.JWT_SECRET);
}

// MYSQL LARAGON

// import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
// import { TypeOrmModule } from '@nestjs/typeorm';
// import { ConfigModule } from '@nestjs/config';
// import { JwtModule } from '@nestjs/jwt';
// import { MulterModule } from '@nestjs/platform-express';
// import { memoryStorage } from 'multer';
// import { join } from 'path';
// import { ScheduleModule } from '@nestjs/schedule';
// // Entities
// import { Users } from './entities/users.entity';
// import { Role } from './entities/role.entity';
// import { Category } from './entities/category.entity';
// import { Templates } from './entities/templates.entity';
// import { Thumbnails } from './entities/thumbnails.entity';
// import { Cards } from './entities/cards.entity';
// import { Invitations } from './entities/invitations.entity';
// import { Guests } from './entities/guests.entity';
// import { Payments } from './entities/payments.entity';
// import { Feedback_Users } from './entities/feedback-users.entity';

// import { QR_Users } from './entities/qr-users.entity';
// import { Error_Feedbacks } from './entities/error-feedbacks.entity';

// // Middleware
// import { AuthMiddleware } from './middlewares/auth/auth.middleware';

// // Modules
// import { UserModule } from './modules/auth/user/user.module';
// import { CategoryModule } from './modules/category/category.module';
// import { TemplateModule } from './modules/template/template.module';
// import { AuthModule } from './modules/auth/register/auth.module';
// import { AuthUserLoginModule } from './modules/auth/login/login_user.module';
// import { CardModule } from './modules/card/card.module';
// import { PayOSModule } from './modules/payment/payos.module';
// import { QRModule } from './modules/QR_code/qr.module';
// import { ErrorFeedbackModule } from './modules/feedback/error-feedback/error-feedback.module';
// import { UserFeedbackModule } from './modules/feedback/user-feedback/user-feedback.module';
// import { AI_Module } from './modules/auth/AI_reply/ai.module';
// import { DynamicModule } from './modules/dynamic/dynamic.module';
// // Controllers
// import { ImageKitController } from './imagekit/imagekit.controller';

// @Module({
//         imports: [
//                 ScheduleModule.forRoot(),
//                 ConfigModule.forRoot({
//                         isGlobal: true,
//                         envFilePath: '.env',
//                 }),
//                 TypeOrmModule.forRoot({
//                         type: 'mysql',
//                         host: '127.0.0.1',
//                         port: 3306,
//                         username: 'root',
//                         password: '',
//                         database: 'minto',
//                         entities: [
//                                 Users,
//                                 Role,
//                                 Category,
//                                 Templates,
//                                 Thumbnails,
//                                 Cards,
//                                 Invitations,
//                                 Guests,
//                                 Payments,
//                                 QR_Users,
//                                 Error_Feedbacks,
//                                 Feedback_Users,
//                         ],
//                         synchronize: false,
//                 }),
//                 JwtModule.register({
//                         global: true,
//                         secret: process.env.JWT_SECRET || 'MintoInvitiOnsJWTSECRET_KEYVALUES',
//                         signOptions: { expiresIn: '1d' },
//                 }),
//                 MulterModule.register({
//                         storage: memoryStorage(),
//                         fileFilter: (req, file, callback) => {
//                                 if (!file.mimetype.match(/image\/(jpg|jpeg|png|gif)$/)) {
//                                         return callback(
//                                                 new Error(
//                                                         'Chỉ chấp nhận file ảnh (jpg, jpeg, png, gif)'
//                                                 ),
//                                                 false
//                                         );
//                                 }
//                                 callback(null, true);
//                         },
//                         limits: {
//                                 fileSize: 5 * 1024 * 1024,
//                         },
//                 }),
//                 AuthModule,
//                 AuthUserLoginModule,
//                 UserModule,
//                 CategoryModule,
//                 TemplateModule,
//                 CardModule,
//                 PayOSModule,
//                 QRModule,
//                 ErrorFeedbackModule,
//                 UserFeedbackModule,
//                 AI_Module,
//                 DynamicModule,
//         ],
//         controllers: [ImageKitController],
// })
// export class AppModule implements NestModule {
//         configure(consumer: MiddlewareConsumer) {
//                 consumer.apply(AuthMiddleware)
//                         .exclude(
//                                 { path: 'auth/register', method: RequestMethod.POST },
//                                 { path: 'auth/login', method: RequestMethod.POST },
//                                 { path: 'categories/getCategories', method: RequestMethod.GET },
//                                 {
//                                         path: 'templates/getTemplate/:template_id',
//                                         method: RequestMethod.GET,
//                                 },
//                                 {
//                                         path: 'cards/:template_id/:guest_id/:invitation_id/:card_id',
//                                         method: RequestMethod.GET,
//                                 },
//                                 {
//                                         path: 'templates/getTemplate',
//                                         method: RequestMethod.GET,
//                                 },

//                                 { path: 'qr/public/qrs/:userId', method: RequestMethod.GET },
//                                 {
//                                         path: 'user-feedback/all-user-feedback',
//                                         method: RequestMethod.GET,
//                                 },
//                                 { path: 'qr/public/qrs/:userId', method: RequestMethod.GET }

//                                 // Dynamic Island
//                         )
//                         .forRoutes(
//                                 { path: 'users/profile', method: RequestMethod.GET },
//                                 { path: 'users/all-users', method: RequestMethod.GET },
//                                 { path: 'categories/add-template', method: RequestMethod.POST },
//                                 { path: 'templates/add-template', method: RequestMethod.POST },
//                                 { path: 'cards/save-card', method: RequestMethod.POST },
//                                 { path: 'cards/user-templates', method: RequestMethod.GET },
//                                 { path: 'payos/create-payment', method: RequestMethod.POST },
//                                 { path: 'payos/status/:orderCode', method: RequestMethod.PATCH },
//                                 { path: 'payos/statistics', method: RequestMethod.GET },
//                                 { path: 'users/profile/name', method: RequestMethod.PATCH },
//                                 { path: 'qr/create', method: RequestMethod.POST },
//                                 { path: 'qr/my-qrs', method: RequestMethod.GET },
//                                 { path: 'qr/:qrId/status', method: RequestMethod.PATCH },
//                                 { path: 'error-feedback/submit', method: RequestMethod.POST },
//                                 {
//                                         path: 'error-feedback/all-error-feedback',
//                                         method: RequestMethod.GET,
//                                 },
//                                 {
//                                         path: 'error-feedback/:id',
//                                         method: RequestMethod.PATCH,
//                                 },
//                                 {
//                                         path: 'error-feedback/user-feedbacks',
//                                         method: RequestMethod.GET,
//                                 },
//                                 // --------------------
//                                 {
//                                         path: 'error-feedback/user-feedbacks/processed',
//                                         method: RequestMethod.GET,
//                                 },
//                                 {
//                                         path: 'error-feedback/:id/read',
//                                         method: RequestMethod.PATCH,
//                                 },
//                                 // --------------------

//                                 {
//                                         path: 'users/check-discount-eligibility',
//                                         method: RequestMethod.GET,
//                                 },
//                                 {
//                                         path: 'user-feedback/submit',
//                                         method: RequestMethod.POST,
//                                 },
//                                 {
//                                         path: 'templates/update-template/:template_id',
//                                         method: RequestMethod.PATCH,
//                                 },

//                                 {
//                                         path: 'ai/ask-minto',
//                                         method: RequestMethod.POST,
//                                 },
//                                 {
//                                         path: 'ai/end-session',
//                                         method: RequestMethod.POST,
//                                 },
//                                 {
//                                         path: 'templates/update-all-prices',
//                                         method: RequestMethod.PATCH,
//                                 },
//                                 {
//                                         path: 'qr/edit/:qrId',
//                                         method: RequestMethod.PATCH,
//                                 },

//                                 { path: 'dynamic/status', method: RequestMethod.GET },
//                                 { path: 'dynamic/update', method: RequestMethod.POST }
//                         );
//         }
// }

// if (process.env.NODE_ENV !== 'production') {
//         console.log('DB Config:', {
//                 host: process.env.DB_HOST,
//                 port: process.env.DB_PORT,
//                 username: process.env.DB_USER,
//                 database: process.env.DB_NAME,
//         });
//         console.log('JWT_SECRET:', process.env.JWT_SECRET);
// }
