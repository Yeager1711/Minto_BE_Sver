import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Invitations } from './invitations.entity';
import { SharedLinks } from './shared-links.entity';

@Entity('Guests')
export class Guests {
  @Column({ type: 'int', primary: true })
  guest_id: number;

  @Column()
  invitation_id: number;

  @Column()
  full_name: string;

  @ManyToOne(() => Invitations, (invitation) => invitation.guests)
  @JoinColumn({ name: 'invitation_id' })
  invitation: Invitations;

  @OneToMany(() => SharedLinks, (sharedLink) => sharedLink.guest)
  sharedLinks: SharedLinks[];

  static generateRandomId(): number {
    return Math.floor(100000 + Math.random() * 900000); // Tạo ID ngẫu nhiên 6 chữ số
  }
}