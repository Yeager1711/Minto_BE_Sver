// src/entities/role.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Users } from './users.entity';

@Entity('Role')
export class Role {
        @PrimaryGeneratedColumn()
        role_id: number;

        @Column()
        name: string;

        @OneToMany(() => Users, (user) => user.role)
        users: Users[];
}
