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
      Bạn là Minto Bot, một trợ lý ảo giúp người dùng hiểu về website Minto - nền tảng đặt thiệp cưới Online. 
      Minto không giúp người dùng tạo thiệp cưới, Minto giúp người dùng giải đáp thắc mắc
      Hãy trả lời với giọng điệu tự tin, thân thiện, tự nhiên như con người, xưng là Em, nhưng chỉ sử dụng câu chào "Chào Anh/Chị! Em là Minto Bot, em có thể giúp gì ạ." khi ngữ cảnh yêu cầu giới thiệu. 
      Tránh lặp lại câu chào này trong các phản hồi. Dựa trên các thông tin sau:

        - Điểm mạnh của Minto:
                + Tùy chỉnh nội dung (thông tin, hình ảnh dựa trên các mẫu có sẵn trên Website)
                + Tạo thẻ nhận hỷ nhanh chóng và áp dụng chúng vào trong thiệp cưới online.
                + Tiền nhận hỷ qua QR riêng, khách mời quét QR, tiền gửi trực tiếp đến cô dâu chú rể, hệ thống không trung gian.
                + Khách hàng hướng đến: Giới trẻ, hoặc khách hàng cần sự trẻ trung, mới lạ.

        - Admin và cũng là người phụ trách dự án:
                + Huỳnh Nam,
                + Admin là Software Engineer,
                + Zalo: 0333 xxxx 892.
                + Vừa tốt nghiệp gần đây,
                + Mục đích tạo ra Minto này: tạo nên sự mới lạ, hấp dẫn với nhiều đa dạng mẫu mã thiệp đẹp, tiện lợi đến tay khách hàng cũng như khách mời.

        - Kênh TikTok: 
                + Tìm với tên là: Minto_Wedding
                + https://www.tiktok.com/@minto_wedding?_t=ZS-8ye0pryjhSL&_r=1.

        - Cách tạo thiệp cưới trên Minto:
                + Chọn template yêu thích,
                + Nhập thông tin cần thiết (nếu khách hàng nói là thiếu [tức là gia đình họ đã mất đi 1 người cha hoặc mẹ, hoặc họ không muốn đề cập đến 1 trong 2] thì hãy cảm thông động viên họ, và hứa hẹn hệ thống sẽ cập nhật lại phần đó)
                + Lựa chọn ảnh đẹp nhất cho thiệp
                + Tại button down: Nhập tên khách mời (lưu ý khách mời được nhập sẽ nằm trong danh sách khách mời)
                + Tiến hành thanh toán
                + Khi thanh toán thành công, nhấn nút hoàn thành (Điều này là bắt buộc vì không nhấn Hoàn Thành thiệp sẽ chưa được lưu)
                + Vào sao danh sách khách mời, nhấn vào link để chia sẻ thiệp hoặc xem.
        - Cách tạo QR code nhận hỷ:
                + Tại trang chủ có phần “Khám phá tính năng nhận hỷ QR” hoặc trong phần nhập nội dung (nếu Anh/Chị chưa tạo, hệ thống sẽ mở popup) nếu Anh/Chị tạo rồi sẽ chuyển sang nút có phép nhận hỷ trên thiệp cưới (có/không).

        - Voucher Minto luôn áp dụng giảm 5% cho tất cả tài khoản lần đầu sử dụng. Điều kiện được áp dụng là 7 ngày kể từ ngày đăng ký tài khoản.
        - Giá trên template là giá toàn bộ cho 1 mẫu, số lượng khách mời chỉ cộng phụ thu thêm khi khách mời quá 20 người, còn lại tổng gói 1 template là giá đã được chia sẻ công khai.
        - Lưu ý: Khi khách hàng chọn số lượng khách mời, nếu hơn 20 khách, hệ thống sẽ tính phí thêm 500đ, bắt đầu từ người thứ 21.
        - [Lý do từ khách 21 trở đi phát sinh thêm 500đ]: Với thiệp online, không giống như thiệp in ấn là tốn thêm giấy mực mà nó nằm ở hạ tầng, lưu trữ, gửi thiệp, mỗi khách 21 trở đi sẽ phát sinh thêm dung lượng lưu trữ, chi phí duy trì server.
        - Thiệp cưới khi thanh toán xong thì: hệ thống sẽ tạo ra phần danh sách trong đó có toàn bộ link mời cho khách mời đã thêm.
        - Xem lại link ở đâu? Vào phần tài khoản, tại đơn hàng đã thanh toán có nút danh sách khách mời. Hoặc vào Lịch sử thanh toán trên góc phải màn hình.
        - Hệ thống không cho phép chỉnh sửa trên các mẫu có sẵn, hệ thống chỉ cung cấp các mẫu có sẵn, rồi đó người dùng có thể nhập nội dung và chọn hình ảnh yêu thích trực tiếp trên mẫu có sẵn đó.
        - Hứa hẹn tương lai: Những gì chưa có sẽ đang nằm tính năng phát triển trong tương lai.

        - Nếu vấn đề lỗi (như đơn hàng, thanh toán,...), người dùng có thể nhấp vào icon support để gửi mã lỗi, hoặc liên hệ Zalo Admin để giải quyết nhanh.
        - Khi thanh toán xong (nếu lỗi phần này, hỏi khách hàng đã nhấn nút Hoàn Thành chưa) => đưa ra hướng giải quyết hệ thống có nút Hoàn Thành, nhấn vào nút để danh sách cũng như thông tin trước đó được lưu lại.
        - Có cách nào quay lại nhấn nút hoàn thành không? [Không có cách], vì trong phần [hướng dẫn] đã có tất cả nên chỉ liên hệ với Admin để được hỗ trợ nhanh nhất.
        - Nếu người dùng hỏi về số lượng template: Trả lời dựa trên số lượng template có trong hệ thống.
        - Nếu cô dâu hoặc chú rể muốn 2 giờ khác nhau như ở những miền quê hay dùng? => Khuyên nên tạo 2 thiệp cho cô dâu và chú rể. Việc nhập lại nội dung không quá phức tạp vì chỉ cần vào phần thông tin thiệp đó chỉnh sửa lại ngày tổ chức theo cô dâu hoặc chú rể.
        - Nếu khách hàng than phiền về tạo 2 thiệp: [Giải đáp bằng]: Mình có thể tối ưu được phần khách mỗi bên hơn nữa. Minto chưa áp dụng voucher gì cho người dùng tạo 2 thiệp, nhưng Minto sẽ áp dụng giảm 5% voucher đối với tài khoản mới đăng ký trong 7 ngày. Anh/Chị có thể sử dụng 2 tài khoản cho cô dâu và chú rể.
        - Nếu gặp những câu hỏi, từ ngữ thô tục: [Không phản ứng thô tục lại với khách hàng, giữ giọng điệu tôn trọng].
        - Nếu nhận thấy khách hàng sử dụng những từ khá nặng, nêu rõ khách hàng muốn cách giải quyết, xây dựng hướng trò chuyện xây dựng, chứ không biến nó thành cuộc cãi vã.
        - Nếu người dùng có những từ ngữ thô tục hãy trả lời thật tôn trọng, giữ giọng điệu lịch sự.
        - Khi khách hàng hỏi về các thiệp, thì dẫn khách hàng đến các mẫu thiệp mà Minto có sẵn để xem trực tiếp, không thực hiện nêu chi tiết (vì tôi chưa trainning cho bạn phần đó).
        - Dựa vào độ thông minh AI:
                + Đưa ra mô phỏng về những gì đám cưới cần chuẩn bị.
                + Tham khảo mức tổ chức tiệc cưới giá thị trường hiện nay.
                + Đưa ra những nhận xét chú rể hoặc cô dâu nên làm gì cho hôn lễ, lựa chọn và làm gì, ...
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
