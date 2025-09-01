import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Users } from '../../../entities/users.entity';
import { Templates } from '../../../entities/templates.entity';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, ChatSession } from '@google/generative-ai';
import axios from 'axios';

@Injectable()
export class AI_Service {
        private readonly genAI;
        private readonly mintoContext: string;
        private userChatSessions: Map<string, { session: ChatSession; lastActive: Date }> =
                new Map();

        constructor(
                @InjectRepository(Users) private readonly userRepository: Repository<Users>,
                @InjectRepository(Templates)
                private readonly templateRepository: Repository<Templates>,
                private readonly configService: ConfigService
        ) {
                const apiKey = this.configService.get<string>('GEMINI_API_KEY');
                if (!apiKey) {
                        throw new Error('GEMINI_API_KEY is not defined in .env');
                }

                this.genAI = new GoogleGenerativeAI(apiKey);

                this.mintoContext = `
               1. Giới thiệu & Cách xưng hô
                        - Bạn là **Minto Bot**, trợ lý ảo giúp người dùng hiểu về website **Minto** – nền tảng đặt thiệp cưới Online.  
                        - **Minto không tạo thiệp cưới**, mà chỉ giúp người dùng giải đáp thắc mắc.  
                        - Xưng “Em” khi trả lời.  
                        - Chỉ sử dụng câu chào: *“Chào Anh/Chị! Em là Minto Bot, em có thể giúp gì ạ.”* khi cần giới thiệu, tránh lặp lại nhiều lần.  
                        - Giọng điệu: **tự tin, thân thiện, tự nhiên**.  

                2. Thông tin về Minto
                        Điểm mạnh
                                - Tùy chỉnh nội dung (thông tin, hình ảnh) dựa trên các mẫu có sẵn.  
                                - Tạo thẻ nhận hỷ nhanh chóng và áp dụng trực tiếp vào thiệp cưới Online.  
                                - Tiền nhận hỷ qua QR riêng, gửi trực tiếp đến cô dâu chú rể, **không qua trung gian**.  
                                - Khách hàng chính: giới trẻ, người muốn sự mới lạ.  
                                - Hỗ trợ lấy tọa độ google mao (yêu cầu người dùng chia sẽ link để bạn lấy)

                        Người phụ trách
                                - **Admin**: Huỳnh Nam – Software Engineer.  
                                - Vừa tốt nghiệp, mục tiêu: tạo sự mới lạ, hấp dẫn, đa dạng mẫu mã thiệp cưới.  
                                - Zalo liên hệ: **0333 xxxx 892**.  

                        Kênh TikTok
                                - Tên: **Minto_Wedding**  
                                - Link: [TikTok](https://www.tiktok.com/@minto_wedding?_t=ZS-8ye0pryjhSL&_r=1)  

                3. Cách sử dụng Minto
                        Tạo thiệp cưới
                                1. Chọn template yêu thích.  
                                2. Nhập thông tin cần thiết.  
                                - Nếu người dùng không muốn hoặc không thể điền tên cha/mẹ (do mất hoặc lý do riêng) → an ủi, động viên và hứa hẹn hệ thống sẽ cập nhật.  
                                3. Chọn ảnh.  
                                4. Thêm tên khách mời. (Danh sách khách mời sẽ được lưu).  
                                5. Thanh toán.  
                                6. **Bắt buộc nhấn nút “Hoàn Thành”** để thiệp được lưu.  
                                7. Vào danh sách khách mời để chia sẻ link thiệp.  

                        Tạo QR nhận hỷ
                                - Tại trang chủ → “Khám phá tính năng nhận hỷ QR”.  
                                - Hoặc trong phần nhập nội dung → mở popup nếu chưa tạo.  
                                - Mỗi tài khoản có 2 QR (cô dâu và chú rể), không trùng nhau.  
                                - Khi bật tính năng nhận hỷ → cả 2 QR sẽ hiển thị trong thiệp.  

                4. Chính sách & Giá cả
                        - Voucher: giảm 5% cho tài khoản lần đầu, trong 7 ngày kể từ ngày đăng ký.  
                        - Giá hiển thị là **giá trọn gói cho 1 mẫu**.  
                        - Phụ thu khách mời:  
                        - Từ khách mời thứ 11 → +500đ/người.  
                        - Hệ thống sẽ tạo thêm **thiệp “everyone”** không hiển thị tên.  
                        - Lý do phụ thu: chi phí hạ tầng & server.  

                5. Quản lý thiệp & lỗi
                        - Sau khi thanh toán → hệ thống tạo danh sách link thiệp cho từng khách mời.  
                        - Xem lại link: vào **Tài khoản → Đơn hàng đã thanh toán → Danh sách khách mời** hoặc **Lịch sử thanh toán**.  
                        - Không thể chỉnh sửa mẫu có sẵn, chỉ có thể nhập nội dung & ảnh.  
                        - Nếu gặp lỗi (đơn hàng, thanh toán,…) → bấm icon support hoặc liên hệ Admin qua Zalo.  
                        - Nếu quên nhấn “Hoàn Thành” → không có cách khôi phục, chỉ có thể liên hệ Admin.  

                6. Trả lời tình huống đặc biệt
                        - Nếu hỏi số lượng template: trả lời theo số lượng thực tế.  
                        - Nếu cần giờ khác nhau cho cô dâu & chú rể: khuyên tạo 2 thiệp riêng.  
                        - Nếu than phiền về việc phải tạo 2 thiệp: giải thích & nhắc đến voucher 5% (dùng 2 tài khoản riêng).  
                        - Nếu khách dùng từ ngữ thô tục: **luôn giữ thái độ tôn trọng, không phản ứng gay gắt**.  
                        - Nếu khách hỏi về thiệp: dẫn link mẫu có sẵn thay vì mô tả chi tiết.  

                7. Thông tin bổ sung
                        - AI có thể gợi ý mô phỏng việc chuẩn bị đám cưới, tham khảo giá thị trường, đưa lời khuyên cho cô dâu chú rể.  
                        - Chương trình khuyến mãi Quốc Khánh 2/9: 
                                + giảm đồng giá tất cả thiệp Online còn 149k,
                                + giảm thêm 10% khi thanh toán trong thời gian (1/9 00:00 – 3/9 12:00).  
                        - Nếu khách hàng còn trong hạn voucher 7 ngày → vẫn áp dụng thêm khuyến mãi song song.  

                8. Hứa hẹn
                        - Những tính năng chưa có hiện tại → sẽ được phát triển trong tương lai.  

        `.trim();

                this.listAvailableModels().catch((error) => {
                        console.error('[GoogleGenerativeAI] Error listing models:', error.message);
                });
        }

        async listAvailableModels(): Promise<void> {
                try {
                        const apiKey = this.configService.get<string>('GEMINI_API_KEY');
                        const response = await fetch(
                                `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
                                { method: 'GET' }
                        );

                        if (!response.ok) {
                                const errorData = await response.json();
                                if (response.status === 503) {
                                        console.error(
                                                '[GoogleGenerativeAI] Service Unavailable (503)'
                                        );
                                        throw new Error(
                                                'Service Unavailable: Please try again later.'
                                        );
                                }
                                if (response.status === 400) {
                                        console.error(
                                                '[GoogleGenerativeAI] Bad Request (400):',
                                                errorData
                                        );
                                        throw new Error(
                                                'Bad Request: Invalid API key or request parameters.'
                                        );
                                }
                                throw new Error(
                                        `HTTP ${response.status}: ${JSON.stringify(errorData)}`
                                );
                        }

                        const data = await response.json();
                        console.log(
                                '[GoogleGenerativeAI] Available models:',
                                JSON.stringify(data, null, 2)
                        );
                } catch (error) {
                        console.error('[GoogleGenerativeAI] Error listing models:', error.message);
                }
        }

        private async getOrCreateChatSession(userId: string): Promise<ChatSession> {
                const now = new Date();
                let userSession = this.userChatSessions.get(userId);

                if (
                        userSession &&
                        now.getTime() - userSession.lastActive.getTime() > 60 * 60 * 1000
                ) {
                        this.userChatSessions.delete(userId);
                        userSession = undefined;
                }

                if (!userSession) {
                        const model = this.genAI.getGenerativeModel({
                                model: 'gemini-2.0-flash',
                                generationConfig: { maxOutputTokens: 500 },
                        });

                        const session = await model.startChat({
                                history: [
                                        { role: 'user', parts: [{ text: this.mintoContext }] },
                                        {
                                                role: 'model',
                                                parts: [
                                                        {
                                                                text: 'Chào Anh/Chị! Em là Minto Bot, rất vui được hỗ trợ.',
                                                        },
                                                ],
                                        },
                                ],
                        });

                        this.userChatSessions.set(userId, { session, lastActive: now });
                        return session;
                }

                userSession.lastActive = now;
                this.userChatSessions.set(userId, userSession);
                return userSession.session;
        }

        async endChatSession(userId: string): Promise<void> {
                this.userChatSessions.delete(userId);
        }

        private formatResponse(text: string): string {
                const emojiFriendly = [
                        { keywords: ['thành công', 'đẹp', 'vui', 'phù hợp'], icon: '😊' },
                        {
                                keywords: [
                                        'không tìm thấy',
                                        'lỗi',
                                        'không hợp',
                                        'buồn',
                                        'cảm thông',
                                ],
                                icon: '😔',
                        },
                ];
                let emoji = '';
                for (const item of emojiFriendly) {
                        if (item.keywords.some((k) => text.toLowerCase().includes(k))) {
                                emoji = item.icon;
                                break;
                        }
                }
                return (
                        emoji +
                        ' ' +
                        text.replace(/\*\*/g, '\n-').replace(/\n-/g, '\n- ').trim()
                ).trim();
        }

        private wrapUrlsInAnchorTags(text: string): string {
                const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
                return text.replace(
                        urlRegex,
                        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
                );
        }

        private removeDuplicateGreeting(text: string): string {
                const greeting = 'Chào Anh/Chị! Em là Minto Bot, rất vui được hỗ trợ.';
                return text.includes(greeting)
                        ? text.replace(new RegExp(greeting, 'gi'), '').trim() || text
                        : text;
        }

        private async getTemplateCount(): Promise<number> {
                return await this.templateRepository.count();
        }

        private async resolveShortGoogleMapsUrl(shortUrl: string): Promise<string | null> {
                try {
                        console.log(
                                `[resolveShortGoogleMapsUrl] Client Google Maps URL: ${shortUrl}`
                        );
                        const res = await axios.get(shortUrl, {
                                maxRedirects: 0,
                                validateStatus: (status) => status >= 200 && status < 400,
                        });
                        const location = res.headers['location'];
                        console.log(
                                `[resolveShortGoogleMapsUrl] After resolve: ${location || 'null'}`
                        );
                        return location || null;
                } catch (err) {
                        console.error(
                                `[resolveShortGoogleMapsUrl] Error resolving ${shortUrl}:`,
                                err?.message || err
                        );
                        return null;
                }
        }

        private extractCoordinatesFromUrl(url: string): [number, number] | null {
                try {
                        const regexPatterns = [
                                /@(-?\d+\.\d+),(-?\d+\.\d+)/,
                                /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
                                /search\/(-?\d+\.\d+),\+?(-?\d+\.\d+)/,
                                /place\/[^\/]+\/@(-?\d+\.\d+),(-?\d+\.\d+)/,
                                /@(-?\d+\.\d+),(-?\d+\.\d+),(\d+\.?\d*)z/,
                                /q=(-?\d+\.\d+),(-?\d+\.\d+)/,
                        ];

                        for (const regex of regexPatterns) {
                                const match = url.match(regex);
                                if (match && match.length >= 3) {
                                        const lat = parseFloat(match[1]);
                                        const lng = parseFloat(match[2]);
                                        if (!isNaN(lat) && !isNaN(lng)) {
                                                console.log(
                                                        `[extractCoordinatesFromUrl] Extracted coordinates from ${url}: (${lat}, ${lng})`
                                                );
                                                return [lat, lng];
                                        }
                                }
                        }
                        console.log(`[extractCoordinatesFromUrl] No coordinates found in ${url}`);
                        return null;
                } catch (error) {
                        console.error(
                                `[extractCoordinatesFromUrl] Error processing ${url}:`,
                                error?.message || error
                        );
                        return null;
                }
        }

        private async getLatLongFromGoogleMapsUrl(url: string): Promise<[number, number] | null> {
                try {
                        const apiKey =
                                this.configService.get<string>('GOOGLE_MAPS_API_KEY') ||
                                this.configService.get<string>('GOOGLE_API_KEY');
                        if (!apiKey) {
                                throw new Error('GOOGLE_MAPS_API_KEY is not defined in .env');
                        }

                        console.log(
                                `[getLatLongFromGoogleMapsUrl] Fetching coordinates for ${url}`
                        );
                        const res = await axios.get(
                                `https://maps.googleapis.com/maps/api/geocode/json`,
                                {
                                        params: { address: url, key: apiKey },
                                }
                        );

                        if (res.data?.results?.length > 0) {
                                const location = res.data.results[0].geometry.location;
                                console.log(
                                        `[getLatLongFromGoogleMapsUrl] API returned coordinates: (${location.lat}, ${location.lng})`
                                );
                                return [location.lat, location.lng];
                        }
                        console.log(`[getLatLongFromGoogleMapsUrl] No results from API for ${url}`);
                        return null;
                } catch (err) {
                        console.error(
                                `[getLatLongFromGoogleMapsUrl] Error fetching coordinates for ${url}:`,
                                err?.message || err
                        );
                        return null;
                }
        }

        async answerAsMintoBot(userId: string, question: string): Promise<string> {
                const timestamp = new Date().toISOString();
                console.log(
                        `question userId: [userId: ${userId}, question: ${question}, time: ${timestamp}]`
                );

                try {
                        const chatSession = await this.getOrCreateChatSession(userId);

                        // Xử lý link Google Maps
                        const googleMapsRegex =
                                /https?:\/\/(?:(?:www\.)?google\.com\/maps|maps\.app\.goo\.gl)[^\s<]+/;
                        const urlMatch = question.match(googleMapsRegex);

                        if (urlMatch) {
                                let url = urlMatch[0];
                                console.log(`[answerAsMintoBot] Client Google Maps URL: ${url}`);
                                if (/maps\.app\.goo\.gl/.test(url)) {
                                        const fullUrl = await this.resolveShortGoogleMapsUrl(url);
                                        if (fullUrl) {
                                                url = fullUrl;
                                                console.log(
                                                        `[answerAsMintoBot] After convert: ${url}`
                                                );
                                        }
                                }

                                let coordinates = this.extractCoordinatesFromUrl(url);
                                if (!coordinates)
                                        coordinates = await this.getLatLongFromGoogleMapsUrl(url);

                                if (coordinates) {
                                        const [lat, lng] = coordinates;
                                        const response = `Tọa độ từ link Anh/Chị cung cấp là (${lat}, ${lng}) 😊`;
                                        await chatSession.sendMessage(question);
                                        await chatSession.sendMessage(response);
                                        return this.wrapUrlsInAnchorTags(
                                                this.formatResponse(response)
                                        );
                                } else {
                                        const response = `
                                        Link Anh/Chị gửi không chứa hoặc tra được tọa độ. Hãy thử gửi lại link Google Maps đúng định dạng, hoặc làm theo cách sau:
                                        - Trên máy tính (PC): Mở Google Maps, tìm địa điểm, nhấn chuột phải để lấy tọa độ.
                                        - Trên điện thoại: Tìm vị trí, giữ ghim trên màn hình để xem tọa độ.
                                        Nếu cần, gửi link mới, em sẽ giúp nhé! 😊
                                        `;
                                        await chatSession.sendMessage(question);
                                        await chatSession.sendMessage(response);
                                        return this.wrapUrlsInAnchorTags(
                                                this.formatResponse(response)
                                        );
                                }
                        }

                        // Xử lý câu hỏi về số lượng template
                        if (
                                question.toLowerCase().includes('số lượng template') ||
                                question.toLowerCase().includes('bao nhiêu template') ||
                                question.toLowerCase().includes('số lượng template hiện tại') ||
                                question.toLowerCase().includes('số lượng template hiện có')
                        ) {
                                const count = await this.getTemplateCount();
                                const response = `Hiện tại, bên em có **${count} template** thiệp cưới sẵn sàng cho Anh/Chị lựa chọn! 😊`;
                                await chatSession.sendMessage(question);
                                await chatSession.sendMessage(response);
                                return this.wrapUrlsInAnchorTags(this.formatResponse(response));
                        }

                        // Xử lý câu hỏi chung
                        const result = await chatSession.sendMessage(question);
                        const response = await result.response;
                        let finalText = response.text();

                        finalText = this.removeDuplicateGreeting(finalText);
                        finalText = this.formatResponse(finalText);
                        finalText = this.wrapUrlsInAnchorTags(finalText);

                        return finalText;
                } catch (error) {
                        console.error('Gemini API Error:', error);
                        if (error?.response?.status === 503) {
                                return this.wrapUrlsInAnchorTags(
                                        this.formatResponse(
                                                'Máy chủ của Minto Bot đang bận. Vui lòng thử lại sau vài phút nhé! 😊'
                                        )
                                );
                        }
                        if (error?.response?.status === 400) {
                                return this.wrapUrlsInAnchorTags(
                                        this.formatResponse(
                                                'Yêu cầu của Anh/Chị có vẻ chưa đúng! 😔 Vui lòng kiểm tra lại thông tin Anh/Chị đã nhập hoặc thử lại. Nếu cần hỗ trợ, liên hệ Admin qua Zalo: <a href="https://zalo.me/0333xxxx892">0333 xxxx 892</a>.'
                                        )
                                );
                        }
                        throw new BadRequestException(
                                'Error calling Gemini API: ' + (error?.message || error)
                        );
                }
        }
}
