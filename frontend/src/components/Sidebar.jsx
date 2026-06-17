import React, { useState, useEffect } from 'react';
import { Search, Filter, X, User, Heart, Compass, Smartphone, Calendar, Link as LinkIcon, Compass as CompassIcon, RefreshCw, Layers, GitBranch, Plus, Shield, LogOut, Trash2, Gift, Copy, Check } from 'lucide-react';
import { api } from '../utils/api';
import KinshipWalkthrough from './KinshipWalkthrough';

const Sidebar = ({
  nodes,
  selectedNode,
  searchQuery,
  onSearchChange,
  filters,
  onFilterChange,
  onResetFilters,
  relationSource,
  relationTarget,
  onClearRelation,
  onCheckRelation,
  relationResult,
  loadingRelation,

  // Mobile-only props
  trees = [],
  activeTreeId,
  onSelectTree,
  onCreateTree,
  onJoinTree,
  onAddNode,
  onOpenManageRoles,
  onDeleteTree,
  userRole,
  logout,
  pendingRequestsCount = 0,

  // Logs props
  logs = [],
  loadingLogs = false,
  fetchLogs,
  onRevertLog,

  // Notifications props
  notifications = [],
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onNotificationClick,
  hasNotificationAccess = false,
  onSelectNodesForTrace,
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState('members'); // 'members' | 'history' | 'academy' | 'notifications'
  const [copiedId, setCopiedId] = useState(false);

  // States for notification delivery logs
  const [deliveryLogs, setDeliveryLogs] = useState([]);
  const [loadingDeliveryLogs, setLoadingDeliveryLogs] = useState(false);
  const [eventsSubTab, setEventsSubTab] = useState('events'); // 'events' | 'logs'

  useEffect(() => {
    if (activeTab === 'history' && fetchLogs) {
      fetchLogs();
    }
  }, [activeTab, activeTreeId]);

  useEffect(() => {
    if (activeTab === 'notifications' && eventsSubTab === 'logs' && activeTreeId) {
      const fetchLogsData = async () => {
        setLoadingDeliveryLogs(true);
        try {
          const data = await api.kinship.getDeliveryLogs(activeTreeId);
          setDeliveryLogs(data || []);
        } catch (err) {
          console.error('Failed to load delivery logs:', err);
        } finally {
          setLoadingDeliveryLogs(false);
        }
      };
      fetchLogsData();
    }
  }, [activeTab, eventsSubTab, activeTreeId]);

  // Get unique list of gotrams and blood groups for select dropdowns
  const uniqueGotrams = [...new Set(nodes.map(n => n.gotram).filter(Boolean))];
  const uniqueBloodGroups = [...new Set(nodes.map(n => n.bloodGroup).filter(Boolean))];
  const uniqueGenerations = [...new Set(nodes.map(n => n.generationLevel))].sort((a, b) => a - b);

  // Calculate age from DOB
  const getAge = (dobString) => {
    if (!dobString) return 'N/A';
    const birthDate = new Date(dobString);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return `${age} years old`;
  };

  const getDobFormatted = (dobString) => {
    if (!dobString) return 'N/A';
    return new Date(dobString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleCopyId = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const activeTree = trees.find((t) => t._id === activeTreeId);
  const unreadCount = notifications ? notifications.filter(n => !n.isRead).length : 0;

  return (
    <div className="w-full md:w-80 glass-heavy border-r border-slate-700/20 flex flex-col h-full text-slate-200 overflow-y-auto shadow-2xl">

      {/* Mobile-only Tree Selector & Actions */}
      <div className="md:hidden p-4 border-b border-slate-700/20 bg-surface-1/40 space-y-3">
        <div className="flex items-center justify-between">
          <span className="section-label">Active Family Tree</span>
          {logout && (
            <button
              onClick={logout}
              className="text-slate-400 hover:text-red-400 p-1.5 bg-slate-800/30 border border-slate-700/20 rounded-lg flex items-center justify-center transition-all cursor-pointer active:scale-95"
              title="Log Out"
            >
              <LogOut size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <GitBranch size={13} className="text-slate-500 flex-shrink-0" />
          <select
            value={activeTreeId || ''}
            onChange={(e) => onSelectTree(e.target.value)}
            className="flex-1 bg-surface-1 border border-slate-700/30 text-slate-200 text-xs rounded-xl px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer"
          >
            <option value="" disabled>Select Family Tree</option>
            {trees.map((t) => (
              <option key={t._id} value={t._id}>
                {t.treeName}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onCreateTree}
            className="btn-primary flex items-center justify-center space-x-1.5 text-xs py-2"
          >
            <Plus size={12} />
            <span>New Tree</span>
          </button>

          <button
            onClick={onJoinTree}
            className="btn-secondary flex items-center justify-center space-x-1.5 text-xs py-2"
          >
            <GitBranch size={12} className="text-emerald-400" />
            <span>Join Tree</span>
          </button>

          {activeTree && (userRole === 'Admin' || userRole === 'Sub-Admin') && (
            <button
              onClick={onAddNode}
              className="btn-primary col-span-2 flex items-center justify-center space-x-1.5 text-xs py-2 animate-fade-in"
            >
              <Plus size={12} />
              <span>Add Member Node</span>
            </button>
          )}

          {activeTree && userRole === 'Admin' && (
            <>
              <button
                onClick={onOpenManageRoles}
                className="btn-secondary col-span-2 flex items-center justify-center space-x-1.5 text-xs py-2"
              >
                <Shield size={12} className="text-emerald-400" />
                <span>Access Roles</span>
              </button>
              <button
                onClick={onDeleteTree}
                className="btn-danger col-span-2 flex items-center justify-center space-x-1.5 text-xs py-2"
              >
                <Trash2 size={12} />
                <span>Delete Family Tree</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700/20 flex-shrink-0">
        <button
          onClick={() => setActiveTab('members')}
          className={`flex-1 py-3 text-[10px] uppercase tracking-wider font-extrabold border-b-2 transition-all duration-300 cursor-pointer ${activeTab === 'members'
              ? 'border-emerald-500 text-slate-200 bg-emerald-500/5'
              : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/20'
            }`}
        >
          Members
        </button>
        <button
          onClick={() => setActiveTab('academy')}
          className={`flex-1 py-3 text-[10px] uppercase tracking-wider font-extrabold border-b-2 transition-all duration-300 cursor-pointer ${activeTab === 'academy'
              ? 'border-emerald-500 text-slate-200 bg-emerald-500/5'
              : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/20'
            }`}
        >
          Academy 🎓
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-3 text-[10px] uppercase tracking-wider font-extrabold border-b-2 transition-all duration-300 cursor-pointer ${activeTab === 'history'
              ? 'border-emerald-500 text-slate-200 bg-emerald-500/5'
              : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/20'
            }`}
        >
          History
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`flex-1 py-3 text-[10px] uppercase tracking-wider font-extrabold border-b-2 transition-colors cursor-pointer relative ${activeTab === 'notifications'
              ? 'border-emerald-500 text-slate-200 bg-emerald-950/10'
              : 'border-transparent text-slate-500 hover:text-slate-350 hover:bg-slate-900/20'
            }`}
        >
          <span>Events</span>
          {unreadCount > 0 && (
            <span className="absolute top-2.5 right-0.5 bg-emerald-500 text-slate-950 text-[8px] font-extrabold px-1 rounded-full leading-none">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'members' && (
        <>
          {/* 1. SEARCH & FILTERS SECTION */}
          <div className="p-4 border-b border-slate-700/20 space-y-3">
            <div className="relative group">
              <Search size={15} className="absolute left-3.5 top-[11px] text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
              <input
                type="text"
                placeholder="Search family members..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="input-field pl-10 pr-8 py-2.5 text-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center space-x-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all duration-200 cursor-pointer ${showFilters || Object.values(filters).some(Boolean)
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-slate-800/30 border-slate-700/30 text-slate-400 hover:text-slate-200 hover:border-slate-600/40'
                  }`}
              >
                <Filter size={11} />
                <span>Filters</span>
                {Object.values(filters).some(Boolean) && (
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                )}
              </button>

              {Object.values(filters).some(Boolean) && (
                <button
                  onClick={onResetFilters}
                  className="text-[11px] text-red-400 hover:text-red-300 flex items-center space-x-1 transition-colors cursor-pointer"
                >
                  <RefreshCw size={10} />
                  <span>Reset</span>
                </button>
              )}
            </div>

            {/* Filter Details Accordion */}
            {showFilters && (
              <div className="bg-surface-1/60 border border-slate-700/20 p-3.5 rounded-xl space-y-3 animate-fade-in-down">
                {/* Gotram Filter */}
                <div>
                  <label className="section-label block mb-1.5">Gotram</label>
                  <select
                    value={filters.gotram}
                    onChange={(e) => onFilterChange('gotram', e.target.value)}
                    className="input-field text-xs py-1.5 cursor-pointer"
                  >
                    <option value="">All Gotrams</option>
                    {uniqueGotrams.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                {/* Blood Group Filter */}
                <div>
                  <label className="section-label block mb-1.5">Blood Group</label>
                  <select
                    value={filters.bloodGroup}
                    onChange={(e) => onFilterChange('bloodGroup', e.target.value)}
                    className="input-field text-xs py-1.5 cursor-pointer"
                  >
                    <option value="">All Blood Groups</option>
                    {uniqueBloodGroups.map(bg => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>

                {/* Generation Level Filter */}
                <div>
                  <label className="section-label block mb-1.5">Generation Level</label>
                  <select
                    value={filters.generationLevel}
                    onChange={(e) => onFilterChange('generationLevel', e.target.value)}
                    className="input-field text-xs py-1.5 cursor-pointer"
                  >
                    <option value="">All Generations</option>
                    {uniqueGenerations.map(gen => (
                      <option key={gen} value={gen}>Generation {gen}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* 2. TREE INFORMATION SECTION */}
          {activeTree && (
            <div className="p-4 border-b border-slate-700/20 space-y-3 bg-surface-1/20 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="section-label">Tree Information</span>
                <span className={`badge ${userRole === 'Admin'
                    ? 'badge-admin'
                    : userRole === 'Sub-Admin'
                      ? 'badge-subadmin'
                      : 'badge-standard'
                  }`}>
                  {userRole || 'Viewer'}
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="section-label block mb-0.5">Tree Name</span>
                  <span className="text-slate-200 block font-bold text-sm">{activeTree.treeName}</span>
                </div>

                <div>
                  <span className="section-label block mb-1">Tree ID</span>
                  <div className="flex items-center space-x-1.5 bg-surface-1/60 p-2 rounded-xl border border-slate-700/20">
                    <span className="font-mono text-[10px] text-slate-400 truncate flex-1 select-all">{activeTree._id}</span>
                    <button
                      onClick={() => handleCopyId(activeTree._id)}
                      className="flex items-center space-x-1 px-2 py-0.5 bg-slate-800/50 border border-slate-700/30 text-[9px] text-emerald-400 font-bold rounded-lg hover:bg-slate-700/50 active:scale-95 cursor-pointer transition-all"
                    >
                      {copiedId ? <Check size={9} /> : <Copy size={9} />}
                      <span>{copiedId ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div>
                  <span className="section-label block mb-0.5">Creator</span>
                  <span className="text-slate-400 block truncate" title={activeTree.createdBy?.email || 'N/A'}>
                    {activeTree.createdBy?.email || 'N/A'}
                  </span>
                </div>

                {activeTree.admins && activeTree.admins.length > 0 && (
                  <div>
                    <span className="section-label block mb-0.5">Admins</span>
                    <span className="text-slate-400 block truncate" title={activeTree.admins.map(a => a.email).join(', ')}>
                      {activeTree.admins.map(a => a.email).join(', ')}
                    </span>
                  </div>
                )}

                <div>
                  <span className="section-label block mb-0.5">Created At</span>
                  <span className="text-slate-400 block">
                    {activeTree.createdAt ? new Date(activeTree.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    }) : 'N/A'}
                  </span>
                </div>

                {userRole === 'Admin' && pendingRequestsCount > 0 && (
                  <div className="bg-emerald-500/8 border border-emerald-500/15 p-3 rounded-xl flex items-center justify-between text-xs text-emerald-400 mt-2 animate-pulse">
                    <span className="font-semibold">{pendingRequestsCount} Pending Request(s)</span>
                    <button
                      onClick={onOpenManageRoles}
                      className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 text-[10px] font-bold active:scale-95 cursor-pointer transition-colors"
                    >
                      Review
                    </button>
                  </div>
                )}

                {userRole === 'Admin' && (
                  <div className="pt-2.5 border-t border-slate-700/20 mt-2 flex justify-end">
                    <button
                      onClick={onDeleteTree}
                      className="btn-danger flex items-center space-x-1.5 text-[11px] font-bold px-3 py-2"
                    >
                      <Trash2 size={12} />
                      <span>Delete Family Tree</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'history' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-4 border-b border-slate-700/20 flex items-center justify-between flex-shrink-0">
            <span className="section-label">Activity History</span>
            <button
              onClick={fetchLogs}
              disabled={loadingLogs}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center space-x-1 cursor-pointer disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={10} className={loadingLogs ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="p-4 space-y-2.5 overflow-y-auto flex-1 custom-scrollbar">
            {loadingLogs ? (
              <div className="text-center py-12 space-y-3">
                <RefreshCw size={20} className="animate-spin text-slate-600 mx-auto" />
                <p className="text-xs text-slate-500">Loading activity history...</p>
              </div>
            ) : !logs || logs.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <Layers size={24} className="text-slate-700 mx-auto" />
                <p className="text-xs text-slate-500">No activity logs recorded yet.</p>
              </div>
            ) : (
              logs.map((log) => {
                const canRevert = (userRole === 'Admin' || userRole === 'Sub-Admin') && !log.isReverted;
                return (
                  <div
                    key={log._id}
                    className={`p-3 rounded-xl border text-xs space-y-2 transition-all duration-200 ${log.isReverted
                        ? 'bg-surface-1/20 border-slate-800/30 opacity-50'
                        : 'bg-slate-800/20 border-slate-700/20 hover:border-slate-600/30'
                      }`}
                  >
                    <div className="flex items-start justify-between space-x-2">
                      <p className="font-semibold text-slate-200 leading-snug">{log.description}</p>
                      {log.isReverted && (
                        <span className="badge bg-slate-800/60 border-slate-700/30 text-slate-500 flex-shrink-0">
                          Reverted
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>By: {log.userName}</span>
                      <span>{new Date(log.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}</span>
                    </div>

                    {canRevert && onRevertLog && (
                      <button
                        onClick={() => onRevertLog(log._id)}
                        className="btn-danger w-full py-1.5 text-[10px] font-bold mt-1"
                      >
                        Revert Change
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'academy' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          <KinshipWalkthrough
            nodes={nodes}
            onSelectNodesForTrace={onSelectNodesForTrace}
            onClose={() => setActiveTab('members')}
          />
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Sub-tabs header */}
          <div className="flex bg-slate-950/40 p-1 border-b border-slate-900/80 flex-shrink-0">
            <button
              onClick={() => setEventsSubTab('events')}
              className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                eventsSubTab === 'events'
                  ? 'bg-slate-800 text-slate-100 border border-slate-700/30'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              📅 Events
            </button>
            <button
              onClick={() => setEventsSubTab('logs')}
              className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                eventsSubTab === 'logs'
                  ? 'bg-slate-800 text-slate-100 border border-slate-700/30'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              💬 SMS / Email Logs
            </button>
          </div>

          {eventsSubTab === 'events' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-4 border-b border-slate-900 flex items-center justify-between flex-shrink-0">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Upcoming & Recent Events</span>
                {unreadCount > 0 && onMarkAllNotificationsRead && (
                  <button
                    onClick={onMarkAllNotificationsRead}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Mark all as read
                  </button>
                )}
              </div>

              <div className="p-4 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
                {!hasNotificationAccess ? (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-4 rounded-2xl text-center">
                    Access Denied: You must be an Admin or have a linked member profile to view notifications in this tree.
                  </div>
                ) : !notifications || notifications.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500">
                    No events in the next 30 days.
                  </div>
                ) : (
                  notifications.map((notif) => {
                    const isAnniversary = notif.type === 'anniversary';
                    const isBirthday = notif.type === 'birthday';

                    const eventDateFormatted = new Date(notif.eventDate).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric'
                    });

                    return (
                      <div
                        key={notif._id}
                        onClick={() => onNotificationClick && onNotificationClick(notif)}
                        className={`p-3 rounded-xl border text-xs flex items-start space-x-3 transition-all cursor-pointer relative ${notif.isRead
                            ? 'bg-slate-950/20 border-slate-900/60 opacity-70 hover:opacity-100 hover:border-slate-800'
                            : 'bg-slate-900 border-slate-800 hover:border-emerald-500/30 shadow-md shadow-slate-950/20'
                          }`}
                      >
                        {!notif.isRead && (
                          <span className="absolute top-3.5 right-3.5 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        )}

                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${isBirthday ? 'bg-emerald-500/10 text-emerald-400' :
                            isAnniversary ? 'bg-pink-500/10 text-pink-400' :
                              'bg-rose-500/10 text-rose-400'
                          }`}>
                          {isBirthday ? <Gift size={16} /> :
                            isAnniversary ? <Heart size={16} /> :
                              <Shield size={16} />}
                        </div>

                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-200 truncate">{notif.title}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{notif.message}</p>

                          <div className="flex items-center justify-between mt-2.5">
                            <span className="text-[9px] font-bold text-slate-500 uppercase">{eventDateFormatted}</span>
                            {!notif.isRead && onMarkNotificationRead && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onMarkNotificationRead(notif._id);
                                }}
                                className="text-[9px] font-extrabold text-emerald-400 hover:text-emerald-300 uppercase tracking-widest bg-slate-950/60 px-2 py-0.5 rounded-md border border-slate-800 hover:border-emerald-500/20"
                              >
                                Mark Read
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {eventsSubTab === 'logs' && (
            <div className="p-4 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
              {loadingDeliveryLogs ? (
                <div className="text-center py-12 space-y-3">
                  <RefreshCw size={20} className="animate-spin text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-500">Loading delivery logs...</p>
                </div>
              ) : !deliveryLogs || deliveryLogs.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-500">
                  No automated alerts have been sent or simulated yet.
                </div>
              ) : (
                deliveryLogs.map((log) => {
                  const isFailed = log.status === 'failed';
                  const isSent = log.status === 'sent';

                  return (
                    <div
                      key={log._id}
                      className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl text-xs space-y-2 hover:border-slate-700 transition-all duration-250"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex gap-1.5 items-center">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide ${
                            log.channel === 'Twilio'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/25'
                              : log.channel === 'SendGrid'
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/25'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}>
                            {log.channel}
                          </span>
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide ${
                            isFailed
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
                              : isSent
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                              : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25'
                          }`}>
                            {log.status}
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-500">
                          {new Date(log.sentAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <p className="font-semibold text-slate-200">{log.recipientName} ({log.recipientContact})</p>
                        <p className="text-slate-300 font-medium text-[11px]">{log.title}</p>
                        <p className="text-slate-400 text-[10px] leading-relaxed italic">"{log.message}"</p>
                        {isFailed && log.error && (
                          <p className="text-rose-400 text-[9px] bg-rose-950/20 p-1.5 rounded-lg border border-rose-900/30">
                            Error: {log.error}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Sidebar;
