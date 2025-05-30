import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ImageKit from 'imagekit';
import { v4 as uuidv4 } from 'uuid';

@Controller('imagekit')
export class ImageKitController {
        private imagekit: ImageKit;

        constructor(private configService: ConfigService) {
                this.imagekit = new ImageKit({
                        publicKey: this.configService.get<string>('NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY') || '',
                        privateKey: this.configService.get<string>('NEXT_PUBLIC_IMAGEKIT_PRIVATE_KEY') || '',
                        urlEndpoint: this.configService.get<string>('NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT') || '',
                });
        }

        @Get('auth')
        getAuthenticationParameters() {
                const token = uuidv4();
                const authParams = this.imagekit.getAuthenticationParameters(token);
                return authParams;
        }
}
