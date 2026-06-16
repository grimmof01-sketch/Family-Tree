import React from 'react';
import { Handle, Position } from 'reactflow';
import { User, Compass } from 'lucide-react';

const CustomNode = ({ data }) => {

  const {
    _id,
    name,
    gender,
    dob,
    bloodGroup,
    gotram,
    generationLevel,
    parity,
    profilePictureUrl,
    userRole,
    linkedUserId,
    onAddChild,
    onAddSpouse,
    onEditProfile,
    onCheckRelation,
    onDeleteNode,
    isSearched,
    isRelationSource,
    isRelationTarget,
    hasSpouse,
    isDeceased,
    dateOfDeath,
    onViewImage,
    crossTreeLinkId,
    onViewCrossTree,
    isCollapsed,
    hasChildren,
    onToggleCollapse,
  } = data;

  const isMale = gender === 1;

  // Calculate age from DOB (or age at death if deceased)
  const calculateAge = (dobString, dodString) => {
    if (!dobString) return null;
    const birthDate = new Date(dobString);
    const endDate = dodString ? new Date(dodString) : new Date();
    let age = endDate.getFullYear() - birthDate.getFullYear();
    const m = endDate.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && endDate.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const age = calculateAge(dob, isDeceased ? dateOfDeath : null);

  // Get initials for profile fallback
  const getInitials = (n) => {
    if (!n) return '?';
    return n.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase();
  };

  // Determine node styling based on state
  let containerClass = 'border-slate-800/80 bg-gradient-to-br from-slate-900/90 to-slate-950/90 shadow-slate-950/40';
  let accentColor = 'from-emerald-500 to-teal-500';
  
  if (isDeceased) {
    containerClass = 'border-slate-800/60 bg-gradient-to-br from-slate-950/95 to-slate-900/90 opacity-70';
    accentColor = 'from-slate-600 to-slate-700';
  } else if (isMale) {
    containerClass = 'border-blue-500/20 bg-gradient-to-br from-slate-900/95 to-blue-950/20 shadow-blue-950/20 hover:border-blue-500/40';
    accentColor = 'from-blue-500 to-indigo-500';
  } else {
    containerClass = 'border-pink-500/20 bg-gradient-to-br from-slate-900/95 to-pink-950/20 shadow-pink-950/20 hover:border-pink-500/40';
    accentColor = 'from-pink-500 to-rose-500';
  }

  if (isSearched) {
    containerClass = 'border-yellow-400/80 bg-gradient-to-br from-slate-900/90 to-yellow-950/20 shadow-xl ring-2 ring-yellow-400/20 scale-105';
  } else if (isRelationSource) {
    containerClass = 'border-emerald-500 bg-gradient-to-br from-slate-900/90 to-emerald-950/20 shadow-xl ring-2 ring-emerald-500/20 scale-105';
  } else if (isRelationTarget) {
    containerClass = 'border-purple-500 bg-gradient-to-br from-slate-900/90 to-purple-950/20 shadow-xl ring-2 ring-purple-500/20 scale-105';
  } else if (data.isRelationPath) {
    containerClass = 'border-amber-500 bg-gradient-to-br from-slate-900/90 to-amber-950/15 shadow-[0_0_15px_rgba(245,158,11,0.25)] ring-2 ring-amber-500/20';
  }

  // Avatar color scheme
  const avatarBg = isDeceased
    ? 'bg-slate-900 border-slate-800 text-slate-500'
    : isMale
    ? 'bg-blue-950/50 border-blue-500/20 text-blue-400'
    : 'bg-pink-950/50 border-pink-500/20 text-pink-400';

  const avatarBorder = isDeceased
    ? 'border-slate-800'
    : isMale
    ? 'border-blue-500/30'
    : 'border-pink-500/30';

  return (
    <div className={`relative px-3.5 py-2.5 rounded-2xl border text-slate-100 w-[220px] h-[95px] flex flex-col justify-between shadow-2xl backdrop-blur-md transition-all duration-300 select-none ${containerClass} ${isDeceased ? 'opacity-75' : 'hover:scale-[1.02]'}`}>
      
      {/* Top Accent Bar */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl bg-gradient-to-r ${accentColor} opacity-80`} />

      {/* Absolute Badge Indicators */}
      <div className="absolute top-2.5 right-2.5 flex space-x-1 z-10">
        {isDeceased && (
          <span className="px-1 py-[0.5px] text-[6px] font-extrabold bg-slate-800/80 text-slate-400 rounded border border-slate-700/60 uppercase tracking-wider">
            Dec.
          </span>
        )}
        {data.isCurrentUser && (
          <span className="px-1 py-[0.5px] text-[6px] font-extrabold bg-amber-500/20 text-amber-300 rounded border border-amber-500/35 uppercase tracking-wider">
            You
          </span>
        )}
      </div>

      {/* Handles for React Flow. Both source and target handles on all sides to allow flexible connections */}
      {/* Top Handle */}
      <Handle type="target" position={Position.Top} id="top-target" className="!bg-slate-500/60 !w-1.5 !h-1.5 !border-none" />
      <Handle type="source" position={Position.Top} id="top-source" className="!bg-slate-500/60 !w-1.5 !h-1.5 !opacity-0 !border-none" />

      {/* Bottom Handle */}
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="!bg-slate-500/60 !w-1.5 !h-1.5 !border-none" />
      <Handle type="target" position={Position.Bottom} id="bottom-target" className="!bg-slate-500/60 !w-1.5 !h-1.5 !opacity-0 !border-none" />

      {/* Left Handle */}
      <Handle type="target" position={Position.Left} id="left-target" className="!bg-slate-500/60 !w-1.5 !h-1.5 !border-none" />
      <Handle type="source" position={Position.Left} id="left-source" className="!bg-slate-500/60 !w-1.5 !h-1.5 !opacity-0 !border-none" />

      {/* Right Handle */}
      <Handle type="source" position={Position.Right} id="right-source" className="!bg-slate-500/60 !w-1.5 !h-1.5 !border-none" />
      <Handle type="target" position={Position.Right} id="right-target" className="!bg-slate-500/60 !w-1.5 !h-1.5 !opacity-0 !border-none" />
 
      {/* Main Info */}
      <div className="flex items-center space-x-2.5 mt-1">
        {profilePictureUrl ? (
          <img
            src={profilePictureUrl}
            alt={name}
            className={`w-9 h-9 rounded-full object-cover border-2 flex-shrink-0 cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200 shadow-md ${isDeceased ? 'grayscale border-slate-600/40' : avatarBorder}`}
            onClick={(e) => {
              e.stopPropagation();
              if (onViewImage) onViewImage(profilePictureUrl);
            }}
          />
        ) : (
          <div className={`w-9 h-9 rounded-full flex items-center justify-center border text-[10px] font-bold tracking-wider flex-shrink-0 ${avatarBg} ${isDeceased ? 'grayscale' : ''}`}>
            {getInitials(name)}
          </div>
        )}
 
        <div className="flex-1 min-w-0 pr-4">
          <h4 className="text-xs font-bold text-slate-100 truncate">
            {name}
          </h4>
          <p className="text-[10px] text-slate-500 flex items-center space-x-1 mt-0.5">
            <span className={`${isMale ? 'text-blue-400/70' : 'text-pink-400/70'}`}>{isMale ? 'Male' : 'Female'}</span>
            {age !== null && (
              <>
                <span className="text-slate-700">•</span>
                <span>{age} yrs{isDeceased ? ' (d.)' : ''}</span>
              </>
            )}
          </p>
        </div>
      </div>
      {crossTreeLinkId ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onViewCrossTree) onViewCrossTree(crossTreeLinkId);
          }}
          className="w-full py-1 text-[8px] font-bold bg-purple-950/40 text-purple-400 hover:bg-purple-950/60 border border-purple-500/20 hover:border-purple-500/40 rounded-lg flex items-center justify-center space-x-1 transition-all active:scale-95 cursor-pointer group"
        >
          <Compass size={10} className="group-hover:rotate-45 transition-transform duration-300" />
          <span>Check Family Tree</span>
        </button>
      ) : (
        <div className="flex items-center justify-center text-[8px] text-slate-400 px-1 border-t border-slate-800/40 pt-1 mt-1">
          <span className="flex items-center gap-1">
            <span className="text-slate-500">Blood Group:</span> <span className="font-semibold text-slate-300">{bloodGroup || 'N/A'}</span>
          </span>
        </div>
      )}
      
      {/* Collapse/Expand indicator for child branches */}
      {hasChildren && onToggleCollapse && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse(_id);
          }}
          className="absolute -bottom-2 left-[102px] z-10 w-4 h-4 bg-slate-900 border border-slate-800 text-[10px] font-black text-slate-400 hover:text-slate-200 hover:border-slate-650 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90 cursor-pointer select-none"
        >
          {isCollapsed ? '+' : '-'}
        </button>
      )}
    </div>
  );
};

export default CustomNode;
