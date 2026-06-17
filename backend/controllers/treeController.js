const mongoose = require('mongoose');
const Tree = require('../models/Tree');
const User = require('../models/User');
const Node = require('../models/Node');
const Edge = require('../models/Edge');
const JoinRequest = require('../models/JoinRequest');
const { sendAlert } = require('../utils/notificationDelivery');

// Helper to check user permission role in tree
const getUserRoleInTree = async (tree, userId) => {
  const creatorId = tree.createdBy && tree.createdBy._id ? tree.createdBy._id : tree.createdBy;
  if (creatorId && creatorId.toString() === userId.toString()) {
    return 'Admin';
  }

  const adminIds = (tree.admins || []).map(admin => admin && admin._id ? admin._id.toString() : admin.toString());
  if (adminIds.includes(userId.toString())) {
    return 'Admin';
  }

  const subAdminIds = (tree.subAdmins || []).map(sub => sub && sub._id ? sub._id.toString() : sub.toString());
  if (subAdminIds.includes(userId.toString())) {
    return 'Sub-Admin';
  }
  
  // Check if user is linked to any node in this tree
  const linkedNode = await Node.findOne({ treeId: tree._id, linkedUserId: userId });
  if (linkedNode) {
    return 'Standard';
  }

  // Check if tree is in user's activeTrees
  const user = await User.findById(userId);
  if (user && user.activeTrees.some(id => id.toString() === tree._id.toString())) {
    return 'Standard'; // Default viewer role
  }

  return null; // No access
};

// @desc    Create new tree
// @route   POST /api/trees
// @access  Private
const createTree = async (req, res) => {
  const { treeName } = req.body;

  if (!treeName) {
    return res.status(400).json({ message: 'Tree name is required' });
  }

  try {
    const tree = await Tree.create({
      treeName,
      createdBy: req.user.id,
      admins: [req.user.id],
      subAdmins: []
    });

    // Add tree to user's activeTrees list
    await User.findByIdAndUpdate(req.user.id, {
      $addToSet: { activeTrees: tree._id }
    });

    res.status(201).json(tree);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all trees for current user
// @route   GET /api/trees
// @access  Private
const getTrees = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const trees = await Tree.find({
      _id: { $in: user.activeTrees }
    }).populate('createdBy', 'email').populate('admins', 'email').populate('subAdmins', 'email');

    const treesWithRoles = await Promise.all(trees.map(async (tree) => {
      const role = await getUserRoleInTree(tree, req.user.id);
      return {
        ...tree.toObject(),
        userRole: role
      };
    }));

    res.status(200).json(treesWithRoles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single tree details
// @route   GET /api/trees/:id
// @access  Private
const getTreeById = async (req, res) => {
  try {
    const tree = await Tree.findById(req.params.id).populate('createdBy', 'email').populate('admins', 'email').populate('subAdmins', 'email');
    if (!tree) {
      return res.status(404).json({ message: 'Tree not found' });
    }

    const role = await getUserRoleInTree(tree, req.user.id);
    if (!role) {
      return res.status(403).json({ message: 'Not authorized to access this tree' });
    }

    res.status(200).json({
      ...tree.toObject(),
      userRole: role
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a tree
// @route   DELETE /api/trees/:id
// @access  Private
const deleteTree = async (req, res) => {
  try {
    const tree = await Tree.findById(req.params.id);
    if (!tree) {
      return res.status(404).json({ message: 'Tree not found' });
    }

    // Only creator or admin can delete
    const role = await getUserRoleInTree(tree, req.user.id);
    if (role !== 'Admin') {
      return res.status(403).json({ message: 'Only Tree Admins can delete a tree' });
    }

    // Delete all nodes and edges related to this tree
    await Node.deleteMany({ treeId: tree._id });
    await Edge.deleteMany({ treeId: tree._id });
    
    // Remove tree from users' activeTrees list
    await User.updateMany(
      { activeTrees: tree._id },
      { $pull: { activeTrees: tree._id } }
    );

    await Tree.findByIdAndDelete(tree._id);

    res.status(200).json({ message: 'Tree and all its contents deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Manage user roles or link user to node
// @route   POST /api/trees/:id/roles
// @access  Private (Admin Only)
const manageUserRole = async (req, res) => {
  const { email, role, nodeId } = req.body; // role: 'Admin', 'Sub-Admin', 'Standard'

  try {
    const tree = await Tree.findById(req.params.id);
    if (!tree) {
      return res.status(404).json({ message: 'Tree not found' });
    }

    const currentRole = await getUserRoleInTree(tree, req.user.id);
    if (currentRole !== 'Admin') {
      return res.status(403).json({ message: 'Only Tree Admins can manage roles' });
    }

    const targetUser = await User.findOne({ email: email.toLowerCase() });
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found with this email' });
    }

    // Add tree to target user's activeTrees
    await User.findByIdAndUpdate(targetUser._id, {
      $addToSet: { activeTrees: tree._id }
    });

    if (role === 'Admin') {
      // Add to admins, remove from subAdmins
      await Tree.findByIdAndUpdate(tree._id, {
        $addToSet: { admins: targetUser._id },
        $pull: { subAdmins: targetUser._id }
      });
      // Unlink any nodes if previously linked as standard
      await Node.updateMany({ treeId: tree._id, linkedUserId: targetUser._id }, { linkedUserId: null });
    } else if (role === 'Sub-Admin') {
      // Add to subAdmins, remove from admins
      await Tree.findByIdAndUpdate(tree._id, {
        $addToSet: { subAdmins: targetUser._id },
        $pull: { admins: targetUser._id }
      });
      // Unlink any nodes if previously linked as standard
      await Node.updateMany({ treeId: tree._id, linkedUserId: targetUser._id }, { linkedUserId: null });
    } else if (role === 'Standard') {
      // Standard role. Must link to a node
      if (!nodeId) {
        return res.status(400).json({ message: 'nodeId is required for Standard role linkage' });
      }

      // Check if node exists and belongs to tree
      const node = await Node.findOne({ _id: nodeId, treeId: tree._id });
      if (!node) {
        return res.status(404).json({ message: 'Node not found in this tree' });
      }

      // Unlink user from any other node in this tree first
      await Node.updateMany({ treeId: tree._id, linkedUserId: targetUser._id }, { linkedUserId: null });

      // Link node to target user
      node.linkedUserId = targetUser._id;
      await node.save();

      // Sync user profile fields to node based on syncSettings
      const { syncUserToNodes } = require('./authController');
      await syncUserToNodes(targetUser._id, node._id);

      // Remove from admins and subAdmins list
      await Tree.findByIdAndUpdate(tree._id, {
        $pull: { admins: targetUser._id, subAdmins: targetUser._id }
      });
    } else {
      return res.status(400).json({ message: 'Invalid role specified' });
    }

    const updatedTree = await Tree.findById(tree._id);
    res.status(200).json({ message: 'Role updated successfully', tree: updatedTree });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Request to join a tree
// @route   POST /api/trees/join
// @access  Private
const requestToJoinTree = async (req, res) => {
  const { treeId } = req.body;

  if (!treeId) {
    return res.status(400).json({ message: 'Tree ID is required' });
  }

  try {
    if (!mongoose.Types.ObjectId.isValid(treeId)) {
      return res.status(400).json({ message: 'Invalid Tree ID format' });
    }

    const tree = await Tree.findById(treeId);
    if (!tree) {
      return res.status(404).json({ message: 'Tree not found' });
    }

    // Check if user is already a member
    const role = await getUserRoleInTree(tree, req.user.id);
    if (role) {
      return res.status(400).json({ message: 'You are already a member/admin of this tree' });
    }

    // Check for pending request
    const existingRequest = await JoinRequest.findOne({
      treeId,
      userId: req.user.id,
      status: 'pending'
    });

    if (existingRequest) {
      return res.status(400).json({ message: 'Join request is already pending approval' });
    }

    // Create join request
    await JoinRequest.create({
      treeId,
      userId: req.user.id
    });

    // Send automated alerts directly to tree admins
    try {
      const requestorEmail = req.user.email;
      const title = `Family Tree Join Request: ${tree.treeName}`;
      const message = `A new user with email ${requestorEmail} has requested to join your family tree "${tree.treeName}". Please log in to review and approve/reject their request.`;

      // Send to tree creator
      const creatorUser = await User.findById(tree.createdBy);
      if (creatorUser && creatorUser.email) {
        await sendAlert({
          treeId: tree._id,
          recipientName: creatorUser.profile?.name || 'Tree Creator',
          recipientContact: creatorUser.email,
          deliveryType: 'email',
          title,
          message
        });
      }

      // Send to admins
      for (const adminId of tree.admins) {
        const adminUser = await User.findById(adminId);
        if (adminUser && adminUser.email && adminUser.email !== creatorUser?.email) {
          await sendAlert({
            treeId: tree._id,
            recipientName: adminUser.profile?.name || 'Tree Admin',
            recipientContact: adminUser.email,
            deliveryType: 'email',
            title,
            message
          });
        }
      }
    } catch (notifError) {
      console.error('Error triggering join request notifications:', notifError);
    }

    res.status(201).json({ message: 'Request to join tree submitted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get pending join requests for a tree
// @route   GET /api/trees/:id/join-requests
// @access  Private (Admin Only)
const getJoinRequests = async (req, res) => {
  try {
    const tree = await Tree.findById(req.params.id);
    if (!tree) {
      return res.status(404).json({ message: 'Tree not found' });
    }

    const role = await getUserRoleInTree(tree, req.user.id);
    if (role !== 'Admin') {
      return res.status(403).json({ message: 'Only Tree Admins can manage join requests' });
    }

    const requests = await JoinRequest.find({
      treeId: tree._id,
      status: 'pending'
    }).populate('userId', 'email');

    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Approve a join request and link user to a node
// @route   POST /api/trees/:id/join-requests/:requestId/approve
// @access  Private (Admin Only)
const approveJoinRequest = async (req, res) => {
  const { nodeId } = req.body;

  if (!nodeId) {
    return res.status(400).json({ message: 'Node ID is required to link the user' });
  }

  try {
    const tree = await Tree.findById(req.params.id);
    if (!tree) {
      return res.status(404).json({ message: 'Tree not found' });
    }

    const role = await getUserRoleInTree(tree, req.user.id);
    if (role !== 'Admin') {
      return res.status(403).json({ message: 'Only Tree Admins can approve join requests' });
    }

    const request = await JoinRequest.findById(req.params.requestId);
    if (!request || request.status !== 'pending') {
      return res.status(404).json({ message: 'Pending join request not found' });
    }

    const node = await Node.findOne({ _id: nodeId, treeId: tree._id });
    if (!node) {
      return res.status(404).json({ message: 'Node not found in this tree' });
    }

    await Node.updateMany({ treeId: tree._id, linkedUserId: request.userId }, { linkedUserId: null });

    node.linkedUserId = request.userId;
    await node.save();

    // Sync user profile fields to node based on syncSettings
    const { syncUserToNodes } = require('./authController');
    await syncUserToNodes(request.userId, node._id);

    await User.findByIdAndUpdate(request.userId, {
      $addToSet: { activeTrees: tree._id }
    });

    request.status = 'approved';
    request.assignedNodeId = nodeId;
    await request.save();

    // Send automated email alert directly to the applicant
    try {
      const requestingUser = await User.findById(request.userId);
      if (requestingUser && requestingUser.email) {
        await sendAlert({
          treeId: tree._id,
          recipientName: requestingUser.profile?.name || 'Family Member',
          recipientContact: requestingUser.email,
          deliveryType: 'email',
          title: `Join Request Approved: ${tree.treeName}`,
          message: `Congratulations! Your request to join the family tree "${tree.treeName}" has been approved. You are now linked to the node "${node.name}".`
        });
      }
    } catch (notifError) {
      console.error('Error sending approval notification email:', notifError);
    }

    res.status(200).json({ message: 'User approved and successfully linked to node' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reject a join request
// @route   POST /api/trees/:id/join-requests/:requestId/reject
// @access  Private (Admin Only)
const rejectJoinRequest = async (req, res) => {
  try {
    const tree = await Tree.findById(req.params.id);
    if (!tree) {
      return res.status(404).json({ message: 'Tree not found' });
    }

    const role = await getUserRoleInTree(tree, req.user.id);
    if (role !== 'Admin') {
      return res.status(403).json({ message: 'Only Tree Admins can reject join requests' });
    }

    const request = await JoinRequest.findById(req.params.requestId);
    if (!request || request.status !== 'pending') {
      return res.status(404).json({ message: 'Pending join request not found' });
    }

    request.status = 'rejected';
    await request.save();

    // Send automated email alert directly to the applicant
    try {
      const requestingUser = await User.findById(request.userId);
      if (requestingUser && requestingUser.email) {
        await sendAlert({
          treeId: tree._id,
          recipientName: requestingUser.profile?.name || 'Family Member',
          recipientContact: requestingUser.email,
          deliveryType: 'email',
          title: `Join Request Update: ${tree.treeName}`,
          message: `Hello. Your request to join the family tree "${tree.treeName}" has been reviewed by the administrator and was not approved.`
        });
      }
    } catch (notifError) {
      console.error('Error sending rejection notification email:', notifError);
    }

    res.status(200).json({ message: 'Join request rejected' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all members of a tree (admins, sub-admins, standard users)
// @route   GET /api/trees/:id/members
// @access  Private
const getTreeMembers = async (req, res) => {
  try {
    const tree = await Tree.findById(req.params.id)
      .populate('admins', 'email profile')
      .populate('subAdmins', 'email profile')
      .populate('createdBy', 'email profile');

    if (!tree) {
      return res.status(404).json({ message: 'Tree not found' });
    }

    const role = await getUserRoleInTree(tree, req.user.id);
    if (!role) {
      return res.status(403).json({ message: 'Not authorized to access this tree' });
    }

    // Find all nodes in this tree that have a linkedUserId
    const linkedNodes = await Node.find({ treeId: tree._id, linkedUserId: { $ne: null } })
      .populate('linkedUserId', 'email profile');

    const members = [];

    // Add Creator
    if (tree.createdBy) {
      members.push({
        userId: tree.createdBy._id,
        email: tree.createdBy.email,
        role: 'Admin',
        isCreator: true,
        nodeId: null,
        nodeName: null
      });
    }

    // Add Admins
    const creatorIdStr = tree.createdBy ? tree.createdBy._id.toString() : '';
    if (tree.admins && tree.admins.length > 0) {
      tree.admins.forEach(admin => {
        if (admin._id.toString() === creatorIdStr) return;
        members.push({
          userId: admin._id,
          email: admin.email,
          role: 'Admin',
          isCreator: false,
          nodeId: null,
          nodeName: null
        });
      });
    }

    // Add Sub-Admins
    if (tree.subAdmins && tree.subAdmins.length > 0) {
      tree.subAdmins.forEach(subAdmin => {
        members.push({
          userId: subAdmin._id,
          email: subAdmin.email,
          role: 'Sub-Admin',
          isCreator: false,
          nodeId: null,
          nodeName: null
        });
      });
    }

    // Add Standard members linked to nodes
    linkedNodes.forEach(node => {
      if (node.linkedUserId) {
        members.push({
          userId: node.linkedUserId._id,
          email: node.linkedUserId.email,
          role: 'Standard',
          isCreator: false,
          nodeId: node._id,
          nodeName: node.name
        });
      }
    });

    res.status(200).json(members);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createTree,
  getTrees,
  getTreeById,
  deleteTree,
  manageUserRole,
  getUserRoleInTree,
  requestToJoinTree,
  getJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  getTreeMembers
};
