import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { api } from './utils/api';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import NodeModal from './components/NodeModal';
import RolesModal from './components/RolesModal';
import NotificationViewModal from './components/NotificationViewModal';
import Profile from './components/Profile';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import MailVerification from './components/MailVerification';
import LandingPage from './components/LandingPage';
import { 
  TreeDeciduous, 
  GitBranch, 
  Plus, 
  LayoutGrid, 
  Settings2, 
  Unlock, 
  Mail, 
  Lock, 
  ChevronRight, 
  Heart,
  Eye,
  EyeOff,
  UserCheck,
  X,
  User,
  Calendar,
  Smartphone,
  Link2,
  Compass,
  UserPlus,
  Edit2,
  Trash2
} from 'lucide-react';

const App = () => {
  const { user, loading: authLoading, login, loginWithGoogle, register, reloadUser, logout, needVerification, forgotPassword } = useAuth();
  
  // App states
  const [currentView, setCurrentView] = useState('tree'); // 'tree' | 'profile' | 'superadmin'
  const [trees, setTrees] = useState([]);
  const [activeTreeId, setActiveTreeId] = useState(null);
  const [graphCenterNodeId, setGraphCenterNodeId] = useState(null);
  const [rawNodes, setRawNodes] = useState([]);
  const [rawEdges, setRawEdges] = useState([]);
  const [userRole, setUserRole] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    gotram: '',
    bloodGroup: '',
    generationLevel: '',
  });

  // Selected Node in tree
  const [selectedNode, setSelectedNode] = useState(null);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);
  
  // Relationship states
  const [relationSource, setRelationSource] = useState(null);
  const [relationTarget, setRelationTarget] = useState(null);
  const [relationResult, setRelationResult] = useState(null);
  const [loadingRelation, setLoadingRelation] = useState(false);

  // Marriage Eligibility states
  const [marriageEligibility, setMarriageEligibility] = useState(null);
  const [loadingEligibility, setLoadingEligibility] = useState(false);

  // Lineage Highlight states
  const [descentHighlight, setDescentHighlight] = useState({ type: null, nodeIds: [], edgeIds: [] });

  // Offline Sync states
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState(null); // 'add_child' | 'add_spouse' | 'edit_profile' | 'link_user'
  const [modalTargetId, setModalTargetId] = useState(null);
  
  const [rolesModalOpen, setRolesModalOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  // Activity History states
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Notifications states
  const [notifications, setNotifications] = useState([]);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);

  const fetchNotifications = async (treeId) => {
    if (!treeId) {
      setNotifications([]);
      return;
    }
    try {
      const data = await api.kinship.getNotifications(treeId);
      setNotifications(data);
    } catch (err) {
      console.warn('Failed to load notifications:', err);
      setNotifications([]);
    }
  };

  const handleMarkNotificationRead = async (notificationId) => {
    if (!activeTreeId) return;
    try {
      await api.kinship.markNotificationRead(activeTreeId, notificationId);
      setNotifications(prev => prev.map(n => n._id === notificationId ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    if (!activeTreeId) return;
    try {
      await api.kinship.markAllNotificationsRead(activeTreeId);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  const handleNotificationClick = (notification) => {
    setSelectedNotification(notification);
    setIsNotificationModalOpen(true);
    if (!notification.isRead) {
      handleMarkNotificationRead(notification._id);
    }
  };

  const fetchLogs = async () => {
    if (!activeTreeId) return;
    setLoadingLogs(true);
    try {
      const data = await api.kinship.getLogs(activeTreeId);
      setLogs(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load activity logs');
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleRevertLog = async (logId) => {
    if (!activeTreeId) return;
    const confirmRevert = window.confirm('Are you sure you want to revert this change? This will restore previous data or remove created items.');
    if (!confirmRevert) return;
    
    try {
      setError('');
      const response = await api.kinship.revertLog(activeTreeId, logId);
      alert(response.message || 'Change reverted successfully');
      
      // Refresh tree graph and logs list
      await fetchGraph();
      await fetchLogs();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to revert change');
    }
  };

  // Auto-close sidebar on mobile when active tree changes or current view changes
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [activeTreeId, currentView]);

  // Layout direction
  const [layoutDirection, setLayoutDirection] = useState('TB'); // 'TB' or 'LR'

  // Auth Page states
  const [isLoginTab, setIsLoginTab] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authProcess, setAuthProcess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Fetch trees list when user logs in
  useEffect(() => {
    if (user) {
      fetchTrees();
    } else {
      setTrees([]);
      setActiveTreeId(null);
      setRawNodes([]);
      setRawEdges([]);
    }
  }, [user]);

  // Fetch graph details when active tree changes
  useEffect(() => {
    if (activeTreeId) {
      setGraphCenterNodeId(null);
      fetchGraph(null);
      // Clear selected nodes and relation result when switching trees (persisting source & target)
      setSelectedNode(null);
      setRelationResult(null);
      setNotifications([]);
      setDescentHighlight({ type: null, nodeIds: [], edgeIds: [] });
    }
  }, [activeTreeId]);

  // Network offline status listener
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      syncOfflineActions();
    };
    const handleOffline = () => {
      setIsOffline(true);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchTrees = async () => {
    try {
      const data = await api.trees.list();
      setTrees(data);
      if (data.length > 0 && !activeTreeId) {
        // Default to first tree
        setActiveTreeId(data[0]._id);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch family trees');
    }
  };

  const fetchGraph = async (centerId = null) => {
    if (!activeTreeId) return;
    setLoading(true);
    try {
      const targetCenterId = centerId !== null ? centerId : graphCenterNodeId;
      const data = await api.kinship.getGraph(activeTreeId, targetCenterId);
      setRawNodes(data.nodes);
      setRawEdges(data.edges);
      setUserRole(data.userRole);

      // Cache tree details locally
      localStorage.setItem(`graph_cache_${activeTreeId}`, JSON.stringify({
        nodes: data.nodes,
        edges: data.edges,
        userRole: data.userRole
      }));

      // Fetch pending requests count if user is Admin of the active tree
      if (data.userRole === 'Admin') {
        const reqs = await api.trees.listJoinRequests(activeTreeId);
        setPendingRequestsCount(reqs.length);
      } else {
        setPendingRequestsCount(0);
      }

      // Fetch notifications if user is Admin, Sub-Admin, or a linked member
      const isLinkedNode = data.nodes.some(n => n.linkedUserId && user && n.linkedUserId.toString() === user._id.toString());
      if (data.userRole === 'Admin' || data.userRole === 'Sub-Admin' || isLinkedNode) {
        fetchNotifications(activeTreeId);
      } else {
        setNotifications([]);
      }
    } catch (err) {
      console.error(err);
      // Attempt load from cache
      const cached = localStorage.getItem(`graph_cache_${activeTreeId}`);
      if (cached) {
        const { nodes, edges, userRole } = JSON.parse(cached);
        setRawNodes(nodes);
        setRawEdges(edges);
        setUserRole(userRole);
        setError('Working Offline: Loaded family tree from local cache.');
      } else {
        setError('Failed to load tree graph data and no local cache exists.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Auth submit handler
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthProcess(true);

    try {
      if (isLoginTab) {
        await login(authEmail, authPassword);
      } else {
        await register(authEmail, authPassword);
      }
    } catch (err) {
      if (err.message === 'unverified') {
        setAuthError('Your email address is not verified. Please verify your email first.');
      } else {
        setAuthError(err.message || 'Authentication failed');
      }
    } finally {
      setAuthProcess(false);
    }
  };

  // Forgot password submit handler
  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthProcess(true);
    setResetSent(false);
    try {
      await forgotPassword(authEmail);
      setResetSent(true);
    } catch (err) {
      setAuthError(err.message || 'Failed to send password reset email');
    } finally {
      setAuthProcess(false);
    }
  };

  // Create tree handler
  const handleCreateTree = async () => {
    const treeName = prompt('Enter a name for the new family tree:');
    if (!treeName || !treeName.trim()) return;

    try {
      const newTree = await api.trees.create(treeName.trim());
      await reloadUser(); // reload user activeTrees array
      await fetchTrees();
      setActiveTreeId(newTree._id);
    } catch (err) {
      alert(err.message || 'Failed to create tree');
    }
  };

  // Join tree handler
  const handleJoinTree = async () => {
    const treeId = prompt('Enter the Unique Database ID of the family tree you wish to join:');
    if (!treeId || !treeId.trim()) return;

    try {
      const response = await api.trees.joinRequest(treeId.trim());
      alert(response.message || 'Request to join tree submitted successfully! Please wait for the administrator to approve.');
    } catch (err) {
      alert(err.message || 'Failed to submit join request');
    }
  };

  // Delete tree handler
  const handleDeleteTree = async () => {
    if (!activeTreeId) return;
    const treeToDelete = trees.find(t => t._id === activeTreeId);
    if (!treeToDelete) return;
    
    const confirmDelete = window.confirm(`Are you absolutely sure you want to delete the family tree "${treeToDelete.treeName}"? This action CANNOT be undone, and will delete all members and relationships in this tree.`);
    if (!confirmDelete) return;

    try {
      setError('');
      await api.trees.delete(activeTreeId);
      
      // Refresh trees list
      const updatedTrees = await api.trees.list();
      setTrees(updatedTrees);
      
      if (updatedTrees.length > 0) {
        setActiveTreeId(updatedTrees[0]._id);
      } else {
        setActiveTreeId(null);
        setRawNodes([]);
        setRawEdges([]);
      }
      setSelectedNode(null);
      setRelationSource(null);
      setRelationTarget(null);
      setRelationResult(null);
      setDescentHighlight({ type: null, nodeIds: [], edgeIds: [] });
      
      alert('Family tree deleted successfully.');
    } catch (err) {
      alert(err.message || 'Failed to delete the family tree');
    }
  };

  // Manage roles handler
  const handleManageRole = async (email, role, nodeId) => {
    if (!activeTreeId) return;
    await api.trees.manageRole(activeTreeId, email, role, nodeId);
    // Reload graph in case user details changed
    fetchGraph();
  };

  // Remove relationship handler
  const handleRemoveRelationship = async (sourceNodeId, targetNodeId, relationshipType) => {
    if (!activeTreeId) return;
    if (!window.confirm(`Are you sure you want to remove this ${relationshipType.replace('_', ' ')} relationship?`)) {
      return;
    }
    await executeKinshipAction('deleteEdge', { sourceNodeId, targetNodeId, relationshipType });
  };

  // Node submissions handler
  const handleNodeSubmit = async (data) => {
    if (!activeTreeId) return;
    
    if (modalMode === 'add_child') {
      if (data.modeType === 'existing_child') {
        await executeKinshipAction('createParentChild', { parentId: data.parentId, childId: data.childId });
      } else {
        await executeKinshipAction('createNode', data);
      }
    } else if (modalMode === 'add_parent') {
      if (data.modeType === 'existing_parent') {
        await executeKinshipAction('createParentChild', { parentId: data.parentId, childId: data.childId });
      } else {
        await executeKinshipAction('createNode', data);
      }
    } else if (modalMode === 'add_spouse') {
      if (data.modeType === 'existing') {
        await executeKinshipAction('createMarriage', { nodeAId: data.targetNodeId, nodeBId: data.spouseNodeId });
      } else if (data.modeType === 'cross_tree') {
        if (!navigator.onLine) {
          alert('Linking cross-tree members requires an active internet connection.');
          return;
        }
        try {
          await api.kinship.createSpouse(activeTreeId, {
            existingNodeId: data.targetNodeId,
            crossTreeNodeId: data.crossTreeNodeId
          });
          fetchGraph();
        } catch (err) {
          alert(err.message || 'Failed to link cross-tree spouse');
        }
      } else {
        await executeKinshipAction('createSpouse', data);
      }
    } else if (modalMode === 'edit_profile') {
      await executeKinshipAction('updateNode', { nodeId: modalTargetId, data });
      if (selectedNode && selectedNode._id === modalTargetId) {
        setSelectedNode(prev => ({ ...prev, ...data }));
      }
    }
  };

  const executeKinshipAction = async (type, payload) => {
    if (!activeTreeId) return;

    if (!navigator.onLine) {
      const queueItem = {
        id: Date.now().toString(),
        treeId: activeTreeId,
        type,
        payload
      };

      const queue = JSON.parse(localStorage.getItem('offline_actions_queue') || '[]');
      queue.push(queueItem);
      localStorage.setItem('offline_actions_queue', JSON.stringify(queue));

      applyOptimisticUpdate(queueItem);
      alert('You are currently offline. Your action has been saved locally and will automatically synchronize when you reconnect.');
      return;
    }

    try {
      if (type === 'createParentChild') {
        await api.kinship.createParentChild(activeTreeId, payload.parentId, payload.childId);
      } else if (type === 'createNode') {
        await api.kinship.createNode(activeTreeId, payload);
      } else if (type === 'createMarriage') {
        await api.kinship.createMarriage(activeTreeId, payload.nodeAId, payload.nodeBId);
      } else if (type === 'createSpouse') {
        await api.kinship.createSpouse(activeTreeId, payload);
      } else if (type === 'updateNode') {
        await api.kinship.updateNode(activeTreeId, payload.nodeId, payload.data);
      } else if (type === 'deleteNode') {
        await api.kinship.deleteNode(activeTreeId, payload.nodeId);
      } else if (type === 'deleteEdge') {
        await api.kinship.deleteEdge(activeTreeId, payload.sourceNodeId, payload.targetNodeId, payload.relationshipType);
      }
      fetchGraph();
    } catch (err) {
      alert(err.message || 'Action execution failed');
    }
  };

  const applyOptimisticUpdate = (action) => {
    const { type, payload } = action;

    if (type === 'createNode') {
      const tempId = `temp_${Date.now()}`;
      const mockNode = {
        _id: tempId,
        name: payload.name,
        gender: payload.gender,
        dob: payload.dob,
        bloodGroup: payload.bloodGroup,
        gotram: payload.gotram,
        generationLevel: selectedNode ? selectedNode.generationLevel - 1 : 0,
        parity: selectedNode ? (selectedNode.parity + (1 - selectedNode.gender)) % 2 : 0,
        isDeceased: payload.isDeceased,
        dateOfDeath: payload.dateOfDeath,
        socialLinks: payload.socialLinks || []
      };

      setRawNodes(prev => [...prev, mockNode]);

      if (payload.parentId) {
        setRawEdges(prev => [...prev, {
          _id: `temp_edge_${Date.now()}`,
          sourceNodeId: payload.parentId,
          targetNodeId: tempId,
          relationshipType: 'parent_child'
        }]);
      }
    } else if (type === 'createSpouse') {
      const tempId = `temp_${Date.now()}`;
      const mockNode = {
        _id: tempId,
        name: payload.name || 'Spouse',
        gender: selectedNode ? 1 - selectedNode.gender : 1,
        dob: payload.dob,
        bloodGroup: payload.bloodGroup,
        gotram: payload.gotram,
        generationLevel: selectedNode ? selectedNode.generationLevel : 0,
        parity: selectedNode ? 1 - selectedNode.parity : 1,
        isDeceased: payload.isDeceased,
        dateOfDeath: payload.dateOfDeath,
        socialLinks: payload.socialLinks || []
      };

      setRawNodes(prev => [...prev, mockNode]);
      setRawEdges(prev => [...prev, {
        _id: `temp_edge_${Date.now()}`,
        sourceNodeId: payload.existingNodeId,
        targetNodeId: tempId,
        relationshipType: 'spouse'
      }]);
    } else if (type === 'updateNode') {
      setRawNodes(prev => prev.map(n => n._id === payload.nodeId ? { ...n, ...payload.data } : n));
    } else if (type === 'deleteNode') {
      setRawNodes(prev => prev.filter(n => n._id !== payload.nodeId));
      setRawEdges(prev => prev.filter(e => e.sourceNodeId !== payload.nodeId && e.targetNodeId !== payload.nodeId));
    } else if (type === 'createMarriage') {
      setRawEdges(prev => [...prev, {
        _id: `temp_edge_${Date.now()}`,
        sourceNodeId: payload.nodeAId,
        targetNodeId: payload.nodeBId,
        relationshipType: 'spouse'
      }]);
    } else if (type === 'createParentChild') {
      setRawEdges(prev => [...prev, {
        _id: `temp_edge_${Date.now()}`,
        sourceNodeId: payload.parentId,
        targetNodeId: payload.childId,
        relationshipType: 'parent_child'
      }]);
    } else if (type === 'deleteEdge') {
      setRawEdges(prev => prev.filter(e => !(
        e.relationshipType === payload.relationshipType &&
        ((e.sourceNodeId === payload.sourceNodeId && e.targetNodeId === payload.targetNodeId) ||
         (e.sourceNodeId === payload.targetNodeId && e.targetNodeId === payload.sourceNodeId))
      )));
    }
  };

  const syncOfflineActions = async () => {
    const queue = JSON.parse(localStorage.getItem('offline_actions_queue') || '[]');
    if (queue.length === 0) return;

    console.log(`Syncing ${queue.length} offline actions...`);
    let updatedQueue = [...queue];

    for (const action of queue) {
      try {
        if (action.type === 'createParentChild') {
          await api.kinship.createParentChild(action.treeId, action.payload.parentId, action.payload.childId);
        } else if (action.type === 'createNode') {
          await api.kinship.createNode(action.treeId, action.payload);
        } else if (action.type === 'createMarriage') {
          await api.kinship.createMarriage(action.treeId, action.payload.nodeAId, action.payload.nodeBId);
        } else if (action.type === 'createSpouse') {
          await api.kinship.createSpouse(action.treeId, action.payload);
        } else if (action.type === 'updateNode') {
          await api.kinship.updateNode(action.treeId, action.payload.nodeId, action.payload.data);
        } else if (action.type === 'deleteNode') {
          await api.kinship.deleteNode(action.treeId, action.payload.nodeId);
        } else if (action.type === 'deleteEdge') {
          await api.kinship.deleteEdge(action.treeId, action.payload.sourceNodeId, action.payload.targetNodeId, action.payload.relationshipType);
        }
        
        updatedQueue = updatedQueue.filter(item => item.id !== action.id);
        localStorage.setItem('offline_actions_queue', JSON.stringify(updatedQueue));
      } catch (err) {
        console.error('Failed to sync offline action:', action, err);
        if (!navigator.onLine) {
          break;
        } else {
          updatedQueue = updatedQueue.filter(item => item.id !== action.id);
          localStorage.setItem('offline_actions_queue', JSON.stringify(updatedQueue));
        }
      }
    }
    fetchGraph();
  };

  // Node actions from CustomNode dropdown
  const handleAddChildClick = (id) => {
    setModalMode('add_child');
    setModalTargetId(id);
    setModalOpen(true);
  };

  const handleAddSpouseClick = (id) => {
    setModalMode('add_spouse');
    setModalTargetId(id);
    setModalOpen(true);
  };

  const handleAddParentClick = (id) => {
    setModalMode('add_parent');
    setModalTargetId(id);
    setModalOpen(true);
  };

  const handleEditProfileClick = (id) => {
    const node = rawNodes.find(n => n._id === id);
    setModalMode('edit_profile');
    setModalTargetId(id);
    setSelectedNode(node); // Sync selection
    setModalOpen(true);
  };

  const handleDeleteNodeClick = async (id) => {
    if (!activeTreeId) return;
    const confirmDelete = window.confirm('Are you sure you want to delete this family member? All their relationships will be removed.');
    if (!confirmDelete) return;

    await executeKinshipAction('deleteNode', { nodeId: id });
    if (selectedNode && selectedNode._id === id) {
      setSelectedNode(null);
    }
    if (relationSource && relationSource._id === id) setRelationSource(null);
    if (relationTarget && relationTarget._id === id) setRelationTarget(null);
  };

  const handleCheckRelationClick = (id, roleType) => {
    const node = rawNodes.find(n => n._id === id);
    if (roleType === 'source') {
      setRelationSource(node);
      setRelationResult(null); // Clear old results
      setMarriageEligibility(null);
    } else {
      setRelationTarget(node);
      setRelationResult(null); // Clear old results
      setMarriageEligibility(null);
    }
    setSelectedNode(null); // Auto-close profile panel when set as source/target
  };

  const handleClearRelation = (roleType) => {
    if (roleType === 'source') {
      setRelationSource(null);
    } else {
      setRelationTarget(null);
    }
    setRelationResult(null);
    setMarriageEligibility(null);
  };

  // Calculate kinship terms
  const handleCheckRelation = async () => {
    if (!activeTreeId || !relationSource || !relationTarget) return;
    setLoadingRelation(true);
    setMarriageEligibility(null);
    try {
      const data = await api.kinship.getRelation(activeTreeId, relationSource._id, relationTarget._id);
      setRelationResult(data);
    } catch (err) {
      alert(err.message || 'Error computing relation path');
    } finally {
      setLoadingRelation(false);
    }
  };

  // Calculate marriage eligibility
  const handleCheckMarriageEligibility = async () => {
    if (!activeTreeId || !relationSource || !relationTarget) return;
    setLoadingEligibility(true);
    setRelationResult(null);
    try {
      const data = await api.kinship.checkMarriageEligibility(activeTreeId, relationSource._id, relationTarget._id);
      setMarriageEligibility(data);
    } catch (err) {
      alert(err.message || 'Error checking marriage eligibility');
    } finally {
      setLoadingEligibility(false);
    }
  };

  // Lineage highlights calculations
  const handleHighlightLineage = (type) => {
    if (!selectedNode || !rawNodes || !rawEdges) return;

    const nodeIds = new Set();
    const edgeIds = new Set();
    const selectedId = selectedNode._id.toString();
    nodeIds.add(selectedId);

    const getFather = (nodeId) => {
      const parentEdges = rawEdges.filter(e => e.relationshipType === 'parent_child' && e.targetNodeId === nodeId);
      for (const edge of parentEdges) {
        const parentNode = rawNodes.find(n => n._id === edge.sourceNodeId);
        if (parentNode && parentNode.gender === 1) return parentNode;
      }
      return null;
    };

    const getMother = (nodeId) => {
      const parentEdges = rawEdges.filter(e => e.relationshipType === 'parent_child' && e.targetNodeId === nodeId);
      for (const edge of parentEdges) {
        const parentNode = rawNodes.find(n => n._id === edge.sourceNodeId);
        if (parentNode && parentNode.gender === 0) return parentNode;
      }
      return null;
    };

    if (type === 'patrilineal') {
      let currentId = selectedId;
      let father = getFather(currentId);
      while (father) {
        const fId = father._id.toString();
        nodeIds.add(fId);
        const edge = rawEdges.find(e => e.relationshipType === 'parent_child' && e.sourceNodeId === fId && e.targetNodeId === currentId);
        if (edge) edgeIds.add(edge._id);
        currentId = fId;
        father = getFather(currentId);
      }

      if (selectedNode.gender === 1) {
        const traverseSons = (nodeId) => {
          const childEdges = rawEdges.filter(e => e.relationshipType === 'parent_child' && e.sourceNodeId === nodeId);
          for (const edge of childEdges) {
            const childNode = rawNodes.find(n => n._id === edge.targetNodeId);
            if (childNode && childNode.gender === 1) {
              const cId = childNode._id.toString();
              nodeIds.add(cId);
              edgeIds.add(edge._id);
              traverseSons(cId);
            }
          }
        };
        traverseSons(selectedId);
      }
    } else if (type === 'matrilineal') {
      let currentId = selectedId;
      let mother = getMother(currentId);
      while (mother) {
        const mId = mother._id.toString();
        nodeIds.add(mId);
        const edge = rawEdges.find(e => e.relationshipType === 'parent_child' && e.sourceNodeId === mId && e.targetNodeId === currentId);
        if (edge) edgeIds.add(edge._id);
        currentId = mId;
        mother = getMother(currentId);
      }

      if (selectedNode.gender === 0) {
        const traverseDaughters = (nodeId) => {
          const childEdges = rawEdges.filter(e => e.relationshipType === 'parent_child' && e.sourceNodeId === nodeId);
          for (const edge of childEdges) {
            const childNode = rawNodes.find(n => n._id === edge.targetNodeId);
            if (childNode && childNode.gender === 0) {
              const cId = childNode._id.toString();
              nodeIds.add(cId);
              edgeIds.add(edge._id);
              traverseDaughters(cId);
            }
          }
        };
        traverseDaughters(selectedId);
      }
    }

    setDescentHighlight({
      type,
      nodeIds: Array.from(nodeIds),
      edgeIds: Array.from(edgeIds)
    });
  };

  const handleTracePath = (nodeAId, nodeBId) => {
    if (!nodeAId || !nodeBId || !rawNodes || !rawEdges) return;

    const adj = {};
    rawEdges.forEach(edge => {
      const s = edge.sourceNodeId.toString();
      const t = edge.targetNodeId.toString();
      if (!adj[s]) adj[s] = [];
      if (!adj[t]) adj[t] = [];
      adj[s].push({ target: t, edgeId: edge._id });
      adj[t].push({ target: s, edgeId: edge._id });
    });

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
        if (!visited.has(neighbor.target)) {
          visited.add(neighbor.target);
          queue.push([...currPath, neighbor.target]);
        }
      }
    }

    if (path) {
      const edgeIds = [];
      for (let i = 0; i < path.length - 1; i++) {
        const u = path[i];
        const v = path[i + 1];
        const edge = rawEdges.find(e => 
          (e.sourceNodeId.toString() === u && e.targetNodeId.toString() === v) ||
          (e.sourceNodeId.toString() === v && e.targetNodeId.toString() === u)
        );
        if (edge) {
          edgeIds.push(edge._id);
        }
      }

      setDescentHighlight({
        type: 'path',
        nodeIds: path,
        edgeIds
      });
    } else {
      setDescentHighlight({
        type: 'path',
        nodeIds: [nodeAId.toString(), nodeBId.toString()],
        edgeIds: []
      });
    }
  };



  const [pendingSelectNodeId, setPendingSelectNodeId] = useState(null);

  // Handle auto-selecting pending cross-tree node after graph loads
  useEffect(() => {
    if (pendingSelectNodeId && rawNodes.length > 0) {
      const matched = rawNodes.find(n => n._id === pendingSelectNodeId);
      if (matched) {
        setSelectedNode(matched);
        setPendingSelectNodeId(null);
      }
    }
  }, [rawNodes, pendingSelectNodeId]);

  const handleViewCrossTree = async (crossTreeLinkId) => {
    try {
      setError('');
      const response = await api.kinship.getNodeTree(crossTreeLinkId);
      if (response && response.treeId) {
        setPendingSelectNodeId(crossTreeLinkId);
        setActiveTreeId(response.treeId);
      }
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to locate linked family tree');
    }
  };

  // Canvas node click selection
  const handleNodeClick = (event, node) => {
    const matched = rawNodes.find(n => n._id === node.id);
    if (matched) {
      setSelectedNode(matched);
    }
  };

  // Sidebar filters
  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      gotram: '',
      bloodGroup: '',
      generationLevel: '',
    });
  };

  // Calculate age from DOB (or age at death if deceased)
  const getAge = (dobString, dodString = null, isDeceased = false) => {
    if (!dobString) return 'N/A';
    const birthDate = new Date(dobString);
    const endDate = isDeceased && dodString ? new Date(dodString) : new Date();
    let age = endDate.getFullYear() - birthDate.getFullYear();
    const m = endDate.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && endDate.getDate() < birthDate.getDate())) {
      age--;
    }
    return isDeceased ? `${age} yrs (at death)` : `${age} years old`;
  };

  const getDobFormatted = (dobString) => {
    if (!dobString) return 'N/A';
    return new Date(dobString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Apply filters (excluding search, since search highlights nodes instead of hiding them)
  const filteredNodes = rawNodes.filter(node => {
    if (filters.gotram && node.gotram !== filters.gotram) return false;
    if (filters.bloodGroup && node.bloodGroup !== filters.bloodGroup) return false;
    if (filters.generationLevel !== '' && node.generationLevel !== parseInt(filters.generationLevel)) return false;
    return true;
  });

  const filteredNodeIds = new Set(filteredNodes.map(n => n._id));
  const filteredEdges = rawEdges.filter(edge => 
    filteredNodeIds.has(edge.sourceNodeId) && filteredNodeIds.has(edge.targetNodeId)
  );

  // loading splash screen
  if (authLoading) {
    return (
      <div className="h-screen w-screen bg-surface-0 flex flex-col items-center justify-center text-slate-100 font-sans">
        <div className="bg-emerald-950/40 border border-emerald-500/20 p-4 rounded-2xl text-emerald-400 mb-5 shadow-glow-md animate-bounce">
          <TreeDeciduous size={36} />
        </div>
        <h2 className="text-sm font-bold tracking-widest text-slate-300 uppercase">Sangam Roots</h2>
        <span className="text-[11px] text-slate-500 mt-1.5">Loading your heritage...</span>
      </div>
    );
  }

  // Mail verification page check
  if (needVerification) {
    return <MailVerification />;
  }

  // Auth login/register view
  if (!user) {
    return (
      <LandingPage
        isLoginTab={isLoginTab}
        setIsLoginTab={setIsLoginTab}
        authEmail={authEmail}
        setAuthEmail={setAuthEmail}
        authPassword={authPassword}
        setAuthPassword={setAuthPassword}
        authError={authError}
        setAuthError={setAuthError}
        authProcess={authProcess}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        showForgotPassword={showForgotPassword}
        setShowForgotPassword={setShowForgotPassword}
        resetSent={resetSent}
        setResetSent={setResetSent}
        handleAuthSubmit={handleAuthSubmit}
        handleForgotPasswordSubmit={handleForgotPasswordSubmit}
        loginWithGoogle={loginWithGoogle}
        setAuthProcess={setAuthProcess}
      />
    );
  }

  // Authenticated View
  return (
    <div className="h-screen w-screen bg-surface-0 flex flex-col font-sans overflow-hidden">
      
      {/* 1. TOP NAVBAR */}
      <Navbar
        trees={trees}
        activeTreeId={activeTreeId}
        onSelectTree={setActiveTreeId}
        onCreateTree={handleCreateTree}
        onJoinTree={handleJoinTree}
        onAddNode={() => handleAddChildClick(null)}
        onOpenManageRoles={() => setRolesModalOpen(true)}
        onToggleSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        pendingRequestsCount={pendingRequestsCount}
        currentView={currentView}
        onSelectView={setCurrentView}
      />

      <div className="flex flex-1 overflow-hidden relative">
        {/* 2. SIDEBAR (Collapsible drawer on mobile, z-index and visibility set highest) */}
        <div 
          className={`
            fixed md:relative top-[60px] md:top-0 left-0 z-[100] md:z-auto h-[calc(100vh-60px)] md:h-auto 
            transition-transform duration-300 ease-in-out md:translate-x-0 flex flex-col flex-shrink-0
            ${currentView !== 'tree' ? 'md:hidden' : ''}
            ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}
        >
          <Sidebar
            nodes={rawNodes}
            selectedNode={selectedNode}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filters={filters}
            onFilterChange={handleFilterChange}
            onResetFilters={handleResetFilters}
            relationSource={relationSource}
            relationTarget={relationTarget}
            onClearRelation={handleClearRelation}
            onCheckRelation={handleCheckRelation}
            relationResult={relationResult}
            loadingRelation={loadingRelation}
            
            // Mobile-only props
            trees={trees}
            activeTreeId={activeTreeId}
            onSelectTree={setActiveTreeId}
            onCreateTree={handleCreateTree}
            onJoinTree={handleJoinTree}
            onAddNode={() => handleAddChildClick(null)}
            onOpenManageRoles={() => setRolesModalOpen(true)}
            onDeleteTree={handleDeleteTree}
            userRole={userRole}
            logout={logout}
            pendingRequestsCount={pendingRequestsCount}

            // Logs props
            logs={logs}
            loadingLogs={loadingLogs}
            fetchLogs={fetchLogs}
            onRevertLog={handleRevertLog}

            // Notifications props
            notifications={notifications}
            onMarkNotificationRead={handleMarkNotificationRead}
            onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
            onNotificationClick={handleNotificationClick}
            hasNotificationAccess={userRole === 'Admin' || userRole === 'Sub-Admin' || rawNodes.some(n => n.linkedUserId && user && n.linkedUserId.toString() === user._id.toString())}
            onSelectNodesForTrace={handleTracePath}
          />
        </div>

        {/* Mobile Sidebar overlay backdrop */}
        {mobileSidebarOpen && (
          <div 
            onClick={() => setMobileSidebarOpen(false)}
            className="md:hidden fixed inset-0 bg-surface-0/60 backdrop-blur-sm z-[90] top-[60px] cursor-pointer"
          />
        )}

        {currentView === 'profile' ? (
          <Profile />
        ) : currentView === 'superadmin' ? (
          <SuperAdminDashboard />
        ) : (
          <>

        {/* 3. MAIN CANVAS AREA */}
        <div className="flex-1 h-full relative">
          
          {activeTreeId ? (
            <>


              {/* Floating Selected Node Profile View */}
              {selectedNode && (() => {
                const isCurrentUser = selectedNode.linkedUserId && user && selectedNode.linkedUserId.toString() === user._id.toString();
                const canEdit = userRole === 'Admin' || userRole === 'Sub-Admin' || (userRole === 'Standard' && isCurrentUser);
                const canAdd = userRole === 'Admin' || userRole === 'Sub-Admin';
                const canDelete = userRole === 'Admin';
                return (
                  <div className="absolute top-[88px] right-4 z-10 w-[calc(100vw-32px)] sm:w-80 glass-heavy rounded-2xl p-4 shadow-2xl animate-slide-in-right text-slate-200 max-h-[78vh] overflow-y-auto custom-scrollbar">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-700/30 mb-3">
                      <h3 className="section-label">Member Profile</h3>
                      <button
                        onClick={() => setSelectedNode(null)}
                        className="text-slate-500 hover:text-slate-300 p-1 bg-surface-1/40 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="space-y-3.5">
                      {/* Avatar & Header */}
                      <div className="flex items-center space-x-3">
                        {selectedNode.profilePictureUrl ? (
                          <img
                            src={selectedNode.profilePictureUrl}
                            alt={selectedNode.name}
                            className={`w-12 h-12 rounded-full object-cover border cursor-pointer hover:scale-105 active:scale-95 transition-transform duration-200 ${selectedNode.isDeceased ? 'grayscale border-slate-650' : 'border-slate-800'}`}
                            onClick={() => setPreviewImageUrl(selectedNode.profilePictureUrl)}
                          />
                        ) : (
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${
                            selectedNode.isDeceased ? 'bg-slate-950 border-slate-650 text-slate-400 grayscale' :
                            (selectedNode.gender === 1 ? 'bg-blue-950/40 border-blue-500/20 text-blue-400' : 'bg-pink-950/40 border-pink-500/20 text-pink-400')
                          }`}>
                            <User size={22} />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-bold text-slate-100 leading-tight flex flex-wrap items-center break-words w-full">
                            <span className="break-words w-full block">{selectedNode.name}</span>
                            {selectedNode.isDeceased && (
                              <span className="mt-1 px-1 py-0.2 text-[8px] font-extrabold bg-slate-700 text-slate-300 rounded border border-slate-600 inline-block">
                                Deceased
                              </span>
                            )}
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {selectedNode.gender === 1 ? 'Male' : 'Female'} • Gen Level {selectedNode.generationLevel}
                          </p>
                        </div>
                      </div>

                      {/* Profile fields */}
                      <div className="space-y-2.5 text-xs pt-1 border-t border-slate-800/40">
                        <div className="flex items-start space-x-2">
                          <Calendar size={13} className="text-slate-500 mt-0.5" />
                          <div>
                            <span className="text-[10px] text-slate-500 block leading-none font-semibold">Date of Birth</span>
                            <span className="text-slate-300 block mt-0.5">{getDobFormatted(selectedNode.dob)} ({getAge(selectedNode.dob, selectedNode.dateOfDeath, selectedNode.isDeceased)})</span>
                          </div>
                        </div>

                        {selectedNode.isDeceased && (
                          <div className="flex items-start space-x-2 animate-in fade-in slide-in-from-top-1 duration-150">
                            <Calendar size={13} className="text-rose-500 mt-0.5" />
                            <div>
                              <span className="text-[10px] text-rose-450 block leading-none font-semibold">Date of Death</span>
                              <span className="text-slate-350 block mt-0.5">{getDobFormatted(selectedNode.dateOfDeath)}</span>
                            </div>
                          </div>
                        )}

                        <div className="flex items-start space-x-2">
                          <Compass size={13} className="text-slate-500 mt-0.5" />
                          <div>
                            <span className="text-[10px] text-slate-500 block leading-none font-semibold">Gotram</span>
                            <span className="text-slate-300 block mt-0.5">{selectedNode.gotram || 'N/A'}</span>
                          </div>
                        </div>

                        <div className="flex items-start space-x-2">
                          <Heart size={13} className="text-slate-500 mt-0.5" />
                          <div>
                            <span className="text-[10px] text-slate-500 block leading-none font-semibold">Blood Group</span>
                            <span className="text-slate-300 block mt-0.5">{selectedNode.bloodGroup || 'N/A'}</span>
                          </div>
                        </div>

                        <div className="flex items-start space-x-2">
                          <Smartphone size={13} className="text-slate-500 mt-0.5" />
                          <div>
                            <span className="text-[10px] text-slate-500 block leading-none font-semibold">Mobile Number</span>
                            <span className="text-slate-300 block mt-0.5">{selectedNode.mobileNumber || 'N/A'}</span>
                          </div>
                        </div>

                        <div className="flex items-start space-x-2">
                          <Mail size={13} className="text-slate-500 mt-0.5" />
                          <div>
                            <span className="text-[10px] text-slate-500 block leading-none font-semibold">Email Address</span>
                            <span className="text-slate-300 block mt-0.5">{selectedNode.email || 'N/A'}</span>
                          </div>
                        </div>

                        {selectedNode.socialLinks && selectedNode.socialLinks.length > 0 && (
                          <div className="flex items-start space-x-2">
                            <Link2 size={13} className="text-slate-500 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <span className="text-[10px] text-slate-500 block leading-none font-semibold mb-1">Social Profiles</span>
                              <div className="space-y-0.5">
                                {selectedNode.socialLinks.map((link, idx) => (
                                  <a
                                    key={idx}
                                    href={link.startsWith('http') ? link : `https://${link}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-emerald-400 hover:underline block truncate"
                                  >
                                    {link}
                                  </a>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800 flex justify-between items-center text-[10px] font-mono mt-1">
                          <span className="text-slate-500 font-bold uppercase">Kinship Parity</span>
                          <span className={`px-2 py-0.5 rounded font-extrabold ${selectedNode.parity === 1 ? 'bg-indigo-950 text-indigo-400 border border-indigo-500/10' : 'bg-amber-950 text-amber-400 border border-amber-500/10'}`}>
                            STATE {selectedNode.parity}
                          </span>
                        </div>

                        {/* Relationships List */}
                        <div className="mt-3.5 pt-3 border-t border-slate-800/80 space-y-2">
                          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Relationships</span>
                          {(() => {
                            const spouses = rawEdges
                              .filter(e => e.relationshipType === 'spouse' && (e.sourceNodeId === selectedNode._id || e.targetNodeId === selectedNode._id))
                              .map(e => {
                                const partnerId = e.sourceNodeId === selectedNode._id ? e.targetNodeId : e.sourceNodeId;
                                const partnerNode = rawNodes.find(n => n._id === partnerId);
                                return { edge: e, node: partnerNode, type: 'spouse' };
                              })
                              .filter(item => item.node);

                            const parents = rawEdges
                              .filter(e => e.relationshipType === 'parent_child' && e.targetNodeId === selectedNode._id)
                              .map(e => {
                                const parentNode = rawNodes.find(n => n._id === e.sourceNodeId);
                                return { edge: e, node: parentNode, type: 'parent' };
                              })
                              .filter(item => item.node);

                            const children = rawEdges
                              .filter(e => e.relationshipType === 'parent_child' && e.sourceNodeId === selectedNode._id)
                              .map(e => {
                                const childNode = rawNodes.find(n => n._id === e.targetNodeId);
                                return { edge: e, node: childNode, type: 'child' };
                              })
                              .filter(item => item.node);

                            const allRelations = [...spouses, ...parents, ...children];

                            if (allRelations.length === 0) {
                              return <p className="text-[10px] text-slate-500 italic">No direct relationships established.</p>;
                            }

                            return (
                              <div className="space-y-1.5 max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
                                {allRelations.map(({ edge, node: relNode, type }) => (
                                  <div key={edge._id + '-' + type} className="flex items-center justify-between bg-slate-950/40 border border-slate-850/60 rounded-lg px-2.5 py-1.5 text-xs text-slate-350">
                                    <div className="flex flex-col min-w-0">
                                      <span className="font-bold truncate text-[11px] text-slate-200">{relNode.name}</span>
                                      <span className="text-[9px] text-slate-500 capitalize leading-none mt-0.5">
                                        {type === 'parent' ? 'parent' : type === 'child' ? 'child' : 'spouse'}
                                      </span>
                                    </div>
                                    {canAdd && (
                                      <button
                                        type="button"
                                        title={`Remove ${type} relationship`}
                                        onClick={() => handleRemoveRelationship(edge.sourceNodeId, edge.targetNodeId, edge.relationshipType)}
                                        className="text-slate-500 hover:text-red-400 p-1 hover:bg-red-950/20 rounded-md transition-colors cursor-pointer"
                                      >
                                        <Trash2 size={11} />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Action Buttons inside Profile panel */}
                      <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2.5">
                        {/* Relationship Actions */}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => {
                              setRelationTarget(selectedNode);
                              setRelationResult(null);
                              setMarriageEligibility(null);
                              setSelectedNode(null); // Auto-close profile panel when set as target
                            }}
                            className={`flex items-center justify-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all active:scale-95 cursor-pointer ${
                              relationTarget && relationTarget._id === selectedNode._id
                                ? 'bg-purple-950/50 border-purple-500/50 text-purple-400 shadow-md shadow-purple-500/5'
                                : 'bg-slate-950 border-slate-800 hover:border-purple-500/30 text-slate-350 hover:text-purple-400'
                            }`}
                          >
                            <span>Set as Target</span>
                          </button>
                          <button
                            onClick={() => {
                              setRelationSource(selectedNode);
                              setRelationResult(null);
                              setMarriageEligibility(null);
                              setSelectedNode(null); // Auto-close profile panel when set as source
                            }}
                            className={`flex items-center justify-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all active:scale-95 cursor-pointer ${
                              relationSource && relationSource._id === selectedNode._id
                                ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-400 shadow-md shadow-emerald-500/5'
                                : 'bg-slate-950 border-slate-800 hover:border-emerald-500/30 text-slate-350 hover:text-emerald-400'
                            }`}
                          >
                            <span>Set as Source</span>
                          </button>
                        </div>

                        {/* Expand Graph Action */}
                        {selectedNode.hasUnloadedRelatives && (
                          <button
                            onClick={() => {
                              setGraphCenterNodeId(selectedNode._id);
                              fetchGraph(selectedNode._id);
                            }}
                            className="w-full flex items-center justify-center space-x-1.5 bg-indigo-650 hover:bg-indigo-550 text-white font-bold text-xs py-2 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-indigo-650/20 active:scale-95 cursor-pointer"
                          >
                            <Compass size={13} className="animate-pulse" />
                            <span>Expand Tree from Here</span>
                          </button>
                        )}
                        
                        {/* Node Manipulation Actions */}
                        {(canAdd || canEdit || canDelete) && (
                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                            {canAdd && (
                              <button
                                onClick={() => handleAddChildClick(selectedNode._id)}
                                className="bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 text-slate-350 px-2 py-1.5 rounded-xl flex items-center justify-center space-x-1 transition-all active:scale-95 cursor-pointer"
                              >
                                <Plus size={11} className="text-emerald-500" />
                                <span>Add Child</span>
                              </button>
                            )}
                            {canAdd && (
                              <button
                                onClick={() => handleAddSpouseClick(selectedNode._id)}
                                disabled={rawEdges.some(e => e.relationshipType === 'spouse' && (e.sourceNodeId === selectedNode._id || e.targetNodeId === selectedNode._id))}
                                className="bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 text-slate-350 px-2 py-1.5 rounded-xl flex items-center justify-center space-x-1 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                              >
                                <UserPlus size={11} className="text-pink-500" />
                                <span>Add Spouse</span>
                              </button>
                            )}
                            {canAdd && (
                              <button
                                onClick={() => handleAddParentClick(selectedNode._id)}
                                disabled={rawEdges.filter(e => e.relationshipType === 'parent_child' && e.targetNodeId === selectedNode._id).length >= 2}
                                className="bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 text-slate-350 px-2 py-1.5 rounded-xl flex items-center justify-center space-x-1 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                              >
                                <Plus size={11} className="text-blue-500" />
                                <span>Add Parent</span>
                              </button>
                            )}
                            {canEdit && (
                              <button
                                onClick={() => handleEditProfileClick(selectedNode._id)}
                                className="bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 text-slate-350 px-2 py-1.5 rounded-xl flex items-center justify-center space-x-1 transition-all active:scale-95 cursor-pointer"
                              >
                                <Edit2 size={11} className="text-blue-500" />
                                <span>Edit Profile</span>
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => handleDeleteNodeClick(selectedNode._id)}
                                className="col-span-2 bg-slate-950 border border-slate-855 hover:border-red-900/30 hover:bg-red-950/20 text-red-400 px-2 py-1.5 rounded-xl flex items-center justify-center space-x-1 transition-all active:scale-95 cursor-pointer"
                              >
                                <Trash2 size={11} />
                                <span>Delete Member</span>
                              </button>
                            )}
                          </div>
                        )}

                        {/* Lineage Highlights */}
                        <div className="pt-3 border-t border-slate-800/80 space-y-2">
                          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Lineage Highlights</span>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => handleHighlightLineage('patrilineal')}
                              className={`flex items-center justify-center space-x-1.5 px-2 py-1.5 rounded-xl border text-[10px] font-bold transition-all active:scale-95 cursor-pointer ${
                                descentHighlight.type === 'patrilineal' && descentHighlight.nodeIds.includes(selectedNode._id)
                                  ? 'bg-blue-950/60 border-blue-500 text-blue-400 font-extrabold shadow-md shadow-blue-500/5'
                                  : 'bg-slate-950 border-slate-855 hover:border-blue-500/30 text-slate-400 hover:text-blue-400'
                              }`}
                            >
                              <span>Patrilineal (Father)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleHighlightLineage('matrilineal')}
                              className={`flex items-center justify-center space-x-1.5 px-2 py-1.5 rounded-xl border text-[10px] font-bold transition-all active:scale-95 cursor-pointer ${
                                descentHighlight.type === 'matrilineal' && descentHighlight.nodeIds.includes(selectedNode._id)
                                  ? 'bg-pink-950/60 border-pink-500 text-pink-400 font-extrabold shadow-md shadow-pink-500/5'
                                  : 'bg-slate-950 border-slate-855 hover:border-pink-500/30 text-slate-400 hover:text-pink-400'
                              }`}
                            >
                              <span>Matrilineal (Mother)</span>
                            </button>
                          </div>
                          {descentHighlight.type && (
                            <button
                              type="button"
                              onClick={() => setDescentHighlight({ type: null, nodeIds: [], edgeIds: [] })}
                              className="w-full py-1.5 text-[9px] bg-slate-950 border border-slate-855 hover:border-slate-800 text-slate-500 hover:text-slate-350 rounded-xl flex items-center justify-center space-x-1 cursor-pointer transition-colors"
                            >
                              <span>Clear Highlights</span>
                            </button>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })()}

              {previewImageUrl && (
                <div 
                  className="absolute top-[88px] left-4 md:left-auto md:right-[352px] z-20 w-64 bg-slate-900/95 border border-slate-800 backdrop-blur-md rounded-2xl p-3 shadow-2xl animate-in fade-in slide-in-from-top-4 md:slide-in-from-right-4 duration-200 text-slate-200"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 mb-2">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Photo Preview</span>
                    <button
                      onClick={() => setPreviewImageUrl(null)}
                      className="text-slate-500 hover:text-slate-300 p-1 bg-slate-950/40 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <div className="relative w-full aspect-square overflow-hidden rounded-xl bg-slate-950">
                    <img 
                      src={previewImageUrl} 
                      alt="Profile Enlarged" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}

              {/* Floating bottom Kinship Calculator division */}
              {relationTarget && (
                <div className="absolute bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-10 w-[calc(100vw-32px)] sm:min-w-[450px] sm:max-w-xl bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col space-y-3 text-slate-200 animate-in slide-in-from-bottom-20 md:slide-in-from-bottom-6 fade-in duration-200">
                  {/* Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Kinship Calculator</span>
                    <button
                      onClick={() => {
                        setRelationSource(null);
                        setRelationTarget(null);
                        setRelationResult(null);
                        setMarriageEligibility(null);
                      }}
                      className="text-slate-500 hover:text-slate-300 p-1 bg-slate-950/40 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </div>

                  {/* Selection Status & Calculate Layout */}
                  {!relationSource ? (
                    <div className="flex flex-col items-center justify-center py-2.5 space-y-2.5">
                      <div className="flex items-center space-x-2 bg-purple-950/40 border border-purple-500/20 px-4 py-2 rounded-xl">
                        <span className="text-[10px] text-slate-500 uppercase font-bold">Target selected:</span>
                        <span className="text-xs font-bold text-purple-400">{relationTarget.name}</span>
                        <button
                          onClick={() => {
                            setRelationTarget(null);
                            setRelationResult(null);
                            setMarriageEligibility(null);
                          }}
                          className="text-slate-500 hover:text-red-400 ml-1.5 cursor-pointer"
                          title="Clear target"
                        >
                          <X size={12} />
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-450 animate-pulse text-center">
                        Select another family member node and click <span className="text-emerald-400 font-semibold">"Set as Source"</span> to check their kinship relationship.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Both target and source are selected */}
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        {/* Source */}
                        <div className="bg-slate-950/50 border border-slate-850 p-2.5 rounded-xl flex items-center justify-between min-h-[38px]">
                          <div className="flex flex-col">
                            <span className="text-[9px] text-slate-500 uppercase font-bold">Source</span>
                            <span className="font-bold text-emerald-400 truncate max-w-[130px] sm:max-w-[180px]">{relationSource.name}</span>
                          </div>
                          <button onClick={() => handleClearRelation('source')} className="text-slate-500 hover:text-red-400">
                            <X size={12} />
                          </button>
                        </div>

                        {/* Target */}
                        <div className="bg-slate-950/50 border border-slate-850 p-2.5 rounded-xl flex items-center justify-between min-h-[38px]">
                          <div className="flex flex-col">
                            <span className="text-[9px] text-slate-500 uppercase font-bold">Target</span>
                            <span className="font-bold text-purple-400 truncate max-w-[130px] sm:max-w-[180px]">{relationTarget.name}</span>
                          </div>
                          <button onClick={() => handleClearRelation('target')} className="text-slate-500 hover:text-red-400">
                            <X size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Calculate Buttons */}
                      {!relationResult && !marriageEligibility && (
                        <div className="flex gap-2 w-full">
                          <button
                            onClick={handleCheckRelation}
                            disabled={loadingRelation || loadingEligibility}
                            className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-650 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-[11px] py-2.5 rounded-xl shadow-lg transition-all duration-300 active:scale-98 disabled:opacity-50 cursor-pointer text-center"
                          >
                            {loadingRelation ? 'Computing Path...' : 'Check Relationship'}
                          </button>
                          <button
                            onClick={handleCheckMarriageEligibility}
                            disabled={loadingRelation || loadingEligibility}
                            className="flex-1 bg-gradient-to-r from-purple-650 to-indigo-655 hover:from-purple-550 hover:to-indigo-550 text-white font-bold text-[11px] py-2.5 rounded-xl shadow-lg transition-all duration-300 active:scale-98 disabled:opacity-50 cursor-pointer text-center"
                          >
                            {loadingEligibility ? 'Evaluating...' : 'Check Eligibility'}
                          </button>
                        </div>
                      )}

                      {/* Relationship Result & Lineage Path */}
                      {relationResult && (
                        <div className="bg-emerald-950/20 border border-emerald-500/20 p-3 rounded-xl space-y-2.5 animate-in zoom-in-95 duration-150">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-[9px] uppercase tracking-wider text-slate-500 block font-bold leading-none">Relationship Term</span>
                              <span className="text-sm font-extrabold text-emerald-400 block mt-1">{relationResult.term}</span>
                            </div>
                            <div className="flex items-center space-x-1.5">
                              <button
                                onClick={handleCheckRelation}
                                disabled={loadingRelation}
                                className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 text-[10px] font-semibold rounded-lg hover:bg-slate-800 transition-colors text-slate-350"
                              >
                                Recalculate
                              </button>
                              <button
                                onClick={() => {
                                  setRelationResult(null);
                                  setMarriageEligibility(null);
                                }}
                                className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 text-[10px] font-semibold rounded-lg hover:bg-slate-800 transition-colors text-slate-400"
                              >
                                Back
                              </button>
                            </div>
                          </div>

                          {relationResult.path && relationResult.path.length > 0 && (
                            <div className="border-t border-slate-800/40 pt-2">
                              <span className="text-[9px] uppercase tracking-wider text-slate-500 block font-bold mb-1.5 leading-none">Lineage Path</span>
                              <div className="flex flex-wrap items-center gap-1.5 max-h-20 overflow-y-auto custom-scrollbar pr-1">
                                {relationResult.path.map((node, i) => (
                                  <React.Fragment key={node._id}>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono leading-none font-bold ${
                                      node._id === relationSource._id 
                                        ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-500/20'
                                        : node._id === relationTarget._id
                                        ? 'bg-purple-900/40 text-purple-300 border border-purple-500/20'
                                        : 'bg-slate-950 border border-slate-850 text-slate-400'
                                    }`}>
                                      {node.name}
                                    </span>
                                    {i < relationResult.path.length - 1 && (
                                      <span className="text-[9px] text-slate-600 font-bold">➔</span>
                                    )}
                                  </React.Fragment>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Marriage Eligibility Result */}
                      {marriageEligibility && (
                        <div className={`p-3 rounded-xl border space-y-2.5 animate-in zoom-in-95 duration-150 ${
                          marriageEligibility.isEligible 
                            ? 'bg-emerald-950/20 border-emerald-500/30' 
                            : 'bg-red-950/20 border-red-500/30'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-[9px] uppercase tracking-wider text-slate-500 block font-bold leading-none">Marriage Compatibility</span>
                              <span className={`text-xs font-extrabold block mt-1 ${
                                marriageEligibility.isEligible ? 'text-emerald-400' : 'text-red-400'
                              }`}>
                                {marriageEligibility.isEligible ? '✅ COMPATIBLE' : '❌ INCOMPATIBLE'}
                              </span>
                            </div>
                            <div className="flex items-center space-x-1.5">
                              <button
                                onClick={handleCheckMarriageEligibility}
                                disabled={loadingEligibility}
                                className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 text-[10px] font-semibold rounded-lg hover:bg-slate-800 transition-colors text-slate-350"
                              >
                                Re-evaluate
                              </button>
                              <button
                                onClick={() => {
                                  setRelationResult(null);
                                  setMarriageEligibility(null);
                                }}
                                className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 text-[10px] font-semibold rounded-lg hover:bg-slate-800 transition-colors text-slate-400"
                              >
                                Back
                              </button>
                            </div>
                          </div>
                          
                          <p className="text-[11px] text-slate-350 leading-relaxed font-medium">
                            {marriageEligibility.details}
                          </p>

                          {marriageEligibility.reasons && marriageEligibility.reasons.length > 0 && (
                            <div className="border-t border-slate-800/40 pt-2 space-y-1">
                              <span className="text-[9px] uppercase tracking-wider text-slate-500 block font-bold leading-none mb-1">Rule Violations:</span>
                              {marriageEligibility.reasons.map((reason, idx) => (
                                <p key={idx} className="text-[10px] text-red-450 flex items-start space-x-1.5">
                                  <span>•</span>
                                  <span>{reason}</span>
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Empty state when tree has no nodes */}
              {rawNodes.length === 0 && !loading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-surface-0/80 backdrop-blur-sm px-6 text-center">
                  <div className="bg-emerald-950/40 border border-emerald-500/20 p-5 rounded-2xl text-emerald-400 mb-5 shadow-glow-md animate-float">
                    <TreeDeciduous size={32} />
                  </div>
                  <h2 className="text-lg font-bold text-slate-100">Empty Family Tree</h2>
                  <p className="text-xs text-slate-400 max-w-sm mt-2 leading-relaxed">
                    This family tree doesn't have any members yet. Initialize it by adding the first root member.
                  </p>
                  <button
                    onClick={() => {
                      setModalMode('add_child');
                      setModalTargetId(null);
                      setModalOpen(true);
                    }}
                    className="btn-primary mt-6 text-xs px-5 py-2.5 flex items-center space-x-1.5 shadow-glow-sm"
                  >
                    <Plus size={14} />
                    <span>Create Root Member Node</span>
                  </button>
                </div>
              )}

              {/* Canvas viewport */}
              <Canvas
                rawNodes={filteredNodes}
                rawEdges={filteredEdges}
                userRole={userRole}
                activeUserId={user._id}
                onAddChild={handleAddChildClick}
                onAddSpouse={handleAddSpouseClick}
                onEditProfile={handleEditProfileClick}
                onCheckRelation={handleCheckRelationClick}
                onDeleteNode={handleDeleteNodeClick}
                searchQuery={searchQuery}
                relationSource={relationSource}
                relationTarget={relationTarget}
                onNodeClick={handleNodeClick}
                layoutDirection={layoutDirection}
                onViewImage={(url) => setPreviewImageUrl(url)}
                onViewCrossTree={handleViewCrossTree}
                descentHighlight={descentHighlight}
              />
              {graphCenterNodeId && (
                <button
                  onClick={() => {
                    setGraphCenterNodeId(null);
                    fetchGraph(null);
                  }}
                  className="absolute bottom-6 left-6 z-10 flex items-center space-x-1.5 bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-slate-100 font-semibold text-xs px-3.5 py-2 rounded-xl transition duration-350 active:scale-95 shadow-2xl cursor-pointer"
                >
                  <RefreshCw size={12} className="text-emerald-400" />
                  <span>Reset to Home Node</span>
                </button>
              )}
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 p-6">
              <div className="card p-8 max-w-md text-center flex flex-col items-center">
                <GitBranch size={36} className="text-slate-600 mb-4" />
                <h2 className="text-base font-bold text-slate-200">No Family Tree Selected</h2>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Select an existing family tree from the header or click "New Tree" to start building.
                </p>
              </div>
            </div>
          )}
          
        </div>
          </>
        )}
      </div>

      {/* 4. MODALS */}
      <NodeModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setModalMode(null); setModalTargetId(null); }}
        mode={modalMode}
        targetNodeId={modalTargetId}
        nodeData={modalMode === 'edit_profile' ? selectedNode : null}
        nodes={rawNodes}
        edges={rawEdges}
        trees={trees}
        treeId={activeTreeId}
        onSubmit={handleNodeSubmit}
      />

      <RolesModal
        isOpen={rolesModalOpen}
        onClose={() => {
          setRolesModalOpen(false);
          fetchGraph();
        }}
        nodes={rawNodes}
        treeId={activeTreeId}
        onSubmit={handleManageRole}
      />

      <NotificationViewModal
        isOpen={isNotificationModalOpen}
        onClose={() => {
          setIsNotificationModalOpen(false);
          setSelectedNotification(null);
        }}
        notification={selectedNotification}
        nodes={rawNodes}
      />



    </div>
  );
};

export default App;
