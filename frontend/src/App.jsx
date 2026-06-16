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
  Trash2,
  Share2
} from 'lucide-react';

// Helper to generate and download a gorgeous high-fidelity member profile card image
const handleShareCard = async (node) => {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 350;
  const ctx = canvas.getContext('2d');

  // 1. Background Gradient
  const grad = ctx.createLinearGradient(0, 0, 600, 350);
  grad.addColorStop(0, '#0f172a'); // slate-900
  grad.addColorStop(1, '#020617'); // slate-950
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 600, 350);

  // 2. Card Accent border / glow
  const isMale = node.gender === 1;
  ctx.strokeStyle = isMale ? 'rgba(59, 130, 246, 0.25)' : 'rgba(236, 72, 153, 0.25)';
  ctx.lineWidth = 4;
  ctx.strokeRect(12, 12, 576, 326);

  // Decorative header line
  const accentGrad = ctx.createLinearGradient(12, 0, 588, 0);
  if (isMale) {
    accentGrad.addColorStop(0, '#3b82f6');
    accentGrad.addColorStop(1, '#6366f1');
  } else {
    accentGrad.addColorStop(0, '#ec4899');
    accentGrad.addColorStop(1, '#f43f5e');
  }
  ctx.fillStyle = accentGrad;
  ctx.fillRect(12, 12, 576, 4);

  // 3. Draw Watermark/Logo
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.font = '900 10px sans-serif';
  ctx.fillText('SANGAM ROOTS FAMILY TREE', 35, 45);

  // 4. Draw Avatar Profile Image (or Fallback initials)
  const drawAvatar = () => {
    return new Promise((resolve) => {
      if (node.profilePictureUrl) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          ctx.save();
          // Draw circular clip
          ctx.beginPath();
          ctx.arc(100, 180, 55, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(img, 45, 125, 110, 110);
          ctx.restore();

          // Border ring
          ctx.strokeStyle = isMale ? '#3b82f6' : '#ec4899';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(100, 180, 55, 0, Math.PI * 2);
          ctx.stroke();
          resolve();
        };
        img.onerror = () => {
          drawInitialsFallback();
          resolve();
        };
        img.src = node.profilePictureUrl;
      } else {
        drawInitialsFallback();
        resolve();
      }
    });
  };

  const drawInitialsFallback = () => {
    ctx.fillStyle = isMale ? 'rgba(59, 130, 246, 0.15)' : 'rgba(236, 72, 153, 0.15)';
    ctx.beginPath();
    ctx.arc(100, 180, 55, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = isMale ? 'rgba(59, 130, 246, 0.3)' : 'rgba(236, 72, 153, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(100, 180, 55, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = isMale ? '#60a5fa' : '#f472b6';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const initials = node.name ? node.name.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase() : '?';
    ctx.fillText(initials, 100, 180);
  };

  await drawAvatar();

  // 5. Draw Member Details
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(node.name || 'Unknown', 185, 135);

  // Role/Gender/Gen Info
  ctx.fillStyle = '#94a3b8'; // slate-400
  ctx.font = '11px sans-serif';
  const genderStr = isMale ? 'Male' : 'Female';
  ctx.fillText(`${genderStr}  •  Generation Level ${node.generationLevel}`, 185, 160);

  // Divider line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(185, 180);
  ctx.lineTo(540, 180);
  ctx.stroke();

  // Detail Fields (Date of Birth, Blood Group, Gotram)
  ctx.fillStyle = '#64748b'; // slate-500
  ctx.font = 'bold 8.5px sans-serif';
  ctx.fillText('DATE OF BIRTH', 185, 210);
  ctx.fillText('BLOOD GROUP', 315, 210);
  ctx.fillText('GOTRAM', 445, 210);

  ctx.fillStyle = '#cbd5e1'; // slate-300
  ctx.font = 'bold 12px sans-serif';
  
  const getDobFormatted = (dobString) => {
    if (!dobString) return 'N/A';
    const d = new Date(dobString);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  
  ctx.fillText(getDobFormatted(node.dob), 185, 232);
  ctx.fillText(node.bloodGroup || 'N/A', 315, 232);
  ctx.fillText(node.gotram || 'N/A', 445, 232);

  // Footer / Lineage watermark
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.font = 'italic 9.5px sans-serif';
  ctx.fillText('Generated from Sangam Roots Family Tree Application', 185, 285);

  // 6. Download Trigger
  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = `${node.name.replace(/\s+/g, '_')}_Profile_Card.png`;
  link.href = dataUrl;
  link.click();
};

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

  // Auto-close sidebar on mobile when active tree changes
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [activeTreeId]);

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
    }
  }, [activeTreeId]);

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
      setError('Failed to load tree graph data');
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
    try {
      await api.kinship.deleteEdge(activeTreeId, sourceNodeId, targetNodeId, relationshipType);
      alert('Relationship removed successfully!');
      fetchGraph();
    } catch (err) {
      alert(err.message || 'Failed to remove relationship');
    }
  };

  // Node submissions handler
  const handleNodeSubmit = async (data) => {
    if (!activeTreeId) return;
    
    if (modalMode === 'add_child') {
      if (data.modeType === 'existing_child') {
        await api.kinship.createParentChild(activeTreeId, data.parentId, data.childId);
      } else {
        await api.kinship.createNode(activeTreeId, data);
      }
    } else if (modalMode === 'add_parent') {
      if (data.modeType === 'existing_parent') {
        await api.kinship.createParentChild(activeTreeId, data.parentId, data.childId);
      } else {
        await api.kinship.createNode(activeTreeId, data);
      }
    } else if (modalMode === 'add_spouse') {
      if (data.modeType === 'existing') {
        // Link pre-existing nodes in marriage
        await api.kinship.createMarriage(activeTreeId, data.targetNodeId, data.spouseNodeId);
      } else if (data.modeType === 'cross_tree') {
        // Link cross-tree node
        await api.kinship.createSpouse(activeTreeId, {
          existingNodeId: data.targetNodeId,
          crossTreeNodeId: data.crossTreeNodeId
        });
      } else {
        // Create new spouse node
        await api.kinship.createSpouse(activeTreeId, data);
      }
    } else if (modalMode === 'edit_profile') {
      await api.kinship.updateNode(activeTreeId, modalTargetId, data);
      // If the currently selected node was edited, update selectedNode profile view
      if (selectedNode && selectedNode._id === modalTargetId) {
        setSelectedNode(prev => ({ ...prev, ...data }));
      }
    }
    
    // Refresh graph
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

    try {
      await api.kinship.deleteNode(activeTreeId, id);
      if (selectedNode && selectedNode._id === id) {
        setSelectedNode(null);
      }
      if (relationSource && relationSource._id === id) setRelationSource(null);
      if (relationTarget && relationTarget._id === id) setRelationTarget(null);
      fetchGraph();
    } catch (err) {
      alert(err.message || 'Failed to delete node');
    }
  };

  const handleCheckRelationClick = (id, roleType) => {
    const node = rawNodes.find(n => n._id === id);
    if (roleType === 'source') {
      setRelationSource(node);
      setRelationResult(null); // Clear old results
    } else {
      setRelationTarget(node);
      setRelationResult(null); // Clear old results
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
  };

  // Calculate kinship terms
  const handleCheckRelation = async () => {
    if (!activeTreeId || !relationSource || !relationTarget) return;
    setLoadingRelation(true);
    try {
      const data = await api.kinship.getRelation(activeTreeId, relationSource._id, relationTarget._id);
      setRelationResult(data);
    } catch (err) {
      alert(err.message || 'Error computing relation path');
    } finally {
      setLoadingRelation(false);
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
        {currentView === 'profile' ? (
          <Profile />
        ) : currentView === 'superadmin' ? (
          <SuperAdminDashboard />
        ) : (
          <>
        
        {/* 2. SIDEBAR (Collapsible drawer on mobile, side panel on desktop) */}
        <div 
          className={`
            fixed md:relative top-[60px] md:top-0 left-0 z-20 md:z-auto h-[calc(100vh-60px)] md:h-auto 
            transition-transform duration-300 ease-in-out md:translate-x-0 flex flex-col flex-shrink-0
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
          />
        </div>

        {/* Mobile Sidebar overlay backdrop */}
        {mobileSidebarOpen && (
          <div 
            onClick={() => setMobileSidebarOpen(false)}
            className="md:hidden fixed inset-0 bg-surface-0/60 backdrop-blur-sm z-10 top-[60px] cursor-pointer"
          />
        )}

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
                const isMale = selectedNode.gender === 1;
                const initials = selectedNode.name ? selectedNode.name.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase() : '?';

                let containerBorder = 'border-slate-800/80 bg-gradient-to-br from-slate-900/95 to-slate-950/95 shadow-slate-950/50';
                let accentColor = 'from-emerald-500 to-teal-500';
                if (selectedNode.isDeceased) {
                  containerBorder = 'border-slate-850 bg-gradient-to-br from-slate-950/95 to-slate-900/90';
                  accentColor = 'from-slate-600 to-slate-700';
                } else if (isMale) {
                  containerBorder = 'border-blue-500/20 bg-gradient-to-br from-slate-950 via-slate-950 to-blue-950/15 hover:border-blue-500/30';
                  accentColor = 'from-blue-500 to-indigo-500';
                } else {
                  containerBorder = 'border-pink-500/20 bg-gradient-to-br from-slate-950 via-slate-950 to-pink-950/15 hover:border-pink-500/30';
                  accentColor = 'from-pink-500 to-rose-500';
                }

                return (
                  <div className={`absolute top-[88px] right-4 z-10 w-[calc(100vw-32px)] sm:w-80 border rounded-3xl p-5 shadow-2xl animate-slide-in-right text-slate-200 backdrop-blur-xl transition-all duration-300 ${containerBorder}`}>
                    
                    {/* Top Accent Gradient Bar */}
                    <div className={`absolute top-0 left-0 right-0 h-[3px] rounded-t-3xl bg-gradient-to-r ${accentColor} opacity-90`} />

                    <div className="flex items-center justify-between pb-3 border-b border-slate-800/40 mb-4">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Member Profile</span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleShareCard(selectedNode)}
                          className="text-slate-400 hover:text-slate-100 p-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl transition-all active:scale-95 cursor-pointer flex items-center space-x-1"
                          title="Download Profile Card Image"
                        >
                          <Share2 size={12} />
                          <span className="text-[9px] font-bold">Card</span>
                        </button>
                        <button
                          onClick={() => setSelectedNode(null)}
                          className="text-slate-500 hover:text-slate-200 p-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl transition-all active:scale-95 cursor-pointer"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Avatar & Header */}
                      <div className="flex items-center space-x-3.5">
                        {selectedNode.profilePictureUrl ? (
                          <img
                            src={selectedNode.profilePictureUrl}
                            alt={selectedNode.name}
                            className={`w-12 h-12 rounded-full object-cover border-2 cursor-pointer hover:scale-105 active:scale-95 transition-transform duration-200 shadow-md ${selectedNode.isDeceased ? 'grayscale border-slate-700' : (isMale ? 'border-blue-500/30' : 'border-pink-500/30')}`}
                            onClick={() => setPreviewImageUrl(selectedNode.profilePictureUrl)}
                          />
                        ) : (
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center border border-dashed text-xs font-bold tracking-wider shadow-md ${
                            selectedNode.isDeceased ? 'bg-slate-905 border-slate-800 text-slate-500 grayscale' :
                            (isMale ? 'bg-blue-950/60 border-blue-500/20 text-blue-400' : 'bg-pink-950/60 border-pink-500/20 text-pink-400')
                          }`}>
                            {initials}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-bold text-slate-100 leading-snug break-words flex flex-wrap items-center gap-1.5">
                            <span>{selectedNode.name}</span>
                            {selectedNode.isDeceased && (
                              <span className="px-1.5 py-0.5 text-[7px] font-extrabold bg-slate-800 text-slate-400 rounded-md border border-slate-700 flex-shrink-0 uppercase tracking-wide">
                                Dec.
                              </span>
                            )}
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {isMale ? 'Male' : 'Female'} • Gen Level {selectedNode.generationLevel}
                          </p>
                        </div>
                      </div>

                      {/* Profile fields */}
                      <div className="space-y-3 pt-3.5 border-t border-slate-800/40 text-xs">
                        <div className="flex items-start space-x-2.5">
                          <Calendar size={13} className="text-slate-500 mt-0.5" />
                          <div>
                            <span className="text-[10px] text-slate-500 block leading-none font-bold uppercase tracking-wider">Date of Birth</span>
                            <span className="text-slate-350 block mt-0.5">{getDobFormatted(selectedNode.dob)} ({getAge(selectedNode.dob, selectedNode.dateOfDeath, selectedNode.isDeceased)})</span>
                          </div>
                        </div>

                        {selectedNode.isDeceased && (
                          <div className="flex items-start space-x-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
                            <Calendar size={13} className="text-rose-500 mt-0.5" />
                            <div>
                              <span className="text-[10px] text-rose-400 block leading-none font-bold uppercase tracking-wider">Date of Death</span>
                              <span className="text-slate-350 block mt-0.5">{getDobFormatted(selectedNode.dateOfDeath)}</span>
                            </div>
                          </div>
                        )}

                        <div className="flex items-start space-x-2.5">
                          <Compass size={13} className="text-slate-500 mt-0.5" />
                          <div>
                            <span className="text-[10px] text-slate-500 block leading-none font-bold uppercase tracking-wider">Gotram</span>
                            <span className="text-slate-355 block mt-0.5">{selectedNode.gotram || 'N/A'}</span>
                          </div>
                        </div>

                        <div className="flex items-start space-x-2.5">
                          <Heart size={13} className="text-slate-500 mt-0.5" />
                          <div>
                            <span className="text-[10px] text-slate-500 block leading-none font-bold uppercase tracking-wider">Blood Group</span>
                            <span className="text-slate-355 block mt-0.5">{selectedNode.bloodGroup || 'N/A'}</span>
                          </div>
                        </div>

                        <div className="flex items-start space-x-2.5">
                          <Smartphone size={13} className="text-slate-500 mt-0.5" />
                          <div className="flex-1">
                            <span className="text-[10px] text-slate-500 block leading-none font-bold uppercase tracking-wider">Mobile Number</span>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-slate-355 block">{selectedNode.mobileNumber || 'N/A'}</span>
                              {selectedNode.mobileNumber && (() => {
                                const cleanNumber = selectedNode.mobileNumber.replace(/[^\d]/g, '');
                                if (!cleanNumber) return null;
                                const prefilledText = encodeURIComponent(`Hello${selectedNode.name ? ' ' + selectedNode.name : ''}, reaching out to you from Sangam Roots Family Tree!`);
                                const waUrl = `https://wa.me/${cleanNumber}?text=${prefilledText}`;
                                
                                return (
                                  <a
                                    href={waUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center space-x-1 px-2.5 py-1 bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-500/20 hover:border-emerald-500/40 text-[9.5px] text-emerald-400 font-extrabold rounded-lg hover:scale-102 transition-all active:scale-95 cursor-pointer ml-2"
                                    title="Chat on WhatsApp"
                                  >
                                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.488 1.459 5.407 1.46h.007c5.432 0 9.854-4.41 9.857-9.843.002-2.63-1.023-5.102-2.886-6.968C17.168 1.836 14.697.813 12.011.813c-5.437 0-9.859 4.41-9.862 9.843-.001 1.93.501 3.818 1.456 5.416l-.995 3.637 3.737-.98c1.61.877 3.415 1.341 5.25 1.343zm10.374-7.04c-.29-.145-1.713-.845-1.978-.942-.266-.097-.459-.145-.652.145-.193.29-.748.942-.917 1.135-.168.193-.337.217-.627.072-1.09-.546-1.819-1.02-2.541-2.262-.165-.284.165-.264.472-.876.085-.17.042-.317-.02-.462-.063-.146-.541-1.304-.741-1.787-.195-.47-.393-.404-.541-.412-.139-.007-.3-.008-.461-.008-.162 0-.427.06-.65.302-.224.24-.855.835-.855 2.036 0 1.2.875 2.36 1.0 2.528.123.167 1.723 2.63 4.174 3.687.583.25 1.038.4 1.393.513.585.186 1.118.16 1.539.097.47-.07 1.712-.7 1.953-1.376.24-.678.24-1.258.17-1.377-.073-.119-.265-.192-.556-.338z"/>
                                    </svg>
                                    <span>WhatsApp</span>
                                  </a>
                                );
                              })()}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-start space-x-2.5">
                          <Mail size={13} className="text-slate-500 mt-0.5" />
                          <div>
                            <span className="text-[10px] text-slate-500 block leading-none font-bold uppercase tracking-wider">Email Address</span>
                            <span className="text-slate-355 block mt-0.5">{selectedNode.email || 'N/A'}</span>
                          </div>
                        </div>

                        {selectedNode.socialLinks && selectedNode.socialLinks.length > 0 && (
                          <div className="flex items-start space-x-2.5">
                            <Link2 size={13} className="text-slate-500 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <span className="text-[10px] text-slate-500 block leading-none font-bold uppercase tracking-wider mb-1">Social Profiles</span>
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

                        <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-850 flex justify-between items-center text-[10px] font-mono mt-2 shadow-inner">
                          <span className="text-slate-400 font-bold uppercase tracking-wider">Kinship Parity</span>
                          <span className={`px-2 py-0.5 rounded-md font-extrabold tracking-wider ${selectedNode.parity === 1 ? 'bg-indigo-950 text-indigo-400 border border-indigo-500/20' : 'bg-amber-950 text-amber-400 border border-amber-500/20'}`}>
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

                      {/* Calculate Button */}
                      {!relationResult && (
                        <button
                          onClick={handleCheckRelation}
                          disabled={loadingRelation}
                          className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs py-2 rounded-xl shadow-lg transition-all duration-300 active:scale-98 disabled:opacity-50 cursor-pointer"
                        >
                          {loadingRelation ? 'Computing Relationship Path...' : 'Check Relationship'}
                        </button>
                      )}

                      {/* Relationship Result & Lineage Path */}
                      {relationResult && (
                        <div className="bg-emerald-950/20 border border-emerald-500/20 p-3 rounded-xl space-y-2.5 animate-in zoom-in-95 duration-150">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-[9px] uppercase tracking-wider text-slate-500 block font-bold leading-none">Relationship Term</span>
                              <span className="text-sm font-extrabold text-emerald-400 block mt-1">{relationResult.term}</span>
                            </div>
                            <button
                              onClick={handleCheckRelation}
                              disabled={loadingRelation}
                              className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 text-[10px] font-semibold rounded-lg hover:bg-slate-800 transition-colors"
                            >
                              Recalculate
                            </button>
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
                selectedNode={selectedNode}
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
