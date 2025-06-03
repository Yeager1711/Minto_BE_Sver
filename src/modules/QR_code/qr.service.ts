import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QR_Users } from '../../entities/qr-users.entity';

@Injectable()
export class QRService {
        constructor(
                @InjectRepository(QR_Users)
                private qrUsersRepository: Repository<QR_Users>
        ) {}

        private async generateRandomQrId(): Promise<number> {
                const min = 100000;
                const max = 2147483647;
                let qrId: number;
                let existingQr: QR_Users | null;

                do {
                        qrId = Math.floor(min + Math.random() * (max - min));
                        existingQr = await this.qrUsersRepository.findOne({
                                where: { qr_id: qrId },
                        });
                } while (existingQr);

                return qrId;
        }

        async createQr(
                userId: number,
                qrData: {
                        bank: string;
                        accountNumber: string;
                        accountHolder: string;
                        qrCodeUrl: string;
                }
        ) {
                const { bank, accountNumber, accountHolder, qrCodeUrl } = qrData;

                if (
                        !accountNumber ||
                        accountNumber.length < 6 ||
                        accountNumber.length > 20 ||
                        !/^\d+$/.test(accountNumber)
                ) {
                        throw new BadRequestException('Số tài khoản phải có từ 6 đến 20 chữ số');
                }
                if (
                        !accountHolder ||
                        accountHolder.length < 3 ||
                        !/^[A-Za-z\s]+$/.test(accountHolder)
                ) {
                        throw new BadRequestException(
                                'Tên chủ tài khoản không hợp lệ, chỉ được chứa chữ cái và khoảng trắng'
                        );
                }
                if (!qrCodeUrl) {
                        throw new BadRequestException('URL mã QR không được để trống');
                }

                const existingQrForUser = await this.qrUsersRepository.findOne({
                        where: { user: { user_id: userId } },
                });

                if (existingQrForUser) {
                        throw new BadRequestException('Mỗi người dùng chỉ được tạo 1 mã QR');
                }

                const existingQr = await this.qrUsersRepository.findOne({
                        where: {
                                bank: bank || null,
                                account_number: accountNumber,
                        },
                });

                if (existingQr) {
                        throw new BadRequestException(
                                'Số tài khoản đã được tạo với ngân hàng này rồi !'
                        );
                }

                const qrId = await this.generateRandomQrId();

                const qrUser = this.qrUsersRepository.create({
                        qr_id: qrId,
                        user: { user_id: userId },
                        bank,
                        account_number: accountNumber,
                        account_holder: accountHolder,
                        qr_code_url: qrCodeUrl,
                        created_at: new Date(),
                        status: 'SUCCESS',
                });

                const savedQr = await this.qrUsersRepository.save(qrUser);

                return {
                        qrId: savedQr.qr_id,
                        bank: savedQr.bank,
                        accountNumber: savedQr.account_number,
                        accountHolder: savedQr.account_holder,
                        qrCodeUrl: savedQr.qr_code_url,
                        createdAt: savedQr.created_at,
                        status: savedQr.status,
                };
        }

        async getQrsByUser(userId: number) {
                const qrUsers = await this.qrUsersRepository.find({
                        where: { user: { user_id: userId } },
                });

                return qrUsers.map((qr) => ({
                        qrId: qr.qr_id,
                        bank: qr.bank,
                        accountNumber: qr.account_number,
                        accountHolder: qr.account_holder,
                        qrCodeUrl: qr.qr_code_url,
                        createdAt: qr.created_at,
                        status: qr.status,
                }));
        }

        async getPublicQrsByUser(userId: number) {
                const qrUsers = await this.qrUsersRepository.find({
                        where: { status: 'ACTIVE', user: { user_id: userId } },
                });
                return qrUsers.map((qr) => ({
                        qrId: qr.qr_id,
                        bank: qr.bank,
                        accountNumber: qr.account_number,
                        accountHolder: qr.account_holder,
                        qrCodeUrl: qr.qr_code_url,
                        createdAt: qr.created_at,
                        status: qr.status,
                }));
        }

        async updateQrStatus(userId: number, qrId: number, newStatus: 'SUCCESS' | 'ACTIVE') {
                const qr = await this.qrUsersRepository.findOne({
                        where: { qr_id: qrId, user: { user_id: userId } },
                });

                if (!qr) {
                        throw new NotFoundException('Không tìm thấy mã QR cho người dùng này');
                }

                if (!['SUCCESS', 'ACTIVE'].includes(newStatus)) {
                        throw new BadRequestException(
                                'Trạng thái không hợp lệ. Phải là SUCCESS hoặc ACTIVE.'
                        );
                }

                qr.status = newStatus;
                const updatedQr = await this.qrUsersRepository.save(qr);

                return {
                        qrId: updatedQr.qr_id,
                        bank: updatedQr.bank,
                        accountNumber: updatedQr.account_number,
                        accountHolder: updatedQr.account_holder,
                        qrCodeUrl: updatedQr.qr_code_url,
                        createdAt: updatedQr.created_at,
                        status: updatedQr.status,
                };
        }
}
