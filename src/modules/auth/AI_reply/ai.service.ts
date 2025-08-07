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
      - Admin: 
                + Huỳnh Nam, 
                + Zalo: 0333 xxxx 892. 
      - Kênh TikTok: https://www.tiktok.com/@minto_wedding?_t=ZS-8ye0pryjhSL&_r=1.
      - Minto luôn áp dụng giảm 5% cho tất cả tài khoản lần đầu sử dụng. điều kiện được áp dụng là 7 ngày kể từ ngày đăng kí tài khoản.
      - Thiệp cưới khi thanh toán xong thì: hệ thống sẽ tạo ra phần danh sách trong đó có toàn bộ link mời cho khách mời đã thêm.
      - Xem lại link ở đâu? Vào phần tài khoản, tại đơn hàng đã thanh toán có nút danh sách khách mời. Hoặc vào Lịch sử thanh toán trên góc phải màn hình.
      - Mọi thắc mắc liên hệ với Admin Huỳnh Nam (Dev) qua Zalo 0333 xxxx 892.
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
                                maxOutputTokens: 1000,
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

        private async findMatchingTemplates(
                preferences: string,
                budget?: number
        ): Promise<Templates[]> {
                const allTemplates = await this.findAllTemplates();
                const cleanedPref = preferences.trim().toLowerCase();

                // Tìm exact hoặc partial match trong name trước
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

                // Nếu không tìm được match rõ ràng, fallback sang tìm theo keyword mô tả + ngân sách
                const keywords = cleanedPref.split(/\s+/).filter((word) => word.length > 2);

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
                        .sort((a, b) => b._score - a._score)
                        .slice(0, 3)
                        .map((template) => ({
                                ...template,
                                features: [template.description?.split(',')[0] || 'Không có mô tả'],
                                imageUrl: template.image_url || '',
                        }));
        }

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

                        if (
                                question.toLowerCase().includes('số lượng template') ||
                                question.toLowerCase().includes('bao nhiêu template')
                        ) {
                                const count = await this.getTemplateCount();
                                const response = `Hiện tại, Minto có **${count} template** thiệp cưới sẵn sàng cho bạn lựa chọn! 😊 Bạn muốn mình gợi ý mẫu nào phù hợp với sở thích của bạn không?`;
                                return this.wrapUrlsInAnchorTags(this.formatResponse(response));
                        }

                        const preferenceKeywords = [
                                'gu',
                                'sở thích',
                                'phong cách',
                                'thiệp cưới',
                                'mẫu thiệp',
                        ];
                        const hasPreference = preferenceKeywords.some((keyword) =>
                                question.toLowerCase().includes(keyword)
                        );
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

                        if (hasPreference) {
                                const templates = await this.findMatchingTemplates(
                                        question,
                                        budget
                                );
                                if (templates.length > 0) {
                                        return templates;
                                } else {
                                        const response = `
Không tìm thấy template nào phù hợp với sở thích bạn mô tả. 😔 Bạn có thể thử mô tả chi tiết hơn (ví dụ: phong cách hiện đại, cổ điển, tối giản, hoặc giá tiền mong muốn cụ thể).
          `;
                                        return this.wrapUrlsInAnchorTags(
                                                this.formatResponse(response)
                                        );
                                }
                        }

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
                        throw new BadRequestException('Error calling Gemini API: ' + error.message);
                }
        }
}
