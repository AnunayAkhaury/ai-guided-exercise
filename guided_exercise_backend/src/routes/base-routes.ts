import { Router } from 'express';
import {
  helloWorldController,
  createProfileController,
  getProfileController,
  getUserRecordingsController,
  getUserAchievementsController,
  listProfilesController,
  updateProfileController,
  createApprovalRequestController,
  verifyAccountController,
  getUserVerificationStatusController
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
  upsertRecordingController,
  getClipsByUserController,
  getClipPlaybackController
} from '@/controllers/recording-controller.js';
import {
  createAndStartSessionController,
  createSessionController,
  endSessionController,
  getSessionByIdController,
  heartbeatSessionParticipantController,
  joinSessionByCodeController,
  leaveSessionParticipantController,
  listSessionParticipantsController,
  listSessionsController,
  startSessionController,
  upsertSessionParticipantController
} from '@/controllers/session-controller.js';
import {
  addExerciseTimestampController,
  addClipController,
  addFeedbackController,
  getFeedbackFromIdController,
  getFeedbackFromUserIdController
} from '@/controllers/feedback-controller.js';
import {
  registerPushTokenController,
  sendDueClassRemindersController,
  unregisterPushTokenController
} from '@/controllers/notification-controller.js';
import { verifyFirebaseToken } from '@/middleware/firebase-jwt-middleware.js';

const router = Router();

router.get('/', helloWorldController);
router.get('/health', helloWorldController);
router.post('/api/firebase/createProfile', createProfileController);
router.post('/api/firebase/getProfile', verifyFirebaseToken, getProfileController);
router.post('/api/firebase/updateProfile', verifyFirebaseToken, updateProfileController);
router.get('/api/firebase/users', verifyFirebaseToken, listProfilesController);
router.post('/api/firebase/addRecording', addRecordingController);
router.post('/api/firebase/getUserRecordings', getUserRecordingsController);
router.post('/api/firebase/addTimestamp', addExerciseTimestampController);
router.post('/api/firebase/addClip', addClipController);
router.post('/api/firebase/addFeedback', addFeedbackController);
router.post('/api/verification/createApprovalRequest', createApprovalRequestController);
router.get('/api/verification/verifyEmail/:token', verifyAccountController);
router.get('/api/verification/verificationStatus/:uid', getUserVerificationStatusController);
router.post('/api/recordings/upsert', upsertRecordingController);
router.post('/api/recordings/:recordingId/process', startRecordingProcessingController);
router.post('/api/recordings/worker-complete', completeRecordingProcessingController);
router.get('/api/recordings/session/:sessionId', verifyFirebaseToken, listRecordingsBySessionController);
router.get('/api/recordings/user/:userId', verifyFirebaseToken, listRecordingsByUserController);
router.get('/api/recordings/:recordingId/playback', verifyFirebaseToken, getRecordingPlaybackController);
router.get('/api/clips/user/:userId', verifyFirebaseToken, getClipsByUserController);
router.get('/api/clip/:clipId/playback', verifyFirebaseToken, getClipPlaybackController);
router.get('/api/feedback/:feedbackRef', verifyFirebaseToken, getFeedbackFromIdController);
router.get('/api/feedback/user/:userId', verifyFirebaseToken, getFeedbackFromUserIdController);
router.post('/api/ivs/token', createIvsTokenController);
router.post('/api/ivs/telemetry', addIvsTelemetryController);
router.post('/api/ivs/sessions/create', createSessionController);
router.post('/api/ivs/sessions/create-and-start', createAndStartSessionController);
router.post('/api/ivs/sessions/join', joinSessionByCodeController);
router.post('/api/ivs/sessions/start', startSessionController);
router.post('/api/ivs/sessions/end', endSessionController);
router.get('/api/ivs/sessions', listSessionsController);
router.get('/api/ivs/sessions/:sessionId', getSessionByIdController);
router.post('/api/ivs/sessions/participants/upsert', upsertSessionParticipantController);
router.post('/api/ivs/sessions/participants/heartbeat', heartbeatSessionParticipantController);
router.post('/api/ivs/sessions/participants/leave', leaveSessionParticipantController);
router.get('/api/ivs/sessions/:sessionId/participants', listSessionParticipantsController);
router.post('/api/notifications/register-token', registerPushTokenController);
router.post('/api/notifications/unregister-token', unregisterPushTokenController);
router.post('/api/notifications/class-reminders/send-due', sendDueClassRemindersController);
router.post('/api/aws/uploadVideo', uploadVideoController);
router.post('/api/aws/getVideo', verifyFirebaseToken, getVideoUrlController);
router.post('/api/firebase/getAchievements', verifyFirebaseToken, getUserAchievementsController);

export default router;
