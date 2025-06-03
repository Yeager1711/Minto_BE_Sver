import {
        BadRequestException,
        Injectable,
        InternalServerErrorException,
        NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, IsNull, Equal } from 'typeorm';
import { Cards } from '../../entities/cards.entity';
import { Invitations } from '../../entities/invitations.entity';
import { Guests } from '../../entities/guests.entity';
import { Thumbnails } from '../../entities/thumbnails.entity';
import { Templates } from '../../entities/templates.entity';
import { Payments } from '../../entities/payments.entity';
import { Users } from '../../entities/users.entity';
import logger from '../../common/logger';

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

                const { orderCode, weddingData, weddingImages } = data;

                if (!orderCode || !weddingData) {
                        const error = new BadRequestException('Thiếu orderCode hoặc weddingData');
                        this.logger.error('Input validation failed', {
                                error: error.message,
                                stack: error.stack,
                                userId,
                                data,
                        });
                        throw error;
                }

                // Kiểm tra user
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

                // Kiểm tra payment dựa trên orderCode (transaction_id) và user_id
                const payment = await this.paymentsRepository.findOne({
                        where: {
                                transaction_id: orderCode,
                                user: { user_id: userId },
                                status: 'COMPLETED',
                        },
                        relations: ['card', 'card.template'],
                });
                if (!payment || !payment.card) {
                        const error = new BadRequestException(
                                'Thanh toán không hợp lệ hoặc không tồn tại card liên quan'
                        );
                        this.logger.error('Payment or card not found', {
                                error: error.message,
                                stack: error.stack,
                                userId,
                                orderCode,
                        });
                        throw error;
                }

                const card = payment.card;
                const template = card.template;

                // Kiểm tra dữ liệu weddingData
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
                                        // Cập nhật Cards với weddingData và weddingImages
                                        card.custom_data = { weddingData, weddingImages };
                                        card.status = 'COMPLETED';
                                        const updatedCard = await transactionalEntityManager.save(
                                                Cards,
                                                card
                                        );
                                        this.logger.info(
                                                `Cập nhật card với ID ${updatedCard.card_id}`,
                                                {
                                                        cardId: updatedCard.card_id,
                                                }
                                        );

                                        // Tạo Invitations với dữ liệu từ weddingData
                                        const invitationId = await this.getUniqueRandomId(
                                                this.invitationsRepository,
                                                Invitations,
                                                'invitation_id'
                                        );
                                        const invitation = new Invitations();
                                        invitation.invitation_id = invitationId;
                                        invitation.card = updatedCard;
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
                                                weddingImages.find(
                                                        (img: any) => img.position === 'mainImage'
                                                )?.url || '';
                                        const savedInvitation =
                                                await transactionalEntityManager.save(
                                                        Invitations,
                                                        invitation
                                                );
                                        this.logger.info(
                                                `Tạo invitation với ID ${savedInvitation.invitation_id}`,
                                                {
                                                        invitationId: savedInvitation.invitation_id,
                                                        cardId: updatedCard.card_id,
                                                }
                                        );

                                        // Tìm và cập nhật invitation_id cho các bản ghi Guests có card_id khớp và invitation_id = NULL
                                        const existingGuests = await this.guestsRepository.find({
                                                where: {
                                                        card_id: Equal(updatedCard.card_id), // Chỉ lấy Guests có card_id khớp
                                                        invitation_id: IsNull(), // Chỉ lấy Guests chưa có invitation_id
                                                },
                                        });
                                        this.logger.info(
                                                `Tìm thấy ${existingGuests.length} khách mời với card_id = ${updatedCard.card_id} và invitation_id = NULL`,
                                                {
                                                        guestCount: existingGuests.length,
                                                        cardId: updatedCard.card_id,
                                                }
                                        );

                                        if (existingGuests.length > 0) {
                                                await Promise.all(
                                                        existingGuests.map(async (guest) => {
                                                                guest.invitation_id =
                                                                        savedInvitation.invitation_id;
                                                                await transactionalEntityManager.save(
                                                                        Guests,
                                                                        guest
                                                                );
                                                                this.logger.info(
                                                                        `Cập nhật guest với ID ${guest.guest_id} cho invitation ${savedInvitation.invitation_id} và card ${updatedCard.card_id}`,
                                                                        {
                                                                                guestId: guest.guest_id,
                                                                                invitationId:
                                                                                        savedInvitation.invitation_id,
                                                                                cardId: updatedCard.card_id,
                                                                        }
                                                                );
                                                        })
                                                );
                                        } else {
                                                this.logger.warn(
                                                        `Không tìm thấy khách mời nào với card_id = ${updatedCard.card_id} và invitation_id = NULL để cập nhật`,
                                                        {
                                                                cardId: updatedCard.card_id,
                                                                orderCode,
                                                        }
                                                );
                                        }

                                        // Tạo Thumbnails và lưu card_id
                                        if (
                                                Array.isArray(weddingImages) &&
                                                weddingImages.length > 0
                                        ) {
                                                const thumbnails = await Promise.all(
                                                        weddingImages.map(
                                                                async (
                                                                        image: any,
                                                                        index: number
                                                                ) => {
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
                                                                                `image_${index}`;
                                                                        thumbnail.description = `Ảnh cho vị trí ${image.position || index}`;
                                                                        thumbnail.card_id =
                                                                                updatedCard.card_id;
                                                                        return thumbnail;
                                                                }
                                                        )
                                                );
                                                await transactionalEntityManager.save(
                                                        Thumbnails,
                                                        thumbnails
                                                );
                                                this.logger.info(
                                                        `Lưu ${thumbnails.length} thumbnails cho template ${template.template_id} và card ${updatedCard.card_id}`,
                                                        {
                                                                thumbnailCount: thumbnails.length,
                                                                templateId: template.template_id,
                                                                cardId: updatedCard.card_id,
                                                        }
                                                );
                                        }

                                        return {
                                                ...updatedCard,
                                                invitation_id: savedInvitation.invitation_id,
                                        };
                                } catch (error) {
                                        this.logger.error(
                                                'Unexpected error occurred during transaction',
                                                {
                                                        error: error.message,
                                                        stack: error.stack,
                                                        userId,
                                                        orderCode,
                                                        data,
                                                }
                                        );
                                        throw new BadRequestException('Lỗi khi lưu dữ liệu');
                                }
                        }
                );
        }

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
                                .leftJoinAndSelect('card.payments', 'payments')
                                .where('card.user_id = :userId', { userId })
                                .andWhere('card.status = :status', { status: 'COMPLETED' })
                                .andWhere('payments.status = :paymentStatus', {
                                        paymentStatus: 'COMPLETED',
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
                                        'guests.card_id', // Thêm guests.card_id vào select
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

                        // Nhóm dữ liệu theo card_id
                        const result = cards.reduce((acc: any[], card) => {
                                const existingCard = acc.find(
                                        (item) => item.card_id === card.card_id
                                );

                                const templateData = {
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
                                                                        card_id: guest.card_id, // Thêm card_id vào dữ liệu trả về
                                                                })) || []
                                                ) || [],
                                };

                                if (existingCard) {
                                        // Nếu card_id đã tồn tại, không cần merge vì mỗi card_id chỉ có một template
                                } else {
                                        acc.push({
                                                card_id: card.card_id,
                                                template: templateData,
                                        });
                                }

                                return acc;
                        }, []);

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
                invitation_id: number,
                card_id: number
        ): Promise<any> {
                this.logger.info(
                        `Lấy thông tin khách mời và thiệp cưới cho template_id ${template_id}, guest_id ${guest_id}, invitation_id ${invitation_id}, card_id ${card_id}`
                );

                // Validate input parameters
                if (
                        !Number.isInteger(template_id) ||
                        template_id <= 0 ||
                        !Number.isInteger(guest_id) ||
                        guest_id <= 0 ||
                        !Number.isInteger(invitation_id) ||
                        invitation_id <= 0 ||
                        !Number.isInteger(card_id) ||
                        card_id <= 0
                ) {
                        this.logger.error(
                                `ID không hợp lệ: template_id ${template_id}, guest_id ${guest_id}, invitation_id ${invitation_id}, card_id ${card_id}`
                        );
                        throw new NotFoundException(
                                'ID mẫu thiệp, khách mời, lời mời, hoặc card không hợp lệ'
                        );
                }

                try {
                        // Kiểm tra trước xem guest có tồn tại không
                        const guestExists = await this.guestsRepository.findOne({
                                where: { guest_id },
                        });
                        if (!guestExists) {
                                this.logger.warn(
                                        `Khách mời với guest_id ${guest_id} không tồn tại`
                                );
                                throw new NotFoundException(
                                        `Khách mời với ID ${guest_id} không tồn tại`
                                );
                        }

                        // Kiểm tra xem invitation_id có thuộc card_id không bằng createQueryBuilder
                        const invitationCheck = await this.invitationsRepository
                                .createQueryBuilder('invitation')
                                .leftJoinAndSelect('invitation.card', 'card')
                                .where('invitation.invitation_id = :invitation_id', {
                                        invitation_id,
                                })
                                .andWhere('card.card_id = :card_id', { card_id })
                                .getOne();

                        if (!invitationCheck) {
                                this.logger.warn(
                                        `Lời mời với invitation_id ${invitation_id} không thuộc card_id ${card_id}`
                                );
                                throw new NotFoundException(
                                        `Lời mời với ID ${invitation_id} không thuộc card ${card_id}`
                                );
                        }

                        // Truy vấn chính
                        const guest = await this.guestsRepository
                                .createQueryBuilder('guest')
                                .leftJoinAndSelect('guest.invitation', 'invitation')
                                .leftJoinAndSelect('invitation.card', 'card')
                                .leftJoinAndSelect('card.template', 'template')
                                .leftJoinAndSelect('template.thumbnails', 'thumbnails')
                                .where('guest.guest_id = :guest_id', { guest_id })
                                .andWhere('guest.invitation_id = :invitation_id', { invitation_id })
                                .andWhere('card.template_id = :template_id', { template_id })
                                .andWhere('card.card_id = :card_id', { card_id })
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
                                        'card.user_id',
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
                                        'thumbnails.card_id',
                                ])
                                .getOne();

                        if (!guest) {
                                this.logger.warn(
                                        `Không tìm thấy khách mời với guest_id ${guest_id}, invitation_id ${invitation_id}, template_id ${template_id}, card_id ${card_id}`
                                );
                                throw new NotFoundException(
                                        `Khách mời với ID ${guest_id} không tồn tại, không thuộc lời mời ${invitation_id}, mẫu thiệp ${template_id}, hoặc card ${card_id}`
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
                                },
                                card: {
                                        user_id: guest.invitation.card.user_id,
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
                                        thumbnails: guest.invitation.card.template.thumbnails
                                                .filter(
                                                        (thumbnail) => thumbnail.card_id === card_id
                                                )
                                                .map((thumbnail) => ({
                                                        thumbnail_id: thumbnail.thumbnail_id,
                                                        image_url: thumbnail.image_url,
                                                        position: thumbnail.position,
                                                        description: thumbnail.description,
                                                        card_id: thumbnail.card_id,
                                                })),
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
                                `Lấy thông tin thành công cho guest_id ${guest_id}, invitation_id ${invitation_id}, template_id ${template_id}, card_id ${card_id}`
                        );
                        return result;
                } catch (error) {
                        this.logger.error(`Lỗi khi lấy thông tin khách mời: ${error.message}`, {
                                stack: error.stack,
                                template_id,
                                guest_id,
                                invitation_id,
                                card_id,
                        });
                        throw error instanceof NotFoundException
                                ? error
                                : new NotFoundException(
                                          `Lỗi khi lấy thông tin khách mời: ${error.message}`
                                  );
                }
        }
}
