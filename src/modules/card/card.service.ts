import {
        BadRequestException,
        Injectable,
        InternalServerErrorException,
        NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError, FindOptionsWhere } from 'typeorm';
import { Cards, CardStatus } from '../../entities/cards.entity';
import { Invitations } from '../../entities/invitations.entity';
import { Guests } from '../../entities/guests.entity';
import { Thumbnails } from '../../entities/thumbnails.entity';
import { Templates } from '../../entities/templates.entity';
import { SharedLinks } from '../../entities/shared-links.entity';
import { Payments, PaymentMethod, PaymentStatus } from '../../entities/payments.entity';
import logger from '../../common/logger';
import { Users } from '../../entities/users.entity';

@Injectable()
export class CardService {
        private readonly logger = logger.child({ context: 'CardService' });

        constructor(
                @InjectRepository(Cards)
                private cardsRepository: Repository<Cards>,
                @InjectRepository(Invitations)
                private invitationsRepository: Repository<Invitations>,
                @InjectRepository(Guests)
                private guestsRepository: Repository<Guests>,
                @InjectRepository(Thumbnails)
                private thumbnailsRepository: Repository<Thumbnails>,
                @InjectRepository(Templates)
                private templatesRepository: Repository<Templates>,
                @InjectRepository(SharedLinks)
                private sharedLinksRepository: Repository<SharedLinks>,
                @InjectRepository(Payments)
                private paymentsRepository: Repository<Payments>,
                @InjectRepository(Users)
                private usersRepository: Repository<Users>
        ) {}

        private async getUniqueRandomId<T>(
                repository: Repository<T>,
                entityClass: any,
                idField: keyof T
        ): Promise<number> {
                let id: number;
                let maxRetries = 5;
                do {
                        if (maxRetries-- <= 0) {
                                const error = new BadRequestException(
                                        'Không thể tạo ID duy nhất sau nhiều lần thử'
                                );
                                this.logger.error(
                                        `Failed to generate unique ID for ${String(idField)} after ${maxRetries} retries`,
                                        {
                                                error: error.message,
                                                stack: error.stack,
                                                entity: entityClass.name,
                                        }
                                );
                                throw error;
                        }
                        id = entityClass.generateRandomId();
                } while (
                        await repository.findOne({
                                where: { [idField]: id } as FindOptionsWhere<T>,
                        })
                );
                return id;
        }

        async saveCard(userId: number, data: any): Promise<any> {
                this.logger.info(`Processing data for user ${userId}`, { data });

                const { templateId, weddingData, inviteeNames, weddingImages, totalPrice } = data;

                if (!templateId || !weddingData || !inviteeNames || totalPrice === undefined) {
                        const error = new BadRequestException(
                                'Thiếu templateId, weddingData, inviteeNames hoặc totalPrice'
                        );
                        this.logger.error('Input validation failed', {
                                error: error.message,
                                stack: error.stack,
                                userId,
                                data: { templateId, weddingData, inviteeNames, totalPrice },
                        });
                        throw error;
                }

                const template = await this.templatesRepository.findOne({
                        where: { template_id: templateId },
                });
                if (!template) {
                        const error = new NotFoundException(
                                `Template với ID ${templateId} không tồn tại`
                        );
                        this.logger.error('Template not found', {
                                error: error.message,
                                stack: error.stack,
                                userId,
                                templateId,
                        });
                        throw error;
                }

                const user = await this.usersRepository.findOne({ where: { user_id: userId } });
                if (!user) {
                        const error = new NotFoundException(`User với ID ${userId} không tồn tại`);
                        this.logger.error('User not found', {
                                error: error.message,
                                stack: error.stack,
                                userId,
                        });
                        throw error;
                }

                if (
                        !weddingData.groom ||
                        !weddingData.bride ||
                        !weddingData.weddingDate ||
                        !weddingData.groomAddress ||
                        !weddingData.brideAddress ||
                        !weddingData.lunarDay
                ) {
                        const error = new BadRequestException(
                                'Thiếu thông tin chú rể, cô dâu, ngày cưới, địa điểm chú rể, địa điểm cô dâu hoặc ngày âm lịch'
                        );
                        this.logger.error('Wedding data validation failed', {
                                error: error.message,
                                stack: error.stack,
                                userId,
                                weddingData,
                        });
                        throw error;
                }

                return await this.cardsRepository.manager.transaction(
                        async (transactionalEntityManager) => {
                                try {
                                        const cardId = await this.getUniqueRandomId(
                                                this.cardsRepository,
                                                Cards,
                                                'card_id'
                                        );

                                        const card = new Cards();
                                        card.card_id = cardId;
                                        card.user_id = userId;
                                        card.template_id = templateId;
                                        card.created_at = new Date();
                                        card.status = CardStatus.DRAFT;
                                        card.custom_data = { weddingData, weddingImages };
                                        const savedCard = await transactionalEntityManager.save(
                                                Cards,
                                                card
                                        );
                                        this.logger.info(`Tạo card với ID ${savedCard.card_id}`, {
                                                cardId: savedCard.card_id,
                                        });

                                        const invitationId = await this.getUniqueRandomId(
                                                this.invitationsRepository,
                                                Invitations,
                                                'invitation_id'
                                        );

                                        const invitation = new Invitations();
                                        invitation.invitation_id = invitationId;
                                        invitation.card = savedCard;
                                        invitation.groom_name = weddingData.groom;
                                        invitation.bride_name = weddingData.bride;
                                        invitation.wedding_date = new Date(
                                                weddingData.weddingDate
                                                        .split('/')
                                                        .reverse()
                                                        .join('-')
                                        );
                                        invitation.lunar_day = weddingData.lunarDay;
                                        invitation.venue_groom = weddingData.groomAddress;
                                        invitation.venue_bride = weddingData.brideAddress;
                                        invitation.story_groom = weddingData.groomStory || '';
                                        invitation.story_bride = weddingData.brideStory || '';
                                        invitation.custom_image =
                                                weddingImages?.mainImage?.url || '';
                                        const savedInvitation =
                                                await transactionalEntityManager.save(
                                                        Invitations,
                                                        invitation
                                                );
                                        this.logger.info(
                                                `Tạo invitation với ID ${savedInvitation.invitation_id}`,
                                                {
                                                        invitationId: savedInvitation.invitation_id,
                                                }
                                        );

                                        let sharedLinks: { guest_id: number; share_url: string }[] =
                                                [];
                                        if (
                                                inviteeNames &&
                                                Array.isArray(inviteeNames) &&
                                                inviteeNames.length > 0
                                        ) {
                                                const guests = await Promise.all(
                                                        inviteeNames.map(async (name: string) => {
                                                                if (!name.trim()) {
                                                                        const error =
                                                                                new BadRequestException(
                                                                                        'Tên khách mời không được để trống'
                                                                                );
                                                                        this.logger.error(
                                                                                'Guest name validation failed',
                                                                                {
                                                                                        error: error.message,
                                                                                        stack: error.stack,
                                                                                        userId,
                                                                                        guestName: name,
                                                                                }
                                                                        );
                                                                        throw error;
                                                                }
                                                                const guestId =
                                                                        await this.getUniqueRandomId(
                                                                                this
                                                                                        .guestsRepository,
                                                                                Guests,
                                                                                'guest_id'
                                                                        );
                                                                const guest = new Guests();
                                                                guest.guest_id = guestId;
                                                                guest.invitation_id =
                                                                        savedInvitation.invitation_id;
                                                                guest.full_name = name;
                                                                return guest;
                                                        })
                                                );
                                                const savedGuests =
                                                        await transactionalEntityManager.save(
                                                                Guests,
                                                                guests
                                                        );
                                                this.logger.info(
                                                        `Lưu ${guests.length} khách mời cho invitation ${savedInvitation.invitation_id}`,
                                                        {
                                                                guestCount: guests.length,
                                                                invitationId:
                                                                        savedInvitation.invitation_id,
                                                        }
                                                );

                                                sharedLinks = await Promise.all(
                                                        savedGuests.map(async (guest) => {
                                                                const linkId =
                                                                        await this.getUniqueRandomId(
                                                                                this
                                                                                        .sharedLinksRepository,
                                                                                SharedLinks,
                                                                                'link_id'
                                                                        );
                                                                const sharedLink =
                                                                        new SharedLinks();
                                                                sharedLink.link_id = linkId;
                                                                sharedLink.guest_id =
                                                                        guest.guest_id;
                                                                sharedLink.share_url = `/template/${templateId}/${encodeURIComponent(guest.full_name)}`;
                                                                sharedLink.created_at = new Date();
                                                                sharedLink.expires_at = new Date(
                                                                        Date.now() +
                                                                                30 *
                                                                                        24 *
                                                                                        60 *
                                                                                        60 *
                                                                                        1000
                                                                );
                                                                await transactionalEntityManager.save(
                                                                        SharedLinks,
                                                                        sharedLink
                                                                );
                                                                return {
                                                                        guest_id: guest.guest_id,
                                                                        share_url: sharedLink.share_url,
                                                                };
                                                        })
                                                );
                                                this.logger.info(
                                                        `Tạo ${sharedLinks.length} SharedLinks cho các khách mời`,
                                                        {
                                                                sharedLinkCount: sharedLinks.length,
                                                        }
                                                );
                                        }

                                        if (weddingImages && typeof weddingImages === 'object') {
                                                const thumbnails = await Promise.all(
                                                        Object.entries(weddingImages).map(
                                                                async ([key, image]: [
                                                                        string,
                                                                        any,
                                                                ]) => {
                                                                        const thumbnailId =
                                                                                await this.getUniqueRandomId(
                                                                                        this
                                                                                                .thumbnailsRepository,
                                                                                        Thumbnails,
                                                                                        'thumbnail_id'
                                                                                );
                                                                        const thumbnail =
                                                                                new Thumbnails();
                                                                        thumbnail.thumbnail_id =
                                                                                thumbnailId;
                                                                        thumbnail.template =
                                                                                template;
                                                                        thumbnail.image_url =
                                                                                image.url || '';
                                                                        thumbnail.position =
                                                                                image.position ||
                                                                                key;
                                                                        thumbnail.description = `Ảnh cho ${key}`;
                                                                        return thumbnail;
                                                                }
                                                        )
                                                );
                                                await transactionalEntityManager.save(
                                                        Thumbnails,
                                                        thumbnails
                                                );
                                                this.logger.info(
                                                        `Lưu ${thumbnails.length} thumbnails cho template ${templateId}`,
                                                        {
                                                                thumbnailCount: thumbnails.length,
                                                                templateId,
                                                        }
                                                );
                                        }

                                        const paymentId = await this.getUniqueRandomId(
                                                this.paymentsRepository,
                                                Payments,
                                                'payment_id'
                                        );
                                        const payment = new Payments();
                                        payment.payment_id = paymentId;
                                        payment.card = savedCard;
                                        payment.user = user;
                                        payment.amount = totalPrice;
                                        payment.payment_date = new Date();
                                        payment.payment_method = PaymentMethod.ONLINE;
                                        payment.status = PaymentStatus.COMPLETED;
                                        payment.transaction_id = paymentId.toString();
                                        await transactionalEntityManager.save(Payments, payment);
                                        this.logger.info(`Tạo payment với ID ${paymentId}`, {
                                                paymentId,
                                                amount: totalPrice,
                                                userId,
                                                cardId: savedCard.card_id,
                                        });

                                        if (inviteeNames && inviteeNames.length > 0) {
                                                savedCard.status = CardStatus.COMPLETED;
                                                await transactionalEntityManager.save(
                                                        Cards,
                                                        savedCard
                                                );
                                                this.logger.info(
                                                        `Cập nhật card ${savedCard.card_id} sang trạng thái COMPLETED`,
                                                        {
                                                                cardId: savedCard.card_id,
                                                                status: CardStatus.COMPLETED,
                                                        }
                                                );
                                        }

                                        return {
                                                ...savedCard,
                                                sharedLinks,
                                        };
                                } catch (error) {
                                        if (error instanceof QueryFailedError) {
                                                this.logger.error(
                                                        'Database error occurred during transaction',
                                                        {
                                                                error: error.message,
                                                                stack: error.stack,
                                                                sql: error.query,
                                                                parameters: error.parameters,
                                                                driverError: error.driverError,
                                                                userId,
                                                                templateId,
                                                                data,
                                                        }
                                                );
                                                throw new BadRequestException(
                                                        'Lỗi khi lưu dữ liệu, có thể do xung đột khóa chính'
                                                );
                                        } else {
                                                this.logger.error(
                                                        'Unexpected error occurred during transaction',
                                                        {
                                                                error: error.message,
                                                                stack: error.stack,
                                                                userId,
                                                                templateId,
                                                                data,
                                                        }
                                                );
                                                throw error;
                                        }
                                }
                        }
                );
        }

        // src/services/card.service.ts
        async getUserPaidTemplates(userId: number): Promise<any[]> {
                this.logger.info(`Lấy danh sách template đã thanh toán cho user ${userId}`);

                if (!Number.isInteger(userId) || userId <= 0) {
                        this.logger.error(`ID người dùng không hợp lệ: ${userId}`);
                        throw new BadRequestException('ID người dùng không hợp lệ');
                }

                try {
                        const cards = await this.cardsRepository
                                .createQueryBuilder('card')
                                .leftJoinAndSelect('card.template', 'template')
                                .leftJoinAndSelect('card.invitations', 'invitations')
                                .leftJoinAndSelect('invitations.guests', 'guests')
                                .leftJoinAndSelect('guests.sharedLinks', 'sharedLinks')
                                .leftJoinAndSelect('card.payments', 'payments')
                                .where('card.user_id = :userId', { userId })
                                .andWhere('card.status = :status', { status: CardStatus.COMPLETED })
                                .andWhere('payments.status = :paymentStatus', {
                                        paymentStatus: PaymentStatus.COMPLETED,
                                })
                                .select([
                                        'card.card_id',
                                        'template.template_id',
                                        'template.name',
                                        'template.image_url',
                                        'template.price',
                                        'invitations.invitation_id',
                                        'guests.guest_id',
                                        'guests.invitation_id',
                                        'guests.full_name',
                                        'sharedLinks.link_id',
                                        'sharedLinks.guest_id',
                                        'sharedLinks.share_url',
                                        'sharedLinks.created_at',
                                        'sharedLinks.expires_at',
                                        'payments.amount',
                                        'payments.payment_date',
                                        'payments.status',
                                        'payments.payment_method',
                                ])
                                .getMany();

                        if (!cards || cards.length === 0) {
                                this.logger.warn(
                                        `Không tìm thấy template đã thanh toán cho user ${userId}`
                                );
                                return [];
                        }

                        const result = cards.map((card) => ({
                                card_id: card.card_id,
                                template: {
                                        template_id: card.template.template_id,
                                        name: card.template.name,
                                        image_url: card.template.image_url,
                                        price: card.template.price,
                                        payments: card.payments.map((payment) => ({
                                                amount: payment.amount,
                                                payment_date: payment.payment_date,
                                                status: payment.status,
                                                payment_method: payment.payment_method,
                                        })),
                                        guests:
                                                card.invitations?.flatMap(
                                                        (invitation) =>
                                                                invitation.guests?.map((guest) => ({
                                                                        guest_id: guest.guest_id,
                                                                        invitation_id:
                                                                                guest.invitation_id,
                                                                        full_name: guest.full_name,
                                                                        sharedLinks:
                                                                                guest.sharedLinks?.map(
                                                                                        (link) => ({
                                                                                                link_id: link.link_id,
                                                                                                guest_id: link.guest_id,
                                                                                                share_url: link.share_url,
                                                                                                created_at: link.created_at,
                                                                                                expires_at: link.expires_at,
                                                                                        })
                                                                                ) || [],
                                                                })) || []
                                                ) || [],
                                },
                        }));

                        this.logger.info(
                                `Tìm thấy ${cards.length} template đã thanh toán cho user ${userId}`
                        );
                        return result;
                } catch (error) {
                        this.logger.error(`Lỗi khi lấy danh sách template: ${error.message}`, {
                                stack: error.stack,
                                userId,
                        });
                        throw new InternalServerErrorException(
                                `Lỗi khi lấy danh sách template: ${error.message}`
                        );
                }
        }

        async getGuestAndCardByGuestIdAndInvitationId(
                template_id: number,
                guest_id: number,
                invitation_id: number
        ): Promise<any> {
                this.logger.info(
                        `Lấy thông tin khách mời và thiệp cưới cho template_id ${template_id}, guest_id ${guest_id}, và invitation_id ${invitation_id}`
                );

                // Validate input parameters
                if (
                        !Number.isInteger(template_id) ||
                        template_id <= 0 ||
                        !Number.isInteger(guest_id) ||
                        guest_id <= 0 ||
                        !Number.isInteger(invitation_id) ||
                        invitation_id <= 0
                ) {
                        this.logger.error(
                                `ID không hợp lệ: template_id ${template_id}, guest_id ${guest_id}, invitation_id ${invitation_id}`
                        );
                        throw new NotFoundException(
                                'ID mẫu thiệp, khách mời, hoặc lời mời không hợp lệ'
                        );
                }

                try {
                        const guest = await this.guestsRepository
                                .createQueryBuilder('guest')
                                .leftJoinAndSelect('guest.invitation', 'invitation')
                                .leftJoinAndSelect('invitation.card', 'card')
                                .leftJoinAndSelect('card.template', 'template')
                                .leftJoinAndSelect('template.thumbnails', 'thumbnails')
                                .leftJoinAndSelect('guest.sharedLinks', 'sharedLinks')
                                .where('guest.guest_id = :guest_id', { guest_id })
                                .andWhere('guest.invitation_id = :invitation_id', { invitation_id })
                                .andWhere('card.template_id = :template_id', { template_id })
                                .select([
                                        'guest.guest_id',
                                        'guest.invitation_id',
                                        'guest.full_name',
                                        'invitation.invitation_id',
                                        'invitation.groom_name',
                                        'invitation.bride_name',
                                        'invitation.wedding_date',
                                        'invitation.venue_groom',
                                        'invitation.venue_bride',
                                        'invitation.lunar_day',
                                        'invitation.story_groom',
                                        'invitation.story_bride',
                                        'invitation.custom_image',
                                        'card.card_id',
                                        'card.created_at',
                                        'card.custom_data',
                                        'card.status',
                                        'template.template_id',
                                        'template.name',
                                        'template.description',
                                        'template.image_url',
                                        'template.price',
                                        'template.status',
                                        'thumbnails.thumbnail_id',
                                        'thumbnails.image_url',
                                        'thumbnails.position',
                                        'thumbnails.description',
                                        'sharedLinks.link_id',
                                        'sharedLinks.guest_id',
                                        'sharedLinks.share_url',
                                        'sharedLinks.created_at',
                                        'sharedLinks.expires_at',
                                ])
                                .getOne();

                        if (!guest) {
                                this.logger.warn(
                                        `Không tìm thấy khách mời với guest_id ${guest_id}, invitation_id ${invitation_id}, và template_id ${template_id}`
                                );
                                throw new NotFoundException(
                                        `Khách mời với ID ${guest_id} không tồn tại, không thuộc lời mời ${invitation_id}, hoặc không thuộc mẫu thiệp ${template_id}`
                                );
                        }

                        if (!guest.invitation || !guest.invitation.card) {
                                this.logger.warn(
                                        `Không tìm thấy thiệp cưới liên quan cho guest_id ${guest_id}`
                                );
                                throw new NotFoundException(
                                        `Thiệp cưới liên quan đến khách mời ${guest_id} không tồn tại`
                                );
                        }

                        const result = {
                                guest: {
                                        guest_id: guest.guest_id,
                                        invitation_id: guest.invitation_id,
                                        full_name: guest.full_name,
                                        sharedLinks: guest.sharedLinks.map((link) => ({
                                                link_id: link.link_id,
                                                guest_id: link.guest_id,
                                                share_url: link.share_url,
                                                created_at: link.created_at,
                                                expires_at: link.expires_at,
                                        })),
                                },
                                card: {
                                        card_id: guest.invitation.card.card_id,
                                        created_at: guest.invitation.card.created_at,
                                        status: guest.invitation.card.status,
                                        custom_data: guest.invitation.card.custom_data,
                                        template: {
                                                template_id:
                                                        guest.invitation.card.template.template_id,
                                                name: guest.invitation.card.template.name,
                                                description:
                                                        guest.invitation.card.template.description,
                                                image_url: guest.invitation.card.template.image_url,
                                                price: guest.invitation.card.template.price,
                                                status: guest.invitation.card.template.status,
                                        },
                                        thumbnails: guest.invitation.card.template.thumbnails.map(
                                                (thumbnail) => ({
                                                        thumbnail_id: thumbnail.thumbnail_id,
                                                        image_url: thumbnail.image_url,
                                                        position: thumbnail.position,
                                                        description: thumbnail.description,
                                                })
                                        ),
                                        invitations: [
                                                {
                                                        invitation_id:
                                                                guest.invitation.invitation_id,
                                                        groom_name: guest.invitation.groom_name,
                                                        bride_name: guest.invitation.bride_name,
                                                        wedding_date: guest.invitation.wedding_date,
                                                        venue_groom: guest.invitation.venue_groom,
                                                        venue_bride: guest.invitation.venue_bride,
                                                        lunar_day: guest.invitation.lunar_day,
                                                        story_groom: guest.invitation.story_groom,
                                                        story_bride: guest.invitation.story_bride,
                                                        custom_image: guest.invitation.custom_image,
                                                },
                                        ],
                                },
                        };

                        this.logger.info(
                                `Lấy thông tin thành công cho guest_id ${guest_id}, invitation_id ${invitation_id}, và template_id ${template_id}`
                        );
                        return result;
                } catch (error) {
                        this.logger.error(`Lỗi khi lấy thông tin khách mời: ${error.message}`, {
                                stack: error.stack,
                                template_id,
                                guest_id,
                                invitation_id,
                        });
                        throw error instanceof NotFoundException
                                ? error
                                : new NotFoundException(
                                          `Lỗi khi lấy thông tin khách mời: ${error.message}`
                                  );
                }
        }
}
