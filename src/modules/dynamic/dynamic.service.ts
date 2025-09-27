import { Injectable, Logger } from '@nestjs/common';

export interface DynamicData {
        state: 'minimal' | 'compact' | 'expanded';
        type?: string;
        title?: string;
        content?: {
                message?: string;
                note?: string;
        };
        time?: string;
        action?: string;
        duration?: number;
        TypeContextCollapsed?: boolean; // Thêm trường mới
}

@Injectable()
export class DynamicService {
        private readonly logger = new Logger(DynamicService.name);
        private userStates = new Map<number, DynamicData>();

        getStatus(userId: number) {
                const userState = this.userStates.get(userId);
                if (!userState) {
                        const defaultState: DynamicData = {
                                state: 'compact',
                                title: 'Chưa có dữ liệu',
                                content: { message: '', note: '' },
                                time: '',
                                action: '',
                                TypeContextCollapsed: false, // Mặc định không collapse
                        };
                        this.logger.debug(`=========================================================
Dynamic Returning state (default): ${JSON.stringify(defaultState, null, 2)}`);
                        return defaultState;
                }

                this.logger.debug(`=========================================================
Dynamic Returning state: ${JSON.stringify(userState, null, 2)}`);
                return userState;
        }

        setState(userId: number, state: 'minimal' | 'compact' | 'expanded', data?: any) {
                const newState: DynamicData = {
                        state,
                        ...data,
                };

                this.userStates.set(userId, newState);

                this.logger.debug(`=========================================================
Dynamic Setting state: ${state} ${JSON.stringify(data, null, 2)}`);

                return newState;
        }
}
