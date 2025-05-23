// // src/imagekit/imagekit.d.ts
// declare module 'imagekit' {
//         export interface AuthenticationParameters {
//                 signature: string;
//                 token: string;
//                 expire: number;
//         }

//         export interface ImageKitConfig {
//                 publicKey: string;
//                 privateKey: string;
//                 urlEndpoint: string;
//         }

//         export class ImageKit {
//                 constructor(config: ImageKitConfig);
//                 getAuthenticationParameters(
//                         token?: string,
//                         expire?: number
//                 ): AuthenticationParameters;
//         }

//         export default ImageKit;
// }
