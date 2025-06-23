// src/auth/auth.service.ts
import {
        Injectable,
        ConflictException,
        BadRequestException,
        UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { Users } from '../../../entities/users.entity';
import { Role } from '../../../entities/role.entity';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';

@Injectable()
export class AuthService {
        constructor(
                @InjectRepository(Users) private userRepository: Repository<Users>,
                @InjectRepository(Role) private roleRepository: Repository<Role>,
                private jwtService: JwtService
        ) {}

        async register(registerDto: RegisterDto): Promise<{ user: Users; token: string }> {
                return await this.userRepository.manager.transaction(async (manager) => {
                        const userRepo = manager.getRepository(Users);
                        const roleRepo = manager.getRepository(Role);

                        const { full_name, email, password, confirmPassword } = registerDto;

                        // Kiểm tra mật khẩu khớp
                        if (password !== confirmPassword) {
                                throw new BadRequestException(
                                        'Mật khẩu và xác nhận mật khẩu không khớp'
                                );
                        }

                        // Kiểm tra email đã tồn tại
                        const existingUser = await userRepo.findOne({ where: { email } });
                        if (existingUser) {
                                throw new ConflictException('Email đã được sử dụng');
                        }

                        // Mã hóa mật khẩu
                        const salt = await bcrypt.genSalt(10);
                        const hashedPassword = await bcrypt.hash(password, salt);

                        // Xác định vai trò (admin nếu là người dùng đầu tiên, ngược lại là customer)
                        const userCount = await userRepo.count();
                        const roleName = userCount === 0 ? 'admin' : 'customer';
                        let role = await roleRepo.findOne({ where: { name: roleName } });

                        if (!role) {
                                role = roleRepo.create({ name: roleName });
                                await roleRepo.save(role);
                        }

                        // Tạo user_id ngẫu nhiên
                        let randomId: number;
                        do {
                                const min = 100000;
                                const max = 999999;
                                randomId = Math.floor(Math.random() * (max - min + 1)) + min;
                        } while (await this.isDuplicateId(userRepo, randomId));

                        // Tạo người dùng mới
                        const user = userRepo.create({
                                user_id: randomId,
                                full_name,
                                email,
                                password: hashedPassword,
                                role,
                                created_at: new Date(),
                        });

                        // Lưu người dùng
                        const savedUser = await userRepo.save(user);

                        // Tạo JWT token
                        const token = this.jwtService.sign({
                                user_id: savedUser.user_id,
                                email: savedUser.email,
                        });

                        // Trả về thông tin người dùng (bao gồm created_at để kiểm tra nếu cần)
                        return { user: savedUser, token };
                });
        }

        private async isDuplicateId(repo: Repository<Users>, id: number): Promise<boolean> {
                const existingUser = await repo.findOne({ where: { user_id: id } });
                return !!existingUser;
        }
}
