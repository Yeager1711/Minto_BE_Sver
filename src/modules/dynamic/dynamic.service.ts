import { Injectable, Logger } from '@nestjs/common';

export interface DynamicPayload {
        state: 'minimal' | 'compact' | 'expanded';
        TypeContextCollapsed?: boolean;
        action: 'success' | 'failure';
        actionTitle?: string;
        describle?: string;
        time?: string;
        type?: string;
        duration?: number;
        [key: string]: any; // Cho phép mở rộng trường tùy chọn
}

@Injectable()
export class DynamicService {
        private readonly logger = new Logger(DynamicService.name);
        private userStates = new Map<number, DynamicPayload>();

        getStatus(userId: number): DynamicPayload {
                const userState = this.userStates.get(userId);
                if (!userState) {
                        const defaultState: DynamicPayload = {
                                state: 'compact',
                                TypeContextCollapsed: false,
                                action: 'failure',
                                actionTitle: 'Chưa có dữ liệu',
                                describle: 'Không có thông tin trạng thái hiện tại.',
                                time: new Date().toISOString(),
                                type: 'notification',
                                duration: 3500,
                        };
                        this.logger.debug(`=========================================================
Dynamic Returning state (default): ${JSON.stringify(defaultState, null, 2)}`);
                        return defaultState;
                }

                this.logger.debug(`=========================================================
Dynamic Returning state: ${JSON.stringify(userState, null, 2)}`);
                return userState;
        }

        setState(userId: number, payload: DynamicPayload): DynamicPayload {
                const newState: DynamicPayload = {
                        ...payload,
                        time: payload.time || new Date().toISOString(), // Đảm bảo có thời gian
                        type: payload.type || 'notification', // Mặc định loại
                        duration: payload.duration || 3500, // Mặc định thời gian hiển thị
                };

                this.userStates.set(userId, newState);

                this.logger.debug(
                        `=========================================================\nDynamic Setting state: ${newState.state} ${JSON.stringify(
                                {
                                        TypeContextCollapsed: newState.TypeContextCollapsed,
                                        action: newState.action,
                                        actionTitle: newState.actionTitle,
                                        describle: newState.describle,
                                        time: newState.time,
                                        type: newState.type,
                                        duration: newState.duration,
                                },
                                null,
                                2
                        )}`
                );

                return newState;
        }
}
