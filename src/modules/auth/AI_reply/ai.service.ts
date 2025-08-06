// ai.service.ts
import {
        BadRequestException,
        Injectable,
        NotFoundException,
        ConflictException,
        UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Users } from '../../../entities/users.entity';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AI_Service {
        private readonly genAI;
        private readonly mintoContext: string;

        constructor(
                @InjectRepository(Users)
                private readonly userRepository: Repository<Users>,
                private readonly configService: ConfigService
        ) {
                const apiKey = this.configService.get<string>('GEMINI_API_KEY');
                if (!apiKey) {
                        throw new Error('GEMINI_API_KEY is not defined in .env');
                }
                this.genAI = new GoogleGenerativeAI(apiKey);

                this.mintoContext = `
      Bạn là Minto Bot, một trợ lý ảo giúp người dùng hiểu về website Minto - nền tảng đặt thiệp cưới. Hãy trả lời với giọng điệu tự tin, thân thiện, tự nhiên như con người, nhưng chỉ sử dụng câu chào "Chào bạn! Mình là Minto Bot, rất vui được giúp bạn." khi ngữ cảnh yêu cầu giới thiệu. Tránh lặp lại câu chào này trong các phản hồi. Dựa trên các thông tin sau:
      - Điểm mạnh của Minto:
        + Template thiệp cưới có sẵn, dễ sử dụng, linh hoạt để tùy chỉnh.
        + Tạo thẻ nhận hỷ nhanh chóng.
        + Tiền nhận hỷ qua QR code riêng, khách mời quét QR, tiền gửi trực tiếp đến cô dâu chú rể, không qua trung gian.
      - Admin: Huỳnh Nam, Zalo: 0333 xxxx 892.
      - Kênh TikTok: https://www.tiktok.com/@minto_wedding?_t=ZS-8ye0pryjhSL&_r=1. Nơi này luôn cho ra mắt những mẫu mới, cực kỳ sáng tạo và trendy.
      - Minto luôn áp dụng giảm 5% cho tất cả các tài khoản lần đầu sử dụng dịch vụ.
      - Thiệp cưới khi thanh toán xong thì: hệ thống sẽ tạo ra phần danh sách trong đó có toàn bộ link mời cho những khách mời đã thêm trước đó.
      - Xem lại link ở đâu? Vào phần tài khoản, tại đơn hàng đã thanh toán có hiển thị toàn bộ các đơn hàng đã thanh toán, mỗi đơn hàng có nút danh sách đó là nơi chứa toàn bộ khách mời cho đơn hàng đó. Hoặc có thể vào Lịch sử thanh toán trên góc phải màn hình.
      - Mọi thắc mắc liên hệ với ai? Liên hệ với Admin Huỳnh Nam (Dev) qua Zalo 0333 xxxx 892.
      - Cách lấy tọa độ bản đồ: Nếu người dùng cung cấp URL Google Maps, bạn sẽ trích xuất tọa độ từ URL (nếu có) và trả về định dạng (latitude, longitude). Nếu không, hướng dẫn: Trên máy tính (PC): Mở Google Maps, tìm địa điểm, nhấn chuột phải, nếu thấy dãy số như (10.397164609748486, 106.20870203654184), đó là tọa độ. Trên điện thoại: Tìm vị trí, giữ ghim trên màn hình, tọa độ sẽ hiển thị bên dưới. Nếu người dùng chưa rõ, mời họ chia sẻ link Google Maps để bạn hỗ trợ lấy tọa độ. Định dạng câu trả lời: thay ** bằng - đầu dòng và thêm xuống dòng trước mỗi -.
      - Nếu vấn đề lỗi (như đơn hàng, thanh toán,...), người dùng có thể nhấp vào icon support phía dưới màn hình để gửi mã lỗi, hoặc liên hệ Zalo Admin để giải quyết nhanh.
      Nếu câu hỏi không liên quan đến Minto, trả lời ngắn gọn rằng bạn là Minto Bot và chỉ hỗ trợ thông tin về Minto, rồi mời người dùng liên hệ admin qua Zalo 0333 xxxx 892 hoặc xem TikTok để biết thêm.
    `;
        }

        // Hàm bọc URL trong thẻ <a>
        private wrapUrlsInAnchorTags(text: string): string {
                const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
                return text.replace(urlRegex, '<a href="$1" target="_blank">$1</a>');
        }

        // Hàm lọc câu chào lặp
        private removeDuplicateGreeting(text: string): string {
                const greeting = 'Chào bạn! Mình là Minto Bot, rất vui được giúp bạn.';
                if (text.includes(greeting)) {
                        const cleanText = text.replace(new RegExp(greeting, 'gi'), '').trim();
                        return cleanText ? cleanText : text;
                }
                return text;
        }

        // Hàm trích xuất tọa độ từ URL Google Maps
        private extractCoordinatesFromUrl(url: string): [number, number] | null {
                try {
                        const coordRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
                        const altCoordRegex = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/;
                        const placeCoordRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;

                        let match =
                                url.match(coordRegex) ||
                                url.match(altCoordRegex) ||
                                url.match(placeCoordRegex);

                        if (match && match.length >= 3) {
                                const lat = parseFloat(match[1]);
                                const lng = parseFloat(match[2]);
                                if (isNaN(lat) || isNaN(lng)) return null;
                                return [lat, lng];
                        }
                        return null;
                } catch (error) {
                        console.error('Error extracting coordinates:', error);
                        return null;
                }
        }

        // Hàm định dạng lại câu trả lời, thay ** bằng - và thêm xuống dòng
        private formatResponse(text: string): string {
                return text
                        .replace(/\*\*/g, '\n-') // Thay ** bằng \n- để tạo danh sách
                        .replace(/\n-/g, '\n- ') // Thêm khoảng trắng sau - để định dạng đẹp hơn
                        .trim(); // Loại bỏ khoảng trắng thừa
        }

        // Hàm gọi API Gemini để trả lời câu hỏi
        async answerAsMintoBot(question: string): Promise<string> {
                try {
                        const model = this.genAI.getGenerativeModel({
                                model: 'gemini-1.5-flash-latest',
                                generationConfig: { maxOutputTokens: 2000 },
                        });

                        // Kiểm tra nếu câu hỏi chứa URL Google Maps
                        const googleMapsRegex = /https?:\/\/(www\.)?google\.com\/maps\/[^\s<]+/;
                        const urlMatch = question.match(googleMapsRegex);

                        if (urlMatch) {
                                const url = urlMatch[0];
                                const coordinates = this.extractCoordinatesFromUrl(url);
                                if (coordinates) {
                                        const [lat, lng] = coordinates;
                                        const response = `Tọa độ từ link bạn cung cấp là (${lat}, ${lng}). Bạn muốn mình hỗ trợ gì thêm về thiệp cưới hoặc địa điểm không nha? 😊 Liên hệ admin Huỳnh Nam qua Zalo 0333 xxxx 892 nếu cần hỗ trợ nhanh!`;
                                        return this.wrapUrlsInAnchorTags(response);
                                } else {
                                        const response = `Link bạn gửi không chứa tọa độ rõ ràng. Hãy thử gửi lại link Google Maps đúng định dạng (ví dụ: chứa @lat,lng hoặc !3dlat!4dlng), hoặc làm theo cách sau:
- Trên máy tính (PC): Mở Google Maps, tìm địa điểm, nhấn chuột phải để lấy tọa độ.
- Trên điện thoại: Tìm vị trí, giữ ghim trên màn hình để xem tọa độ. Nếu cần, gửi link mới, mình sẽ giúp nhé! 😊`;
                                        return this.wrapUrlsInAnchorTags(
                                                this.formatResponse(response)
                                        );
                                }
                        }

                        // Nếu không có URL Google Maps, gửi câu hỏi đến Gemini
                        const prompt = `${this.mintoContext}\n\nCâu hỏi từ người dùng: ${question}\nHãy trả lời đúng vai trò Minto Bot, sử dụng thông tin trong context, giọng điệu thân thiện, tự tin, và tự nhiên.`;

                        const result = await model.generateContent(prompt);
                        const response = await result.response;
                        let finalResponse = response.text();

                        // Xử lý câu trả lời: lọc câu chào lặp, định dạng, và bọc URL trong thẻ <a>
                        finalResponse = this.removeDuplicateGreeting(finalResponse);
                        finalResponse = this.formatResponse(finalResponse);
                        finalResponse = this.wrapUrlsInAnchorTags(finalResponse);

                        return finalResponse;
                } catch (error) {
                        throw new BadRequestException('Error calling Gemini API: ' + error.message);
                }
        }
}
