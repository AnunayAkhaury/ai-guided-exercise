import { Router } from 'express';
import {
  helloWorldController,
  createProfileController,
  getProfileController,
  getUserRecordingsController,
  addSessionController
} from '@/controllers/firebase-controller.js';
import { addRecordingController } from '@/controllers/firebase-controller.js';
import { zoomTokenController } from '@/controllers/zoom-controller.js';
import { uploadVideoController, getVideoUrlController } from '@/controllers/aws-controller.js';

const router = Router();
router.get('/', helloWorldController);
router.post('/api/firebase/createProfile', createProfileController);
router.post('/api/firebase/getProfile', getProfileController);
router.post('/api/firebase/addRecording', addRecordingController);
router.post('/api/firebase/getUserRecordings', getUserRecordingsController);
router.post('/api/zoom/token', zoomTokenController);
router.post('/api/aws/uploadVideo', uploadVideoController);
router.post('/api/aws/getVideo', getVideoUrlController);
router.post('/api/firebase/addSession', addSessionController);

export default router;
