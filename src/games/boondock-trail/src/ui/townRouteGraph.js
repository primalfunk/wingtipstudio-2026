import {
  getResourceIcon,
  getRouteMarkerIcon,
  renderAssetIcon
} from "./assetCatalog.js";
import {
  getV2JourneyNode,
  getV2TownGraphLayout
} from "../state/v2JourneyGraph.js";

const GRAPH_WIDTH = 1000;
const GRAPH_HEIGHT = 640;
const ROOT_POSITION = Object.freeze({ x: 0.5, y: 0.82 });

export function renderTownRouteGraph({
  town,
  destinations,
  selectedDestinationId,
  expandedGroupId = null
}) {
  const graph = buildTownRouteGraphModel({
    town,
    destinations,
    selectedDestinationId,
    expandedGroupId
  });

  return `
    <section class="town-route-graph" aria-label="${escapeHtml(`${town.name} route choices`)}">
      <div class="town-route-graph-stage">
        <svg
          class="town-route-graph-svg"
          viewBox="0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}"
          role="img"
          aria-label="${escapeHtml(`Route graph showing reachable destinations from ${town.name}`)}"
        >
          <defs>
            <linearGradient id="town-route-forward-edge" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#ffb64c" />
              <stop offset="100%" stop-color="#ffd98a" />
            </linearGradient>
          </defs>
          ${renderRootHalo(graph.root)}
          ${graph.edges.map(renderEdge).join("")}
          ${graph.previewEdges.map(renderPreviewEdge).join("")}
          ${graph.previewNodes.map(renderPreviewNode).join("")}
        </svg>
        <div class="town-route-graph-overlay">
          ${renderRootNode(graph.root)}
          ${graph.immediateNodes.map(renderImmediateNode).join("")}
          ${graph.groupNodes.map(renderGroupNode).join("")}
        </div>
      </div>
      <div class="town-route-graph-note">
        <p class="body-copy">The bright route continues the run north. Dim markers hint at what opens up after the next stop.</p>
      </div>
    </section>
  `;
}

function buildTownRouteGraphModel({ town, destinations, selectedDestinationId, expandedGroupId }) {
  const layout = getV2TownGraphLayout(town.id);
  const root = {
    id: `town_${town.id}`,
    label: town.name,
    position: layout.root ?? ROOT_POSITION
  };
  const immediateNodes = destinations.map((destination, index) =>
    buildImmediateNode(destination, index, layout, selectedDestinationId)
  );
  const collapsed = collapseImmediateNodes(immediateNodes, layout, expandedGroupId);
  const previewData = buildPreviewNodes(collapsed.visibleNodes, town.id, layout);

  return {
    root,
    immediateNodes: collapsed.visibleNodes,
    groupNodes: collapsed.groupNodes,
    edges: buildRootEdges(root, collapsed.visibleNodes, collapsed.groupNodes),
    previewEdges: previewData.edges,
    previewNodes: previewData.nodes
  };
}

function buildImmediateNode(destination, index, layout, selectedDestinationId) {
  const nodePosition = resolveImmediatePosition(destination, index, layout);
  const typeLabel = formatDestinationType(destination.category);
  const selected = destination.id === selectedDestinationId;
  const recommended = destination.isForwardSpine === true;

  return {
    kind: "destination",
    id: destination.id,
    nodeId: destination.nodeId,
    label: destination.label,
    shortLabel: buildShortLabel(destination.label),
    distanceMiles: destination.distanceMiles,
    category: destination.category,
    risk: destination.risk ?? "low",
    isForwardSpine: destination.isForwardSpine === true,
    isSelected: selected,
    isRecommended: recommended,
    typeLabel,
    position: nodePosition,
    iconHtml: renderAssetIcon(getDestinationIcon(destination.category), "town-route-node-icon"),
    ariaLabel: buildDestinationAriaLabel(destination, typeLabel)
  };
}

function collapseImmediateNodes(immediateNodes, layout, expandedGroupId) {
  const forwardNode = immediateNodes.find((node) => node.isForwardSpine) ?? null;
  const branchNodes = immediateNodes.filter((node) => !node.isForwardSpine);
  const maxVisibleBranches = Math.max(1, Number(layout.maxVisibleBranches) || 4) - (forwardNode ? 1 : 0);
  const shouldCollapse = branchNodes.length > maxVisibleBranches;

  if (!shouldCollapse) {
    return {
      visibleNodes: immediateNodes,
      groupNodes: []
    };
  }

  if (expandedGroupId === "side_branches") {
    return {
      visibleNodes: immediateNodes,
      groupNodes: [
        {
          kind: "group",
          id: "side_branches",
          label: "Collapse Branches",
          detail: "Return to compact graph",
          count: branchNodes.length,
          position: { x: 0.86, y: 0.16 },
          ariaLabel: "Collapse the expanded side branches."
        }
      ]
    };
  }

  const visibleBranches = branchNodes.slice(0, Math.max(0, maxVisibleBranches - 1));
  const hiddenBranches = branchNodes.slice(visibleBranches.length);
  const groupAnchor = hiddenBranches[0]?.position ?? { x: 0.82, y: 0.54 };

  return {
    visibleNodes: [forwardNode, ...visibleBranches].filter(Boolean),
    groupNodes: [
      {
        kind: "group",
        id: "side_branches",
        label: `${hiddenBranches.length} more stops`,
        detail: "Expand side branches",
        count: hiddenBranches.length,
        position: groupAnchor,
        ariaLabel: `${hiddenBranches.length} additional side destinations. Expand to inspect them.`
      }
    ]
  };
}

function buildRootEdges(root, visibleNodes, groupNodes) {
  return [...visibleNodes, ...groupNodes].map((node) => ({
    id: `edge_${root.id}_${node.id}`,
    x1: root.position.x,
    y1: root.position.y,
    x2: node.position.x,
    y2: node.position.y,
    forward: node.isForwardSpine === true,
    muted: node.kind === "group"
  }));
}

function buildPreviewNodes(immediateNodes, townId, layout) {
  const previewNodes = [];
  const previewEdges = [];
  const seen = new Set();

  immediateNodes
    .filter((node) => node.kind === "destination")
    .forEach((node) => {
      const destination = getV2JourneyNode(node.nodeId);
      const connections = (destination?.connections ?? []).filter(
        (connection) => connection.kind !== "backtrack_spine" && connection.to !== townId
      );

      connections.forEach((connection, index) => {
        const preview = getV2JourneyNode(connection.to);

        if (!preview || seen.has(preview.id)) {
          return;
        }

        seen.add(preview.id);
        const previewPosition = resolvePreviewPosition(preview.id, node, index, layout);

        previewNodes.push({
          id: preview.id,
          label: preview.name,
          shortLabel: buildShortLabel(preview.name),
          position: previewPosition,
          isForward: connection.kind === "forward_spine"
        });
        previewEdges.push({
          id: `preview_edge_${node.id}_${preview.id}`,
          x1: node.position.x,
          y1: node.position.y,
          x2: previewPosition.x,
          y2: previewPosition.y,
          forward: connection.kind === "forward_spine"
        });
      });
    });

  return {
    nodes: previewNodes,
    edges: previewEdges
  };
}

function resolveImmediatePosition(destination, index, layout) {
  const authored = layout.immediate?.[destination.nodeId];

  if (authored) {
    return authored;
  }

  if (destination.isForwardSpine) {
    return { x: 0.5, y: 0.24 };
  }

  const branchIndex = index % 3;
  return [
    { x: 0.2, y: 0.48 },
    { x: 0.5, y: 0.58 },
    { x: 0.8, y: 0.48 }
  ][branchIndex];
}

function resolvePreviewPosition(nodeId, parentNode, index, layout) {
  const authored = layout.preview?.[nodeId];

  if (authored) {
    return authored;
  }

  const xOffsets = [-0.14, -0.04, 0.08, 0.18];
  return {
    x: clamp(parentNode.position.x + (xOffsets[index] ?? 0.08), 0.1, 0.9),
    y: clamp(parentNode.position.y - 0.18 - (index % 2 === 0 ? 0.02 : 0), 0.08, 0.68)
  };
}

function renderRootHalo(root) {
  return `
    <circle
      class="town-route-root-halo"
      cx="${root.position.x * GRAPH_WIDTH}"
      cy="${root.position.y * GRAPH_HEIGHT}"
      r="78"
    />
  `;
}

function renderEdge(edge) {
  const path = buildEdgePath(edge);
  return `
    <path
      class="town-route-edge${edge.forward ? " town-route-edge--forward" : ""}${edge.muted ? " town-route-edge--muted" : ""}"
      d="${path}"
    />
  `;
}

function renderPreviewEdge(edge) {
  const path = buildEdgePath(edge, 0.22);
  return `
    <path
      class="town-route-preview-edge${edge.forward ? " town-route-preview-edge--forward" : ""}"
      d="${path}"
    />
  `;
}

function renderPreviewNode(node) {
  return `
    <g class="town-route-preview-node${node.isForward ? " town-route-preview-node--forward" : ""}">
      <circle
        cx="${node.position.x * GRAPH_WIDTH}"
        cy="${node.position.y * GRAPH_HEIGHT}"
        r="${node.isForward ? 16 : 12}"
      />
      ${
        node.isForward
          ? `
            <text
              x="${node.position.x * GRAPH_WIDTH}"
              y="${node.position.y * GRAPH_HEIGHT - 26}"
              text-anchor="middle"
            >${escapeHtml(node.shortLabel)}</text>
          `
          : ""
      }
    </g>
  `;
}

function renderRootNode(root) {
  return `
    <div class="town-route-root-node" style="${toPositionStyle(root.position)}">
      <div class="town-route-root-node-inner">
        <span class="choice-kicker">Town Hub</span>
        <strong>${escapeHtml(root.label)}</strong>
      </div>
    </div>
  `;
}

function renderImmediateNode(node) {
  return `
    <button
      class="town-route-node town-route-node--${node.risk}${node.isForwardSpine ? " town-route-node--forward" : ""}${node.isSelected ? " is-selected" : ""}${node.isRecommended ? " is-recommended" : ""}"
      type="button"
      style="${toPositionStyle(node.position)}"
      data-action="open-town-destination"
      data-value="${node.id}"
      aria-label="${escapeHtml(node.ariaLabel)}"
    >
      <span class="town-route-node-type">${escapeHtml(node.typeLabel)}</span>
      <span class="town-route-node-head">
        ${node.iconHtml}
        <span class="town-route-node-title">${escapeHtml(node.label)}</span>
      </span>
      <span class="town-route-node-meta">${node.distanceMiles} mi</span>
      <span class="town-route-node-signals">
        Risk ${escapeHtml(node.risk)}${node.isForwardSpine ? " | Northbound" : ""}
      </span>
    </button>
  `;
}

function renderGroupNode(node) {
  return `
    <button
      class="town-route-node town-route-node--group"
      type="button"
      style="${toPositionStyle(node.position)}"
      data-action="open-town-graph-group"
      data-value="${node.id}"
      aria-label="${escapeHtml(node.ariaLabel)}"
    >
      <span class="town-route-node-type">Side Branches</span>
      <span class="town-route-node-head">
        <span class="town-route-node-title">${escapeHtml(node.label)}</span>
      </span>
      <span class="town-route-node-meta">${escapeHtml(node.detail)}</span>
    </button>
  `;
}

function buildEdgePath(edge, tension = 0.32) {
  const x1 = edge.x1 * GRAPH_WIDTH;
  const y1 = edge.y1 * GRAPH_HEIGHT;
  const x2 = edge.x2 * GRAPH_WIDTH;
  const y2 = edge.y2 * GRAPH_HEIGHT;
  const cp1x = x1 + (x2 - x1) * tension;
  const cp1y = y1 - 36;
  const cp2x = x2 - (x2 - x1) * tension;
  const cp2y = y2 + 26;

  return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
}

function buildDestinationAriaLabel(destination, typeLabel) {
  const risk = destination.risk ?? "low";
  const recommendation = destination.recommendationReason ?? "";
  return `${destination.label}, ${typeLabel}, ${destination.distanceMiles} miles away, risk ${risk}. ${recommendation}`;
}

function buildShortLabel(label) {
  const words = String(label).split(" ");
  return words.length <= 2 ? String(label) : words.slice(0, 2).join(" ");
}

function formatDestinationType(category) {
  return {
    premium_boondock: "Premium Boondock",
    poor_boondock: "Poor Boondock",
    roadside_fallback: "Fallback Stop",
    gas_station: "Service Stop",
    rv_park: "RV Park",
    scenic_stop: "Scenic Stop",
    route_connector: "Continue Route",
    destination: "Final Stop"
  }[category] ?? "Destination";
}

function getDestinationIcon(category) {
  if (category === "gas_station") {
    return getResourceIcon("battery");
  }
  if (category === "rv_park") {
    return getResourceIcon("morale");
  }
  if (category === "poor_boondock" || category === "roadside_fallback") {
    return getResourceIcon("water");
  }

  return getRouteMarkerIcon(category === "destination");
}

function toPositionStyle(position) {
  return `left:${position.x * 100}%;top:${position.y * 100}%;`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
