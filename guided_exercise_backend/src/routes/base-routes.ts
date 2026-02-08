import { Router } from 'express';
import { helloWorldController, createUserController } from '@/controllers/base-controller.js';

const router = Router();
router.get('/', helloWorldController);
router.post('/api/createUser', createUserController);

export default router;
