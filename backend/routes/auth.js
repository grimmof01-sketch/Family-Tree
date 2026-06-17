const express = require('express');
const router = express.Router();
const multer = require('multer');
const { rateLimiter } = require('../middleware/rateLimiter');

// Auth rate limiter (max 15 requests per 5 minutes per IP)
const authLimiter = rateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 15,
  message: 'Too many authentication attempts. Please try again after 5 minutes.'
});

// Multer memory storage setup (limit: 5MB, images only)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

const { 
  registerUser, 
  loginUser, 
  getMe, 
  updateProfile, 
  googleLogin, 
  firebaseLogin,
  uploadProfilePicture,
  logoutUser
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', authLimiter, registerUser);
router.post('/login', authLimiter, loginUser);
router.post('/google', authLimiter, googleLogin);
router.post('/firebase-login', authLimiter, firebaseLogin);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.post('/logout', protect, logoutUser);
router.post('/upload', protect, upload.single('image'), uploadProfilePicture);

module.exports = router;
