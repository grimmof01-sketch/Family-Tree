import React, { useMemo, useEffect } from 'react';
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import dagre from 'dagre';
import CustomNode from './CustomNode';
import 'reactflow/dist/style.css';

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
  descentHighlight = { type: null, nodeIds: [], edgeIds: [] }
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { fitView } = useReactFlow();

  // Compute layout and prepare nodes/edges when raw data or configuration changes
  useEffect(() => {
    if (rawNodes.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // 1. Prepare React Flow edges
    const reactFlowEdges = rawEdges.map((edge) => {
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

      const isEdgeHighlighted = descentHighlight && descentHighlight.edgeIds && descentHighlight.edgeIds.includes(edge._id);
      let edgeStyle = isSpouse 
        ? { stroke: '#fb7185', strokeWidth: 2, strokeDasharray: '8 5', opacity: 0.7 } 
        : { stroke: '#34d399', strokeWidth: 1.5, opacity: 0.6 };

      if (isEdgeHighlighted) {
        if (descentHighlight.type === 'patrilineal') {
          edgeStyle = { stroke: '#3b82f6', strokeWidth: 3, opacity: 0.9 };
        } else if (descentHighlight.type === 'matrilineal') {
          edgeStyle = { stroke: '#ec4899', strokeWidth: 3, opacity: 0.9 };
        } else if (descentHighlight.type === 'path') {
          edgeStyle = { stroke: '#10b981', strokeWidth: 3, opacity: 0.9 };
        }
      }

      return {
        id: edge._id,
        source: edge.sourceNodeId,
        target: edge.targetNodeId,
        relationshipType: edge.relationshipType,
        type: isSpouse ? 'straight' : 'smoothstep',
        animated: isEdgeHighlighted,
        className: isSpouse ? 'spouse' : 'parent_child',
        data: { relationshipType: edge.relationshipType },
        label: labelText,
        labelStyle,
        labelBgStyle,
        labelBgPadding: [5, 3],
        labelBgBorderRadius: 4,
        style: edgeStyle,
        // Add arrow markers for parent_child relationships
        markerEnd: !isSpouse ? {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: isEdgeHighlighted
            ? (descentHighlight.type === 'patrilineal' ? '#3b82f6' : (descentHighlight.type === 'matrilineal' ? '#ec4899' : '#10b981'))
            : '#34d399',
        } : undefined,
      };
    });

    // 2. Map nodes of the tree to React Flow format
    const reactFlowNodes = rawNodes.map((node) => {
      // Find if node has a spouse in the tree
      const hasSpouse = rawEdges.some(
        e => e.relationshipType === 'spouse' && 
        (e.sourceNodeId === node._id || e.targetNodeId === node._id)
      );

      // Determine if we should show the cross-tree link button for this node.
      // We only show it for the imported spouse copy, not the native member node.
      // In a cross-tree marriage, the spouse copy has a later ObjectId creation timestamp (larger _id) than the native spouse.
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
      const isDescentHighlighted = descentHighlight && descentHighlight.nodeIds && descentHighlight.nodeIds.includes(node._id);
      const descentType = isDescentHighlighted ? descentHighlight.type : null;

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
          isDescentHighlighted,
          descentType,
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
        position: { x: 0, y: 0 },
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
    descentHighlight,
    setNodes,
    setEdges
  ]);

  // Track signature of rawNodes to trigger fitView only on initial load, structural updates, or layout changes
  const lastSignatureRef = React.useRef('');

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
      </ReactFlow>
    </div>
  );
};

const Canvas = (props) => (
  <ReactFlowProvider>
    <CanvasComponent {...props} />
  </ReactFlowProvider>
);

export default Canvas;
