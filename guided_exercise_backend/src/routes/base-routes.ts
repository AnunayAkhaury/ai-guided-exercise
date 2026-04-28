import { Router } from 'express';
import {
  helloWorldController,
  createProfileController,
  getProfileController,
  getUserRecordingsController,
  getUserAchievementsController
} from '@/controllers/firebase-controller.js';
import { addRecordingController } from '@/controllers/firebase-controller.js';
import { uploadVideoController, getVideoUrlController } from '@/controllers/aws-controller.js';
import { createIvsTokenController } from '@/controllers/ivs-controller.js';
import { addIvsTelemetryController } from '@/controllers/telemetry-controller.js';
import {
  completeRecordingProcessingController,
  getRecordingPlaybackController,
  listRecordingsBySessionController,
  listRecordingsByUserController,
  startRecordingProcessingController,
  upsertRecordingController
} from '@/controllers/recording-controller.js';
import {
  createSessionController,
  endSessionController,
  getSessionByIdController,
  joinSessionByCodeController,
  leaveSessionParticipantController,
  listSessionParticipantsController,
  listSessionsController,
  startSessionController,
  upsertSessionParticipantController
} from '@/controllers/session-controller.js';
import { addExerciseTimestampController } from '@/controllers/feedback-controller.js';

const router = Router();
router.get('/', helloWorldController);
router.get('/health', helloWorldController);
router.post('/api/firebase/createProfile', createProfileController);
router.post('/api/firebase/getProfile', getProfileController);
router.post('/api/firebase/addRecording', addRecordingController);
router.post('/api/firebase/getUserRecordings', getUserRecordingsController);
router.post('/api/firebase/addTimestamp', addExerciseTimestampController);
router.post('/api/recordings/upsert', upsertRecordingController);
router.post('/api/recordings/:recordingId/process', startRecordingProcessingController);
router.post('/api/recordings/worker-complete', completeRecordingProcessingController);
router.get('/api/recordings/session/:sessionId', listRecordingsBySessionController);
router.get('/api/recordings/user/:userId', listRecordingsByUserController);
router.get('/api/recordings/:recordingId/playback', getRecordingPlaybackController);
router.post('/api/ivs/token', createIvsTokenController);
router.post('/api/ivs/telemetry', addIvsTelemetryController);
router.post('/api/ivs/sessions/create', createSessionController);
router.post('/api/ivs/sessions/join', joinSessionByCodeController);
router.post('/api/ivs/sessions/start', startSessionController);
router.post('/api/ivs/sessions/end', endSessionController);
router.get('/api/ivs/sessions', listSessionsController);
router.get('/api/ivs/sessions/:sessionId', getSessionByIdController);
router.post('/api/ivs/sessions/participants/upsert', upsertSessionParticipantController);
router.post('/api/ivs/sessions/participants/leave', leaveSessionParticipantController);
router.get('/api/ivs/sessions/:sessionId/participants', listSessionParticipantsController);
router.post('/api/aws/uploadVideo', uploadVideoController);
router.post('/api/aws/getVideo', getVideoUrlController);
router.post('/api/firebase/getAchievements', getUserAchievementsController);

export default router;
