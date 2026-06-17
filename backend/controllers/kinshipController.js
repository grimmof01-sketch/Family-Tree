const Node = require('../models/Node');
const Edge = require('../models/Edge');
const Tree = require('../models/Tree');
const ActivityLog = require('../models/ActivityLog');
const { getUserRoleInTree } = require('./treeController');
const uploadToDrive = require('../utils/driveUpload');

// BFS Descent Check: returns true if nodeA is direct ancestor or descendant of nodeB
const checkDescent = async (nodeAId, nodeBId, treeId) => {
  const edges = await Edge.find({ treeId, relationshipType: 'parent_child' });
  
  // Build parent-child relationships map
  // Key: childId, Value: array of parentIds
  const parentsOf = {};
  edges.forEach(edge => {
    const parent = edge.sourceNodeId.toString();
    const child = edge.targetNodeId.toString();
    if (!parentsOf[child]) parentsOf[child] = [];
    parentsOf[child].push(parent);
  });

  // Helper to check if startId is ancestor of targetId
  const isAncestor = (startId, targetId) => {
    const queue = [startId];
    const visited = new Set([startId]);
    while (queue.length > 0) {
      const curr = queue.shift();
      if (curr === targetId) return true;
      const parents = parentsOf[curr] || [];
      for (const p of parents) {
        if (!visited.has(p)) {
          visited.add(p);
          queue.push(p);
        }
      }
    }
    return false;
  };

  // True if A is ancestor of B or B is ancestor of A
  return isAncestor(nodeBId.toString(), nodeAId.toString()) || isAncestor(nodeAId.toString(), nodeBId.toString());
};

// Helper to calculate age from DOB
const getAge = (dob, dateOfDeath) => {
  if (!dob) return null;
  const birthDate = new Date(dob);
  const endDate = dateOfDeath ? new Date(dateOfDeath) : new Date();
  let age = endDate.getFullYear() - birthDate.getFullYear();
  const m = endDate.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && endDate.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

// Helper to calculate difference in years between two dates
const getYearDiff = (date1, date2) => {
  if (!date1 || !date2) return null;
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  let diffYears = d2.getFullYear() - d1.getFullYear();
  const m = d2.getMonth() - d1.getMonth();
  if (m < 0 || (m === 0 && d2.getDate() < d1.getDate())) {
    diffYears--;
  }
  return diffYears;
};

// Helper to dynamically recalculate generation levels and parities for a tree
const recalculateTreeGenerations = async (treeId) => {
  const Node = require('../models/Node');
  const Edge = require('../models/Edge');

  try {
    const nodes = await Node.find({ treeId });
    if (nodes.length === 0) return;

    const edges = await Edge.find({ treeId });

    // Build relationship maps
    const childrenOf = {};
    const parentsOf = {};
    const spousesOf = {};

    nodes.forEach(node => {
      const idStr = node._id.toString();
      childrenOf[idStr] = [];
      parentsOf[idStr] = [];
      spousesOf[idStr] = [];
    });

    edges.forEach(edge => {
      const src = edge.sourceNodeId.toString();
      const dst = edge.targetNodeId.toString();

      if (edge.relationshipType === 'parent_child') {
        if (childrenOf[src]) childrenOf[src].push(dst);
        if (parentsOf[dst]) parentsOf[dst].push(src);
      } else if (edge.relationshipType === 'spouse') {
        if (spousesOf[src]) spousesOf[src].push(dst);
        if (spousesOf[dst]) spousesOf[dst].push(src);
      }
    });

    // Find absolute roots (nodes with no parents, and not married to someone who has parents)
    const roots = nodes.filter(node => {
      const idStr = node._id.toString();
      if (parentsOf[idStr].length > 0) return false;
      
      const spouses = spousesOf[idStr] || [];
      const spouseHasParents = spouses.some(spouseId => parentsOf[spouseId].length > 0);
      if (spouseHasParents) return false;
      
      return true;
    });

    const queue = [];
    const visited = new Set();
    const nodeLevels = {};
    const nodeParities = {};

    if (roots.length > 0) {
      roots.forEach(root => {
        const idStr = root._id.toString();
        nodeLevels[idStr] = 0;
        nodeParities[idStr] = root.parity || 0;
        queue.push(idStr);
        visited.add(idStr);
      });
    } else {
      const firstNode = nodes[0];
      const idStr = firstNode._id.toString();
      nodeLevels[idStr] = 0;
      nodeParities[idStr] = firstNode.parity || 0;
      queue.push(idStr);
      visited.add(idStr);
    }

    while (queue.length > 0) {
      const currId = queue.shift();
      const currLevel = nodeLevels[currId];
      const currParity = nodeParities[currId];
      const currNode = nodes.find(n => n._id.toString() === currId);
      const currGender = currNode ? currNode.gender : 0;

      // Process spouses: must be in same generation level
      const spouses = spousesOf[currId] || [];
      spouses.forEach(spouseId => {
        if (!visited.has(spouseId)) {
          nodeLevels[spouseId] = currLevel;
          nodeParities[spouseId] = (1 - currParity + 2) % 2;
          visited.add(spouseId);
          queue.push(spouseId);
        } else {
          if (nodeLevels[spouseId] !== currLevel) {
            nodeLevels[spouseId] = currLevel;
            nodeParities[spouseId] = (1 - currParity + 2) % 2;
            queue.push(spouseId);
          }
        }
      });

      // Process children
      const children = childrenOf[currId] || [];
      children.forEach(childId => {
        const childLevel = currLevel + 1;
        const childParity = (currParity + (1 - currGender)) % 2;

        if (!visited.has(childId)) {
          nodeLevels[childId] = childLevel;
          nodeParities[childId] = childParity;
          visited.add(childId);
          queue.push(childId);
        } else {
          if (childLevel > nodeLevels[childId]) {
            nodeLevels[childId] = childLevel;
            nodeParities[childId] = childParity;
            queue.push(childId);
          }
        }
      });
    }

    // Shift levels so that minLevel is 0
    let minLevel = 0;
    Object.values(nodeLevels).forEach(lvl => {
      if (lvl < minLevel) minLevel = lvl;
    });

    const shift = minLevel < 0 ? -minLevel : 0;

    // Save changes
    for (const node of nodes) {
      const idStr = node._id.toString();
      let changed = false;

      const newLevel = nodeLevels[idStr] !== undefined ? nodeLevels[idStr] + shift : 0;
      const newParity = nodeParities[idStr] !== undefined ? nodeParities[idStr] : 0;

      if (node.generationLevel !== newLevel) {
        node.generationLevel = newLevel;
        changed = true;
      }
      if (node.parity !== newParity) {
        node.parity = newParity;
        changed = true;
      }

      if (changed) {
        await node.save();
      }
    }
  } catch (err) {
    console.error('Error recalculating tree generations:', err);
  }
};

// @desc    Get complete tree nodes and edges for visualization
// @route   GET /api/kinship/:treeId/graph
// @access  Private
const getTreeGraph = async (req, res) => {
  const { treeId } = req.params;
  const { centerNodeId, depth } = req.query;

  try {
    const tree = await Tree.findById(treeId);
    if (!tree) {
      return res.status(404).json({ message: 'Tree not found' });
    }

    let role = await getUserRoleInTree(tree, req.user.id);
    if (!role) {
      // Grant read-only Viewer access if they have the exact Tree ID
      role = 'Viewer';
    }

    const totalNodesCount = await Node.countDocuments({ treeId });
    const shouldLazyLoad = req.query.lazy === 'true' || !!depth || !!centerNodeId || totalNodesCount > 30;

    if (!shouldLazyLoad) {
      const nodes = await Node.find({ treeId });
      const edges = await Edge.find({ treeId });
      return res.status(200).json({ nodes, edges, userRole: role });
    }

    // Outward lazy loading via BFS
    const bfsDepth = depth ? parseInt(depth, 10) : 3;

    // 1. Get all edges of the tree to build undirected adjacency map
    const allEdges = await Edge.find({ treeId });

    // 2. Find starting center node
    let startNodeId = centerNodeId;
    if (!startNodeId) {
      const linkedNode = await Node.findOne({ treeId, linkedUserId: req.user.id });
      if (linkedNode) {
        startNodeId = linkedNode._id.toString();
      } else {
        // Find root nodes (no incoming parent_child edges where this node is targetNodeId)
        const childNodeIds = new Set(allEdges.filter(e => e.relationshipType === 'parent_child').map(e => e.targetNodeId.toString()));
        const rootNode = await Node.findOne({ treeId, _id: { $nin: Array.from(childNodeIds) } });
        if (rootNode) {
          startNodeId = rootNode._id.toString();
        } else {
          const anyNode = await Node.findOne({ treeId });
          if (anyNode) {
            startNodeId = anyNode._id.toString();
          }
        }
      }
    }

    if (!startNodeId) {
      return res.status(200).json({ nodes: [], edges: [], userRole: role });
    }

    // 3. Build adjacency list
    const adj = {};
    allEdges.forEach(edge => {
      const src = edge.sourceNodeId.toString();
      const tgt = edge.targetNodeId.toString();
      if (!adj[src]) adj[src] = [];
      if (!adj[tgt]) adj[tgt] = [];
      adj[src].push(tgt);
      adj[tgt].push(src);
    });

    // 4. BFS Traversal
    const visited = new Set();
    const nodeDistances = {};

    const queue = [startNodeId];
    visited.add(startNodeId);
    nodeDistances[startNodeId] = 0;

    while (queue.length > 0) {
      const curr = queue.shift();
      const dist = nodeDistances[curr];

      if (dist < bfsDepth) {
        const neighbors = adj[curr] || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            nodeDistances[neighbor] = dist + 1;
            queue.push(neighbor);
          }
        }
      }
    }

    // 5. Query nodes and flag boundaries
    const visitedIds = Array.from(visited);
    const dbNodes = await Node.find({ _id: { $in: visitedIds } });

    const nodes = dbNodes.map(node => {
      const nodeIdStr = node._id.toString();
      const neighbors = adj[nodeIdStr] || [];
      const hasUnloadedRelatives = neighbors.some(n => !visited.has(n));
      return {
        ...node.toObject(),
        hasUnloadedRelatives
      };
    });

    // 6. Filter edges with both endpoints loaded
    const edges = allEdges.filter(edge => {
      const src = edge.sourceNodeId.toString();
      const tgt = edge.targetNodeId.toString();
      return visited.has(src) && visited.has(tgt);
    });

    res.status(200).json({
      nodes,
      edges,
      userRole: role,
      centerNodeId: startNodeId,
      depth: bfsDepth
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new child node (or root node if tree is empty)
// @route   POST /api/kinship/:treeId/nodes
// @access  Private (Admin or Sub-Admin)
const createNode = async (req, res) => {
  const { treeId } = req.params;
  const { name, dob, bloodGroup, gotram, mobileNumber, email, socialLinks, gender, parentId, profilePictureUrl, isDeceased, dateOfDeath, marriageDate } = req.body;

  try {
    const tree = await Tree.findById(treeId);
    if (!tree) {
      return res.status(404).json({ message: 'Tree not found' });
    }

    const role = await getUserRoleInTree(tree, req.user.id);
    if (role !== 'Admin' && role !== 'Sub-Admin') {
      return res.status(403).json({ message: 'Only Admins or Sub-Admins can create nodes' });
    }

    // Validation: Name can only contain letters and spaces
    if (name) {
      const nameRegex = /^[A-Za-z\s]+$/;
      if (!nameRegex.test(name)) {
        return res.status(400).json({ message: 'Validation failed: Name can only contain letters and spaces' });
      }
    }

    // Validation: Mobile number must start with +91 and have exactly 10 digits that do not start with 0-5
    let finalMobileNumber = mobileNumber || '';
    if (finalMobileNumber) {
      if (finalMobileNumber.length === 10 && !finalMobileNumber.startsWith('+')) {
        finalMobileNumber = '+91' + finalMobileNumber;
      }
      const mobileRegex = /^\+91[6-9]\d{9}$/;
      if (!mobileRegex.test(finalMobileNumber)) {
        return res.status(400).json({ message: 'Validation failed: Mobile number must start with +91 followed by a valid 10-digit number (cannot start with 0-5)' });
      }
    }

    // Validation: DOB and Date of Death cannot be in the future
    if (dob && new Date(dob) > new Date()) {
      return res.status(400).json({ message: 'Validation failed: Date of birth cannot be in the future' });
    }
    if (isDeceased && dateOfDeath) {
      if (new Date(dateOfDeath) > new Date()) {
        return res.status(400).json({ message: 'Validation failed: Date of death cannot be in the future' });
      }
      if (dob && new Date(dateOfDeath) < new Date(dob)) {
        return res.status(400).json({ message: 'Validation failed: Date of death cannot be before date of birth' });
      }
    }

    let generationLevel = 0;
    let parity = 0;
    const nodesModified = [];

    const { childId } = req.body;
    let childNode = null;

    if (childId) {
      // Adding a parent to an existing child node
      childNode = await Node.findOne({ _id: childId, treeId });
      if (!childNode) {
        return res.status(404).json({ message: 'Child node not found' });
      }

      // Check if child already has 2 parents
      const existingParents = await Edge.find({ treeId, targetNodeId: childId, relationshipType: 'parent_child' });
      if (existingParents.length >= 2) {
        return res.status(400).json({ message: 'This child already has two parents' });
      }
      if (existingParents.length > 0) {
        const parent1 = await Node.findById(existingParents[0].sourceNodeId);
        if (parent1 && parent1.gender === gender) {
          return res.status(400).json({ message: `This child already has a ${gender === 1 ? 'father' : 'mother'}` });
        }
      }

      // Age difference validation
      if (dob && childNode.dob) {
        const ageDiff = getYearDiff(dob, childNode.dob);
        if (ageDiff === null || ageDiff < 15) {
          return res.status(400).json({ message: 'Validation failed: The parent must be at least 15 years older than the child' });
        }
      }

      generationLevel = childNode.generationLevel - 1;
      parity = (childNode.parity - (1 - gender) + 2) % 2;
    } else if (parentId) {
      // Adding a child to an existing parent node
      const parentNode = await Node.findOne({ _id: parentId, treeId });
      if (!parentNode) {
        return res.status(404).json({ message: 'Parent node not found' });
      }

      // Validation: A single parent cannot have children
      const parentHasSpouse = await Edge.findOne({
        treeId,
        relationshipType: 'spouse',
        $or: [{ sourceNodeId: parentId }, { targetNodeId: parentId }]
      });

      if (!parentHasSpouse) {
        return res.status(400).json({ message: 'Validation failed: A single parent cannot have children. Please add a spouse first.' });
      }

      // Age difference validation
      if (dob && parentNode.dob) {
        const ageDiff = getYearDiff(parentNode.dob, dob);
        if (ageDiff === null || ageDiff < 15) {
          return res.status(400).json({ message: 'Validation failed: The age difference between parent and child must be at least 15 years' });
        }
      }

      generationLevel = parentNode.generationLevel + 1;
      parity = (parentNode.parity + (1 - parentNode.gender)) % 2;
    } else {
      // Floating / Root node created at will
      generationLevel = 0;
      parity = 0;
    }

    // Gotram rule: child inherits father's gotram
    let childGotram = gotram || '';
    if (parentId) {
      const parentNode = await Node.findOne({ _id: parentId, treeId });
      if (parentNode) {
        let fatherNode = null;
        if (parentNode.gender === 1) {
          fatherNode = parentNode;
        } else {
          // Parent is female, find her spouse (if any)
          const spouseEdge = await Edge.findOne({
            treeId,
            relationshipType: 'spouse',
            $or: [{ sourceNodeId: parentId }, { targetNodeId: parentId }]
          });
          if (spouseEdge) {
            const fatherId = spouseEdge.sourceNodeId.toString() === parentId.toString()
              ? spouseEdge.targetNodeId
              : spouseEdge.sourceNodeId;
            fatherNode = await Node.findById(fatherId);
          }
        }
        if (fatherNode && fatherNode.gotram) {
          childGotram = fatherNode.gotram;
        } else {
          childGotram = parentNode.gotram || '';
        }
      }
    }

    const newNode = await Node.create({
      treeId,
      name,
      dob: dob ? new Date(dob) : null,
      bloodGroup: bloodGroup || '',
      gotram: childGotram,
      mobileNumber: finalMobileNumber || '',
      email: email || '',
      socialLinks: socialLinks || [],
      gender,
      generationLevel,
      parity,
      profilePictureUrl: profilePictureUrl || '',
      isDeceased: isDeceased || false,
      dateOfDeath: dateOfDeath ? new Date(dateOfDeath) : null,
      marriageDate: marriageDate ? new Date(marriageDate) : null
    });

    if (childId) {
      // Create parent_child edge
      await Edge.create({
        treeId,
        sourceNodeId: newNode._id,
        targetNodeId: childId,
        relationshipType: 'parent_child'
      });

      // If the child already has another parent, link them as spouses!
      const otherParents = await Edge.find({
        treeId,
        targetNodeId: childId,
        relationshipType: 'parent_child',
        sourceNodeId: { $ne: newNode._id }
      });

      if (otherParents.length > 0) {
        const spouseId = otherParents[0].sourceNodeId;
        await Edge.create({
          treeId,
          sourceNodeId: spouseId,
          targetNodeId: newNode._id,
          relationshipType: 'spouse'
        });

        // Sync gotrams
        const spouseNode = await Node.findById(spouseId);
        if (spouseNode) {
          if (spouseNode.gender === 1) {
            nodesModified.push({ nodeId: newNode._id, gotram: newNode.gotram });
            newNode.gotram = spouseNode.gotram;
            await newNode.save();
          } else if (gender === 1) {
            nodesModified.push({ nodeId: spouseNode._id, gotram: spouseNode.gotram });
            spouseNode.gotram = newNode.gotram;
            await spouseNode.save();
          }
        }
      }

      // Sync child's gotram to match the father
      let fatherNode = null;
      if (newNode.gender === 1) {
        fatherNode = newNode;
      } else if (otherParents.length > 0) {
        const spouseNode = await Node.findById(otherParents[0].sourceNodeId);
        if (spouseNode && spouseNode.gender === 1) {
          fatherNode = spouseNode;
        }
      }

      if (fatherNode && fatherNode.gotram && childNode) {
        nodesModified.push({ nodeId: childNode._id, gotram: childNode.gotram });
        childNode.gotram = fatherNode.gotram;
        await childNode.save();
      }
    } else if (parentId) {
      await Edge.create({
        treeId,
        sourceNodeId: parentId,
        targetNodeId: newNode._id,
        relationshipType: 'parent_child'
      });

      // If the parent has a spouse, we should automatically add parent_child edge from the spouse too!
      const spouseEdges = await Edge.find({
        treeId,
        relationshipType: 'spouse',
        $or: [{ sourceNodeId: parentId }, { targetNodeId: parentId }]
      });

      for (const edge of spouseEdges) {
        const spouseId = edge.sourceNodeId.toString() === parentId.toString()
          ? edge.targetNodeId
          : edge.sourceNodeId;

        await Edge.create({
          treeId,
          sourceNodeId: spouseId,
          targetNodeId: newNode._id,
          relationshipType: 'parent_child'
        });
      }
    }

    // Dynamic generation levels recalculation
    await recalculateTreeGenerations(treeId);

    // Log the activity
    await ActivityLog.create({
      treeId,
      userId: req.user.id,
      userName: req.user.name || req.user.email,
      action: 'CREATE_NODE',
      description: `${req.user.name || req.user.email} added node "${newNode.name}"`,
      revertData: {
        nodeId: newNode._id,
        nodesModified
      }
    });

    res.status(201).json(newNode);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Attach a new spouse node to an existing node (supports new, existing or cross-tree node links)
// @route   POST /api/kinship/:treeId/nodes/spouse
// @access  Private (Admin or Sub-Admin)
const createSpouseNode = async (req, res) => {
  const { treeId } = req.params;
  const { 
    name, dob, bloodGroup, gotram, mobileNumber, email, socialLinks, 
    existingNodeId, profilePictureUrl, crossTreeNodeId, isDeceased, dateOfDeath,
    marriageDate
  } = req.body;

  try {
    const tree = await Tree.findById(treeId);
    if (!tree) {
      return res.status(404).json({ message: 'Tree not found' });
    }

    const role = await getUserRoleInTree(tree, req.user.id);
    if (role !== 'Admin' && role !== 'Sub-Admin') {
      return res.status(403).json({ message: 'Only Admins or Sub-Admins can add spouses' });
    }

    // Validation: Name can only contain letters and spaces
    if (name) {
      const nameRegex = /^[A-Za-z\s]+$/;
      if (!nameRegex.test(name)) {
        return res.status(400).json({ message: 'Validation failed: Name can only contain letters and spaces' });
      }
    }

    // Validation: Mobile number must start with +91 and have exactly 10 digits that do not start with 0-5
    let finalMobileNumber = mobileNumber || '';
    if (finalMobileNumber) {
      if (finalMobileNumber.length === 10 && !finalMobileNumber.startsWith('+')) {
        finalMobileNumber = '+91' + finalMobileNumber;
      }
      const mobileRegex = /^\+91[6-9]\d{9}$/;
      if (!mobileRegex.test(finalMobileNumber)) {
        return res.status(400).json({ message: 'Validation failed: Mobile number must start with +91 followed by a valid 10-digit number (cannot start with 0-5)' });
      }
    }

    // Validation: DOB and Date of Death cannot be in the future
    if (dob && new Date(dob) > new Date()) {
      return res.status(400).json({ message: 'Validation failed: Date of birth cannot be in the future' });
    }
    if (isDeceased && dateOfDeath) {
      if (new Date(dateOfDeath) > new Date()) {
        return res.status(400).json({ message: 'Validation failed: Date of death cannot be in the future' });
      }
      if (dob && new Date(dateOfDeath) < new Date(dob)) {
        return res.status(400).json({ message: 'Validation failed: Date of death cannot be before date of birth' });
      }
    }

    const existingNode = await Node.findOne({ _id: existingNodeId, treeId });
    if (!existingNode) {
      return res.status(404).json({ message: 'Existing node not found' });
    }
    const prevExistingGotram = existingNode.gotram;

    if (existingNode.dob) {
      const existingAge = getAge(existingNode.dob, existingNode.dateOfDeath);
      if (existingAge !== null && existingAge < 18) {
        return res.status(400).json({ message: `Marriage validation failed: ${existingNode.name} is under 18 years old and cannot marry` });
      }
    }

    // Check if existing node already has a spouse
    const hasSpouse = await Edge.findOne({
      treeId,
      relationshipType: 'spouse',
      $or: [{ sourceNodeId: existingNodeId }, { targetNodeId: existingNodeId }]
    });

    if (hasSpouse) {
      return res.status(400).json({ message: 'This node already has a spouse' });
    }

    // Spouse node gender is opposite
    const gender = existingNode.gender === 1 ? 0 : 1;
    
    // Spouse node generation level is identical
    const generationLevel = existingNode.generationLevel;

    // Spouse node parity: P_new = 1 - P_existing
    const parity = 1 - existingNode.parity;

    let spouseNode;
    let spouseNodeInOtherTree;
    let prevOriginalGotram;

    if (crossTreeNodeId) {
      // Import node from another tree
      const originalNode = await Node.findById(crossTreeNodeId);
      if (!originalNode) {
        return res.status(404).json({ message: 'Cross-tree node not found' });
      }
      prevOriginalGotram = originalNode.gotram;

      if (originalNode.dob) {
        const originalAge = getAge(originalNode.dob, originalNode.dateOfDeath);
        if (originalAge !== null && originalAge < 18) {
          return res.status(400).json({ message: `Marriage validation failed: Spouse candidate ${originalNode.name} is under 18 years old and cannot marry` });
        }
      }

      // Gender check
      if (originalNode.gender !== gender) {
        return res.status(400).json({ 
          message: `Marriage validation failed: Node from other tree is of gender ${originalNode.gender === 1 ? 'Male' : 'Female'} but spouse must be ${gender === 1 ? 'Male' : 'Female'}` 
        });
      }

      // Check if originalNode already has a spouse in its own tree
      const originalHasSpouse = await Edge.findOne({
        treeId: originalNode.treeId,
        relationshipType: 'spouse',
        $or: [{ sourceNodeId: crossTreeNodeId }, { targetNodeId: crossTreeNodeId }]
      });

      if (originalHasSpouse) {
        return res.status(400).json({ message: 'Selected cross-tree member already has a spouse in their own tree' });
      }

      // Gotram rule: female gotram changes to match husband's gotram
      let spouseGotram = originalNode.gotram;
      if (existingNode.gender === 1) {
        // Existing is Male, Spouse is Female -> Spouse gets husband's gotram
        spouseGotram = existingNode.gotram;
      } else {
        // Existing is Female, Spouse is Male -> Female gets husband's gotram
        existingNode.gotram = originalNode.gotram;
        await existingNode.save();
      }

      // Create copy of originalNode in current tree (Tree A)
      spouseNode = await Node.create({
        treeId,
        name: originalNode.name,
        dob: originalNode.dob,
        bloodGroup: originalNode.bloodGroup,
        gotram: spouseGotram,
        mobileNumber: originalNode.mobileNumber,
        email: originalNode.email || '',
        socialLinks: originalNode.socialLinks,
        gender,
        generationLevel,
        parity,
        profilePictureUrl: originalNode.profilePictureUrl,
        crossTreeLinkId: originalNode._id,
        isDeceased: originalNode.isDeceased || false,
        dateOfDeath: originalNode.dateOfDeath || null,
        marriageDate: marriageDate ? new Date(marriageDate) : (originalNode.marriageDate || null)
      });

      // Create copy of existingNode in originalNode's tree (Tree B)
      spouseNodeInOtherTree = await Node.create({
        treeId: originalNode.treeId,
        name: existingNode.name,
        dob: existingNode.dob,
        bloodGroup: existingNode.bloodGroup,
        gotram: existingNode.gender === 1 ? existingNode.gotram : originalNode.gotram,
        mobileNumber: existingNode.mobileNumber,
        email: existingNode.email || '',
        socialLinks: existingNode.socialLinks,
        gender: existingNode.gender,
        generationLevel: originalNode.generationLevel,
        parity: 1 - originalNode.parity,
        profilePictureUrl: existingNode.profilePictureUrl,
        crossTreeLinkId: existingNode._id,
        isDeceased: existingNode.isDeceased || false,
        dateOfDeath: existingNode.dateOfDeath || null,
        marriageDate: marriageDate ? new Date(marriageDate) : (existingNode.marriageDate || null)
      });

      // Link existing node to its copy in other tree
      existingNode.crossTreeLinkId = spouseNodeInOtherTree._id;
      if (existingNode.gender === 0) {
        existingNode.gotram = originalNode.gotram;
      }
      // Link original node to its copy in current tree
      originalNode.crossTreeLinkId = spouseNode._id;
      if (existingNode.gender === 1) {
        originalNode.gotram = existingNode.gotram;
      }
      // Update existingNode and originalNode marriageDate
      if (marriageDate) {
        existingNode.marriageDate = new Date(marriageDate);
        originalNode.marriageDate = new Date(marriageDate);
      }
      await existingNode.save();
      await originalNode.save();

      // Create spouse edge in other tree
      await Edge.create({
        treeId: originalNode.treeId,
        sourceNodeId: originalNode._id,
        targetNodeId: spouseNodeInOtherTree._id,
        relationshipType: 'spouse'
      });

      // Proactively sync children in the other tree
      const otherChildrenEdges = await Edge.find({
        treeId: originalNode.treeId,
        sourceNodeId: originalNode._id,
        relationshipType: 'parent_child'
      });

      for (const edge of otherChildrenEdges) {
        await Edge.create({
          treeId: originalNode.treeId,
          sourceNodeId: spouseNodeInOtherTree._id,
          targetNodeId: edge.targetNodeId,
          relationshipType: 'parent_child'
        });
      }
    } else {
      // Gotram rule: female gotram changes to match husband's gotram
      let spouseGotram = gotram || '';
      if (existingNode.gender === 1) {
        // Existing is Male, Spouse is Female -> Spouse gets husband's gotram
        spouseGotram = existingNode.gotram;
      } else {
        // Existing is Female, Spouse is Male -> Female gets husband's gotram
        existingNode.gotram = gotram || '';
        await existingNode.save();
      }

      if (dob) {
        const spouseAge = getAge(dob, dateOfDeath);
        if (spouseAge !== null && spouseAge < 18) {
          return res.status(400).json({ message: 'Marriage validation failed: Spouse must be 18 years or older to marry' });
        }
      }

      // Create new node from scratch
      spouseNode = await Node.create({
        treeId,
        name,
        dob: dob ? new Date(dob) : null,
        bloodGroup: bloodGroup || '',
        gotram: spouseGotram,
        mobileNumber: finalMobileNumber || '',
        email: email || '',
        socialLinks: socialLinks || [],
        gender,
        generationLevel,
        parity,
        profilePictureUrl: profilePictureUrl || '',
        isDeceased: isDeceased || false,
        dateOfDeath: dateOfDeath ? new Date(dateOfDeath) : null,
        marriageDate: marriageDate ? new Date(marriageDate) : null
      });

      existingNode.marriageDate = marriageDate ? new Date(marriageDate) : null;
      await existingNode.save();
    }

    // Create spouse edge
    await Edge.create({
      treeId,
      sourceNodeId: existingNodeId,
      targetNodeId: spouseNode._id,
      relationshipType: 'spouse'
    });

    // Proactively check: if the existing node already has children, create parent_child edges between new spouse and these children too!
    const childrenEdges = await Edge.find({
      treeId,
      sourceNodeId: existingNodeId,
      relationshipType: 'parent_child'
    });

    for (const edge of childrenEdges) {
      // Create parent_child edge from new spouse to child
      await Edge.create({
        treeId,
        sourceNodeId: spouseNode._id,
        targetNodeId: edge.targetNodeId,
        relationshipType: 'parent_child'
      });
    }

    // Log the activity
    if (crossTreeNodeId) {
      await ActivityLog.create({
        treeId,
        userId: req.user.id,
        userName: req.user.name || req.user.email,
        action: 'CREATE_SPOUSE',
        description: `${req.user.name || req.user.email} added spouse "${spouseNode.name}" from another tree`,
        revertData: {
          nodesCreated: [spouseNode._id, spouseNodeInOtherTree._id],
          nodesModified: [
            { nodeId: existingNode._id, crossTreeLinkId: null, gotram: prevExistingGotram },
            { nodeId: crossTreeNodeId, crossTreeLinkId: null, gotram: prevOriginalGotram }
          ]
        }
      });
    } else {
      await ActivityLog.create({
        treeId,
        userId: req.user.id,
        userName: req.user.name || req.user.email,
        action: 'CREATE_SPOUSE',
        description: `${req.user.name || req.user.email} added spouse "${spouseNode.name}"`,
        revertData: {
          nodesCreated: [spouseNode._id],
          nodesModified: [
            { nodeId: existingNode._id, gotram: prevExistingGotram }
          ]
        }
      });
    }

    await recalculateTreeGenerations(treeId);

    res.status(201).json(spouseNode);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a spouse edge between two pre-existing nodes with marriage validation
// @route   POST /api/kinship/:treeId/edges/marriage
// @access  Private (Admin or Sub-Admin)
const createMarriageEdge = async (req, res) => {
  const { treeId } = req.params;
  const { nodeAId, nodeBId } = req.body;

  if (nodeAId === nodeBId) {
    return res.status(400).json({ message: 'A node cannot marry itself' });
  }

  try {
    const tree = await Tree.findById(treeId);
    if (!tree) {
      return res.status(404).json({ message: 'Tree not found' });
    }

    const role = await getUserRoleInTree(tree, req.user.id);
    if (role !== 'Admin' && role !== 'Sub-Admin') {
      return res.status(403).json({ message: 'Only Admins or Sub-Admins can create relationships' });
    }

    const nodeA = await Node.findOne({ _id: nodeAId, treeId });
    const nodeB = await Node.findOne({ _id: nodeBId, treeId });

    if (!nodeA || !nodeB) {
      return res.status(404).json({ message: 'One or both nodes not found' });
    }
    const prevNodeAGotram = nodeA.gotram;
    const prevNodeBGotram = nodeB.gotram;

    // Validation: Spouses must be 18 years or older to marry
    if (nodeA.dob) {
      const ageA = getAge(nodeA.dob, nodeA.dateOfDeath);
      if (ageA !== null && ageA < 18) {
        return res.status(400).json({ message: `Marriage validation failed: ${nodeA.name} is under 18 years old` });
      }
    }
    if (nodeB.dob) {
      const ageB = getAge(nodeB.dob, nodeB.dateOfDeath);
      if (ageB !== null && ageB < 18) {
        return res.status(400).json({ message: `Marriage validation failed: ${nodeB.name} is under 18 years old` });
      }
    }

    // Validation 1: Gender Check (G_A !== G_B)
    if (nodeA.gender === nodeB.gender) {
      return res.status(400).json({ message: 'Marriage validation failed: Spouses must have different genders' });
    }

    // Validation 2: Parity Check (P_A !== P_B)
    if (nodeA.parity === nodeB.parity) {
      return res.status(400).json({ message: 'Marriage validation failed: Dravidian Kinship Rules require opposite parity for marriage (Parallel relatives cannot marry)' });
    }

    // Validation 3: Generation Boundary Check (|L_A - L_B| <= 1)
    if (Math.abs(nodeA.generationLevel - nodeB.generationLevel) > 1) {
      return res.status(400).json({ message: 'Marriage validation failed: Generational gap cannot exceed 1 level' });
    }

    // Validation 4: Descent Check (BFS to verify not direct ancestor/descendant)
    const isDirectLine = await checkDescent(nodeAId, nodeBId, treeId);
    if (isDirectLine) {
      return res.status(400).json({ message: 'Marriage validation failed: Direct ancestral or descendant lineages cannot marry' });
    }

    // Check if either node already has a spouse
    const existingSpouseA = await Edge.findOne({
      treeId,
      relationshipType: 'spouse',
      $or: [{ sourceNodeId: nodeAId }, { targetNodeId: nodeAId }]
    });

    const existingSpouseB = await Edge.findOne({
      treeId,
      relationshipType: 'spouse',
      $or: [{ sourceNodeId: nodeBId }, { targetNodeId: nodeBId }]
    });

    if (existingSpouseA || existingSpouseB) {
      return res.status(400).json({ message: 'Marriage validation failed: Monogamy rule. One of the nodes already has a spouse edge' });
    }

    // Create spouse edge
    const edge = await Edge.create({
      treeId,
      sourceNodeId: nodeAId,
      targetNodeId: nodeBId,
      relationshipType: 'spouse'
    });

    // Gotram rule: female gotram changes to match husband's gotram
    if (nodeA.gender === 1) {
      // NodeA is Male, NodeB is Female -> NodeB gets NodeA gotram
      nodeB.gotram = nodeA.gotram;
      await nodeB.save();
    } else {
      // NodeA is Female, NodeB is Male -> NodeA gets NodeB gotram
      nodeA.gotram = nodeB.gotram;
      await nodeA.save();
    }

    // Proactively sync children: if A has children, link them as children of B. If B has children, link them as children of A.
    const childrenA = await Edge.find({ treeId, sourceNodeId: nodeAId, relationshipType: 'parent_child' });
    const childrenB = await Edge.find({ treeId, sourceNodeId: nodeBId, relationshipType: 'parent_child' });

    const childEdgeIds = [];
    for (const childEdge of childrenA) {
      // Link child as B's child if not already linked
      const alreadyLinked = await Edge.findOne({ treeId, sourceNodeId: nodeBId, targetNodeId: childEdge.targetNodeId, relationshipType: 'parent_child' });
      if (!alreadyLinked) {
        const e = await Edge.create({ treeId, sourceNodeId: nodeBId, targetNodeId: childEdge.targetNodeId, relationshipType: 'parent_child' });
        childEdgeIds.push(e._id);
      }
    }

    for (const childEdge of childrenB) {
      // Link child as A's child if not already linked
      const alreadyLinked = await Edge.findOne({ treeId, sourceNodeId: nodeAId, targetNodeId: childEdge.targetNodeId, relationshipType: 'parent_child' });
      if (!alreadyLinked) {
        const e = await Edge.create({ treeId, sourceNodeId: nodeAId, targetNodeId: childEdge.targetNodeId, relationshipType: 'parent_child' });
        childEdgeIds.push(e._id);
      }
    }

    // Log the activity
    await ActivityLog.create({
      treeId,
      userId: req.user.id,
      userName: req.user.name || req.user.email,
      action: 'CREATE_MARRIAGE',
      description: `${req.user.name || req.user.email} married "${nodeA.name}" to "${nodeB.name}"`,
      revertData: {
        edgeId: edge._id,
        childEdgeIds,
        nodesModified: [
          { nodeId: nodeA._id, gotram: prevNodeAGotram },
          { nodeId: nodeB._id, gotram: prevNodeBGotram }
        ]
      }
    });

    await recalculateTreeGenerations(treeId);

    res.status(201).json(edge);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a parent-child edge between two pre-existing nodes with validation
// @route   POST /api/kinship/:treeId/edges/parent-child
// @access  Private (Admin or Sub-Admin)
const createParentChildEdge = async (req, res) => {
  const { treeId } = req.params;
  const { parentId, childId } = req.body;

  if (parentId === childId) {
    return res.status(400).json({ message: 'A node cannot be its own parent' });
  }

  try {
    const tree = await Tree.findById(treeId);
    if (!tree) {
      return res.status(404).json({ message: 'Tree not found' });
    }

    const role = await getUserRoleInTree(tree, req.user.id);
    if (role !== 'Admin' && role !== 'Sub-Admin') {
      return res.status(403).json({ message: 'Only Admins or Sub-Admins can create relationships' });
    }

    const parentNode = await Node.findOne({ _id: parentId, treeId });
    const childNode = await Node.findOne({ _id: childId, treeId });

    if (!parentNode || !childNode) {
      return res.status(404).json({ message: 'Parent or child node not found' });
    }

    // Check if edge already exists
    const existingEdge = await Edge.findOne({
      treeId,
      sourceNodeId: parentId,
      targetNodeId: childId,
      relationshipType: 'parent_child'
    });

    if (existingEdge) {
      return res.status(400).json({ message: 'This relationship already exists' });
    }

    // Check if this child already has two parents
    const existingParents = await Edge.find({
      treeId,
      targetNodeId: childId,
      relationshipType: 'parent_child'
    });

    if (existingParents.length >= 2) {
      return res.status(400).json({ message: 'A child cannot have more than two parents' });
    }

    // Check if there is already a parent of the same gender
    if (existingParents.length > 0) {
      const parent1 = await Node.findById(existingParents[0].sourceNodeId);
      if (parent1 && parent1.gender === parentNode.gender) {
        return res.status(400).json({ message: `This child already has a ${parentNode.gender === 1 ? 'father' : 'mother'}` });
      }
    }

    // Validation: age difference of at least 15 years
    if (parentNode.dob && childNode.dob) {
      const ageDiff = getYearDiff(parentNode.dob, childNode.dob);
      if (ageDiff === null || ageDiff < 15) {
        return res.status(400).json({ message: 'Validation failed: The age difference between parent and child must be at least 15 years' });
      }
    }

    // Create parent_child edge
    const edge = await Edge.create({
      treeId,
      sourceNodeId: parentId,
      targetNodeId: childId,
      relationshipType: 'parent_child'
    });

    const parentChildEdgeIds = [edge._id];
    const nodesModified = [];

    // Find the father (male parent) in the relationship to sync Gotram to child
    let fatherNode = null;
    if (parentNode.gender === 1) {
      fatherNode = parentNode;
    } else {
      // Parent is female, find her spouse (if any)
      const spouseEdge = await Edge.findOne({
        treeId,
        relationshipType: 'spouse',
        $or: [{ sourceNodeId: parentId }, { targetNodeId: parentId }]
      });
      if (spouseEdge) {
        const fatherId = spouseEdge.sourceNodeId.toString() === parentId.toString()
          ? spouseEdge.targetNodeId
          : spouseEdge.sourceNodeId;
        fatherNode = await Node.findById(fatherId);
      }
      // Fallback: If father still not found, check if child has another parent who is male
      if (!fatherNode && existingParents && existingParents.length > 0) {
        for (const ep of existingParents) {
          const pNode = await Node.findById(ep.sourceNodeId);
          if (pNode && pNode.gender === 1) {
            fatherNode = pNode;
            break;
          }
        }
      }
    }

    if (fatherNode && fatherNode.gotram) {
      // Record original gotram of child for reversion
      nodesModified.push({ nodeId: childNode._id, gotram: childNode.gotram });
      childNode.gotram = fatherNode.gotram;
      await childNode.save();
    }

    // If the parent has a spouse, automatically link them too
    const spouseEdges = await Edge.find({
      treeId,
      relationshipType: 'spouse',
      $or: [{ sourceNodeId: parentId }, { targetNodeId: parentId }]
    });

    for (const e of spouseEdges) {
      const spouseId = e.sourceNodeId.toString() === parentId.toString()
        ? e.targetNodeId
        : e.sourceNodeId;

      const alreadyLinked = await Edge.findOne({
        treeId,
        sourceNodeId: spouseId,
        targetNodeId: childId,
        relationshipType: 'parent_child'
      });

      if (!alreadyLinked) {
        const spouseEdge = await Edge.create({
          treeId,
          sourceNodeId: spouseId,
          targetNodeId: childId,
          relationshipType: 'parent_child'
        });
        parentChildEdgeIds.push(spouseEdge._id);
      }
    }

    // If the child already has another parent, link them as spouses!
    let createdSpouseEdgeId = null;

    if (existingParents.length > 0) {
      const spouseId = existingParents[0].sourceNodeId;
      
      const spouseEdgeExists = await Edge.findOne({
        treeId,
        relationshipType: 'spouse',
        $or: [
          { sourceNodeId: parentId, targetNodeId: spouseId },
          { sourceNodeId: spouseId, targetNodeId: parentId }
        ]
      });

      if (!spouseEdgeExists) {
        const spouseEdge = await Edge.create({
          treeId,
          sourceNodeId: parentId,
          targetNodeId: spouseId,
          relationshipType: 'spouse'
        });
        createdSpouseEdgeId = spouseEdge._id;

        // Sync gotrams
        const spouseNode = await Node.findById(spouseId);
        if (spouseNode) {
          if (spouseNode.gender === 1) {
            nodesModified.push({ nodeId: parentNode._id, gotram: parentNode.gotram });
            parentNode.gotram = spouseNode.gotram;
            await parentNode.save();
          } else if (parentNode.gender === 1) {
            nodesModified.push({ nodeId: spouseNode._id, gotram: spouseNode.gotram });
            spouseNode.gotram = parentNode.gotram;
            await spouseNode.save();
          }
        }
      }
    }

    // Dynamically recalculate generation levels and parities
    await recalculateTreeGenerations(treeId);

    // Log the activity
    await ActivityLog.create({
      treeId,
      userId: req.user.id,
      userName: req.user.name || req.user.email,
      action: 'CREATE_RELATIONSHIP',
      description: `${req.user.name || req.user.email} linked parent "${parentNode.name}" to child "${childNode.name}"`,
      revertData: {
        parentChildEdgeIds,
        spouseEdgeId: createdSpouseEdgeId,
        nodesModified
      }
    });

    res.status(201).json(edge);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a node's profile fields
// @route   PUT /api/kinship/:treeId/nodes/:nodeId
// @access  Private (Admin, Sub-Admin, or Assigned User)
const updateNode = async (req, res) => {
  const { treeId, nodeId } = req.params;
  const { name, dob, bloodGroup, gotram, mobileNumber, email, socialLinks, profilePictureUrl, isDeceased, dateOfDeath, marriageDate } = req.body;

  try {
    const tree = await Tree.findById(treeId);
    if (!tree) {
      return res.status(404).json({ message: 'Tree not found' });
    }

    const role = await getUserRoleInTree(tree, req.user.id);
    const node = await Node.findOne({ _id: nodeId, treeId });

    if (!node) {
      return res.status(404).json({ message: 'Node not found' });
    }

    // Check authorization: Admin, Sub-Admin, or Node-Linked Standard User
    const isLinkedUser = node.linkedUserId && node.linkedUserId.toString() === req.user.id.toString();
    const canEdit = role === 'Admin' || role === 'Sub-Admin' || isLinkedUser;

    if (!canEdit) {
      return res.status(403).json({ message: 'Not authorized to edit this node profile' });
    }

    // Validation: Name can only contain letters and spaces
    if (name !== undefined && name) {
      const nameRegex = /^[A-Za-z\s]+$/;
      if (!nameRegex.test(name)) {
        return res.status(400).json({ message: 'Validation failed: Name can only contain letters and spaces' });
      }
    }

    // Validation: Mobile number must start with +91 and have exactly 10 digits that do not start with 0-5
    let finalMobileNumber = mobileNumber;
    if (finalMobileNumber !== undefined && finalMobileNumber) {
      if (finalMobileNumber.length === 10 && !finalMobileNumber.startsWith('+')) {
        finalMobileNumber = '+91' + finalMobileNumber;
      }
      const mobileRegex = /^\+91[6-9]\d{9}$/;
      if (!mobileRegex.test(finalMobileNumber)) {
        return res.status(400).json({ message: 'Validation failed: Mobile number must start with +91 followed by a valid 10-digit number (cannot start with 0-5)' });
      }
    }

    // Store previous fields of node for revert capability
    const previousFields = {
      name: node.name,
      dob: node.dob,
      bloodGroup: node.bloodGroup,
      gotram: node.gotram,
      mobileNumber: node.mobileNumber,
      email: node.email,
      socialLinks: node.socialLinks,
      profilePictureUrl: node.profilePictureUrl,
      isDeceased: node.isDeceased,
      dateOfDeath: node.dateOfDeath,
      marriageDate: node.marriageDate
    };

    // Validation: 18+ check for married people
    const targetDob = dob !== undefined ? dob : node.dob;
    const targetDod = dateOfDeath !== undefined ? dateOfDeath : node.dateOfDeath;
    const targetIsDeceased = isDeceased !== undefined ? isDeceased : node.isDeceased;

    // Validation: DOB and Date of Death cannot be in the future
    if (targetDob && new Date(targetDob) > new Date()) {
      return res.status(400).json({ message: 'Validation failed: Date of birth cannot be in the future' });
    }
    if (targetIsDeceased && targetDod) {
      if (new Date(targetDod) > new Date()) {
        return res.status(400).json({ message: 'Validation failed: Date of death cannot be in the future' });
      }
      if (targetDob && new Date(targetDod) < new Date(targetDob)) {
        return res.status(400).json({ message: 'Validation failed: Date of death cannot be before date of birth' });
      }
    }

    const hasSpouseEdge = await Edge.findOne({
      treeId,
      relationshipType: 'spouse',
      $or: [{ sourceNodeId: nodeId }, { targetNodeId: nodeId }]
    });

    if (hasSpouseEdge && targetDob) {
      const age = getAge(targetDob, targetIsDeceased ? targetDod : null);
      if (age !== null && age < 18) {
        return res.status(400).json({ message: 'Validation failed: Person is married and cannot be under 18 years old' });
      }
    }

    // Validation: Parent-child age difference must be at least 15 years
    if (dob !== undefined) {
      const targetDobDate = dob ? new Date(dob) : null;
      if (targetDobDate) {
        // 1. Check against parent DOBs
        const parentEdges = await Edge.find({
          treeId,
          targetNodeId: nodeId,
          relationshipType: 'parent_child'
        });

        if (parentEdges.length > 0) {
          const parentIds = parentEdges.map(e => e.sourceNodeId);
          const parents = await Node.find({ _id: { $in: parentIds }, treeId });

          const fathers = parents.filter(p => p.gender === 1);
          const mothers = parents.filter(p => p.gender === 0);

          for (const father of fathers) {
            if (father.dob) {
              const ageDiff = getYearDiff(father.dob, targetDobDate);
              if (ageDiff === null || ageDiff < 15) {
                return res.status(400).json({ message: `Validation failed: The age difference between father (${father.name}) and child must be at least 15 years` });
              }
            }
          }

          if (mothers.length > 0) {
            const hasValidMotherAgeDiff = mothers.some(mother => {
              if (!mother.dob) return true;
              return getYearDiff(mother.dob, targetDobDate) >= 15;
            });
            if (!hasValidMotherAgeDiff) {
              return res.status(400).json({ message: 'Validation failed: The age difference between biological mother and child must be at least 15 years' });
            }
          }
        }

        // 2. Check against children DOBs
        const childEdges = await Edge.find({
          treeId,
          sourceNodeId: nodeId,
          relationshipType: 'parent_child'
        });

        if (childEdges.length > 0) {
          const childIds = childEdges.map(e => e.targetNodeId);
          const children = await Node.find({ _id: { $in: childIds }, treeId });

          const isMaleNode = node.gender === 1;
          if (isMaleNode) {
            for (const child of children) {
              if (child.dob) {
                const ageDiff = getYearDiff(targetDobDate, child.dob);
                if (ageDiff === null || ageDiff < 15) {
                  return res.status(400).json({ message: `Validation failed: Father must be at least 15 years older than child (${child.name})` });
                }
              }
            }
          } else {
            for (const child of children) {
              if (child.dob) {
                const ageDiff = getYearDiff(targetDobDate, child.dob);
                if (ageDiff !== null && ageDiff < 15) {
                  const siblingParentEdges = await Edge.find({
                    treeId,
                    targetNodeId: child._id,
                    relationshipType: 'parent_child',
                    sourceNodeId: { $ne: nodeId }
                  });

                  const siblingParentIds = siblingParentEdges.map(e => e.sourceNodeId);
                  const siblingParents = await Node.find({ _id: { $in: siblingParentIds }, treeId, gender: 0 });

                  const hasValidMotherAgeDiff = siblingParents.some(m => m.dob && getYearDiff(m.dob, child.dob) >= 15);
                  if (!hasValidMotherAgeDiff) {
                    return res.status(400).json({ message: `Validation failed: Biological mother must be at least 15 years older than child (${child.name})` });
                  }
                }
              }
            }
          }
        }
      }
    }

    // Update allowable fields (exclude gender, generationLevel, parity to protect kinship logic integrity)
    if (name !== undefined) node.name = name;
    if (dob !== undefined) node.dob = dob ? new Date(dob) : null;
    if (bloodGroup !== undefined) node.bloodGroup = bloodGroup;
    if (gotram !== undefined) node.gotram = gotram;
    if (mobileNumber !== undefined) node.mobileNumber = finalMobileNumber || '';
    if (email !== undefined) node.email = email;
    if (socialLinks !== undefined) node.socialLinks = socialLinks;
    if (profilePictureUrl !== undefined) node.profilePictureUrl = profilePictureUrl;
    if (isDeceased !== undefined) node.isDeceased = isDeceased;
    if (dateOfDeath !== undefined) node.dateOfDeath = dateOfDeath ? new Date(dateOfDeath) : null;
    if (marriageDate !== undefined) {
      const parsedMarriageDate = marriageDate ? new Date(marriageDate) : null;
      node.marriageDate = parsedMarriageDate;

      // Sync marriage date to spouse node in the same tree
      const spouseEdge = await Edge.findOne({
        treeId,
        relationshipType: 'spouse',
        $or: [{ sourceNodeId: nodeId }, { targetNodeId: nodeId }]
      });
      if (spouseEdge) {
        const spouseId = spouseEdge.sourceNodeId.toString() === nodeId.toString() 
          ? spouseEdge.targetNodeId 
          : spouseEdge.sourceNodeId;
        const spouse = await Node.findOne({ _id: spouseId, treeId });
        if (spouse) {
          spouse.marriageDate = parsedMarriageDate;
          await spouse.save();
        }
      }
    }

    const updatedNode = await node.save();

    // Sync updates to cross-tree linked node if it exists
    let previousLinkedFields = null;
    let linkedNode = null;
    if (node.crossTreeLinkId) {
      linkedNode = await Node.findById(node.crossTreeLinkId);
      if (linkedNode) {
        previousLinkedFields = {
          name: linkedNode.name,
          dob: linkedNode.dob,
          bloodGroup: linkedNode.bloodGroup,
          gotram: linkedNode.gotram,
          mobileNumber: linkedNode.mobileNumber,
          email: linkedNode.email,
          socialLinks: linkedNode.socialLinks,
          profilePictureUrl: linkedNode.profilePictureUrl,
          isDeceased: linkedNode.isDeceased,
          dateOfDeath: linkedNode.dateOfDeath,
          marriageDate: linkedNode.marriageDate
        };
        if (name !== undefined) linkedNode.name = name;
        if (dob !== undefined) linkedNode.dob = dob ? new Date(dob) : null;
        if (bloodGroup !== undefined) linkedNode.bloodGroup = bloodGroup;
        if (gotram !== undefined) linkedNode.gotram = gotram;
        if (mobileNumber !== undefined) linkedNode.mobileNumber = finalMobileNumber || '';
        if (email !== undefined) linkedNode.email = email;
        if (socialLinks !== undefined) linkedNode.socialLinks = socialLinks;
        if (profilePictureUrl !== undefined) linkedNode.profilePictureUrl = profilePictureUrl;
        if (isDeceased !== undefined) linkedNode.isDeceased = isDeceased;
        if (dateOfDeath !== undefined) linkedNode.dateOfDeath = dateOfDeath ? new Date(dateOfDeath) : null;
        if (marriageDate !== undefined) {
          const parsedMarriageDate = marriageDate ? new Date(marriageDate) : null;
          linkedNode.marriageDate = parsedMarriageDate;

          // Sync marriage date to spouse of the linked node in its tree
          const spouseEdge = await Edge.findOne({
            treeId: linkedNode.treeId,
            relationshipType: 'spouse',
            $or: [{ sourceNodeId: linkedNode._id }, { targetNodeId: linkedNode._id }]
          });
          if (spouseEdge) {
            const spouseId = spouseEdge.sourceNodeId.toString() === linkedNode._id.toString() 
              ? spouseEdge.targetNodeId 
              : spouseEdge.sourceNodeId;
            const spouse = await Node.findOne({ _id: spouseId, treeId: linkedNode.treeId });
            if (spouse) {
              spouse.marriageDate = parsedMarriageDate;
              await spouse.save();
            }
          }
        }
        await linkedNode.save();
      }
    }

    // Log the activity
    const updates = [
      { nodeId: node._id, fields: previousFields }
    ];
    if (linkedNode && previousLinkedFields) {
      updates.push({ nodeId: linkedNode._id, fields: previousLinkedFields });
    }

    await ActivityLog.create({
      treeId,
      userId: req.user.id,
      userName: req.user.name || req.user.email,
      action: 'UPDATE_NODE',
      description: `${req.user.name || req.user.email} updated profile of "${node.name}"`,
      revertData: {
        updates
      }
    });

    // Recalculate tree generations in case DOB changed
    if (dob !== undefined) {
      await recalculateTreeGenerations(treeId);
    }

    res.status(200).json(updatedNode);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a node and its relationships
// @route   DELETE /api/kinship/:treeId/nodes/:nodeId
// @access  Private (Admin Only)
const deleteNode = async (req, res) => {
  const { treeId, nodeId } = req.params;

  try {
    const tree = await Tree.findById(treeId);
    if (!tree) {
      return res.status(404).json({ message: 'Tree not found' });
    }

    const role = await getUserRoleInTree(tree, req.user.id);
    if (role !== 'Admin') {
      return res.status(403).json({ message: 'Only Tree Admins can delete nodes' });
    }

    const node = await Node.findOne({ _id: nodeId, treeId });
    if (!node) {
      return res.status(404).json({ message: 'Node not found' });
    }

    // Query all edges connected to this node before deleting them
    const edges = await Edge.find({
      treeId,
      $or: [{ sourceNodeId: nodeId }, { targetNodeId: nodeId }]
    });

    // Delete node
    await Node.findByIdAndDelete(nodeId);

    // Delete all edges connected to this node
    await Edge.deleteMany({
      treeId,
      $or: [{ sourceNodeId: nodeId }, { targetNodeId: nodeId }]
    });

    // Log the activity
    await ActivityLog.create({
      treeId,
      userId: req.user.id,
      userName: req.user.name || req.user.email,
      action: 'DELETE_NODE',
      description: `${req.user.name || req.user.email} deleted node "${node.name}"`,
      revertData: {
        nodeData: node,
        edgesData: edges
      }
    });

    await recalculateTreeGenerations(treeId);

    res.status(200).json({ message: 'Node and its relationship linkages deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Helper to find parent node in graph database
const getParentNode = async (childId, genderVal) => {
  const edge = await Edge.findOne({ targetNodeId: childId, relationshipType: 'parent_child' });
  if (!edge) return null;
  
  // Find node corresponding to sourceNodeId
  const parent = await Node.findById(edge.sourceNodeId);
  if (parent && (genderVal === undefined || parent.gender === genderVal)) {
    return parent;
  }
  
  // If the parent found is not of the desired gender, find if they have a spouse edge
  if (parent) {
    const spouseEdge = await Edge.findOne({
      relationshipType: 'spouse',
      $or: [{ sourceNodeId: parent._id }, { targetNodeId: parent._id }]
    });
    if (spouseEdge) {
      const spouseId = spouseEdge.sourceNodeId.toString() === parent._id.toString()
        ? spouseEdge.targetNodeId
        : spouseEdge.sourceNodeId;
      const spouseNode = await Node.findById(spouseId);
      if (spouseNode && (genderVal === undefined || spouseNode.gender === genderVal)) {
        return spouseNode;
      }
    }
  }

  return null;
};

// @desc    Calculate Dravidian Telugu kinship classification label between two nodes
// @route   GET /api/kinship/:treeId/relation
// @access  Private
const classifyKinshipRelation = async (req, res) => {
  const { treeId } = req.params;
  const { sourceId, targetId } = req.query;

  if (!sourceId || !targetId) {
    return res.status(400).json({ message: 'sourceId and targetId query parameters are required' });
  }

  if (sourceId === targetId) {
    return res.status(200).json({ term: 'Self / Nenu', path: [] });
  }

  try {
    // 1. Fetch source and target nodes globally
    const sourceNode = await Node.findById(sourceId);
    const targetNode = await Node.findById(targetId);

    if (!sourceNode || !targetNode) {
      return res.status(404).json({ message: 'Source or Target node not found' });
    }

    // 2. Load all nodes and edges globally to find the path
    const nodes = await Node.find({});
    const edges = await Edge.find({});

    // 4. Construct undirected graph adjacency list
    const adj = {};
    edges.forEach(edge => {
      const s = edge.sourceNodeId.toString();
      const t = edge.targetNodeId.toString();
      if (!adj[s]) adj[s] = [];
      if (!adj[t]) adj[t] = [];
      adj[s].push({ node: t, type: edge.relationshipType, direction: 'forward' });
      adj[t].push({ node: s, type: edge.relationshipType, direction: 'backward' });
    });

    // Add cross-tree link edges
    nodes.forEach(node => {
      if (node.crossTreeLinkId) {
        const s = node._id.toString();
        const t = node.crossTreeLinkId.toString();
        // Ensure target node is also accessible
        const linkedNodeExists = nodes.some(n => n._id.toString() === t);
        if (linkedNodeExists) {
          if (!adj[s]) adj[s] = [];
          if (!adj[t]) adj[t] = [];
          if (!adj[s].some(neighbor => neighbor.node === t)) {
            adj[s].push({ node: t, type: 'cross_link', direction: 'bidirectional' });
          }
          if (!adj[t].some(neighbor => neighbor.node === s)) {
            adj[t].push({ node: s, type: 'cross_link', direction: 'bidirectional' });
          }
        }
      }
    });

    // 5. Shortest path BFS
    const queue = [[sourceId.toString()]];
    const visited = new Set([sourceId.toString()]);
    let path = null;

    while (queue.length > 0) {
      const currPath = queue.shift();
      const lastNode = currPath[currPath.length - 1];
      
      if (lastNode === targetId.toString()) {
        path = currPath;
        break;
      }

      const neighbors = adj[lastNode] || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.node)) {
          visited.add(neighbor.node);
          queue.push([...currPath, neighbor.node]);
        }
      }
    }

    if (!path) {
      return res.status(200).json({ term: 'Dunna (No traceable relationship path)', path: [] });
    }

    // Load full node info for the path
    const pathNodes = await Promise.all(path.map(id => Node.findById(id)));

    // Helper to find edge type between two node IDs
    const getEdgeType = (nodeId1, nodeId2, edgesList) => {
      const id1 = nodeId1.toString();
      const id2 = nodeId2.toString();
      const edge = edgesList.find(e => 
        (e.sourceNodeId.toString() === id1 && e.targetNodeId.toString() === id2) ||
        (e.sourceNodeId.toString() === id2 && e.targetNodeId.toString() === id1)
      );
      if (edge) {
        return {
          type: edge.relationshipType,
          source: edge.sourceNodeId.toString(),
          target: edge.targetNodeId.toString()
        };
      }
      return null;
    };

    // 6. Trace relative generation and relative parity along the path
    let relativeGen = 0;
    let relativeParity = 0;

    for (let i = 0; i < pathNodes.length - 1; i++) {
      const curr = pathNodes[i];
      const next = pathNodes[i + 1];

      // Check if it's a cross-tree link
      if (curr.crossTreeLinkId && curr.crossTreeLinkId.toString() === next._id.toString()) {
        continue;
      }
      if (next.crossTreeLinkId && next.crossTreeLinkId.toString() === curr._id.toString()) {
        continue;
      }

      // Check regular edge
      const edgeInfo = getEdgeType(curr._id, next._id, edges);
      if (edgeInfo) {
        if (edgeInfo.type === 'spouse') {
          relativeParity = 1 - relativeParity;
        } else if (edgeInfo.type === 'parent_child') {
          if (edgeInfo.source === curr._id.toString()) {
            relativeGen = relativeGen - 1;
            relativeParity = (relativeParity + (1 - curr.gender)) % 2;
          } else {
            relativeGen = relativeGen + 1;
            relativeParity = (relativeParity + (1 - next.gender)) % 2;
          }
        }
      }
    }

    const delta = relativeGen;
    const sameParity = (relativeParity === 0);
    const targetGender = targetNode.gender; // 1 = Male, 0 = Female
    const sourceGender = sourceNode.gender;

    // Helper for relative age (older/younger)
    const isTargetOlder = () => {
      if (targetNode.dob && sourceNode.dob) {
        return new Date(targetNode.dob) < new Date(sourceNode.dob);
      }
      return false; // default younger
    };

    let term = 'Relative (Chuttamu)';

    // A. Same Generation (delta = 0)
    if (delta === 0) {
      // Check if they are spouses directly
      const directSpouseEdge = await Edge.findOne({
        relationshipType: 'spouse',
        $or: [
          { sourceNodeId: sourceId, targetNodeId: targetId },
          { sourceNodeId: targetId, targetNodeId: sourceId }
        ]
      });

      if (directSpouseEdge) {
        term = targetGender === 1 ? 'Mogudu (Husband)' : 'Pellam (Wife)';
      } else if (sameParity) {
        // Parallel relatives (siblings or parallel cousins)
        if (targetGender === 1) {
          term = isTargetOlder() ? 'Annayya (Older Brother)' : 'Tammudu (Younger Brother)';
        } else {
          term = isTargetOlder() ? 'Akka (Older Sister)' : 'Chellelu (Younger Sister)';
        }
      } else {
        // Cross relatives (cross cousins / potential spouses)
        if (targetGender === 1) {
          term = isTargetOlder() ? 'Bava (Older Cross Cousin)' : 'Maridi (Younger Cross Cousin)';
        } else {
          term = isTargetOlder() ? 'Vadina (Older Cross Cousin)' : 'Maradalu (Younger Cross Cousin)';
        }
      }
    }
    // B. Parental Tier (delta = 1)
    else if (delta === 1) {
      // Check if target is direct parent
      const directParentEdge = await Edge.findOne({
        sourceNodeId: targetId,
        targetNodeId: sourceId,
        relationshipType: 'parent_child'
      });

      if (directParentEdge) {
        term = targetGender === 1 ? 'Nanna (Father)' : 'Amma (Mother)';
      } else {
        if (targetGender === 1) {
          if (sameParity) {
            // Father's brother (parallel uncle)
            const father = await getParentNode(sourceId, 1);
            let targetOlderThanFather = false;
            if (father && father.dob && targetNode.dob) {
              targetOlderThanFather = new Date(targetNode.dob) < new Date(father.dob);
            } else {
              targetOlderThanFather = isTargetOlder();
            }
            term = targetOlderThanFather ? 'Pedhananna (Older Paternal Uncle)' : 'Babai (Younger Paternal Uncle)';
          } else {
            // Mother's brother (cross uncle)
            term = 'Mavayya (Maternal Uncle)';
          }
        } else {
          if (sameParity) {
            // Father's sister (cross aunt)
            term = 'Atta (Paternal Aunt)';
          } else {
            // Mother's sister (parallel aunt)
            const mother = await getParentNode(sourceId, 0);
            let targetOlderThanMother = false;
            if (mother && mother.dob && targetNode.dob) {
              targetOlderThanMother = new Date(targetNode.dob) < new Date(mother.dob);
            } else {
              targetOlderThanMother = isTargetOlder();
            }
            term = targetOlderThanMother ? 'Pedhamma (Older Maternal Aunt)' : 'Pinni (Younger Maternal Aunt)';
          }
        }
      }
    }
    // C. Grandparent Tier (delta = 2)
    else if (delta === 2) {
      if (targetGender === 1) {
        term = 'Tatayya (Grandfather)';
      } else {
        if (sameParity) {
          term = 'Ammama (Maternal Grandmother)';
        } else {
          term = 'Nannamma (Paternal Grandmother)';
        }
      }
    }
    // D. Children Tier (delta = -1)
    else if (delta === -1) {
      // Check if target is direct child
      const directChildEdge = await Edge.findOne({
        sourceNodeId: sourceId,
        targetNodeId: targetId,
        relationshipType: 'parent_child'
      });

      if (directChildEdge) {
        term = targetGender === 1 ? 'Abbayi / Kodu (Son)' : 'Ammayi / Kuthuru (Daughter)';
      } else {
        // Nephews and nieces
        const isParallel = sameParity === (sourceGender === 1);
        if (isParallel) {
          term = targetGender === 1 ? 'Abbayi / Kodu (Parallel Nephew / Son)' : 'Ammayi / Kuthuru (Parallel Niece / Daughter)';
        } else {
          term = targetGender === 1 ? 'Alludu (Cross Nephew / Son-in-law)' : 'Kodalu (Cross Niece / Daughter-in-law)';
        }
      }
    }
    // E. Grandchildren Tier (delta = -2)
    else if (delta === -2) {
      term = targetGender === 1 ? 'Manamadu (Grandson)' : 'Manamalaralu (Granddaughter)';
    }
    // F. Distant Ancestry (delta > 2)
    else if (delta > 2) {
      term = targetGender === 1 ? 'Ancestor (Muthathayya)' : 'Ancestress (Muthammama)';
    }
    // G. Distant Descendants (delta < -2)
    else if (delta < -2) {
      term = targetGender === 1 ? 'Great-Grandson' : 'Great-Granddaughter';
    }

    res.status(200).json({
      term,
      path: pathNodes.map(n => ({
        _id: n._id,
        name: n.name,
        gender: n.gender,
        generationLevel: n.generationLevel,
        parity: n.parity
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Upload an image file and return its public URL
// @route   POST /api/kinship/:treeId/upload
// @access  Private
const uploadProfilePicture = async (req, res) => {
  const { treeId } = req.params;

  try {
    const tree = await Tree.findById(treeId);
    if (!tree) {
      return res.status(404).json({ message: 'Tree not found' });
    }

    const role = await getUserRoleInTree(tree, req.user.id);
    if (!role) {
      return res.status(403).json({ message: 'Not authorized to upload files for this tree' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const fileBuffer = req.file.buffer;
    const originalName = req.file.originalname;
    const mimeType = req.file.mimetype;

    // Generate a unique file name to avoid overwrite
    const uniqueFileName = `${Date.now()}-${originalName}`;

    // Upload to drive
    const link = await uploadToDrive(fileBuffer, uniqueFileName, mimeType);

    res.status(200).json({
      success: true,
      link
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get tree ID of a node by node ID
// @route   GET /api/kinship/nodes/:nodeId/tree
// @access  Private
const getNodeTree = async (req, res) => {
  const { nodeId } = req.params;
  try {
    const node = await Node.findById(nodeId);
    if (!node) {
      return res.status(404).json({ message: 'Node not found' });
    }
    res.status(200).json({ treeId: node.treeId });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a relationship (edge) between two nodes
// @route   DELETE /api/kinship/:treeId/edges
// @access  Private (Admin or Sub-Admin)
const deleteEdge = async (req, res) => {
  const { treeId } = req.params;
  const sourceNodeId = req.body.sourceNodeId || req.query.sourceNodeId;
  const targetNodeId = req.body.targetNodeId || req.query.targetNodeId;
  const relationshipType = req.body.relationshipType || req.query.relationshipType;

  if (!sourceNodeId || !targetNodeId || !relationshipType) {
    return res.status(400).json({ message: 'sourceNodeId, targetNodeId, and relationshipType are required' });
  }

  try {
    const tree = await Tree.findById(treeId);
    if (!tree) {
      return res.status(404).json({ message: 'Tree not found' });
    }

    const role = await getUserRoleInTree(tree, req.user.id);
    if (role !== 'Admin' && role !== 'Sub-Admin') {
      return res.status(403).json({ message: 'Only Tree Admins or Sub-Admins can delete relationships' });
    }

    // Find the edge
    let query = {
      treeId,
      relationshipType
    };

    if (relationshipType === 'spouse') {
      // Spouse can be represented as source -> target or target -> source
      query.$or = [
        { sourceNodeId, targetNodeId },
        { sourceNodeId: targetNodeId, targetNodeId: sourceNodeId }
      ];
    } else {
      query.sourceNodeId = sourceNodeId;
      query.targetNodeId = targetNodeId;
    }

    const edge = await Edge.findOne(query);
    if (!edge) {
      return res.status(404).json({ message: 'Relationship not found' });
    }

    await Edge.deleteOne({ _id: edge._id });

    // Fetch node names for activity logging
    const sourceNode = await Node.findById(sourceNodeId);
    const targetNode = await Node.findById(targetNodeId);
    const sourceName = sourceNode ? sourceNode.name : 'Unknown';
    const targetName = targetNode ? targetNode.name : 'Unknown';

    // Log the activity
    await ActivityLog.create({
      treeId,
      userId: req.user.id,
      userName: req.user.name || req.user.email,
      action: 'DELETE_RELATIONSHIP',
      description: `${req.user.name || req.user.email} removed relationship "${relationshipType}" between "${sourceName}" and "${targetName}"`,
      revertData: {}
    });

    res.status(200).json({ message: 'Relationship removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all activity logs for a tree
// @route   GET /api/kinship/:treeId/logs
// @access  Private
const getTreeLogs = async (req, res) => {
  const { treeId } = req.params;
  try {
    const logs = await ActivityLog.find({ treeId }).sort({ createdAt: -1 });
    res.status(200).json(logs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Revert a specific activity log entry
// @route   POST /api/kinship/:treeId/logs/:logId/revert
// @access  Private (Admin or Sub-Admin)
const revertTreeLog = async (req, res) => {
  const { treeId, logId } = req.params;
  try {
    const tree = await Tree.findById(treeId);
    if (!tree) {
      return res.status(404).json({ message: 'Tree not found' });
    }

    const role = await getUserRoleInTree(tree, req.user.id);
    if (role !== 'Admin' && role !== 'Sub-Admin') {
      return res.status(403).json({ message: 'Only Admins or Sub-Admins can revert changes' });
    }

    const log = await ActivityLog.findOne({ _id: logId, treeId });
    if (!log) {
      return res.status(404).json({ message: 'Activity log not found' });
    }

    if (log.isReverted) {
      return res.status(400).json({ message: 'This change has already been reverted' });
    }

    const { action, revertData } = log;

    if (action === 'CREATE_NODE') {
      const { nodeId, nodesModified } = revertData;
      await Node.findByIdAndDelete(nodeId);
      await Edge.deleteMany({ $or: [{ sourceNodeId: nodeId }, { targetNodeId: nodeId }] });

      if (nodesModified && nodesModified.length > 0) {
        for (const mod of nodesModified) {
          const n = await Node.findById(mod.nodeId);
          if (n) {
            if (mod.gotram !== undefined) n.gotram = mod.gotram;
            await n.save();
          }
        }
      }

    } else if (action === 'CREATE_SPOUSE') {
      const { nodesCreated, nodesModified } = revertData;
      
      if (nodesCreated && nodesCreated.length > 0) {
        await Node.deleteMany({ _id: { $in: nodesCreated } });
        await Edge.deleteMany({
          $or: [
            { sourceNodeId: { $in: nodesCreated } },
            { targetNodeId: { $in: nodesCreated } }
          ]
        });
      }

      if (nodesModified && nodesModified.length > 0) {
        for (const mod of nodesModified) {
          const n = await Node.findById(mod.nodeId);
          if (n) {
            if (mod.gotram !== undefined) n.gotram = mod.gotram;
            if (mod.crossTreeLinkId !== undefined) n.crossTreeLinkId = mod.crossTreeLinkId;
            await n.save();
          }
        }
      }

    } else if (action === 'CREATE_MARRIAGE') {
      const { edgeId, childEdgeIds, nodesModified } = revertData;
      
      if (edgeId) {
        await Edge.findByIdAndDelete(edgeId);
      }
      if (childEdgeIds && childEdgeIds.length > 0) {
        await Edge.deleteMany({ _id: { $in: childEdgeIds } });
      }
      if (nodesModified && nodesModified.length > 0) {
        for (const mod of nodesModified) {
          const n = await Node.findById(mod.nodeId);
          if (n) {
            if (mod.gotram !== undefined) n.gotram = mod.gotram;
            await n.save();
          }
        }
      }

    } else if (action === 'UPDATE_NODE') {
      const { updates } = revertData;
      if (updates && updates.length > 0) {
        for (const upd of updates) {
          const n = await Node.findById(upd.nodeId);
          if (n) {
            Object.keys(upd.fields).forEach(key => {
              n[key] = upd.fields[key];
            });
            await n.save();
          }
        }
      }

    } else if (action === 'CREATE_RELATIONSHIP') {
      const { parentChildEdgeIds, spouseEdgeId, nodesModified } = revertData;
      if (parentChildEdgeIds && parentChildEdgeIds.length > 0) {
        await Edge.deleteMany({ _id: { $in: parentChildEdgeIds } });
      }
      if (spouseEdgeId) {
        await Edge.findByIdAndDelete(spouseEdgeId);
      }
      if (nodesModified && nodesModified.length > 0) {
        for (const mod of nodesModified) {
          const n = await Node.findById(mod.nodeId);
          if (n) {
            if (mod.gotram !== undefined) n.gotram = mod.gotram;
            await n.save();
          }
        }
      }

    } else if (action === 'DELETE_NODE') {
      const { nodeData, edgesData } = revertData;
      
      if (nodeData) {
        await Node.create(nodeData);
      }
      if (edgesData && edgesData.length > 0) {
        await Edge.insertMany(edgesData);
      }
    }

    log.isReverted = true;
    await log.save();

    res.status(200).json({ message: 'Change reverted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const checkMarriageEligibility = async (req, res) => {
  const { treeId } = req.params;
  const { nodeAId, nodeBId } = req.query;

  if (!nodeAId || !nodeBId) {
    return res.status(400).json({ message: 'nodeAId and nodeBId query parameters are required' });
  }

  try {
    const nodeA = await Node.findOne({ _id: nodeAId, treeId });
    const nodeB = await Node.findOne({ _id: nodeBId, treeId });

    if (!nodeA || !nodeB) {
      return res.status(404).json({ message: 'One or both nodes not found in this tree' });
    }

    const reasons = [];
    let isEligible = true;
    let details = '';

    // Rule 1: Monogamy / Existing Spouse check
    const spouseA = await Edge.findOne({
      treeId,
      relationshipType: 'spouse',
      $or: [{ sourceNodeId: nodeAId }, { targetNodeId: nodeAId }]
    });
    const spouseB = await Edge.findOne({
      treeId,
      relationshipType: 'spouse',
      $or: [{ sourceNodeId: nodeBId }, { targetNodeId: nodeBId }]
    });

    if (spouseA) {
      reasons.push(`${nodeA.name} already has a spouse in this tree.`);
      isEligible = false;
    }
    if (spouseB) {
      reasons.push(`${nodeB.name} already has a spouse in this tree.`);
      isEligible = false;
    }

    // Rule 2: Opposite Gender
    if (nodeA.gender === nodeB.gender) {
      reasons.push('Marriage must be between opposite genders under standard Dravidian kinship rules.');
      isEligible = false;
    }

    // Rule 3: Same Gotram (parallel clan)
    if (nodeA.gotram && nodeB.gotram && nodeA.gotram.toLowerCase() === nodeB.gotram.toLowerCase()) {
      reasons.push(`Same Gotram (${nodeA.gotram}): Parallel clan members are considered siblings.`);
      isEligible = false;
    }

    // Rule 4: Consanguinity / Parity calculation
    const nodes = await Node.find({ treeId });
    const edges = await Edge.find({ treeId });

    // Construct adjacency list
    const adj = {};
    edges.forEach(edge => {
      const s = edge.sourceNodeId.toString();
      const t = edge.targetNodeId.toString();
      if (!adj[s]) adj[s] = [];
      if (!adj[t]) adj[t] = [];
      adj[s].push({ node: t, type: edge.relationshipType, direction: 'forward' });
      adj[t].push({ node: s, type: edge.relationshipType, direction: 'backward' });
    });

    // Add cross-tree link edges
    nodes.forEach(n => {
      if (n.crossTreeLinkId) {
        const s = n._id.toString();
        const t = n.crossTreeLinkId.toString();
        const linkedNodeExists = nodes.some(x => x._id.toString() === t);
        if (linkedNodeExists) {
          if (!adj[s]) adj[s] = [];
          if (!adj[t]) adj[t] = [];
          if (!adj[s].some(neighbor => neighbor.node === t)) {
            adj[s].push({ node: t, type: 'cross_link', direction: 'bidirectional' });
          }
          if (!adj[t].some(neighbor => neighbor.node === s)) {
            adj[t].push({ node: s, type: 'cross_link', direction: 'bidirectional' });
          }
        }
      }
    });

    // BFS to find shortest path
    const queue = [[nodeAId.toString()]];
    const visited = new Set([nodeAId.toString()]);
    let path = null;

    while (queue.length > 0) {
      const currPath = queue.shift();
      const lastNode = currPath[currPath.length - 1];

      if (lastNode === nodeBId.toString()) {
        path = currPath;
        break;
      }

      const neighbors = adj[lastNode] || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.node)) {
          visited.add(neighbor.node);
          queue.push([...currPath, neighbor.node]);
        }
      }
    }

    if (!path) {
      if (isEligible) {
        details = 'Eligible (Unrelated): No traceable relationship path exists between these members, making them eligible to marry.';
      }
    } else {
      const pathNodes = await Promise.all(path.map(id => Node.findById(id)));
      
      const getEdgeType = (nodeId1, nodeId2, edgesList) => {
        const id1 = nodeId1.toString();
        const id2 = nodeId2.toString();
        const edge = edgesList.find(e => 
          (e.sourceNodeId.toString() === id1 && e.targetNodeId.toString() === id2) ||
          (e.sourceNodeId.toString() === id2 && e.targetNodeId.toString() === id1)
        );
        return edge ? { type: edge.relationshipType, source: edge.sourceNodeId.toString(), target: edge.targetNodeId.toString() } : null;
      };

      let relativeGen = 0;
      let relativeParity = 0;

      for (let i = 0; i < pathNodes.length - 1; i++) {
        const curr = pathNodes[i];
        const next = pathNodes[i + 1];

        if ((curr.crossTreeLinkId && curr.crossTreeLinkId.toString() === next._id.toString()) ||
            (next.crossTreeLinkId && next.crossTreeLinkId.toString() === curr._id.toString())) {
          continue;
        }

        const edgeInfo = getEdgeType(curr._id, next._id, edges);
        if (edgeInfo) {
          if (edgeInfo.type === 'spouse') {
            relativeParity = 1 - relativeParity;
          } else if (edgeInfo.type === 'parent_child') {
            if (edgeInfo.source === curr._id.toString()) {
              relativeGen = relativeGen - 1;
              relativeParity = (relativeParity + (1 - curr.gender)) % 2;
            } else {
              relativeGen = relativeGen + 1;
              relativeParity = (relativeParity + (1 - next.gender)) % 2;
            }
          }
        }
      }

      const delta = relativeGen;
      const sameParity = (relativeParity === 0);

      // Direct checks
      const directParent = edges.some(e => e.relationshipType === 'parent_child' && 
        ((e.sourceNodeId.toString() === nodeAId.toString() && e.targetNodeId.toString() === nodeBId.toString()) ||
         (e.sourceNodeId.toString() === nodeBId.toString() && e.targetNodeId.toString() === nodeAId.toString())));
      
      if (directParent) {
        reasons.push('Direct parent-child relationships are strictly ineligible.');
        isEligible = false;
      }

      if (delta === 0 && path.length === 3) {
        const parentEdgeA = edges.filter(e => e.relationshipType === 'parent_child' && e.targetNodeId.toString() === nodeAId.toString());
        const parentEdgeB = edges.filter(e => e.relationshipType === 'parent_child' && e.targetNodeId.toString() === nodeBId.toString());
        const sharedParents = parentEdgeA.filter(ea => parentEdgeB.some(eb => eb.sourceNodeId.toString() === ea.sourceNodeId.toString()));
        if (sharedParents.length > 0) {
          reasons.push('Direct siblings cannot marry.');
          isEligible = false;
        }
      }

      if (delta === 0) {
        if (sameParity) {
          reasons.push('Parallel cousins are considered siblings (brother/sister tier) and are ineligible to marry.');
          isEligible = false;
        } else {
          if (isEligible) {
            details = 'Eligible (Cross-Cousins): They are cross-cousins (opposite parity) in the same generation, which is the standard marriage eligibility under Dravidian rules.';
          }
        }
      } else if (Math.abs(delta) === 1) {
        const isMavayyaNiece = (nodeA.gender === 1 && nodeB.gender === 0 && !sameParity && delta === 1) ||
                               (nodeB.gender === 1 && nodeA.gender === 0 && !sameParity && delta === -1);
        
        if (isMavayyaNiece) {
          if (isEligible) {
            details = "Eligible (Maternal Uncle / Niece): They are cross-relatives with 1 generation difference (uncle and niece), which is traditionally eligible (Menarikam) in many Dravidian communities.";
          }
        } else {
          reasons.push(`Generational gap of 1 is only eligible for maternal uncle and niece marriages. Current relationship tier is not eligible.`);
          isEligible = false;
        }
      } else {
        reasons.push(`Generational gap is too wide (difference: ${Math.abs(delta)} generation(s)).`);
        isEligible = false;
      }
    }

    res.status(200).json({
      isEligible,
      reasons: isEligible ? [] : reasons,
      details: isEligible ? details : 'Ineligible based on Dravidian kinship parity and descent rules.'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
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
  deleteEdge,
  checkMarriageEligibility
};

