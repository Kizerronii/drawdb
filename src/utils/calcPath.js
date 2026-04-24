import { tableFieldHeight, tableHeaderHeight } from "../data/constants";
import { getCommentHeight } from "./utils";

/**
 * Computes the endpoint coordinates and geometry constants shared by the
 * relationship path and the relationship label position.
 */
function computeEndpoints(r, tableWidth, zoom, showComments) {
  const width = tableWidth * zoom;
  const x1 = r.startTable.x;
  const y1 =
    r.startTable.y +
    r.startFieldIndex * tableFieldHeight +
    tableHeaderHeight +
    getCommentHeight(r.startTable.comment, tableWidth, showComments) +
    tableFieldHeight / 2;
  const x2 = r.endTable.x;
  const y2 =
    r.endTable.y +
    r.endFieldIndex * tableFieldHeight +
    getCommentHeight(r.endTable.comment, tableWidth, showComments) +
    tableHeaderHeight +
    tableFieldHeight / 2;

  let radius = 10 * zoom;
  const midX = (x2 + x1 + width) / 2;
  const endX = x2 + width < x1 ? x2 + width : x2;

  const closeY = Math.abs(y1 - y2) <= 36 * zoom;
  if (closeY) {
    radius = Math.abs(y2 - y1) / 3;
  }

  return { x1, y1, x2, y2, width, midX, endX, radius, closeY };
}

/**
 * Generates an SVG path string to visually represent a relationship between two fields.
 *
 * @param {{
 *   startTable: { x: number, y: number },
 *   endTable: { x: number, y: number },
 *   startFieldIndex: number,
 *   endFieldIndex: number
 * }} r - Relationship data.
 * @param {number} tableWidth - Width of each table (used to calculate horizontal offsets).
 * @param {number} zoom - Zoom level (used to scale vertical spacing).
 * @returns {string} SVG path "d" attribute string.
 */
export function calcPath(r, tableWidth = 200, zoom = 1, showComments = true) {
  if (!r) {
    return "";
  }

  const { x1, y1, x2, y2, width, midX, endX, radius, closeY } =
    computeEndpoints(r, tableWidth, zoom, showComments);

  if (closeY && radius <= 2) {
    if (x1 + width <= x2) return `M ${x1 + width} ${y1} L ${x2} ${y2 + 0.1}`;
    else if (x2 + width < x1)
      return `M ${x1} ${y1} L ${x2 + width} ${y2 + 0.1}`;
  }

  if (y1 <= y2) {
    if (x1 + width <= x2) {
      return `M ${x1 + width} ${y1} L ${
        midX - radius
      } ${y1} A ${radius} ${radius} 0 0 1 ${midX} ${y1 + radius} L ${midX} ${
        y2 - radius
      } A ${radius} ${radius} 0 0 0 ${midX + radius} ${y2} L ${endX} ${y2}`;
    } else if (x2 <= x1 + width && x1 <= x2) {
      return `M ${x1 + width} ${y1} L ${
        x2 + width
      } ${y1} A ${radius} ${radius} 0 0 1 ${x2 + width + radius} ${
        y1 + radius
      } L ${x2 + width + radius} ${y2 - radius} A ${radius} ${radius} 0 0 1 ${
        x2 + width
      } ${y2} L ${x2 + width} ${y2}`;
    } else if (x2 + width >= x1 && x2 + width <= x1 + width) {
      return `M ${x1} ${y1} L ${
        x2 - radius
      } ${y1} A ${radius} ${radius} 0 0 0 ${x2 - radius - radius} ${
        y1 + radius
      } L ${x2 - radius - radius} ${y2 - radius} A ${radius} ${radius} 0 0 0 ${
        x2 - radius
      } ${y2} L ${x2} ${y2}`;
    } else {
      return `M ${x1} ${y1} L ${
        midX + radius
      } ${y1} A ${radius} ${radius} 0 0 0 ${midX} ${y1 + radius} L ${midX} ${
        y2 - radius
      } A ${radius} ${radius} 0 0 1 ${midX - radius} ${y2} L ${endX} ${y2}`;
    }
  } else {
    if (x1 + width <= x2) {
      return `M ${x1 + width} ${y1} L ${
        midX - radius
      } ${y1} A ${radius} ${radius} 0 0 0 ${midX} ${y1 - radius} L ${midX} ${
        y2 + radius
      } A ${radius} ${radius} 0 0 1 ${midX + radius} ${y2} L ${endX} ${y2}`;
    } else if (x1 + width >= x2 && x1 + width <= x2 + width) {
      return `M ${x1} ${y1} L ${
        x1 - radius - radius
      } ${y1} A ${radius} ${radius} 0 0 1 ${x1 - radius - radius - radius} ${
        y1 - radius
      } L ${x1 - radius - radius - radius} ${
        y2 + radius
      } A ${radius} ${radius} 0 0 1 ${
        x1 - radius - radius
      } ${y2} L ${endX} ${y2}`;
    } else if (x1 >= x2 && x1 <= x2 + width) {
      return `M ${x1 + width} ${y1} L ${
        x1 + width + radius
      } ${y1} A ${radius} ${radius} 0 0 0 ${x1 + width + radius + radius} ${
        y1 - radius
      } L ${x1 + width + radius + radius} ${
        y2 + radius
      } A ${radius} ${radius} 0 0 0 ${x1 + width + radius} ${y2} L ${
        x2 + width
      } ${y2}`;
    } else {
      return `M ${x1} ${y1} L ${
        midX + radius
      } ${y1} A ${radius} ${radius} 0 0 1 ${midX} ${y1 - radius} L ${midX} ${
        y2 + radius
      } A ${radius} ${radius} 0 0 0 ${midX - radius} ${y2} L ${endX} ${y2}`;
    }
  }
}

const LABEL_EDGE_PADDING = 8;

/**
 * Returns the anchor position, text-anchor hint, and vertical placement for
 * the relationship name label. The label is pinned to the table edge from
 * which the chosen side's horizontal segment exits (side="start") or enters
 * (side="end"), with LABEL_EDGE_PADDING offset so the text never overlaps the
 * table. textAnchor controls the grow direction so the text runs towards the
 * knee, along the segment.
 *
 * @param {object} r - Relationship data (same shape as calcPath's `r`).
 * @param {"start"|"end"} side - Which table's horizontal segment to attach to.
 * @returns {{x: number, y: number, textAnchor: "start"|"end", placement: "above"|"below"}}
 */
export function calcRelationshipLabel(
  r,
  side = "start",
  tableWidth = 200,
  zoom = 1,
  showComments = true,
) {
  if (!r) {
    return { x: 0, y: 0, textAnchor: "start", placement: "above" };
  }

  const { x1, y1, x2, y2, width, radius, closeY } = computeEndpoints(
    r,
    tableWidth,
    zoom,
    showComments,
  );
  const pad = LABEL_EDGE_PADDING;

  // Degenerate straight line: no knee — anchor at the start-table exit edge,
  // label grows towards the end table.
  if (closeY && radius <= 2) {
    if (x1 + width <= x2) {
      return side === "start"
        ? { x: x1 + width + pad, y: y1, textAnchor: "start", placement: "above" }
        : { x: x2 - pad, y: y2, textAnchor: "end", placement: "above" };
    }
    if (x2 + width < x1) {
      return side === "start"
        ? { x: x1 - pad, y: y1, textAnchor: "end", placement: "above" }
        : { x: x2 + width + pad, y: y2, textAnchor: "start", placement: "above" };
    }
    return { x: (x1 + x2) / 2, y: y1, textAnchor: "middle", placement: "above" };
  }

  // Horizontal variant of the selected segment: determines which edge of the
  // table the label sits next to and the direction the text should grow.
  // - side=start: label starts at the exit edge of startTable, grows towards knee
  // - side=end:   label ends at the entry edge of endTable, grows back towards knee
  let x;
  let textAnchor;
  let y;

  if (side === "start") {
    y = y1;
    const exitsRight =
      y1 <= y2
        ? // y1 <= y2 variants: cases A, B exit from x1+width
          x1 + width <= x2 || (x2 <= x1 + width && x1 <= x2)
        : // y1 > y2 variants: cases A', C' exit from x1+width
          x1 + width <= x2 || (x1 >= x2 && x1 <= x2 + width);
    if (exitsRight) {
      x = x1 + width + pad;
      textAnchor = "start";
    } else {
      x = x1 - pad;
      textAnchor = "end";
    }
  } else {
    y = y2;
    // Entry edge of the end table. "entersFromLeft" = linie dochodzi z lewej
    // strony do LEWEJ krawędzi tabeli end (x2); przeciwnie — dochodzi do
    // PRAWEJ krawędzi (x2 + width).
    const entersLeft =
      y1 <= y2
        ? // A, C use endX=x2; B ends at x2+width; D uses endX=x2+width
          x1 + width <= x2 ||
          (x2 + width >= x1 && x2 + width <= x1 + width)
        : // A', B' end at x2 (endX); C', D' end at x2+width
          x1 + width <= x2 ||
          (x1 + width >= x2 && x1 + width <= x2 + width);
    if (entersLeft) {
      x = x2 - pad;
      textAnchor = "end";
    } else {
      x = x2 + width + pad;
      textAnchor = "start";
    }
  }

  // "above" when the knee falls on the far side of the segment (below it in
  // screen coords means positive Δy). side="start" → knee is towards y2;
  // side="end" → knee is towards y1.
  const kneeY = side === "start" ? y2 : y1;
  const placement = kneeY > y ? "above" : "below";

  return { x, y, textAnchor, placement };
}
