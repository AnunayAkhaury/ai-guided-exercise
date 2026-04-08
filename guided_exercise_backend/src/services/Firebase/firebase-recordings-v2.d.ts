export type RecordingStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type RecordingDocument = {
    recordingId: string;
    sessionId: string;
    participantId: string;
    userId: string | null;
    rawS3Prefix: string;
    recordingStart: Date | null;
    recordingEnd: Date | null;
    durationMs: number | null;
    status: RecordingStatus;
    processedVideoUrl: string | null;
    feedbackJsonUrl: string | null;
    error: string | null;
    source: 'manual' | 'eventbridge' | 'worker';
    createdAt: Date;
    updatedAt: Date;
};
type UpsertRecordingInput = {
    recordingId?: string;
    sessionId: string;
    participantId: string;
    userId?: string | null;
    rawS3Prefix: string;
    recordingStart?: Date | null;
    recordingEnd?: Date | null;
    durationMs?: number | null;
    status?: RecordingStatus;
    processedVideoUrl?: string | null;
    feedbackJsonUrl?: string | null;
    error?: string | null;
    source?: 'manual' | 'eventbridge' | 'worker';
};
export declare function toRecordingId(input: {
    recordingId: string | undefined;
    rawS3Prefix: string;
}): string;
export declare function upsertRecording(input: UpsertRecordingInput): Promise<RecordingDocument>;
export {};
//# sourceMappingURL=firebase-recordings-v2.d.ts.map