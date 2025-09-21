import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Equal, LessThan, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Payments } from '../../entities/payments.entity';
import { Users } from '../../entities/users.entity';
import { Cards } from '../../entities/cards.entity';
import { Guests } from '../../entities/guests.entity';
import { UserService } from '../auth/user/user.service';
import { Templates } from '../../entities/templates.entity';
const PayOS = require('@payos/node');

@Injectable()
export class PayOSService {
        private payos: any;
        private readonly logger = new Logger(PayOSService.name);

        constructor(
                @InjectRepository(Payments)
                private readonly paymentRepository: Repository<Payments>,
                @InjectRepository(Users)
                private readonly userRepository: Repository<Users>,
                @InjectRepository(Cards)
                private readonly cardRepository: Repository<Cards>,
                @InjectRepository(Guests)
                private readonly guestsRepository: Repository<Guests>,
                private readonly userService: UserService,
                @InjectRepository(Templates)
                private readonly templatesRepository: Repository<Templates>
        ) {
                this.payos = new PayOS(
                        process.env.PAYOS_CLIENT_ID,
                        process.env.PAYOS_API_KEY,
                        process.env.PAYOS_CHECKSUM_KEY
                );
        }

        async createPaymentLink(
                userId: number,
                totalAmount: number,
                description: string = 'Thanh toán thiệp cưới',
                templateId: string,
                inviteeNames: string[] // Thêm tham số inviteeNames
        ) {
                try {
                        const user = await this.userRepository.findOne({
                                where: { user_id: userId },
                        });
                        if (!user) {
                                throw new BadRequestException('Người dùng không tồn tại');
                        }

                        // Tạo Card entity
                        const card = new Cards();
                        card.card_id = Cards.generateRandomId();
                        card.user_id = userId;
                        card.template_id = parseInt(templateId);
                        card.created_at = new Date();
                        card.custom_data = null;
                        card.status = 'DRAFT';
                        card.user = user;

                        // Lưu Card entity
                        await this.cardRepository.save(card);

                        // Tạo Payment entity
                        const paymentId = Payments.generateRandomId();
                        const orderCode = paymentId.toString();

                        const payment = new Payments();
                        payment.payment_id = paymentId;
                        payment.card = card;
                        payment.user = user;
                        payment.amount = totalAmount;
                        payment.payment_date = new Date();
                        payment.payment_method = 'online';
                        payment.status = 'PENDING';
                        payment.transaction_id = orderCode;

                        // Lưu Payment entity
                        await this.paymentRepository.save(payment);

                        // Tạo Guests với card_id được gán ngay lập tức
                        if (inviteeNames && inviteeNames.length > 0) {
                                const guests = inviteeNames.map((name) => {
                                        if (!name.trim()) {
                                                throw new BadRequestException(
                                                        'Tên khách mời không được để trống'
                                                );
                                        }
                                        const guest = new Guests();
                                        guest.guest_id = Guests.generateRandomId();
                                        guest.invitation_id = null; // Lưu null ban đầu
                                        guest.full_name = name;
                                        guest.card_id = card.card_id; // Gán card_id ngay khi tạo
                                        return guest;
                                });
                                await this.guestsRepository.save(guests);
                        }

                        const paymentData = {
                                orderCode: paymentId,
                                amount: totalAmount,
                                description,
                                returnUrl: `${process.env.NEXT_PUBLIC_PAYOS_RETURN_URL}?templateId=${templateId}&checkOut=true`,
                                cancelUrl: `${process.env.NEXT_PUBLIC_PAYOS_RETURN_URL}?templateId=${templateId}&checkOut=true&status=CANCELLED`,
                                buyerEmail: user.email,
                                buyerName: user.full_name,
                                buyerPhone: user.phone || '',
                        };
                        const paymentLink = await this.payos.createPaymentLink(paymentData);

                        return {
                                success: true,
                                paymentLink: paymentLink.checkoutUrl,
                                paymentId,
                                orderCode,
                                cardId: card.card_id,
                        };
                } catch (error) {
                        console.error(
                                'Lỗi khi tạo liên kết thanh toán:',
                                error.message,
                                error.stack
                        );
                        throw new BadRequestException('Không thể tạo liên kết thanh toán');
                }
        }

        async checkPaymentStatus(orderCode: string, userId: number) {
                try {
                        const paymentInfo = await this.payos.getPaymentLinkInformation(orderCode);
                        console.log('PayOS paymentInfo:', JSON.stringify(paymentInfo, null, 2));

                        const payment = await this.paymentRepository.findOne({
                                where: { transaction_id: orderCode, user: { user_id: userId } },
                                relations: ['user'],
                        });

                        if (!payment) {
                                console.error(
                                        `Không tìm thấy thanh toán với orderCode ${orderCode} và user_id ${userId}`
                                );
                                throw new BadRequestException(
                                        'Không tìm thấy thanh toán hoặc không thuộc về người dùng'
                                );
                        }

                        console.log('Raw payment.status before update:', payment.status);

                        const currentStatus = payment.status.toUpperCase();
                        const pendingStatus = 'PENDING'.toUpperCase();

                        console.log('Normalized currentStatus:', currentStatus);
                        console.log('Normalized pendingStatus:', pendingStatus);

                        if (currentStatus === pendingStatus || paymentInfo.status === 'CANCELLED') {
                                if (paymentInfo.status === 'CANCELLED') {
                                        payment.status = 'CANCELLED';
                                        console.log('Setting payment.status to:', payment.status);
                                        await this.paymentRepository.save(payment);
                                        console.log(`Thanh toán ${orderCode} đã bị hủy`);
                                } else if (paymentInfo.status === 'EXPIRED') {
                                        payment.status = 'FAILED';
                                        console.log('Setting payment.status to:', payment.status);
                                        await this.paymentRepository.save(payment);
                                        console.log(`Thanh toán ${orderCode} đã hết hạn`);
                                } else if (paymentInfo.status === 'PAID') {
                                        payment.status = 'COMPLETED';
                                        console.log('Setting payment.status to:', payment.status);
                                        await this.paymentRepository.save(payment);
                                        console.log(`Thanh toán ${orderCode} đã hoàn tất`);
                                } else {
                                        console.log(
                                                `Trạng thái ${paymentInfo.status} từ PayOS không được xử lý`
                                        );
                                }
                        } else {
                                console.log(
                                        `Thanh toán ${orderCode} hiện tại ở trạng thái ${currentStatus}, không thay đổi`
                                );
                        }

                        const updatedPayment = await this.paymentRepository.findOne({
                                where: { transaction_id: orderCode },
                        });
                        console.log(
                                'Verified database status after update:',
                                updatedPayment?.status
                        );

                        return payment;
                } catch (error) {
                        console.error(
                                'Lỗi khi kiểm tra trạng thái thanh toán:',
                                error.message,
                                error.stack
                        );
                        throw new BadRequestException('Không thể kiểm tra trạng thái thanh toán');
                }
        }

        async handleWebhook(webhookData: any) {
                try {
                        console.log(
                                'Dữ liệu webhook nhận được:',
                                JSON.stringify(webhookData, null, 2)
                        );

                        const isValid = this.payos.verifyPaymentWebhookData(webhookData);
                        if (!isValid) {
                                console.error('Chữ ký webhook không hợp lệ');
                                return { success: false, message: 'Chữ ký webhook không hợp lệ' };
                        }

                        const { orderCode, status, description, amount, code, desc } =
                                webhookData.data;
                        const orderCodeStr = orderCode.toString();

                        const payment = await this.paymentRepository.findOne({
                                where: { transaction_id: orderCodeStr },
                                relations: ['user', 'card'],
                        });

                        if (!payment) {
                                console.error(
                                        `Không tìm thấy thanh toán với orderCode ${orderCodeStr}`
                                );
                                return {
                                        success: false,
                                        message: `Thanh toán ${orderCodeStr} không tìm thấy`,
                                };
                        }

                        if (payment.status === 'PENDING') {
                                if (status) {
                                        if (status === 'PAID') {
                                                payment.status = 'COMPLETED';
                                        } else if (status === 'CANCELLED') {
                                                payment.status = 'CANCELLED';
                                        } else if (status === 'EXPIRED') {
                                                payment.status = 'FAILED';
                                        } else {
                                                console.log(
                                                        `Trạng thái webhook ${status} không được xử lý, giữ PENDING`
                                                );
                                                return {
                                                        success: true,
                                                        message: `Thanh toán ${orderCodeStr} vẫn ở trạng thái PENDING`,
                                                };
                                        }
                                } else {
                                        if (code === '00' && desc.toLowerCase() === 'success') {
                                                payment.status = 'COMPLETED';
                                        } else if (
                                                code === '01' ||
                                                desc.toLowerCase().includes('cancel')
                                        ) {
                                                payment.status = 'CANCELLED';
                                        } else {
                                                console.log(
                                                        `Mã webhook ${code} và mô tả ${desc} không được xử lý, giữ PENDING`
                                                );
                                                return {
                                                        success: true,
                                                        message: `Thanh toán ${orderCodeStr} vẫn ở trạng thái PENDING`,
                                                };
                                        }
                                }

                                await this.paymentRepository.save(payment);
                                console.log(
                                        `Thanh toán ${orderCodeStr} đã được cập nhật thành ${payment.status}`
                                );
                        }

                        return {
                                success: true,
                                message: `Trạng thái thanh toán ${orderCodeStr} đã được cập nhật thành công`,
                        };
                } catch (error) {
                        console.error('Lỗi xử lý webhook:', error.message, error.stack);
                        return { success: false, message: 'Không thể xử lý webhook' };
                }
        }

        @Cron(CronExpression.EVERY_5_MINUTES)
        async handleExpiredPayments() {
                try {
                        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

                        const expiredPayments = await this.paymentRepository.find({
                                where: {
                                        status: 'PENDING',
                                        payment_date: LessThan(fiveMinutesAgo),
                                },
                                relations: ['card'], // Thêm quan hệ để lấy card_id
                        });

                        if (expiredPayments.length === 0) {
                                this.logger.log('No expired payments found.');
                                return;
                        }

                        for (const payment of expiredPayments) {
                                // Đặt trạng thái Payment thành CANCELLED
                                payment.status = 'CANCELLED';
                                await this.paymentRepository.save(payment);
                                this.logger.log(
                                        `Payment ${payment.transaction_id} has been cancelled due to expiration.`
                                );

                                // Xóa các bản ghi Guests có card_id khớp
                                if (payment.card && payment.card.card_id) {
                                        const guests = await this.guestsRepository.find({
                                                where: {
                                                        card_id: Equal(payment.card.card_id),
                                                },
                                        });

                                        if (guests.length > 0) {
                                                await this.guestsRepository.remove(guests);
                                                this.logger.log(
                                                        `Deleted ${guests.length} guests with card_id: ${payment.card.card_id} for cancelled payment ${payment.transaction_id}`
                                                );
                                        } else {
                                                this.logger.log(
                                                        `No guests found with card_id: ${payment.card.card_id} for cancelled payment ${payment.transaction_id}`
                                                );
                                        }
                                } else {
                                        this.logger.warn(
                                                `Payment ${payment.transaction_id} has no associated card_id`
                                        );
                                }
                        }
                } catch (error) {
                        this.logger.error(
                                'Error cancelling expired payments or deleting guests:',
                                error.message,
                                error.stack
                        );
                }
        }

        async getUser(userId: number) {
                return await this.userRepository.findOne({
                        where: { user_id: userId },
                        relations: ['role'],
                });
        }

        async getAllStatistics(startDate?: string, endDate?: string) {
                try {
                        // Tổng doanh thu từ completed payments
                        let revenueQuery = this.paymentRepository
                                .createQueryBuilder('payment')
                                .select([
                                        "DATE(CONVERT_TZ(payment.payment_date, '+00:00', '+07:00')) as paymentDate",
                                        'SUM(payment.amount) as totalAmount',
                                ])
                                .where('payment.status = :status', { status: 'COMPLETED' });

                        // Tổng đơn hàng bị hủy
                        let canceledQuery = this.paymentRepository
                                .createQueryBuilder('payment')
                                .where('payment.status = :status', { status: 'CANCELLED' });

                        // Chi tiết các thanh toán COMPLETED
                        let completedPaymentsQuery = this.paymentRepository
                                .createQueryBuilder('payment')
                                .select([
                                        'payment.payment_id as paymentId',
                                        'payment.payment_date as paymentDate',
                                        'payment.amount as amount',
                                ])
                                .where('payment.status = :status', { status: 'COMPLETED' });

                        // Chi tiết các thanh toán CANCELLED
                        let canceledPaymentsQuery = this.paymentRepository
                                .createQueryBuilder('payment')
                                .select([
                                        'payment.payment_id as paymentId',
                                        'payment.payment_date as paymentDate',
                                        'payment.amount as amount',
                                ])
                                .where('payment.status = :status', { status: 'CANCELLED' });

                        // Chi tiết tất cả các thanh toán (bất kể trạng thái)
                        let paymentsQuery = this.paymentRepository
                                .createQueryBuilder('payment')
                                .leftJoin('payment.card', 'card')
                                .leftJoin('payment.user', 'user')
                                .select([
                                        'payment.payment_id as paymentId',
                                        'payment.card_id as cardId',
                                        'payment.user_id as userId',
                                        'payment.amount as amount',
                                        'payment.payment_date as paymentDate',
                                        'payment.payment_method as paymentMethod',
                                        'payment.status as status',
                                        'payment.transaction_id as transactionId',
                                ]);

                        // Thêm điều kiện thời gian nếu có
                        if (startDate) {
                                const startDateAdjusted = `${startDate}T00:00:00.000Z`;
                                revenueQuery = revenueQuery.andWhere(
                                        'payment.payment_date >= :startDate',
                                        {
                                                startDate: startDateAdjusted,
                                        }
                                );
                                canceledQuery = canceledQuery.andWhere(
                                        'payment.payment_date >= :startDate',
                                        {
                                                startDate: startDateAdjusted,
                                        }
                                );
                                completedPaymentsQuery = completedPaymentsQuery.andWhere(
                                        'payment.payment_date >= :startDate',
                                        {
                                                startDate: startDateAdjusted,
                                        }
                                );
                                canceledPaymentsQuery = canceledPaymentsQuery.andWhere(
                                        'payment.payment_date >= :startDate',
                                        {
                                                startDate: startDateAdjusted,
                                        }
                                );
                                paymentsQuery = paymentsQuery.andWhere(
                                        'payment.payment_date >= :startDate',
                                        {
                                                startDate: startDateAdjusted,
                                        }
                                );
                        }
                        if (endDate) {
                                const endDateAdjusted = `${endDate}T23:59:59.999Z`;
                                revenueQuery = revenueQuery.andWhere(
                                        'payment.payment_date <= :endDate',
                                        {
                                                endDate: endDateAdjusted,
                                        }
                                );
                                canceledQuery = canceledQuery.andWhere(
                                        'payment.payment_date <= :endDate',
                                        {
                                                endDate: endDateAdjusted,
                                        }
                                );
                                completedPaymentsQuery = completedPaymentsQuery.andWhere(
                                        'payment.payment_date <= :endDate',
                                        {
                                                endDate: endDateAdjusted,
                                        }
                                );
                                canceledPaymentsQuery = canceledPaymentsQuery.andWhere(
                                        'payment.payment_date <= :endDate',
                                        {
                                                endDate: endDateAdjusted,
                                        }
                                );
                                paymentsQuery = paymentsQuery.andWhere(
                                        'payment.payment_date <= :endDate',
                                        {
                                                endDate: endDateAdjusted,
                                        }
                                );
                        }

                        const paidOrders = await revenueQuery
                                .groupBy(
                                        "DATE(CONVERT_TZ(payment.payment_date, '+00:00', '+07:00'))"
                                )
                                .orderBy('paymentDate', 'DESC')
                                .getRawMany();

                        const revenueData = {
                                dailyRevenue: paidOrders.map((order) => ({
                                        date: order.paymentDate,
                                        totalAmount: parseFloat(order.totalAmount || 0),
                                })),
                                totalRevenue: paidOrders.reduce(
                                        (sum, order) => sum + parseFloat(order.totalAmount || 0),
                                        0
                                ),
                        };

                        const canceledCount = await canceledQuery.getCount();
                        const completedPayments = await completedPaymentsQuery
                                .orderBy('payment.payment_date', 'DESC')
                                .getRawMany();
                        const canceledPayments = await canceledPaymentsQuery
                                .orderBy('payment.payment_date', 'DESC')
                                .getRawMany();
                        const payments = await paymentsQuery
                                .orderBy('payment.payment_date', 'DESC')
                                .getRawMany();

                        const completedPaymentsData = completedPayments.map((payment) => ({
                                paymentId: payment.paymentId,
                                paymentDate: payment.paymentDate,
                                amount: parseFloat(payment.amount || 0),
                        }));

                        const canceledPaymentsData = canceledPayments.map((payment) => ({
                                paymentId: payment.paymentId,
                                paymentDate: payment.paymentDate,
                                amount: parseFloat(payment.amount || 0),
                        }));

                        const paymentsData = payments.map((payment) => ({
                                paymentId: payment.paymentId,
                                cardId: payment.cardId || null,
                                userId: payment.userId || null,
                                amount: parseFloat(payment.amount || 0),
                                paymentDate: payment.paymentDate,
                                paymentMethod: payment.paymentMethod || 'N/A',
                                status: payment.status,
                                transactionId: payment.transactionId || null,
                        }));

                        // Tổng số template
                        const totalTemplateCount = await this.templatesRepository
                                .createQueryBuilder('template')
                                .getCount();

                        // Lấy tất cả template
                        const allTemplates = await this.templatesRepository
                                .createQueryBuilder('template')
                                .select([
                                        'template.template_id as templateId',
                                        'template.name as templateName',
                                        'template.image_url as templateImage',
                                        'template.price as templatePrice',
                                        'template.status as templateStatus',
                                ])
                                .getRawMany();

                        // Thống kê sử dụng template
                        const templateUsage = await this.cardRepository
                                .createQueryBuilder('card')
                                .innerJoin('card.template', 'template')
                                .select([
                                        'template.template_id as templateId',
                                        'template.name as templateName',
                                        'template.image_url as templateImage',
                                        'template.price as templatePrice',
                                        'template.status as templateStatus',
                                        'COUNT(card.card_id) as usageCount',
                                ])
                                .groupBy(
                                        'template.template_id, template.name, template.image_url, template.price, template.status'
                                )
                                .orderBy('usageCount', 'DESC')
                                .getRawMany();

                        if (
                                revenueData.dailyRevenue.length === 0 &&
                                canceledCount === 0 &&
                                completedPaymentsData.length === 0 &&
                                canceledPaymentsData.length === 0 &&
                                paymentsData.length === 0 &&
                                templateUsage.length === 0 &&
                                totalTemplateCount === 0
                        ) {
                                return {
                                        success: true,
                                        message: 'Không có dữ liệu thống kê trong hệ thống',
                                        data: {
                                                revenue: revenueData,
                                                totalCanceledOrders: canceledCount,
                                                completedPayments: completedPaymentsData,
                                                canceledPayments: canceledPaymentsData,
                                                payments: paymentsData,
                                                totalTemplates: totalTemplateCount,
                                                templateUsage: templateUsage.map((template) => ({
                                                        templateId: template.templateId,
                                                        templateName: template.templateName,
                                                        usageCount: parseInt(template.usageCount),
                                                        templateImage: template.templateImage,
                                                        templatePrice: parseFloat(
                                                                template.templatePrice || 0
                                                        ),
                                                        templateStatus: template.templateStatus,
                                                })),
                                                allTemplates: allTemplates.map((template) => ({
                                                        templateId: template.templateId,
                                                        templateName: template.templateName,
                                                        templateImage: template.templateImage,
                                                        templatePrice: parseFloat(
                                                                template.templatePrice || 0
                                                        ),
                                                        templateStatus: template.templateStatus,
                                                })),
                                        },
                                };
                        }

                        return {
                                success: true,
                                data: {
                                        revenue: revenueData,
                                        totalCanceledOrders: canceledCount,
                                        completedPayments: completedPaymentsData,
                                        canceledPayments: canceledPaymentsData,
                                        payments: paymentsData,
                                        totalTemplates: totalTemplateCount,
                                        allTemplates: allTemplates.map((template) => ({
                                                templateId: template.templateId,
                                                templateName: template.templateName,
                                                templateImage: template.templateImage,
                                                templatePrice: parseFloat(
                                                        template.templatePrice || 0
                                                ),
                                                templateStatus: template.templateStatus,
                                        })),
                                        templateUsage: templateUsage.map((template) => ({
                                                templateId: template.templateId,
                                                templateName: template.templateName,
                                                usageCount: parseInt(template.usageCount),
                                                templateImage: template.templateImage,
                                                templatePrice: parseFloat(
                                                        template.templatePrice || 0
                                                ),
                                                templateStatus: template.templateStatus,
                                        })),
                                },
                        };
                } catch (error) {
                        console.error('Lỗi khi lấy thống kê:', error.message, error.stack);
                        throw new BadRequestException('Không thể lấy thông tin thống kê');
                }
        }
}
