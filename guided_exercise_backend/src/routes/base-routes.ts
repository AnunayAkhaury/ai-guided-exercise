import { Router } from 'express';
import { helloWorldController, createProfileController } from '@/controllers/base-controller.js';
import { zoomTokenController } from '@/controllers/zoom-controller.js';

const router = Router();
router.get('/', helloWorldController);
router.post('/api/createProfile', createProfileController);
router.post('/api/zoom/token', zoomTokenController);

export default router;
