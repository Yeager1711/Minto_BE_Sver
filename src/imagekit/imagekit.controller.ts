// src/imagekit/imagekit.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ImageKit from 'imagekit'; // ✅ dùng đúng với esModuleInterop
import { v4 as uuidv4 } from 'uuid';

@Controller('imagekit')
export class ImageKitController {
        private imagekit: ImageKit;

        constructor(private configService: ConfigService) {
                this.imagekit = new ImageKit({
                        publicKey: 'public_MWz6Jz8dBiCgIo0k5lWmcvBZjqk=',
                        privateKey: 'private_a0k0wfg9Qa3EyaqNLloatHug3+c=',
                        urlEndpoint: 'https://ik.imagekit.io/zawkrzrax',
                });
        }

        @Get('auth')
        getAuthenticationParameters() {
                const token = uuidv4();
                const authParams = this.imagekit.getAuthenticationParameters(token);
                return authParams;
        }
}
