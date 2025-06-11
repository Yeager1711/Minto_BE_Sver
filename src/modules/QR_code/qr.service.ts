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
                        representative?: string;
                }
        ) {
                const { bank, accountNumber, accountHolder, qrCodeUrl, representative } = qrData;

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

                // Kiểm tra số lượng QR hiện tại của người dùng
                const existingQrsCount = await this.qrUsersRepository.count({
                        where: { user: { user_id: userId } },
                });

                if (existingQrsCount >= 2) {
                        throw new BadRequestException('Mỗi người dùng chỉ được tạo tối đa 2 mã QR');
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
                        representative: representative || null,
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
                        representative: savedQr.representative,
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
                        representative: qr.representative,
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
                        representative: qr.representative,
                }));
        }

        async updateQrStatus(userId: number, newStatus: 'SUCCESS' | 'ACTIVE') {
                // Find all QR codes for the user
                const qrUsers = await this.qrUsersRepository.find({
                        where: { user: { user_id: userId } },
                });

                if (!qrUsers.length) {
                        throw new NotFoundException('Không tìm thấy mã QR cho người dùng này');
                }

                // Update all QR codes to the new status
                const updatedQrs = await Promise.all(
                        qrUsers.map(async (qr) => {
                                qr.status = newStatus;
                                return this.qrUsersRepository.save(qr);
                        })
                );

                // Return the updated list of QR codes
                return updatedQrs.map((qr) => ({
                        qrId: qr.qr_id,
                        bank: qr.bank,
                        accountNumber: qr.account_number,
                        accountHolder: qr.account_holder,
                        qrCodeUrl: qr.qr_code_url,
                        createdAt: qr.created_at,
                        status: qr.status,
                        representative: qr.representative,
                }));
        }
}
