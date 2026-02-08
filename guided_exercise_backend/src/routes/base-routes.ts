import { Router } from 'express';
import { helloWorldController, createProfileController } from '@/controllers/base-controller.js';

const router = Router();
router.get('/', helloWorldController);
router.post('/api/createProfile', createProfileController);

export default router;
