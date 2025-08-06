// user.service.ts
import {
        BadRequestException,
        Injectable,
        NotFoundException,
        ConflictException,
        UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Users } from '../../../entities/users.entity';
import { Role } from '../../../entities/role.entity';
import { Cards } from '../../../entities/cards.entity';
import { Payments } from '../../../entities/payments.entity';

@Injectable()
export class UserService {
        constructor(
                @InjectRepository(Users)
                private readonly userRepository: Repository<Users>,
                @InjectRepository(Role)
                private readonly roleRepository: Repository<Role>,
                @InjectRepository(Cards)
                private readonly cardsRepository: Repository<Cards>,
                @InjectRepository(Payments)
                private readonly paymentsRepository: Repository<Payments>
        ) {}

        async getAllUsers(): Promise<Users[]> {
                const users = await this.userRepository.find({
                        relations: ['role'],
                        select: [
                                'user_id',
                                'full_name',
                                'email',
                                'phone',
                                'address',
                                'role',
                                'created_at',
                        ],
                });

                if (!users || users.length === 0) {
                        throw new NotFoundException('No users found');
                }

                return users;
        }

        async getUserProfile(userId: number): Promise<Users> {
                const user = await this.userRepository.findOne({
                        where: { user_id: userId },
                        relations: ['role'],
                        select: [
                                'user_id',
                                'full_name',
                                'email',
                                'phone',
                                'address',
                                'role',
                                'created_at',
                        ],
                });

                if (!user) {
                        throw new NotFoundException('User not found');
                }

                return user;
        }

        async updateUserName(userId: number, fullName: string): Promise<Users> {
                const user = await this.userRepository.findOne({
                        where: { user_id: userId },
                });

                if (!user) {
                        throw new NotFoundException('User not found');
                }

                if (!fullName || fullName.trim().length < 3) {
                        throw new BadRequestException(
                                'Full name must be at least 3 characters long'
                        );
                }

                user.full_name = fullName.trim();
                await this.userRepository.save(user);

                return this.userRepository.findOne({
                        where: { user_id: userId },
                        relations: ['role'],
                        select: ['user_id', 'full_name', 'email', 'phone', 'address', 'role'],
                });
        }

        async checkDiscountEligibility(
                userId: number
        ): Promise<{ isEligible: boolean; message: string }> {
                // Tìm user
                const user = await this.userRepository.findOne({
                        where: { user_id: userId },
                        select: ['user_id', 'created_at'],
                });

                if (!user) {
                        throw new NotFoundException('User not found');
                }

                // Kiểm tra thời gian tạo tài khoản (trong vòng 7 ngày)
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

                if (!user.created_at || user.created_at < sevenDaysAgo) {
                        return {
                                isEligible: false,
                                message: 'Tài khoản đã được tạo quá 7 ngày, không đủ điều kiện áp dụng ưu đãi.',
                        };
                }

                // Kiểm tra xem user đã tạo thiệp cưới chưa
                const cardCount = await this.cardsRepository.count({
                        where: { user_id: userId },
                });

                if (cardCount > 0) {
                        return {
                                isEligible: false,
                                message: 'Tài khoản đã tạo thiệp cưới, không đủ điều kiện áp dụng ưu đãi.',
                        };
                }

                // Kiểm tra thanh toán
                const payment = await this.paymentsRepository.findOne({
                        where: { user: { user_id: userId }, status: 'COMPLETED' },
                });

                if (payment) {
                        return {
                                isEligible: false,
                                message: 'Tài khoản đã có thanh toán hoàn thành, không đủ điều kiện áp dụng ưu đãi.',
                        };
                }

                return {
                        isEligible: true,
                        message: 'Tài khoản đủ điều kiện áp dụng ưu đãi cho lần sử dụng đầu tiên.',
                };
        }
}
