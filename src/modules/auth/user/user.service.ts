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
}
