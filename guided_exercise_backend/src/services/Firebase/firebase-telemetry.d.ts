export type IvsTelemetryEventName = 'join_attempt' | 'token_reused' | 'token_refreshed' | 'participant_left_marked' | 'join_failed' | 'token_refresh_failed' | 'participant_left_mark_failed';
export type IvsTelemetryPayload = {
    eventName: IvsTelemetryEventName;
    sessionId?: string;
    stageArn?: string;
    userId?: string;
    role?: 'student' | 'instructor' | 'unknown';
    participantId?: string;
    requestId?: string;
    details?: Record<string, unknown>;
    clientTimestamp?: string;
};
export declare function addIvsTelemetryEvent(payload: IvsTelemetryPayload): Promise<{
    id: string;
    createdAt: Date;
}>;
//# sourceMappingURL=firebase-telemetry.d.ts.map