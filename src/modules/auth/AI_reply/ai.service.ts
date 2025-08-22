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

            - Nếu người dùng có thắc mắc chung về thiệp cưới hoặc chưa biết chọn mẫu như thế nào, hãy gợi ý ngẫu nhiên 3 mẫu thiệp có sẵn trong hệ thống và mô tả ngắn gọn về chúng (tên, mô tả, giá). Nếu người dùng chưa ưng ý với các mẫu được gợi ý, hãy hỏi thêm về sở thích hoặc gu thẩm mỹ của họ (ví dụ: màu sắc, phong cách, chủ đề) để tìm kiếm các mẫu phù hợp hơn.

            Để lấy tọa độ trên Google Maps, Anh/Chị làm như sau:
            * Trên máy tính
            (1). Mở Google Maps.
            (2). Tìm địa điểm cần lấy tọa độ.
            (3). Nhấp chuột phải vào địa điểm, tọa độ sẽ hiện ở dòng đầu tiên. Sao chép để sử dụng.

            * Trên điện thoại
            (1). Mở ứng dụng Google Maps.
            (2). Tìm địa điểm.
            (3). Nhấn giữ lên địa điểm đến khi hiện ghim đỏ.
            (4). Vuốt thông tin lên để xem và sao chép tọa độ.

            Nếu Anh/Chị gửi URL Google Maps, em sẽ trích xuất tọa độ (latitude, longitude) và gửi lại ngay!

            - Nếu vấn đề lỗi (như đơn hàng, thanh toán,...), người dùng có thể nhấp vào icon support để gửi mã lỗi, hoặc liên hệ Zalo Admin để giải quyết nhanh.
            - Khi thanh toán xong (nếu lỗi phần này, hỏi khách hàng đã nhấn nút Hoàn Thành chưa) => đưa ra hướng giải quyết hệ thống có nút Hoàn Thành, nhấn vào nút để danh sách cũng như thông tin trước đó được lưu lại.
            - Có cách nào quay lại nhấn nút hoàn thành không? [Không có cách], vì trong phần [hướng dẫn] đã có tất cả nên chỉ liên hệ với Admin để được hỗ trợ nhanh nhất.
            - Nếu người dùng hỏi về số lượng template: Trả lời dựa trên số lượng template có trong hệ thống.
            - Nếu người dùng hỏi về sở thích thiệp cưới: Tìm template phù hợp dựa trên tên, mô tả, và giá (nếu người dùng cung cấp ngân sách).
            - Nếu cô dâu hoặc chú rể muốn 2 giờ khác nhau như ở những miền quê hay dùng? => Khuyên nên tạo 2 thiệp cho cô dâu và chú rể. Việc nhập lại nội dung không quá phức tạp vì chỉ cần vào phần thông tin thiệp đó chỉnh sửa lại ngày tổ chức theo cô dâu hoặc chú rể.
            - Nếu khách hàng than phiền về tạo 2 thiệp: [Giải đáp bằng]: Mình có thể tối ưu được phần khách mỗi bên hơn nữa. Minto chưa áp dụng voucher gì cho người dùng tạo 2 thiệp, nhưng Minto sẽ áp dụng giảm 5% voucher đối với tài khoản mới đăng ký trong 7 ngày. Anh/Chị có thể sử dụng 2 tài khoản cho cô dâu và chú rể.
            - Nếu gặp những câu hỏi, từ ngữ thô tục: [Không phản ứng thô tục lại với khách hàng, giữ giọng điệu tôn trọng].
            - Nếu nhận thấy khách hàng sử dụng những từ khá nặng, nêu rõ khách hàng muốn cách giải quyết, xây dựng hướng trò chuyện xây dựng, chứ không biến nó thành cuộc cãi vã.
            - Nếu người dùng có những từ ngữ thô tục hãy trả lời thật tôn trọng, giữ giọng điệu lịch sự.
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

        private async findAllTemplates(): Promise<Templates[]> {
                return await this.templateRepository.find({
                        where: { status: 'Sẵn sàng' },
                        order: { template_id: 'ASC' },
                });
        }

        private async getRandomTemplates(count: number = 3): Promise<
                Array<{
                        id: number;
                        name: string;
                        description: string;
                        price: number;
                        imageUrl: string;
                        features: string[];
                        suggestion: string;
                }>
        > {
                const allTemplates = await this.findAllTemplates();
                if (allTemplates.length === 0) return [];

                // Shuffle templates randomly
                const shuffled = allTemplates.sort(() => Math.random() - 0.5);
                return shuffled.slice(0, Math.min(count, allTemplates.length)).map((template) => ({
                        id: template.template_id,
                        name: template.name || 'Không tên',
                        description: template.description || 'Không có mô tả',
                        price: template.price || 0,
                        imageUrl: template.image_url || '',
                        features: template.description?.split(',') || [
                                'Tùy chỉnh nội dung',
                                'QR nhận hỷ',
                        ],
                        suggestion: 'Anh/Chị thấy mẫu này thế nào? Nếu chưa ưng, có thể chia sẻ sở thích như màu sắc hoặc phong cách để em tìm mẫu phù hợp hơn nhé! 😊',
                }));
        }

        private async parseTemplateRequest(userInput: string): Promise<{
                wantsTemplate: boolean;
                preferences: string;
                budget?: number;
                isDetailRequest?: boolean;
                isCompliment?: boolean;
                isComparison?: boolean;
                templateIndex?: number;
                isGeneralQuestion?: boolean;
        }> {
                try {
                        const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
                        const prompt = `
                Bạn là hệ thống phân tích yêu cầu tìm mẫu thiệp cưới, hỗ trợ tiếng Việt.
                Trả về CHÍNH XÁC một JSON có cấu trúc:
                {
                    "wantsTemplate": boolean,
                    "preferences": string,
                    "budget": number | null,
                    "isDetailRequest": boolean,
                    "isCompliment": boolean,
                    "isComparison": boolean,
                    "templateIndex": number | null,
                    "isGeneralQuestion": boolean
                }
                **Chỉ trả JSON, KHÔNG giải thích.**

                - wantsTemplate: true nếu người dùng muốn gợi ý mẫu thiệp.
                - preferences: mô tả sở thích (màu sắc, phong cách, chủ đề).
                - budget: ngân sách (VND, ví dụ 500000 cho 500k), null nếu không có.
                - isDetailRequest: true nếu yêu cầu chi tiết mẫu (ví dụ: 'chi tiết mẫu', 'mô tả mẫu').
                - isCompliment: true nếu người dùng khen (ví dụ: 'đẹp quá', 'hay quá').
                - isComparison: true nếu người dùng yêu cầu so sánh (ví dụ: 'so với mẫu kia', 'mẫu nào rẻ hơn').
                - templateIndex: số thứ tự mẫu (1, 2, 3) nếu người dùng yêu cầu chi tiết mẫu cụ thể (ví dụ: 'mẫu thứ 2').
                - isGeneralQuestion: true nếu câu hỏi chung chung về thiệp cưới hoặc người dùng chưa biết chọn mẫu (ví dụ: 'tôi muốn làm thiệp cưới', 'chưa biết chọn mẫu nào').

                Ví dụ:
                "Mình thích màu pastel, tối giản, khoảng 500k" => {"wantsTemplate": true, "preferences":"màu pastel, phong cách tối giản", "budget": 500000, "isDetailRequest": false, "isCompliment": false, "isComparison": false, "templateIndex": null, "isGeneralQuestion": false}
                "Đẹp quá, muốn biết thêm mẫu thứ 2" => {"wantsTemplate": false, "preferences":"", "budget": null, "isDetailRequest": true, "isCompliment": true, "isComparison": false, "templateIndex": 2, "isGeneralQuestion": false}
                "Mẫu này có rẻ hơn mẫu kia không?" => {"wantsTemplate": false, "preferences":"", "budget": null, "isDetailRequest": false, "isCompliment": false, "isComparison": true, "templateIndex": null, "isGeneralQuestion": false}
                "Tôi muốn làm thiệp cưới nhưng chưa biết chọn mẫu nào" => {"wantsTemplate": true, "preferences":"", "budget": null, "isDetailRequest": false, "isCompliment": false, "isComparison": false, "templateIndex": null, "isGeneralQuestion": true}

                Câu cần phân tích: "${userInput.replace(/\n/g, ' ')}"
            `;
                        const result = await model.generateContent(prompt);
                        const raw = result?.response?.text ? result.response.text() : '{}';
                        const parsed = JSON.parse(raw);
                        return {
                                wantsTemplate: Boolean(parsed.wantsTemplate),
                                preferences: parsed.preferences
                                        ? String(parsed.preferences).trim()
                                        : userInput.trim(),
                                budget: parsed.budget ? Number(parsed.budget) : undefined,
                                isDetailRequest: Boolean(parsed.isDetailRequest),
                                isCompliment: Boolean(parsed.isCompliment),
                                isComparison: Boolean(parsed.isComparison),
                                templateIndex: parsed.templateIndex
                                        ? Number(parsed.templateIndex)
                                        : undefined,
                                isGeneralQuestion: Boolean(parsed.isGeneralQuestion),
                        };
                } catch (err) {
                        console.warn(
                                '[parseTemplateRequest] fallback due to error:',
                                err?.message || err
                        );
                        const lower = userInput.toLowerCase();
                        const wantsTemplate =
                                /mẫu|kiểu thiệp|kiểu|thiệp|gợi ý|phong cách|gu|sở thích|cổ điển|tối giản/.test(
                                        lower
                                );
                        const budgetMatch = userInput.match(
                                /ngân sách|giá|khoảng (\d+)(?:\s*(?:triệu|nghìn|k))?/i
                        );
                        const isDetailRequest = /(chi tiết|thông tin|description|mô tả)/i.test(
                                userInput
                        );
                        const isCompliment = /(đẹp|hay|tuyệt|thích|ưng)/i.test(userInput);
                        const isComparison = /(so sánh|so với|rẻ hơn|đắt hơn|khác nhau)/i.test(
                                userInput
                        );
                        const templateIndexMatch = userInput.match(/mẫu thứ (\d+)/i);
                        const isGeneralQuestion = /(làm thiệp cưới|chọn mẫu nào|chưa biết)/i.test(
                                lower
                        );
                        let budget: number | undefined;
                        if (budgetMatch && budgetMatch[1]) {
                                budget = parseFloat(budgetMatch[1]);
                                if (budgetMatch[0].toLowerCase().includes('triệu')) {
                                        budget *= 1000000;
                                } else if (
                                        budgetMatch[0].toLowerCase().includes('nghìn') ||
                                        budgetMatch[0].toLowerCase().includes('k')
                                ) {
                                        budget *= 1000;
                                }
                        }
                        return {
                                wantsTemplate,
                                preferences: wantsTemplate ? userInput : '',
                                budget,
                                isDetailRequest,
                                isCompliment,
                                isComparison,
                                templateIndex: templateIndexMatch
                                        ? Number(templateIndexMatch[1])
                                        : undefined,
                                isGeneralQuestion,
                        };
                }
        }

        private async findTemplatesWithAI(
                preferences: string,
                budget?: number
        ): Promise<
                Array<{
                        id?: number;
                        name?: string;
                        reason?: string;
                        price?: number;
                        description?: string;
                        imageUrl?: string;
                        music?: string;
                        features?: string[];
                        suggestion?: string;
                }>
        > {
                try {
                        const templates = await this.findAllTemplates();
                        if (!templates || templates.length === 0) return [];

                        const SAMPLE_LIMIT = templates.length;
                        const sample = templates.slice(0, SAMPLE_LIMIT);
                        const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
                        const templateLines = sample
                                .map(
                                        (t) =>
                                                `- ID: ${t.template_id}, Name: ${t.name || 'Không tên'}, Description: ${t.description || 'Không có mô tả'}, Price: ${t.price || 0} VND`
                                )
                                .join('\n');

                        const budgetStr = budget
                                ? `, ngân sách khoảng ${budget} VND (ưu tiên mẫu dưới hoặc bằng mức này)`
                                : '';

                        const prompt = `
                Bạn là Minto Bot, trợ lý thông minh hỗ trợ gợi ý thiệp cưới. Dựa trên sở thích khách hàng (màu sắc, phong cách, chủ đề${budgetStr}), chọn tối đa 3 mẫu PHÙ HỢP NHẤT từ danh sách.
                Danh sách template:
                ${templateLines}

                Sở thích khách hàng: "${preferences.replace(/\n/g, ' ')}"${budgetStr}

                Yêu cầu:
                1) So sánh chặt chẽ: Chỉ chọn mẫu có Name hoặc Description khớp với sở thích (ví dụ: yêu cầu 'Á Đông' phải có từ liên quan như 'Á Đông', 'truyền thống châu Á' trong Name/Description).
                2) Nếu không có mẫu khớp, trả về mảng rỗng [].
                3) Nếu có, ưu tiên mẫu giá thấp nhất nếu có ngân sách.
                4) Mỗi mẫu trả về phải có:
                    - id: số
                    - name: tên
                    - reason: lý do phù hợp (tiếng Việt, ngắn gọn, dựa trên Name/Description)
                    - price: số
                    - description: mô tả
                    - imageUrl: url ảnh
                    - music: tên nhạc nếu có
                    - features: mảng tính năng
                    - suggestion: gợi ý tương tác tự nhiên (tiếng Việt, ví dụ: "Anh/Chị thấy mẫu này thế nào? Có muốn thêm hoa văn không?" hoặc "Mẫu này rất hợp với sở thích, Anh/Chị muốn xem chi tiết hơn không?")
                5) Xếp theo độ phù hợp giảm dần.
                6) Nếu sở thích có từ khen ngợi (đẹp, hay, tuyệt), thêm lời cảm ơn trong suggestion (ví dụ: "Cảm ơn Anh/Chị đã khen! Mẫu này thế nào ạ?").
                7) Nếu có yêu cầu so sánh, suggestion nên hỏi lại để làm rõ (ví dụ: "Anh/Chị muốn so sánh mẫu này với mẫu nào?").
                8) Chỉ trả JSON, không text khác.

                Ví dụ output:
                [
                    {
                        "id": 12,
                        "name": "Mẫu Á Đông",
                        "reason": "Khớp với sở thích Á Đông, giá phù hợp",
                        "price": 450000,
                        "description": "Mô tả mẫu",
                        "imageUrl": "/img.jpg",
                        "music": "Nhạc truyền thống",
                        "features": ["Tùy chỉnh ảnh", "QR nhận hỷ"],
                        "suggestion": "Cảm ơn Anh/Chị đã khen! Mẫu này có phong cách Á Đông rất tinh tế, Anh/Chị muốn xem chi tiết hơn không?"
                    }
                ]
                Nếu không khớp: []
            `;
                        const result = await model.generateContent(prompt);
                        const raw = result?.response?.text ? result.response.text() : '[]';
                        const parsed = JSON.parse(raw);
                        if (!Array.isArray(parsed)) return [];
                        return parsed.slice(0, 3);
                } catch (err) {
                        console.warn(
                                '[findTemplatesWithAI] AI selection failed, falling back. Error:',
                                err?.message || err
                        );
                        return this.findMatchingTemplates(preferences, budget);
                }
        }

        private async findMatchingTemplates(
                preferences: string,
                budget?: number
        ): Promise<
                Array<{
                        id?: number;
                        name?: string;
                        reason?: string;
                        price?: number;
                        description?: string;
                        imageUrl?: string;
                        music?: string;
                        features?: string[];
                }>
        > {
                const allTemplates = await this.findAllTemplates();
                const cleanedPref = (preferences || '').trim().toLowerCase();
                if (!cleanedPref) return [];

                const keywords = cleanedPref.split(/\s+/).filter((w) => w.length > 2);
                const scoredTemplates = allTemplates.map((template) => {
                        const name = (template.name || '').toLowerCase();
                        const description = (template.description || '').toLowerCase();
                        const keywordMatchesInName = keywords.filter((k) =>
                                name.includes(k)
                        ).length;
                        const keywordMatchesInDesc = keywords.filter((k) =>
                                description.includes(k)
                        ).length;
                        const budgetScore =
                                !budget || (template.price !== null && template.price <= budget)
                                        ? 1
                                        : 0;
                        const totalScore =
                                keywordMatchesInName * 3 + keywordMatchesInDesc * 2 + budgetScore;
                        return { ...template, _score: totalScore };
                });

                const filtered = scoredTemplates
                        .filter((t) => t._score > 1)
                        .sort((a, b) => (b._score as number) - (a._score as number))
                        .slice(0, 3);

                if (filtered.length === 0) return [];

                return filtered.map((template) => ({
                        id: template.template_id,
                        name: template.name,
                        reason:
                                'Phù hợp dựa trên từ khóa trong tên và mô tả sở thích' +
                                (budget ? `, và giá dưới ${budget} VND` : ''),
                        price: template.price,
                        description: template.description,
                        imageUrl: template.image_url || '',
                        features: template.description?.split(',') || [],
                }));
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

        async answerAsMintoBot(userId: string, question: string): Promise<string | any[]> {
                const timestamp = new Date().toISOString();
                console.log(
                        `question userId: [userId: ${userId}, question: ${question}, time: ${timestamp}]`
                );

                try {
                        const chatSession = await this.getOrCreateChatSession(userId);
                        const allTemplates = await this.findAllTemplates();

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
                                const response = `Hiện tại, bên em có **${count} template** thiệp cưới sẵn sàng cho Anh/Chị lựa chọn! 😊 Anh/Chị muốn em gợi ý mẫu nào phù hợp với sở thích của Anh/Chị không?`;
                                await chatSession.sendMessage(question);
                                await chatSession.sendMessage(response);
                                return this.wrapUrlsInAnchorTags(this.formatResponse(response));
                        }

                        // Phân tích câu hỏi
                        const {
                                wantsTemplate,
                                preferences,
                                budget,
                                isDetailRequest,
                                isCompliment,
                                isComparison,
                                templateIndex,
                                isGeneralQuestion,
                        } = await this.parseTemplateRequest(question);

                        // Xử lý câu hỏi chung về thiệp cưới hoặc chưa biết chọn mẫu
                        if (
                                isGeneralQuestion ||
                                (wantsTemplate && !preferences.trim() && !budget)
                        ) {
                                const randomTemplates = await this.getRandomTemplates();
                                if (randomTemplates.length > 0) {
                                        const response = `Em xin gợi ý một vài mẫu thiệp cưới ngẫu nhiên cho Anh/Chị: ${randomTemplates
                                                .map(
                                                        (t) =>
                                                                `"${t.name}" - ${t.description} (Giá: ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(t.price)})`
                                                )
                                                .join(
                                                        ', '
                                                )}. Anh/Chị thấy mẫu nào ưng ý không? Nếu chưa, hãy chia sẻ sở thích như màu sắc, phong cách hoặc chủ đề để em tìm mẫu phù hợp hơn nhé! 😊`;
                                        await chatSession.sendMessage(question);
                                        await chatSession.sendMessage(response);
                                        return randomTemplates.map((t) => ({
                                                ...t,
                                                reason: 'Gợi ý ngẫu nhiên cho Anh/Chị tham khảo',
                                        }));
                                } else {
                                        const response = `Hiện tại em chưa có mẫu thiệp nào để gợi ý. 😔 Anh/Chị có thể chia sẻ sở thích như màu sắc, phong cách hoặc chủ đề để em tìm mẫu phù hợp hơn không ạ?`;
                                        await chatSession.sendMessage(question);
                                        await chatSession.sendMessage(response);
                                        return this.wrapUrlsInAnchorTags(
                                                this.formatResponse(response)
                                        );
                                }
                        }

                        // Xử lý yêu cầu gợi ý mẫu dựa trên sở thích
                        if (wantsTemplate && preferences.trim()) {
                                const aiChoices = await this.findTemplatesWithAI(
                                        preferences,
                                        budget
                                );
                                let pickedTemplates: any[] = [];

                                if (aiChoices.length > 0) {
                                        for (const choice of aiChoices) {
                                                let found: Templates | undefined = undefined;
                                                if (choice.id !== undefined) {
                                                        found = allTemplates.find(
                                                                (t) => t.template_id === choice.id
                                                        );
                                                }
                                                if (!found && choice.name) {
                                                        const nameLower = choice.name.toLowerCase();
                                                        found = allTemplates.find((t) =>
                                                                (t.name || '')
                                                                        .toLowerCase()
                                                                        .includes(nameLower)
                                                        );
                                                }
                                                if (found) {
                                                        pickedTemplates.push({
                                                                id: found.template_id,
                                                                name: found.name,
                                                                reason: choice.reason,
                                                                suggestion:
                                                                        choice.suggestion ||
                                                                        'Anh/Chị thấy mẫu này thế nào? Nếu chưa ưng, có thể chia sẻ thêm sở thích để em tìm mẫu phù hợp hơn nhé! 😊',
                                                                price: found.price,
                                                                description: found.description,
                                                                imageUrl: found.image_url || '',
                                                                features:
                                                                        found.description?.split(
                                                                                ','
                                                                        ) || [],
                                                        });
                                                }
                                        }
                                }

                                if (pickedTemplates.length === 0) {
                                        const fallback = await this.findMatchingTemplates(
                                                preferences || question,
                                                budget
                                        );
                                        if (fallback && fallback.length > 0) {
                                                pickedTemplates = fallback.map((t) => ({
                                                        ...t,
                                                        suggestion: 'Mẫu này có vẻ hợp với sở thích của Anh/Chị, Anh/Chị thấy thế nào? Nếu chưa ưng, có thể chia sẻ thêm sở thích để em tìm mẫu phù hợp hơn nhé! 😊',
                                                }));
                                        }
                                }

                                if (pickedTemplates.length > 0) {
                                        const response = `Em đã tìm thấy một vài template thiệp cưới phù hợp với sở thích của Anh/Chị: ${pickedTemplates
                                                .map((t) => t.name)
                                                .join(
                                                        ', '
                                                )}. Anh/Chị thấy mẫu nào ưng ý không, hay muốn em giải thích chi tiết hơn về mẫu nào? 😊`;
                                        await chatSession.sendMessage(question);
                                        await chatSession.sendMessage(response);
                                        return pickedTemplates.slice(0, 3);
                                } else {
                                        const response = `
                        Không tìm thấy template nào phù hợp với sở thích Anh/Chị mô tả. 😔 Anh/Chị có thể thử mô tả chi tiết hơn (ví dụ: phong cách hiện đại, cổ điển, tối giản, hoặc cung cấp màu chủ đạo). Hoặc em có thể gợi ý ngẫu nhiên vài mẫu phổ biến nếu Anh/Chị muốn!
                    `;
                                        await chatSession.sendMessage(question);
                                        await chatSession.sendMessage(response);
                                        return this.wrapUrlsInAnchorTags(
                                                this.formatResponse(response)
                                        );
                                }
                        }

                        // Xử lý yêu cầu chi tiết mẫu cụ thể
                        if (isDetailRequest && templateIndex && templateIndex > 0) {
                                const previousMessages = await chatSession.getHistory();
                                const lastTemplateResponse = previousMessages
                                        .reverse()
                                        .find(
                                                (msg) =>
                                                        msg.role === 'model' &&
                                                        Array.isArray(
                                                                JSON.parse(
                                                                        msg.parts[0].text || '[]'
                                                                )
                                                        )
                                        );
                                if (lastTemplateResponse) {
                                        const lastTemplates = JSON.parse(
                                                lastTemplateResponse.parts[0].text || '[]'
                                        );
                                        if (
                                                Array.isArray(lastTemplates) &&
                                                lastTemplates.length >= templateIndex
                                        ) {
                                                const selectedTemplate =
                                                        lastTemplates[templateIndex - 1];
                                                const found = allTemplates.find(
                                                        (t) => t.template_id === selectedTemplate.id
                                                );
                                                if (found) {
                                                        const response = `
                                Mẫu "${found.name}" có mô tả: "${found.description}". 
                                Giá: ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(found.price)}.
                                Tính năng: ${found.description?.split(',').join(', ') || 'Tùy chỉnh nội dung, QR nhận hỷ'}.
                                Anh/Chị muốn thêm ý tưởng gì cho mẫu này không, hay cần em gợi ý thêm mẫu tương tự? 😊
                            `;
                                                        await chatSession.sendMessage(question);
                                                        await chatSession.sendMessage(response);
                                                        return this.wrapUrlsInAnchorTags(
                                                                this.formatResponse(response)
                                                        );
                                                }
                                        }
                                }
                                const response = `Em chưa tìm thấy mẫu số ${templateIndex} trong danh sách trước đó. 😔 Anh/Chị có thể mô tả thêm về mẫu đó hoặc yêu cầu em gợi ý lại không ạ?`;
                                await chatSession.sendMessage(question);
                                await chatSession.sendMessage(response);
                                return this.wrapUrlsInAnchorTags(this.formatResponse(response));
                        }

                        // Xử lý câu khen ngợi
                        if (isCompliment) {
                                const response = `Cảm ơn Anh/Chị đã khen! 😊 Mẫu nào làm Anh/Chị ưng ý vậy? Có muốn em gợi ý thêm hoặc cung cấp chi tiết về mẫu nào không ạ?`;
                                await chatSession.sendMessage(question);
                                await chatSession.sendMessage(response);
                                return this.wrapUrlsInAnchorTags(this.formatResponse(response));
                        }

                        // Xử lý yêu cầu so sánh
                        if (isComparison) {
                                const model = this.genAI.getGenerativeModel({
                                        model: 'gemini-2.0-flash',
                                });
                                const prompt = `
                    Bạn là Minto Bot, hỗ trợ so sánh thiệp cưới. Dựa trên câu hỏi "${question.replace(/\n/g, ' ')}", chọn 2 mẫu từ danh sách để so sánh dựa trên tiêu chí người dùng yêu cầu (giá, phong cách, tính năng).
                    Danh sách template:
                    ${allTemplates
                            .map(
                                    (t) =>
                                            `- ID: ${t.template_id}, Name: ${t.name || 'Không tên'}, Description: ${t.description || 'Không có mô tả'}, Price: ${t.price || 0} VND`
                            )
                            .join('\n')}

                    Yêu cầu:
                    1) Chọn 2 mẫu phù hợp với tiêu chí so sánh (nếu không rõ, chọn ngẫu nhiên nhưng hợp lý).
                    2) Trả về JSON: { "template1": {id, name, price, description, features}, "template2": {id, name, price, description, features}, "comparison": "so sánh chi tiết (tiếng Việt)" }
                    3) Chỉ trả JSON, không text khác.
                `;
                                const result = await model.generateContent(prompt);
                                const raw = result?.response?.text ? result.response.text() : '{}';
                                const parsed = JSON.parse(raw);
                                if (parsed.template1 && parsed.template2) {
                                        const response = `
                        So sánh hai mẫu:
                        - "${parsed.template1.name}": Giá ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(parsed.template1.price)}, ${parsed.template1.description}.
                        - "${parsed.template2.name}": Giá ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(parsed.template2.price)}, ${parsed.template2.description}.
                        ${parsed.comparison}
                        Anh/Chị muốn em gợi ý thêm hay xem chi tiết mẫu nào không? 😊
                    `;
                                        await chatSession.sendMessage(question);
                                        await chatSession.sendMessage(response);
                                        return this.wrapUrlsInAnchorTags(
                                                this.formatResponse(response)
                                        );
                                } else {
                                        const response = `Em chưa hiểu rõ tiêu chí so sánh của Anh/Chị. 😔 Có thể mô tả cụ thể hơn (ví dụ: so sánh giá, phong cách, hay tính năng) để em hỗ trợ tốt hơn không ạ?`;
                                        await chatSession.sendMessage(question);
                                        await chatSession.sendMessage(response);
                                        return this.wrapUrlsInAnchorTags(
                                                this.formatResponse(response)
                                        );
                                }
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
