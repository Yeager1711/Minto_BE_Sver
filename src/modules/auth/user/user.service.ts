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

@Injectable()
export class UserService {
        constructor(
                @InjectRepository(Users)
                private readonly userRepository: Repository<Users>,
                @InjectRepository(Role)
                private readonly roleRepository: Repository<Role>
        ) {}

        async getUserProfile(userId: number): Promise<Users> {
                const user = await this.userRepository.findOne({
                        where: { user_id: userId },
                        relations: ['role'],
                        select: ['user_id', 'full_name', 'email', 'phone', 'address', 'role'],
                });

                if (!user) {
                        throw new NotFoundException('User not found');
                }

                return user;
        }

        async updateUserName(userId: number, fullName: string): Promise<Users> {
                // Tìm user theo userId
                const user = await this.userRepository.findOne({
                        where: { user_id: userId },
                });

                if (!user) {
                        throw new NotFoundException('User not found');
                }

                // Validate full_name
                if (!fullName || fullName.trim().length < 3) {
                        throw new BadRequestException(
                                'Full name must be at least 3 characters long'
                        );
                }

                // Cập nhật full_name
                user.full_name = fullName.trim();
                await this.userRepository.save(user);

                // Trả về thông tin user đã cập nhật
                return this.userRepository.findOne({
                        where: { user_id: userId },
                        relations: ['role'],
                        select: ['user_id', 'full_name', 'email', 'phone', 'address', 'role'],
                });
        }
}
