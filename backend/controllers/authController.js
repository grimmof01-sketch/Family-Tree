const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret_key', {
    expiresIn: '30d',
  });
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please add all fields' });
  }

  try {
    // Check if user exists
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      email,
      passwordHash,
      activeTrees: []
    });

    if (user) {
      const token = generateToken(user.id);
      user.currentSessionToken = token;
      user.lastActive = new Date();
      await user.save();

      res.status(201).json({
        _id: user.id,
        email: user.email,
        token: token,
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check for user email
    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      // A new login attempt automatically invalidates any existing session on other devices/tabs

      const token = generateToken(user.id);
      user.currentSessionToken = token;
      user.lastActive = new Date();
      await user.save();

      res.json({
        _id: user.id,
        email: user.email,
        token: token,
      });
    } else {
      res.status(400).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user data
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Sync user profile fields to all linked nodes
const syncUserToNodes = async (userId, customNodeId = null) => {
  const Node = require('../models/Node');
  const User = require('../models/User');

  const user = await User.findById(userId);
  if (!user) return;

  const query = { linkedUserId: userId };
  if (customNodeId) {
    query._id = customNodeId;
  }

  const nodes = await Node.find(query);
  for (const node of nodes) {
    let changed = false;

    if (user.syncSettings.name && user.profile.name && node.name !== user.profile.name) {
      node.name = user.profile.name;
      changed = true;
    }
    if (user.syncSettings.dob && user.profile.dob) {
      const uDob = new Date(user.profile.dob).getTime();
      const nDob = node.dob ? new Date(node.dob).getTime() : null;
      if (uDob !== nDob) {
        node.dob = user.profile.dob;
        changed = true;
      }
    }
    if (user.syncSettings.bloodGroup && user.profile.bloodGroup && node.bloodGroup !== user.profile.bloodGroup) {
      node.bloodGroup = user.profile.bloodGroup;
      changed = true;
    }
    if (user.syncSettings.gotram && user.profile.gotram && node.gotram !== user.profile.gotram) {
      node.gotram = user.profile.gotram;
      changed = true;
    }
    if (user.syncSettings.mobileNumber && user.profile.mobileNumber && node.mobileNumber !== user.profile.mobileNumber) {
      node.mobileNumber = user.profile.mobileNumber;
      changed = true;
    }
    if (user.syncSettings.email && user.email && node.email !== user.email) {
      node.email = user.email;
      changed = true;
    }
    if (user.syncSettings.profilePictureUrl && user.profile.profilePictureUrl && node.profilePictureUrl !== user.profile.profilePictureUrl) {
      node.profilePictureUrl = user.profile.profilePictureUrl;
      changed = true;
    }
    if (user.syncSettings.socialLinks && user.profile.socialLinks && JSON.stringify(node.socialLinks) !== JSON.stringify(user.profile.socialLinks)) {
      node.socialLinks = user.profile.socialLinks;
      changed = true;
    }
    if (user.syncSettings.marriageDate) {
      const uMarriage = user.profile.marriageDate ? new Date(user.profile.marriageDate).getTime() : null;
      const nMarriage = node.marriageDate ? new Date(node.marriageDate).getTime() : null;
      if (uMarriage !== nMarriage) {
        node.marriageDate = user.profile.marriageDate ? new Date(user.profile.marriageDate) : null;
        changed = true;

        // Also sync to spouse node in the same tree
        const Edge = require('../models/Edge');
        const spouseEdge = await Edge.findOne({
          treeId: node.treeId,
          relationshipType: 'spouse',
          $or: [{ sourceNodeId: node._id }, { targetNodeId: node._id }]
        });
        if (spouseEdge) {
          const spouseId = spouseEdge.sourceNodeId.toString() === node._id.toString() 
            ? spouseEdge.targetNodeId 
            : spouseEdge.sourceNodeId;
          const spouse = await Node.findOne({ _id: spouseId, treeId: node.treeId });
          if (spouse) {
            spouse.marriageDate = node.marriageDate;
            await spouse.save();
          }
        }
      }
    }

    if (changed) {
      await node.save();
    }
  }
};

// @desc    Update user profile and sync settings
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  const { profile, syncSettings } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (profile) {
      if (profile.name !== undefined && profile.name) {
        const nameRegex = /^[A-Za-z\s]+$/;
        if (!nameRegex.test(profile.name)) {
          return res.status(400).json({ message: 'Validation failed: Name can only contain letters and spaces' });
        }
      }

      if (profile.mobileNumber !== undefined && profile.mobileNumber) {
        let formattedMobile = profile.mobileNumber;
        if (formattedMobile.length === 10 && !formattedMobile.startsWith('+')) {
          formattedMobile = '+91' + formattedMobile;
        }
        const mobileRegex = /^\+91[6-9]\d{9}$/;
        if (!mobileRegex.test(formattedMobile)) {
          return res.status(400).json({ message: 'Validation failed: Mobile number must start with +91 followed by a valid 10-digit number (cannot start with 0-5)' });
        }
        profile.mobileNumber = formattedMobile;
      }

      if (profile.dob) {
        const selectedDob = new Date(profile.dob);
        if (selectedDob > new Date()) {
          return res.status(400).json({ message: 'Date of birth cannot be in the future.' });
        }
      }

      if (profile.marriageDate) {
        const selectedMarriage = new Date(profile.marriageDate);
        if (selectedMarriage > new Date()) {
          return res.status(400).json({ message: 'Marriage date cannot be in the future.' });
        }
      }

      user.profile = {
        ...user.profile,
        name: profile.name !== undefined ? profile.name : user.profile.name,
        dob: profile.dob !== undefined ? profile.dob : user.profile.dob,
        bloodGroup: profile.bloodGroup !== undefined ? profile.bloodGroup : user.profile.bloodGroup,
        gotram: profile.gotram !== undefined ? profile.gotram : user.profile.gotram,
        mobileNumber: profile.mobileNumber !== undefined ? profile.mobileNumber : user.profile.mobileNumber,
        profilePictureUrl: profile.profilePictureUrl !== undefined ? profile.profilePictureUrl : user.profile.profilePictureUrl,
        socialLinks: profile.socialLinks !== undefined ? profile.socialLinks : user.profile.socialLinks,
        marriageDate: profile.marriageDate !== undefined ? (profile.marriageDate ? new Date(profile.marriageDate) : null) : user.profile.marriageDate
      };
      if (profile.mobileNumber !== undefined) {
        user.mobileVerified = true;
      }
    }

    if (syncSettings) {
      user.syncSettings = {
        ...user.syncSettings,
        name: syncSettings.name !== undefined ? syncSettings.name : user.syncSettings.name,
        dob: syncSettings.dob !== undefined ? syncSettings.dob : user.syncSettings.dob,
        bloodGroup: syncSettings.bloodGroup !== undefined ? syncSettings.bloodGroup : user.syncSettings.bloodGroup,
        gotram: syncSettings.gotram !== undefined ? syncSettings.gotram : user.syncSettings.gotram,
        mobileNumber: syncSettings.mobileNumber !== undefined ? syncSettings.mobileNumber : user.syncSettings.mobileNumber,
        email: syncSettings.email !== undefined ? syncSettings.email : user.syncSettings.email,
        profilePictureUrl: syncSettings.profilePictureUrl !== undefined ? syncSettings.profilePictureUrl : user.syncSettings.profilePictureUrl,
        socialLinks: syncSettings.socialLinks !== undefined ? syncSettings.socialLinks : user.syncSettings.socialLinks,
        marriageDate: syncSettings.marriageDate !== undefined ? syncSettings.marriageDate : user.syncSettings.marriageDate
      };
    }

    await user.save();

    // Trigger sync to all user's linked nodes
    await syncUserToNodes(user._id);

    const updatedUser = await User.findById(user._id).select('-passwordHash');
    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Google Sign In / Register
// @route   POST /api/auth/google
// @access  Public
const googleLogin = async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ message: 'Google credential token is required' });
  }

  try {
    let email, name, picture;
    const clientID = process.env.GOOGLE_CLIENT_ID;

    if (clientID) {
      const { google } = require('googleapis');
      const oauthClient = new google.auth.OAuth2(clientID);
      const ticket = await oauthClient.verifyIdToken({
        idToken: credential,
        audience: clientID,
      });
      const payload = ticket.getPayload();
      email = payload.email;
      name = payload.name;
      picture = payload.picture;
    } else {
      // Base64 decode JWT for development/testing when client ID is missing
      const parts = credential.split('.');
      if (parts.length === 3) {
        const payloadJson = Buffer.from(parts[1], 'base64').toString('utf-8');
        const payload = JSON.parse(payloadJson);
        email = payload.email;
        name = payload.name;
        picture = payload.picture;
      }
    }

    if (!email) {
      return res.status(400).json({ message: 'Invalid or unparseable Google token' });
    }

    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Generate standard random password hash
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(Math.random().toString(36), salt);

      user = await User.create({
        email: email.toLowerCase(),
        passwordHash,
        profile: {
          name: name || '',
          profilePictureUrl: picture || '',
          dob: null,
          bloodGroup: '',
          gotram: '',
          mobileNumber: '',
          socialLinks: []
        },
        syncSettings: {
          name: true,
          dob: true,
          bloodGroup: true,
          gotram: true,
          mobileNumber: true,
          email: true,
          profilePictureUrl: true,
          socialLinks: true
        },
        activeTrees: []
      });
    } else {
      // A new login attempt automatically invalidates any existing session on other devices/tabs
    }

    const token = generateToken(user.id);
    user.currentSessionToken = token;
    user.lastActive = new Date();
    await user.save();

    res.json({
      _id: user.id,
      email: user.email,
      role: user.role || 'User',
      token: token,
    });
  } catch (error) {
    console.error('Google Sign In Error:', error);
    res.status(500).json({ message: 'Google authentication failed' });
  }
};

// @desc    Firebase Auth Login / Register
// @route   POST /api/auth/firebase-login
// @access  Public
const firebaseLogin = async (req, res) => {
  const { firebaseToken } = req.body;
  if (!firebaseToken) {
    return res.status(400).json({ message: 'Firebase ID token is required' });
  }

  try {
    const { verifyFirebaseIdToken } = require('../utils/firebaseVerifier');
    const decoded = await verifyFirebaseIdToken(firebaseToken);
    
    const { email, name, picture, email_verified } = decoded;
    const uid = decoded.uid || decoded.sub;

    if (!email) {
      return res.status(400).json({ message: 'Firebase token is missing email' });
    }

    if (!email_verified) {
      return res.status(400).json({ message: 'Email address is not verified' });
    }

    let user = await User.findOne({ firebaseUid: uid });
    
    if (user) {
      // If email has changed in Firebase (since it is verified now), update it in backend
      if (user.email !== email.toLowerCase()) {
        user.email = email.toLowerCase();
        await user.save();
        
        // Sync email updates to kinship tree nodes
        await syncUserToNodes(user._id);
      }
    } else {
      // Fallback: search by email
      user = await User.findOne({ email: email.toLowerCase() });
      if (user) {
        user.firebaseUid = uid;
        await user.save();
      }
    }

    if (user) {
      // A new login attempt automatically invalidates any existing session on other devices/tabs
    }

    if (!user) {
      // Create user if not exists
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(Math.random().toString(36), salt);

      user = await User.create({
        email: email.toLowerCase(),
        firebaseUid: uid,
        passwordHash,
        emailVerified: true,
        profile: {
          name: name || '',
          profilePictureUrl: picture || '',
          dob: null,
          bloodGroup: '',
          gotram: '',
          mobileNumber: '',
          socialLinks: []
        },
        syncSettings: {
          name: true,
          dob: true,
          bloodGroup: true,
          gotram: true,
          mobileNumber: true,
          email: true,
          profilePictureUrl: true,
          socialLinks: true
        },
        activeTrees: []
      });
    } else if (!user.emailVerified) {
      user.emailVerified = true;
      await user.save();
    }

    const token = generateToken(user.id);
    user.currentSessionToken = token;
    user.lastActive = new Date();
    await user.save();

    res.json({
      _id: user.id,
      email: user.email,
      role: user.role || 'User',
      token: token,
    });
  } catch (error) {
    console.error('Firebase Login Error:', error);
    res.status(500).json({ message: error.message || 'Firebase authentication failed' });
  }
};



const uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const uploadToDrive = require('../utils/driveUpload');
    const fileBuffer = req.file.buffer;
    const originalName = req.file.originalname;
    const mimeType = req.file.mimetype;

    const uniqueFileName = `${Date.now()}-${originalName}`;
    const link = await uploadToDrive(fileBuffer, uniqueFileName, mimeType);

    res.status(200).json({
      success: true,
      link
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const logoutUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user) {
      user.currentSessionToken = '';
      user.lastActive = null;
      await user.save();
    }
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  updateProfile,
  googleLogin,
  firebaseLogin,
  syncUserToNodes,
  uploadProfilePicture,
  logoutUser
};
