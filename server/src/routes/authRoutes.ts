import { Router } from 'express';
import { login, register, getCurrentUser, requestReset, resetPassword, updateProfile, changePassword } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.post('/register', register);
router.get('/me', authenticate, getCurrentUser);
router.post('/request-reset', requestReset);
router.post('/reset-password', resetPassword);
router.patch('/profile/:id', authenticate, updateProfile);
router.post('/change-password/:id', authenticate, changePassword);

export default router;
