const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  getTreeGraph,
  createNode,
  createSpouseNode,
  createMarriageEdge,
  createParentChildEdge,
  updateNode,
  deleteNode,
  classifyKinshipRelation,
  uploadProfilePicture,
  getNodeTree,
  getTreeLogs,
  revertTreeLog,
  deleteEdge
} = require('../controllers/kinshipController');
const {
  getNotifications,
  markAsRead,
  markAllAsRead
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

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

router.use(protect);

router.get('/nodes/:nodeId/tree', getNodeTree);
router.get('/:treeId/graph', getTreeGraph);
router.post('/:treeId/nodes', createNode);
router.post('/:treeId/nodes/spouse', createSpouseNode);
router.post('/:treeId/edges/marriage', createMarriageEdge);
router.post('/:treeId/edges/parent-child', createParentChildEdge);
router.delete('/:treeId/edges', deleteEdge);
router.put('/:treeId/nodes/:nodeId', updateNode);
router.delete('/:treeId/nodes/:nodeId', deleteNode);
router.get('/:treeId/relation', classifyKinshipRelation);
router.get('/:treeId/logs', getTreeLogs);
router.post('/:treeId/logs/:logId/revert', revertTreeLog);

// Notification endpoints
router.get('/:treeId/notifications', getNotifications);
router.put('/:treeId/notifications/read-all', markAllAsRead);
router.put('/:treeId/notifications/:notificationId/read', markAsRead);

// Profile picture upload endpoint
router.post('/:treeId/upload', upload.single('image'), uploadProfilePicture);

module.exports = router;

