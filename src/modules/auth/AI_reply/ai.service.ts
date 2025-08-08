import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Users } from '../../../entities/users.entity';
import { Templates } from '../../../entities/templates.entity';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, ChatSession } from '@google/generative-ai';

@Injectable()
export class AI_Service {
        private readonly genAI;
        private readonly mintoContext: string;
        private chatSession: ChatSession | null = null;

        constructor(
                @InjectRepository(Users)
                private readonly userRepository: Repository<Users>,
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
      Bạn là Minto Bot, một trợ lý ảo giúp người dùng hiểu về website Minto - nền tảng đặt thiệp cưới Online. Hãy trả lời với giọng điệu tự tin, thân thiện, tự nhiên như con người, nhưng chỉ sử dụng câu chào "Chào bạn! Mình là Minto Bot, rất vui được giúp bạn." khi ngữ cảnh yêu cầu giới thiệu. Tránh lặp lại câu chào này trong các phản hồi. Dựa trên các thông tin sau:
      - Điểm mạnh của Minto:
        + Template thiệp cưới có sẵn, dễ sử dụng, linh hoạt để tùy chỉnh.
        + Tạo thẻ nhận hỷ nhanh chóng.
        + Tiền nhận hỷ qua QR code riêng, khách mời quét QR, tiền gửi trực tiếp đến cô dâu chú rể, không qua trung gian.
        + Khách hàng hướng đến: Giới trẻ, hoặc khách hàng cần sự trẻ trung, mới lạ.

      - Admin:
                + Huỳnh Nam,
                + Zalo: 0333 xxxx 892.
      - Kênh TikTok: https://www.tiktok.com/@minto_wedding?_t=ZS-8ye0pryjhSL&_r=1.

      - Minto luôn áp dụng giảm 5% cho tất cả tài khoản lần đầu sử dụng. điều kiện được áp dụng là 7 ngày kể từ ngày đăng kí tài khoản.

      - Thiệp cưới khi thanh toán xong thì: hệ thống sẽ tạo ra phần danh sách trong đó có toàn bộ link mời cho khách mời đã thêm.

      - Xem lại link ở đâu? Vào phần tài khoản, tại đơn hàng đã thanh toán có nút danh sách khách mời. Hoặc vào Lịch sử thanh toán trên góc phải màn hình.

      - Hệ thống không cho phép chỉnh sửa trên các mẫu có sẵn, hệ thống chỉ cung cấp các mẫu có sẵn, rồi đó người dùng có thể nhập nội dung và chọn hình ảnh yêu thích trực tiếp trên mẫu có sẵn đó.

      - Hứa hẹn tương lai: Những gì chưa có sẽ đang nằm tính năng phát triển trong tương lai.

      - Cách lấy tọa độ bản đồ: Nếu người dùng cung cấp URL Google Maps, bạn sẽ trích xuất tọa độ từ URL (nếu có) và trả về định dạng (latitude, longitude). Nếu không, hãy hướng dẫn theo các bước sau:
        Trên máy tính:
        1. Mở Google Maps.
        2. Tìm địa điểm cần lấy tọa độ.
        3. Nhấp chuột phải vào địa điểm → Tọa độ sẽ hiện ở dòng đầu tiên. Sao chép và sử dụng.
        Trên điện thoại:
        1. Mở ứng dụng Google Maps.
        2. Tìm địa điểm.
        3. Nhấn giữ lên địa điểm cho đến khi hiện ghim đỏ.
        4. Vuốt thông tin lên để thấy tọa độ và sao chép.

      - Nếu vấn đề lỗi (như đơn hàng, thanh toán,...), người dùng có thể nhấp vào icon support để gửi mã lỗi, hoặc liên hệ Zalo Admin để giải quyết nhanh.

      - Khi thanh toán xong (nếu lỗi phần này, hỏi khách hàng đã nhấn nút Hoàn Thành chưa) => đưa ra hướng giải quyết hệ thống có nút Hoàn Thành, nhấn vào nút để danh sách cũng như thông tin trước đó được lưu lại. 

      - Có cách nào quay lại nhấn nút hoàn thành không ? [Không có cách], vì trong phần [hướng dẫn] đã có tất cả nên chỉ liên hệ với Admin để được hỗ trợ nhanh nhất.

      - Nếu người dùng hỏi về số lượng template: Trả lời dựa trên số lượng template có trong hệ thống.
      
      - Nếu người dùng hỏi về sở thích thiệp cưới: Tìm template phù hợp dựa trên tên, mô tả, và giá (nếu người dùng cung cấp ngân sách).
    `.trim();

                this.listAvailableModels().catch((error) => {
                        console.error('[GoogleGenerativeAI] Error listing models:', error.message);
                });

                this.initChatSession();
        }

        async listAvailableModels(): Promise<void> {
                try {
                        const apiKey = this.configService.get<string>('GEMINI_API_KEY');
                        const response = await fetch(
                                `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
                                {
                                        method: 'GET',
                                }
                        );

                        if (!response.ok) {
                                const errorData = await response.json();
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

        private async initChatSession() {
                const model = this.genAI.getGenerativeModel({
                        model: 'gemini-2.0-flash',
                        generationConfig: {
                                maxOutputTokens: 500,
                        },
                });

                this.chatSession = model.startChat({
                        history: [
                                {
                                        role: 'user',
                                        parts: [{ text: this.mintoContext }],
                                },
                                {
                                        role: 'model',
                                        parts: [
                                                {
                                                        text: 'Chào bạn! Mình là Minto Bot, rất vui được giúp bạn.',
                                                },
                                        ],
                                },
                        ],
                });
        }

        private extractCoordinatesFromUrl(url: string): [number, number] | null {
                try {
                        const coordRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
                        const altCoordRegex = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/;
                        const match = url.match(coordRegex) || url.match(altCoordRegex);
                        if (match && match.length >= 3) {
                                const lat = parseFloat(match[1]);
                                const lng = parseFloat(match[2]);
                                return isNaN(lat) || isNaN(lng) ? null : [lat, lng];
                        }
                        return null;
                } catch (error) {
                        return null;
                }
        }

        private formatResponse(text: string): string {
                const emojiFriendly = [
                        { keywords: ['thành công', 'đẹp', 'vui', 'phù hợp'], icon: '😊' },
                        { keywords: ['không tìm thấy', 'lỗi', 'không hợp'], icon: '😔' },
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
                return text.replace(urlRegex, '<a href="$1" target="_blank">$1</a>');
        }

        private removeDuplicateGreeting(text: string): string {
                const greeting = 'Chào bạn! Mình là Minto Bot, rất vui được giúp bạn.';
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

        // === NEW: parse user input to detect intent and extract "preferences" (no budget) ===
        private async parseTemplateRequest(
                userInput: string
        ): Promise<{ wantsTemplate: boolean; preferences: string }> {
                try {
                        const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

                        const prompt = `
Bạn là một hệ thống phân tích yêu cầu tìm mẫu thiệp cưới.
Trả về CHÍNH XÁC một JSON có cấu trúc:
{
  "wantsTemplate": boolean,   // true nếu người dùng muốn được gợi ý template (câu hỏi có ý định tìm/so sánh/gợi ý mẫu)
  "preferences": string       // mô tả gu (màu, phong cách, chủ đề, cảm xúc, từ khóa...), rỗng nếu không có
}
**Chỉ trả JSON, KHÔNG giải thích.**

Ví dụ:
"Có mẫu thiệp cổ điển nào không?" => {"wantsTemplate": true, "preferences":"phong cách cổ điển"}
"Mình thích màu pastel, tối giản" => {"wantsTemplate": true, "preferences":"màu pastel, phong cách tối giản, nhẹ nhàng"}
"Bạn có khuyến mãi không?" => {"wantsTemplate": false, "preferences":""}
"Cho mình gợi ý mấy mẫu cho đám cưới biển" => {"wantsTemplate": true, "preferences":"chủ đề biển, màu xanh, lãng mạn"}

Câu cần phân tích: "${userInput.replace(/\n/g, ' ')}"
`;

                        const result = await model.generateContent(prompt);
                        const raw = result?.response?.text ? result.response.text() : '';
                        const parsed = JSON.parse(raw);
                        return {
                                wantsTemplate: Boolean(parsed.wantsTemplate),
                                preferences: parsed.preferences
                                        ? String(parsed.preferences).trim()
                                        : '',
                        };
                } catch (err) {
                        // Nếu parse lỗi, fallback: đơn giản detect một số từ khóa cơ bản (chỉ fallback)
                        console.warn(
                                '[parseTemplateRequest] fallback due to error:',
                                err?.message || err
                        );
                        const lower = (userInput || '').toLowerCase();
                        const fallbackWants =
                                /mẫu|thiệp|gợi ý|phong cách|gu|sở thích|cổ điển|tối giản|vintage|pastel|bãi biển|biển|rustic|boho/.test(
                                        lower
                                );
                        return {
                                wantsTemplate: fallbackWants,
                                preferences: fallbackWants ? userInput : '',
                        };
                }
        }

        // === NEW: ask AI to pick up to 3 best templates from the DB list based on preferences ===
        private async findTemplatesWithAI(
                preferences: string
        ): Promise<Array<{ id?: number; name?: string; reason?: string }>> {
                try {
                        const templates = await this.findAllTemplates();
                        if (!templates || templates.length === 0) return [];

                        // Avoid sending extremely long lists to the model — sample first N templates if DB large
                        const SAMPLE_LIMIT = 60;
                        const sample = templates.slice(0, SAMPLE_LIMIT);

                        const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

                        const templateLines = sample
                                .map(
                                        (t) =>
                                                `- ID: ${t.template_id}, Name: ${t.name || 'Không tên'}, Description: ${t.description || 'Không có mô tả'}`
                                )
                                .join('\n');

                        const prompt = `
                        Bạn là hệ thống gợi ý thiệp cưới. Mục tiêu: dựa trên mô tả gu của khách hàng, chọn tối đa 3 mẫu từ danh sách dưới đây phù hợp nhất.
                        Danh sách template:
                        ${templateLines}

                        Mô tả gu khách hàng: "${preferences.replace(/\n/g, ' ')}"

                        Yêu cầu:
                        1) So sánh dựa trên phong cách, màu sắc chủ đạo, chủ đề và cảm giác tổng thể.
                        2) Trả về một mảng JSON gồm tối đa 3 phần tử, mỗi phần tử có:
                        { "id": số, "name": "tên template", "reason": "ngắn gọn lý do tại sao phù hợp" }
                        3) Xếp theo thứ tự phù hợp giảm dần (phần tử đầu phù hợp nhất).
                        4) Chỉ trả JSON, không giải thích thêm.

                        Ví dụ output:
                        [
                        { "id": 12, "name": "Mẫu Pastel Tối Giản", "reason": "Màu pastel, phong cách tối giản, nhẹ nhàng" },
                        ...
                        ]
`;

                        const result = await model.generateContent(prompt);
                        const raw = result?.response?.text ? result.response.text() : '';
                        const parsed = JSON.parse(raw);

                        if (!Array.isArray(parsed)) return [];

                        // Normalize items
                        return parsed.slice(0, 3).map((it: any) => ({
                                id: typeof it.id === 'number' ? it.id : undefined,
                                name: it.name ? String(it.name) : undefined,
                                reason: it.reason ? String(it.reason) : undefined,
                        }));
                } catch (err) {
                        console.warn(
                                '[findTemplatesWithAI] AI selection failed, falling back. Error:',
                                err?.message || err
                        );
                        return [];
                }
        }

        // keep the original DB-text matching as fallback (keeps budget param optional)
        private async findMatchingTemplates(
                preferences: string,
                budget?: number
        ): Promise<Templates[]> {
                const allTemplates = await this.findAllTemplates();
                const cleanedPref = (preferences || '').trim().toLowerCase();
                if (!cleanedPref) return [];

                // exact/partial name match first
                const strongMatches = allTemplates.filter((t) =>
                        (t.name || '').toLowerCase().includes(cleanedPref)
                );
                if (strongMatches.length > 0) {
                        return strongMatches.map((template) => ({
                                ...template,
                                features: [template.description?.split(',')[0] || 'Không có mô tả'],
                                imageUrl: template.image_url || '',
                        }));
                }

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
                                keywordMatchesInName * 2 + keywordMatchesInDesc + budgetScore;
                        return { ...template, _score: totalScore };
                });

                return scoredTemplates
                        .filter((t) => t._score > 0)
                        .sort((a, b) => (b._score as number) - (a._score as number))
                        .slice(0, 3)
                        .map((template) => ({
                                ...template,
                                features: [template.description?.split(',')[0] || 'Không có mô tả'],
                                imageUrl: template.image_url || '',
                        }));
        }

        // === UPDATED: main entrypoint uses AI-based parsing + AI selection ===
        async answerAsMintoBot(question: string): Promise<string | Templates[]> {
                try {
                        const googleMapsRegex = /https?:\/\/(www\.)?google\.com\/maps\/[^\s<]+/;
                        const urlMatch = question.match(googleMapsRegex);

                        if (urlMatch) {
                                const url = urlMatch[0];
                                const coordinates = this.extractCoordinatesFromUrl(url);
                                if (coordinates) {
                                        const [lat, lng] = coordinates;
                                        const response = `Tọa độ từ link bạn cung cấp là (${lat}, ${lng}). Bạn muốn mình hỗ trợ gì thêm về thiệp cưới hoặc địa điểm không nha? 😊`;
                                        return this.wrapUrlsInAnchorTags(response);
                                } else {
                                        const response = `
Link bạn gửi không chứa tọa độ rõ ràng. Hãy thử gửi lại link Google Maps đúng định dạng (chứa @lat,lng hoặc !3dlat!4dlng), hoặc làm theo cách sau:
**Trên máy tính (PC):** Mở Google Maps, tìm địa điểm, nhấn chuột phải để lấy tọa độ.
**Trên điện thoại:** Tìm vị trí, giữ ghim trên màn hình để xem tọa độ.
Nếu cần, gửi link mới, mình sẽ giúp nhé! 😊
          `;
                                        return this.wrapUrlsInAnchorTags(
                                                this.formatResponse(response)
                                        );
                                }
                        }

                        // số lượng template
                        if (
                                question.toLowerCase().includes('số lượng template') ||
                                question.toLowerCase().includes('bao nhiêu template') ||
                                question.toLowerCase().includes('số lượng template hiện tại') ||
                                question.toLowerCase().includes('số lượng template hiện có')
                        ) {
                                const count = await this.getTemplateCount();
                                const response = `Hiện tại, Minto có **${count} template** thiệp cưới sẵn sàng cho bạn lựa chọn! 😊 Bạn muốn mình gợi ý mẫu nào phù hợp với sở thích của bạn không?`;
                                return this.wrapUrlsInAnchorTags(this.formatResponse(response));
                        }

                        // parse budget if user provided (optional, giữ behavior cũ)
                        const budgetMatch = question.match(
                                /ngân sách|giá|khoảng (\d+)(?:\s*(?:triệu|nghìn|k))?/i
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

                        // AI determines intent + preferences
                        const { wantsTemplate, preferences } =
                                await this.parseTemplateRequest(question);

                        if (wantsTemplate) {
                                // ask AI to pick best templates from DB
                                const aiChoices = await this.findTemplatesWithAI(preferences);

                                const allTemplates = await this.findAllTemplates();
                                let pickedTemplates: Templates[] = [];

                                if (aiChoices.length > 0) {
                                        // preserve AI order
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
                                                                ...found,
                                                                features: [
                                                                        found.description?.split(
                                                                                ','
                                                                        )[0] || 'Không có mô tả',
                                                                ],
                                                                imageUrl: found.image_url || '',
                                                        } as any);
                                                }
                                        }
                                }

                                // fallback: nếu AI không trả mẫu hoặc không khớp, dùng findMatchingTemplates
                                if (pickedTemplates.length === 0) {
                                        const fallback = await this.findMatchingTemplates(
                                                preferences || question,
                                                budget
                                        );
                                        if (fallback && fallback.length > 0) {
                                                pickedTemplates = fallback;
                                        }
                                }

                                if (pickedTemplates.length > 0) {
                                        return pickedTemplates.slice(0, 3);
                                } else {
                                        const response = `
Không tìm thấy template nào phù hợp với sở thích bạn mô tả. 😔 Bạn có thể thử mô tả chi tiết hơn (ví dụ: phong cách hiện đại, cổ điển, tối giản, hoặc cung cấp màu chủ đạo).
          `;
                                        return this.wrapUrlsInAnchorTags(
                                                this.formatResponse(response)
                                        );
                                }
                        }

                        // fallback to chat
                        if (!this.chatSession) {
                                await this.initChatSession();
                        }

                        const result = await this.chatSession.sendMessage(question);
                        const response = await result.response;
                        let finalText = response.text();

                        finalText = this.removeDuplicateGreeting(finalText);
                        finalText = this.formatResponse(finalText);
                        finalText = this.wrapUrlsInAnchorTags(finalText);

                        return finalText;
                } catch (error) {
                        console.error('Gemini API Error:', error);
                        throw new BadRequestException(
                                'Error calling Gemini API: ' + (error?.message || error)
                        );
                }
        }
}
