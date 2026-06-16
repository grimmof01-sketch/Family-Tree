import React, { useMemo, useEffect, useState, useRef } from 'react';
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import dagre from 'dagre';
import CustomNode from './CustomNode';
import 'reactflow/dist/style.css';

// BFS to find the path of node and edge IDs connecting source and target
const findRelationshipPath = (nodes, edges, sourceId, targetId) => {
  if (!sourceId || !targetId || sourceId === targetId) return { nodeIds: [], edgeIds: [] };
  
  const adj = {};
  edges.forEach(edge => {
    const u = edge.sourceNodeId;
    const v = edge.targetNodeId;
    if (!adj[u]) adj[u] = [];
    if (!adj[v]) adj[v] = [];
    adj[u].push({ neighbor: v, edgeId: edge._id });
    adj[v].push({ neighbor: u, edgeId: edge._id });
  });

  const queue = [sourceId];
  const visited = new Set([sourceId]);
  const parentMap = {};

  while (queue.length > 0) {
    const curr = queue.shift();
    if (curr === targetId) {
      const pathNodeIds = [];
      const pathEdgeIds = [];
      let step = targetId;
      while (step !== sourceId) {
        pathNodeIds.push(step);
        const parentInfo = parentMap[step];
        if (parentInfo) {
          pathEdgeIds.push(parentInfo.edgeId);
          step = parentInfo.parentId;
        } else {
          break;
        }
      }
      pathNodeIds.push(sourceId);
      return { nodeIds: pathNodeIds, edgeIds: pathEdgeIds };
    }

    const neighbors = adj[curr] || [];
    for (const { neighbor, edgeId } of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        parentMap[neighbor] = { parentId: curr, edgeId };
        queue.push(neighbor);
      }
    }
  }

  return { nodeIds: [], edgeIds: [] };
};

// BFS/DFS to find all descendants of collapsed nodes
const getHiddenNodeIds = (nodes, edges, collapsedNodeIds) => {
  const hidden = new Set();
  if (!collapsedNodeIds || collapsedNodeIds.size === 0) return hidden;

  const childrenMap = {};
  edges.forEach(edge => {
    if (edge.relationshipType === 'parent_child') {
      const parent = edge.sourceNodeId;
      const child = edge.targetNodeId;
      if (!childrenMap[parent]) childrenMap[parent] = [];
      childrenMap[parent].push(child);
    }
  });

  const stack = [...collapsedNodeIds];
  const visited = new Set();
  
  while (stack.length > 0) {
    const curr = stack.pop();
    if (visited.has(curr)) continue;
    visited.add(curr);

    const children = childrenMap[curr] || [];
    children.forEach(child => {
      hidden.add(child);
      stack.push(child);
    });
  }

  return hidden;
};

// Register custom node types
const nodeTypes = {
  kinshipNode: CustomNode,
};

// Dagre layout helper function
const getLayoutedElements = (nodes, edges, direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  // Set layout options to guarantee exactly half a node's length (~100px) of space between node borders
  // TB = Top to Bottom (horizontal generations), LR = Left to Right (vertical generations)
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 100, // Horizontal separation between adjacent nodes
    ranksep: 100, // Vertical separation between parent/child ranks
  });
 
  // Add nodes to dagre graph with actual visual sizes
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 220, height: 95 });
  });
 
  // Add edges to dagre graph
  edges.forEach((edge) => {
    const isSpouse = edge.relationshipType === 'spouse';
    
    // Check if these spouses share a child in the edges list
    let shareChild = false;
    if (isSpouse) {
      // Find all children of source
      const sourceChildren = edges.filter(e => e.relationshipType !== 'spouse' && e.source === edge.source).map(e => e.target);
      // Find all children of target
      const targetChildren = edges.filter(e => e.relationshipType !== 'spouse' && e.source === edge.target).map(e => e.target);
      // Check if there is any common child
      shareChild = sourceChildren.some(child => targetChildren.includes(child));
    }
    
    // If they are spouses and share a child, do NOT add this edge to Dagre.
    // Their shared parent-child connections are sufficient to position them next to each other.
    // This avoids overlapping conflicts in the Dagre layout solver.
    if (isSpouse && shareChild) {
      return;
    }

    dagreGraph.setEdge(edge.source, edge.target, {
      weight: isSpouse ? 2 : 1, // weight spouses heavier to keep them together
      minlen: isSpouse ? 0 : 1,  // spouses on the same level, children go below
    });
  });
 
  // Run layout algorithm
  dagre.layout(dagreGraph);

  // 1. Store initial positions
  const positions = {};
  nodes.forEach(node => {
    const dNode = dagreGraph.node(node.id);
    positions[node.id] = {
      x: dNode ? dNode.x : 0,
      y: dNode ? dNode.y : 0
    };
  });

  // 2. Resolve 1D collisions for each generation level to avoid any node overlaps
  const coordAttr = isHorizontal ? 'y' : 'x';
  const minSep = isHorizontal ? 100 : 240;

  // Group nodes by generation level
  const genGroups = {};
  nodes.forEach(node => {
    const genLevel = node.data.generationLevel || 0;
    if (!genGroups[genLevel]) {
      genGroups[genLevel] = [];
    }
    genGroups[genLevel].push(node);
  });

  // Resolve overlaps within each generation level group
  Object.keys(genGroups).forEach(genLevel => {
    const groupNodes = genGroups[genLevel];
    if (groupNodes.length <= 1) return;

    // Map to items with current coordinates
    const items = groupNodes.map(node => ({
      id: node.id,
      curr: positions[node.id] ? positions[node.id][coordAttr] : 0
    }));

    // Calculate original average to keep the generation level centered post-spacing
    const origAvg = items.reduce((sum, item) => sum + item.curr, 0) / items.length;

    // Run relaxation solver to separate overlapping nodes
    let changed = true;
    for (let iter = 0; iter < 300 && changed; iter++) {
      changed = false;
      items.sort((a, b) => a.curr - b.curr);
      for (let i = 0; i < items.length - 1; i++) {
        const a = items[i];
        const b = items[i + 1];
        const overlap = a.curr + minSep - b.curr;
        if (overlap > 0.1) {
          const push = overlap / 2;
          a.curr -= push;
          b.curr += push;
          changed = true;
        }
      }
    }

    // Centering step: shift all items to match original average coordinate
    const finalAvg = items.reduce((sum, item) => sum + item.curr, 0) / items.length;
    const shift = origAvg - finalAvg;
    items.forEach(item => {
      item.curr += shift;
    });

    // Save resolved coordinates back
    items.forEach(item => {
      if (positions[item.id]) {
        positions[item.id][coordAttr] = item.curr;
      }
    });
  });
 
  // Translate coordinates back to React Flow nodes
  const layoutedNodes = nodes.map((node) => {
    const posX = positions[node.id] ? positions[node.id].x : 0;
    const posY = positions[node.id] ? positions[node.id].y : 0;
    
    const genLevel = node.data.generationLevel || 0;
    const genGap = 160; // 160px gap between row centers (leaves exactly 100px empty vertical space)
    
    let finalX, finalY;
    if (isHorizontal) {
      // LR layout: generations align in vertical columns (x-axis locked)
      finalX = genLevel * genGap;
      finalY = posY;
    } else {
      // TB layout: generations align in horizontal rows (y-axis locked)
      finalX = posX;
      finalY = genLevel * genGap;
    }
    
    // Position offset to center the handles (matching the 220x95 visual size)
    return {
      ...node,
      targetPosition: isHorizontal ? 'left' : 'top',
      sourcePosition: isHorizontal ? 'right' : 'bottom',
      position: {
        x: finalX - 110, // half of visual node width (220/2)
        y: finalY - 47.5,  // half of visual node height (95/2)
      },
    };
  });
 
  // Update edges dynamically to connect to the correct source and target midpoints
  const layoutedEdges = edges.map((edge) => {
    const isSpouse = edge.relationshipType === 'spouse';
    
    // Find the source and target node positions to evaluate closest sides
    const srcNode = layoutedNodes.find(n => n.id === edge.source);
    const tgtNode = layoutedNodes.find(n => n.id === edge.target);
    
    let srcHandle = isHorizontal ? 'right-source' : 'bottom-source';
    let tgtHandle = isHorizontal ? 'left-target' : 'top-target';
    
    if (isSpouse && srcNode && tgtNode) {
      if (isHorizontal) {
        // Spouse is vertical in LR layout - use top/bottom midpoints based on vertical order
        if (srcNode.position.y < tgtNode.position.y) {
          srcHandle = 'bottom-source';
          tgtHandle = 'top-target';
        } else {
          srcHandle = 'top-source';
          tgtHandle = 'bottom-target';
        }
      } else {
        // Spouse is horizontal in TB layout - use left/right midpoints based on horizontal order
        if (srcNode.position.x < tgtNode.position.x) {
          srcHandle = 'right-source';
          tgtHandle = 'left-target';
        } else {
          srcHandle = 'left-source';
          tgtHandle = 'right-target';
        }
      }
    }
    
    return {
      ...edge,
      sourceHandle: srcHandle,
      targetHandle: tgtHandle,
    };
  });
 
  return { nodes: layoutedNodes, edges: layoutedEdges };
};

const CanvasComponent = ({
  rawNodes,
  rawEdges,
  userRole,
  activeUserId,
  onAddChild,
  onAddSpouse,
  onEditProfile,
  onCheckRelation,
  onDeleteNode,
  searchQuery,
  relationSource,
  relationTarget,
  onNodeClick,
  layoutDirection = 'TB', // 'TB' or 'LR'
  onViewImage,
  onViewCrossTree,
  selectedNode
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { fitView, setCenter } = useReactFlow();

  const [showMiniMap, setShowMiniMap] = useState(false);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState(new Set());

  const toggleCollapseNode = (nodeId) => {
    setCollapsedNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  // Pan and zoom to selectedNode when it changes
  useEffect(() => {
    if (selectedNode && nodes.length > 0) {
      const targetNode = nodes.find(n => n.id === selectedNode._id);
      if (targetNode) {
        setCenter(targetNode.position.x + 110, targetNode.position.y + 47.5, {
          zoom: 1.0,
          duration: 500
        });
      }
    }
  }, [selectedNode, nodes, setCenter]);

  // Compute layout and prepare nodes/edges when raw data or configuration changes
  useEffect(() => {
    if (rawNodes.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // 0. Compute hidden nodes and relationship path
    const hiddenNodeIds = getHiddenNodeIds(rawNodes, rawEdges, collapsedNodeIds);
    const path = (relationSource && relationTarget) 
      ? findRelationshipPath(rawNodes, rawEdges, relationSource._id, relationTarget._id) 
      : { nodeIds: [], edgeIds: [] };

    // 1. Prepare React Flow edges
    const visibleRawEdges = rawEdges.filter(
      e => !hiddenNodeIds.has(e.sourceNodeId) && !hiddenNodeIds.has(e.targetNodeId)
    );

    const reactFlowEdges = visibleRawEdges.map((edge) => {
      const isSpouse = edge.relationshipType === 'spouse';
      const srcNode = rawNodes.find(n => n._id === edge.sourceNodeId);
      const tgtNode = rawNodes.find(n => n._id === edge.targetNodeId);

      let labelText = undefined;
      let labelStyle = {};
      let labelBgStyle = {};

      if (isSpouse && srcNode && tgtNode) {
        const mDateStr = srcNode.marriageDate || tgtNode.marriageDate;
        if (mDateStr) {
          const mDate = new Date(mDateStr);
          const years = new Date().getFullYear() - mDate.getFullYear();
          labelText = `❤️ ${years} yrs`;
        } else {
          labelText = '❤️ Spouse';
        }
        labelStyle = { fill: '#f43f5e', fontSize: 8, fontWeight: 700, fontFamily: 'system-ui, sans-serif' };
        labelBgStyle = { fill: '#170f1e', fillOpacity: 0.9, stroke: '#f43f5e/20', strokeWidth: 1 };
      } else if (!isSpouse && tgtNode) {
        const isMaleChild = tgtNode.gender === 1;
        labelText = isMaleChild ? 'Son' : 'Daughter';
        labelStyle = { fill: '#10b981', fontSize: 7, fontWeight: 600, fontFamily: 'system-ui, sans-serif' };
        labelBgStyle = { fill: '#061c15', fillOpacity: 0.9, stroke: '#10b981/20', strokeWidth: 1 };
      }

      const isPathEdge = path.edgeIds.includes(edge._id);

      return {
        id: edge._id,
        source: edge.sourceNodeId,
        target: edge.targetNodeId,
        relationshipType: edge.relationshipType,
        type: isSpouse ? 'straight' : 'smoothstep',
        animated: isPathEdge,
        className: isSpouse ? 'spouse' : 'parent_child',
        data: { relationshipType: edge.relationshipType },
        label: labelText,
        labelStyle,
        labelBgStyle,
        labelBgPadding: [5, 3],
        labelBgBorderRadius: 4,
        style: isSpouse 
          ? { 
              stroke: isPathEdge ? '#e11d48' : '#fb7185', 
              strokeWidth: isPathEdge ? 3.5 : 2, 
              strokeDasharray: isPathEdge ? undefined : '8 5', 
              opacity: isPathEdge ? 1 : 0.7 
            } 
          : { 
              stroke: isPathEdge ? '#f59e0b' : '#34d399', 
              strokeWidth: isPathEdge ? 3 : 1.5, 
              opacity: isPathEdge ? 1 : 0.6 
            },
        // Add arrow markers for parent_child relationships
        markerEnd: !isSpouse ? {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: isPathEdge ? '#f59e0b' : '#34d399',
        } : undefined,
      };
    });

    // 2. Map nodes of the tree to React Flow format
    const visibleRawNodes = rawNodes.filter(n => !hiddenNodeIds.has(n._id));

    const reactFlowNodes = visibleRawNodes.map((node) => {
      // Find if node has a spouse in the tree
      const hasSpouse = rawEdges.some(
        e => e.relationshipType === 'spouse' && 
        (e.sourceNodeId === node._id || e.targetNodeId === node._id)
      );

      // Determine if we should show the cross-tree link button for this node.
      let showCrossTreeLink = false;
      if (node.crossTreeLinkId) {
        const spouseEdge = rawEdges.find(
          e => e.relationshipType === 'spouse' && 
          (e.sourceNodeId === node._id || e.targetNodeId === node._id)
        );
        if (spouseEdge) {
          const spouseId = spouseEdge.sourceNodeId === node._id ? spouseEdge.targetNodeId : spouseEdge.sourceNodeId;
          const spouseNode = rawNodes.find(n => n._id === spouseId);
          if (spouseNode) {
            showCrossTreeLink = node._id.toString() > spouseNode._id.toString();
          } else {
            showCrossTreeLink = true;
          }
        } else {
          showCrossTreeLink = true;
        }
      }

      // Match search filters
      const isSearched = searchQuery 
        ? node.name.toLowerCase().includes(searchQuery.toLowerCase()) 
        : false;

      const isSource = relationSource ? relationSource._id === node._id : false;
      const isTarget = relationTarget ? relationTarget._id === node._id : false;

      const isPathNode = path.nodeIds.includes(node._id);
      const hasChildren = rawEdges.some(e => e.relationshipType === 'parent_child' && e.sourceNodeId === node._id);

      return {
        id: node._id,
        type: 'kinshipNode',
        data: {
          _id: node._id,
          name: node.name,
          gender: node.gender,
          dob: node.dob,
          bloodGroup: node.bloodGroup,
          gotram: node.gotram,
          marriageDate: node.marriageDate,
          generationLevel: node.generationLevel,
          parity: node.parity,
          profilePictureUrl: node.profilePictureUrl,
          mobileNumber: node.mobileNumber,
          socialLinks: node.socialLinks,
          userRole: userRole,
          linkedUserId: node.linkedUserId,
          isCurrentUser: node.linkedUserId && activeUserId && node.linkedUserId.toString() === activeUserId.toString(),
          hasSpouse,
          isSearched,
          isRelationSource: isSource,
          isRelationTarget: isTarget,
          isRelationPath: isPathNode,
          isCollapsed: collapsedNodeIds.has(node._id),
          hasChildren,
          onToggleCollapse: toggleCollapseNode,
          onAddChild,
          onAddSpouse,
          onEditProfile,
          onCheckRelation,
          isDeceased: node.isDeceased,
          dateOfDeath: node.dateOfDeath,
          onViewImage,
          crossTreeLinkId: showCrossTreeLink ? node.crossTreeLinkId : null,
          onViewCrossTree,
        },
        position: { x: 0, y: 0 }, // positions calculated dynamically by Dagre below
      };
    });

    // 3. Apply Dagre auto-layout algorithm
    const layout = getLayoutedElements(reactFlowNodes, reactFlowEdges, layoutDirection);

    setNodes(layout.nodes);
    setEdges(layout.edges);
  }, [
    rawNodes,
    rawEdges,
    userRole,
    activeUserId,
    searchQuery,
    relationSource,
    relationTarget,
    layoutDirection,
    collapsedNodeIds,
    setNodes,
    setEdges
  ]);

  // Track signature of rawNodes to trigger fitView only on initial load, structural updates, or layout changes
  const lastSignatureRef = useRef('');

  useEffect(() => {
    if (rawNodes.length > 0) {
      const currentSignature = `${rawNodes.map((n) => n._id).sort().join(',')}_${layoutDirection}`;
      if (currentSignature !== lastSignatureRef.current) {
        lastSignatureRef.current = currentSignature;
        const timer = setTimeout(() => {
          fitView({ padding: 0.08, duration: 400 });
        }, 150);
        return () => clearTimeout(timer);
      }
    }
  }, [rawNodes, layoutDirection, fitView]);

  return (
    <div className="w-full h-full relative bg-surface-0">
      {/* Subtle radial glow behind the tree */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/[0.02] rounded-full blur-[100px]" />
      </div>
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.08 }}
        minZoom={0.15}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Controls 
          showInteractive={false} 
          position="bottom-right"
        />
        <Background 
          color="rgba(51, 65, 85, 0.15)" 
          gap={32} 
          size={1} 
          variant="dots"
        />
        {showMiniMap && (
          <MiniMap
            nodeColor={(node) => {
              if (node.data.isDeceased) return '#475569';
              return node.data.gender === 1 ? '#3b82f6' : '#ec4899';
            }}
            maskColor="rgba(15, 23, 42, 0.6)"
            className="!bg-slate-950/80 !border-slate-800 !rounded-2xl !shadow-2xl"
            style={{ 
              bottom: 60,
              left: 24,
              width: 140,
              height: 100,
              margin: 0
            }}
            position="bottom-left"
          />
        )}
      </ReactFlow>

      {/* Floating MiniMap Toggle Button */}
      <div className="absolute bottom-6 left-6 z-10">
        <button
          onClick={() => setShowMiniMap(!showMiniMap)}
          className="flex items-center space-x-1.5 bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-slate-100 font-semibold text-xs px-3.5 py-2.5 rounded-xl transition duration-350 active:scale-95 shadow-2xl cursor-pointer"
        >
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h4v4H7zm0-5h10v3H7zm6 5h4v4h-4z"/>
          </svg>
          <span>{showMiniMap ? 'Hide Mini-Map' : 'Show Mini-Map'}</span>
        </button>
      </div>
    </div>
  );
};

const Canvas = (props) => (
  <ReactFlowProvider>
    <CanvasComponent {...props} />
  </ReactFlowProvider>
);

export default Canvas;
