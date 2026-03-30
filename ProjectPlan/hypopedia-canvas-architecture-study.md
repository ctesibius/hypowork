# Hypopedia Canvas Architecture — Full Study

**Sources:** Local clone at `/Users/bnguyen/Desktop/Github/Hypopedia`
**Purpose:** Complete architecture documentation for implementing edgeless canvas in Hypowork
**Status:** Phase 1 study — for implementation reference

**Hypowork plan alignment:** [phase-1.md](phase-1.md) §**1.7h** (colocation under `components/canvas/`, Hypopedia port order, in-surface AI §**1.6.2**). When porting code from this tree, copy from the local clone path above and record license/subpath in a short `docs/canvas-hypopedia-port.md` (add when first import lands).

---

## 1. Overview

Hypopedia's canvas (called "edgeless") is built on **BlockSuite**, a block-based editor engine with CRDT-oriented data sync. The edgeless surface provides an infinite spatial canvas where users can place, connect, and arrange various elements.

**Key architectural insight:** The edgeless editor is a **view mode** of a document, not a separate document. When you switch from "page" (prose) to "edgeless" (canvas), you're viewing the same document with a different renderer.

---

## 2. Document Model — Page vs Edgeless

### 2.1 Dual-Mode Architecture

```
Document (same id, same route)
├── mode: "page" → renders as prose/markdown editor
└── mode: "edgeless" → renders as infinite canvas
```

**Key file:** `packages/frontend/core/src/blocksuite/block-suite-mode-switch/index.tsx`

```typescript
// Mode switching is controlled by a RadioGroup with two options:
const EdgelessRadioItem = {
  value: 'edgeless',
  label: <EdgelessSwitchItem />,
  testId: 'switch-edgeless-mode-button',
};

const PageRadioItem = {
  value: 'page',
  label: <PageSwitchItem />,
  testId: 'switch-page-mode-button',
};

// Keyboard shortcut: Alt+S toggles between modes
```

### 2.2 Surface Block

In edgeless mode, the document contains a **`surface` block** (`affine:surface`) that holds all canvas elements:

```typescript
// All canvas elements live in the surface block
interface SurfaceBlockModel {
  children: GfxModel[];  // shape, text, connector, brush, etc.

  // CRUD operations
  addElement(element: Partial<GfxModel>): string;
  deleteElement(id: string): void;
  getElementById(id: string): GfxModel | null;
  getConnectors(elementId: string): ConnectorElementModel[];
}
```

---

## 3. Element Types

All elements are defined in `blocksuite/affine/model/src/elements/`:

### 3.1 Element Type Matrix

| Element | Model Class | Description | Stores Content? |
|---------|-------------|-------------|-----------------|
| **Shape** | `ShapeElementModel` | Rectangles, ellipses, diamonds, etc. | Yes (text) |
| **Text** | `TextElementModel` | Standalone text on canvas | Yes |
| **Connector** | `ConnectorElementModel` | Lines/arrows connecting elements | Yes (label) |
| **Brush** | `BrushElementModel` | Freehand drawing paths | Yes (SVG path) |
| **Highlighter** | `HighlighterElementModel` | Semi-transparent strokes | Yes (SVG path) |
| **Group** | `GroupElementModel` | Container for multiple elements | No |
| **Mindmap** | `MindmapElementModel` | Hierarchical tree nodes | Yes |
| **Note** | `NoteBlockModel` | Card with embedded block content | Yes (blocks) |
| **Edgeless Text** | `EdgelessTextBlockModel` | Text specific to edgeless | Yes |
| **Frame** | `FrameBlockModel` | Visual container/background | No |

### 3.2 Shape Element Properties

```typescript
interface ShapeElementModel extends GfxModel {
  shapeType: 'rect' | 'ellipse' | 'diamond' | 'triangle' | 'roundedRect' | 'rhombus' | 'parallelogram' | 'trapezoid' | 'pentagon' | 'hexagon' | 'circle';

  // Bounds (serialized as '[x,y,w,h]')
  xywh: SerializedXYWH;
  index: number;  // Z-order

  // Appearance
  fillColor: string;        // e.g., '--affine-palette-shape-yellow'
  filled: boolean;
  strokeColor: string;
  strokeWidth: number;
  strokeStyle: 'solid' | 'dash' | 'none';
  shapeStyle: 'general' | 'sketch' | 'canvas';

  // Corner radius (for roundedRect)
  radius: number;

  // Text content (stored as Y.Text for collaborative editing)
  text: Y.Text;
  textAlign: 'left' | 'center' | 'right';
  textVerticalAlign: 'top' | 'center' | 'bottom';
  color: string;           // text color
  fontSize: number;
  fontFamily: string;
}
```

### 3.3 Connector Element Properties

```typescript
interface ConnectorElementModel extends GfxModel {
  // Connection mode
  mode: 'curve' | 'orthogonal' | 'straight';

  // Connection endpoints
  source: {
    id: string | null;      // element ID (null = free)
    position: PointLocation; // [x, y] when detached
  };
  target: {
    id: string | null;
    position: PointLocation;
  };

  // Routing points for orthogonal mode
  routerPoints: PointLocation[];

  // Appearance
  stroke: string;
  strokeWidth: number;
  strokeStyle: 'solid' | 'dash' | 'none';
  frontEndpointStyle: 'arrow' | 'triangle' | 'diamond' | 'circle' | 'none';
  rearEndpointStyle: 'arrow' | 'triangle' | 'diamond' | 'circle' | 'none';

  // Label
  text: Y.Text;
  labelOffset: { distance: number; anchor: 'center' | 'top' | 'bottom' };
  labelXYWH: SerializedXYWH;

  // Computed path (not stored)
  path: PointLocation[];
}

interface PointLocation {
  x: number;
  y: number;
}
```

### 3.4 Anchor System

Connectors attach to elements at **anchor points**:

```typescript
// Standard anchor locations on element bounds (0-1 normalized)
const ConnectorEndpointLocations = [
  [0.5, 0],    // top center
  [1, 0.5],    // right center
  [0.5, 1],    // bottom center
  [0, 0.5],    // left center
  [0, 0],      // top-left corner
  [1, 0],      // top-right corner
  [0, 1],      // bottom-left corner
  [1, 1],      // bottom-right corner
];
```

When dragging a connector, the system shows **anchor indicators** on elements:
- Small circles at each anchor point
- Highlight the nearest anchor when hovering

---

## 4. Toolbar Architecture

### 4.1 Toolbar Structure

**Main toolbar file:** `blocksuite/affine/widgets/edgeless-toolbar/src/edgeless-toolbar.ts`

```
Toolbar Layout:
┌─────────────────────────────────────────────────────────────────┐
│ [Quick Tools]  │  [Shape ▼] [Pen ▼] [Connector] [Note] [Frame] │
│   36px size    │              Senior Tools (96px width)          │
└─────────────────────────────────────────────────────────────────┘
```

**Constants:**
```typescript
TOOLBAR_HEIGHT = 64;
QUICK_TOOL_SIZE = 36;
SENIOR_TOOL_WIDTH = 96;
TOOLBAR_PADDING_X = 12;
```

### 4.2 Tool Categories

**Quick Tools** (36px, left side):
| Tool | Icon | Shortcut | Description |
|------|------|----------|-------------|
| Select | `v` | `v` | Default selection tool |
| Pan | `h` | `h` | Hand tool for panning |
| Text | `t` | `t` | Add text elements |

**Senior Tools** (96px wide, main area):
| Tool | Icon | Shortcut | Variants |
|------|------|----------|----------|
| Shape | `s` | `s` | `Shift-s` cycles types |
| Pen | `p` | `p` | `Shift-p` = Highlighter |
| Eraser | `e` | `e` | Erase brush strokes |
| Connector | `c` | `c` | Draw connectors |
| Note | `n` | `n` | Add note cards |
| Frame | `f` | `f` | Create frames |

### 4.3 Tool Selection Flow

Tools are provided via a **provider pattern**:

```typescript
// Each tool is a configuration object
interface ToolConfig {
  id: string;
  name: string;
  icon: TemplateResult;
  enable?: boolean;
  priority?: number;
  menu?: {
    items: ToolConfig[];
  };
}

// Quick tools provided by QuickToolProvider
// Senior tools provided by SeniorToolProvider
```

### 4.4 Active Tool State

The active tool affects cursor and mouse behavior:

```typescript
// When Shape tool active:
// - Click and drag creates a shape
// - Cursor shows shape preview
// - ESC cancels and returns to select

// When Connector tool active:
// - Click on element anchor starts connection
// - Drag to another element's anchor to connect
// - Shows connection line while dragging
```

---

## 5. Connector/Edge Behavior

### 5.1 Connection Process

**File:** `blocksuite/affine/shared/connector/src/connector-manager.ts`

1. **Start connection:**
   - User clicks on an element's anchor point
   - System creates a temporary connector with `source.id = elementId`
   - Shows rubber-band line following cursor

2. **Find target:**
   - `ConnectionOverlay` renders anchor indicators on hoverable elements
   - When cursor nears an element, highlight its anchors
   - When user clicks anchor, set `target.id = elementId`

3. **Path computation:**
   - `ConnectorPathGenerator` computes path based on `mode`:
     - **`curve`**: Bezier curve with auto-calculated control points
     - **`straight`**: Direct line between endpoints
     - **`orthogonal`**: A* pathfinding with 90° turns, avoiding element bounds

### 5.2 Orthogonal Routing

The orthogonal router:
1. Creates a grid around source and target elements
2. Uses A* to find a path with minimal bends
3. Rounds corners with configurable radius
4. Avoids intersecting other elements (optional)

### 5.3 On Element Drag

When an attached element moves:

```typescript
// In ConnectorPathGenerator.updatePath():
1. Get new bounds of source element
2. Get new bounds of target element
3. Calculate new anchor positions
4. Recompute path based on mode
5. Update connector's `path` property
```

### 5.4 Detachment

If an attached element is deleted:
- Connector becomes "free-floating"
- `source.id` and `target.id` become `null`
- `source.position` and `target.position` store last known coordinates

---

## 6. Keyboard Shortcuts

**File:** `blocksuite/affine/blocks/root/src/edgeless/edgeless-keyboard.ts`

| Shortcut | Action |
|----------|--------|
| `v` | Select tool (default) |
| `t` | Text tool |
| `c` | Connector tool |
| `h` | Pan tool (hand) |
| `n` | Note tool |
| `p` | Pen/brush tool |
| `Shift-p` | Highlighter tool |
| `e` | Eraser tool |
| `s` | Shape tool |
| `Shift-s` | Cycle shape types |
| `f` | Frame tool |
| `k` | Toggle note slicer |
| `@` | Insert link |
| `Space` (hold) | Temporary pan mode |
| `Mod-g` | Group selected |
| `Shift-Mod-g` | Ungroup |
| `Mod-a` | Select all |
| `Mod--` | Zoom out |
| `Mod-=` | Zoom in |
| `Alt-0` | Reset zoom to 100% |
| `Alt-1` | Fit to screen |
| `Alt-2` | Zoom to selection |
| `Backspace/Delete` | Delete selected |
| `Control-d` (Mac) | Duplicate |
| `Escape` | Clear selection / cancel |
| `Arrow keys` | Move selected 1px |
| `Shift-Arrow` | Move selected 10px |
| `Enter` | Edit connector label |
| `Tab` | Add sibling (mindmap) |

---

## 7. Data Model

### 7.1 Element Bounds

All elements use `xywh` format: `[x, y, width, height]`

```typescript
type SerializedXYWH = `[${number}, ${number}, ${number}, ${number}]`;
// Example: '[100, 200, 300, 150]'
```

### 7.2 Surface Block Storage

```typescript
// The surface block stores all canvas elements as JSON
interface SurfaceBlock {
  type: 'affine:surface';
  id: string;
  children: string[];  // element IDs in z-order

  // Each element is stored separately with type discrimination
  'shape:xxx': ShapeElementModel;
  'connector:xxx': ConnectorElementModel;
  'text:xxx': TextElementModel;
  // etc.
}
```

### 7.3 Viewport State

```typescript
interface ViewportState {
  centerX: number;
  centerY: number;
  zoom: number;  // 1 = 100%
}

// Zoom constraints
const MIN_ZOOM = 0.1;   // 10%
const MAX_ZOOM = 10;    // 1000%
const ZOOM_STEP = 0.1;
```

---

## 8. Architecture for Hypowork Implementation

### 8.1 Recommended Approach

Based on the study, here's the recommended implementation:

```
Hypowork Canvas Architecture:
├── CanvasDocument (document kind='canvas')
│   ├── surface: { nodes: CanvasNode[], edges: CanvasEdge[] }
│   └── viewport: { centerX, centerY, zoom }
├── CanvasNode
│   ├── id, type, xywh, data (type-specific)
│   └── anchors: AnchorPoint[]
├── CanvasEdge (Connector)
│   ├── id, mode, source, target
│   ├── stroke, strokeWidth, endpoints
│   └── path (computed)
└── Tool System
    ├── QuickToolProvider
    └── SeniorToolProvider
```

### 8.2 Key Differences from Current Implementation

| Aspect | Current (MVP) | Recommended |
|--------|---------------|------------|
| Storage | JSON string in `document.body` | Separate `canvas_nodes`, `canvas_edges` tables |
| Elements | Limited types | Full element type matrix |
| Connectors | Basic lines | Anchor-based with routing |
| Tools | Fixed toolbar | Extensible tool providers |
| Viewport | CSS transforms | Canvas rendering with viewport culling |

### 8.3 Migration Path

1. **Keep existing canvas storage** for MVP compatibility
2. **Add new tables** for proper element storage:
   - `canvas_nodes`: id, document_id, type, xywh, data (JSON), z_index
   - `canvas_edges`: id, document_id, source_node_id, target_node_id, mode, style
3. **Implement tool system** with provider pattern
4. **Add anchor system** for connectors
5. **Keep view/mode switch** as pure UI (no content migration)

---

## 9. Critical Implementation Details

### 9.1 Element Rendering

Use a **layered canvas approach**:

```
Layer 0: Background (grid, snap guides)
Layer 1: Frames (render first, below content)
Layer 2: Shapes, Text, Notes (main elements)
Layer 3: Connectors (on top of elements)
Layer 4: Selection overlays, handles
Layer 5: Drag previews, cursors
```

### 9.2 Hit Testing

For selection, implement hit testing in order:

1. Check selection handles (resize/rotate)
2. Check connectors (thicker hit area)
3. Check elements (bounds intersection)
4. Check viewport (pan/zoom)

### 9.3 Coordinate Systems

```
Screen Coordinates (mouse events)
    ↓
Viewport Transform (pan, zoom)
    ↓
Canvas Coordinates (element positions)
    ↓
Element Local Coordinates (inside element)
```

### 9.4 Undo/Redo

Use a command pattern:

```typescript
interface Command {
  execute(): void;
  undo(): void;
}

// Examples:
// MoveElementCommand { elementId, fromXYWH, toXYWH }
// AddElementCommand { element }
// DeleteElementCommand { element, index }
// etc.
```

---

## 10. Element Behaviors and Interactions

### 10.1 Selection States

**Single Selection:**
- Click element → blue selection border with 8 resize handles + rotation handle
- Handles at corners and edge midpoints

**Multi-Selection:**
- Shift+click → add/remove from selection
- Drag selection box → select all elements intersecting box
- Selection shows bounding box around all selected elements

**Selection Handles:**
```
    [rotate]
       ↑
  [TL]────[T]────[TR]
   |               |
   |               |
  [L]    [C]     [R]
   |               |
   |               |
  [BL]────[B]────[BR]

T/L/R/B = resize handles
C = center (for moving)
TL/TR/BL/BR = corner resize (maintains aspect ratio with Shift)
```

### 10.2 Drag and Drop Behavior

**Element Drag:**
1. Mouse down on element → enter move mode
2. Show element at reduced opacity (0.7) following cursor
3. Snap guides appear when aligned with other elements
4. Mouse up → commit move
5. Connected connectors update automatically

**Resize Behavior:**
- Corner handles: proportional resize (maintains aspect ratio)
- Edge handles: stretch in one dimension
- Shift+resize: maintain aspect ratio
- Alt+resize: resize from center

**Rotation:**
- Rotation handle above selection box
- Drag to rotate
- Shift+rotate: snap to 15° increments

### 10.3 Snap and Alignment

**Snap Guides:**
- Appear when element edges/centers align with other elements
- Vertical: left, center, right edges
- Horizontal: top, center, bottom edges
- Distance threshold: ~8px

**Alignment Helpers:**
- Red guide line when elements align
- Distance indicator when spacing matches

### 10.4 Context Menu (Right-Click)

Right-click on element shows context menu:

```
┌─────────────────────────┐
│ Bring to Front          │
│ Send to Back            │
│ Bring Forward           │
│ Send Backward           │
├─────────────────────────┤
│ Copy                    │  ← Cmd+C
│ Cut                     │  ← Cmd+X
│ Paste                   │  ← Cmd+V
│ Duplicate               │  ← Cmd+D
│ Delete                  │  ← Backspace
├─────────────────────────┤
│ Add Connection          │  (if shape/connector selected)
│ Remove Connection       │  (if already connected)
├─────────────────────────┤
│ Lock                   │
│ Unlock                 │
└─────────────────────────┘
```

### 10.5 Note Element (Card)

Notes are special elements that contain **block content**:

```typescript
interface NoteBlockModel extends GfxModel {
  // Position and size
  xywh: SerializedXYWH;
  index: number;

  // Note-specific
  backgroundColor: string;
  style: 'solid' | 'outline';

  // Block content (embedded editor)
  blocks: Block[];  // The actual prose content

  // Display
  collapsed: boolean;  // In collapsed mode, shows preview only
  displayMode: 'page' | 'edgeless';
}
```

**Note Card Behavior:**
- Double-click → enter edit mode (shows block editor inside)
- Single-click → select the card
- Drag from card → move card (not edit content)
- Cards can be collapsed to show only title

### 10.6 Frame Element

Frames are visual containers:

```typescript
interface FrameBlockModel extends GfxModel {
  title: Y.Text;
  backgroundColor: string;
  borderStyle: 'solid' | 'dashed';
}
```

**Frame Behavior:**
- Acts as a visual background/grouping mechanism
- Elements can be "inside" a frame (clipping)
- Frame title appears at top-left when not empty
- Resize frame → contained elements don't auto-resize

---

## 11. The "View Mode" Architecture — Critical Insight

### 11.1 Hypopedia's Approach

**Key insight:** When switching from Page (prose) to Edgeless (canvas) in Hypopedia:
- The document **does not transform**
- The document **shows as a node** in the canvas view
- The canvas view has **additional elements** that are private to canvas view

### 11.2 Data Model

```
Document (unchanged when switching views)
├── id: string
├── title: string
├── body: ProseContent (markdown/blocks)
├── kind: 'prose' | 'canvas'  ← determines default view
└── createdAt, updatedAt, etc.

CanvasView (ephemeral view state, not stored separately)
├── documentId: string  ← links to the document
├── viewportX: number
├── viewportY: number
├── zoom: number
└── canvasElements: CanvasElement[]  ← these ARE stored, in surface block
```

### 11.3 Canvas Elements vs Document Content

**Canvas elements stored in `surface` block:**
- All shapes, connectors, text, etc.
- These persist when switching between Page and Edgeless views

**Document content:**
- The prose/blocks content lives in the document itself
- In Edgeless view, the document appears as a **Note card** or **embedded frame**
- The Note card is editable and syncs back to the document

### 11.4 "Make Standalone" Feature

When in Edgeless view, you can create a **new document** from canvas elements:

```
Canvas View
├── Document A (as Note card) ← original document
├── My custom shapes
├── My annotations
└── Selected elements
    └── Right-click → "Make Standalone"
        └── Creates NEW Document B
            ├── title: "Untitled" (editable)
            └── body: extracted content from selected elements
```

**"Make Standalone" flow:**
1. User selects canvas elements
2. Right-click → "Make Standalone"
3. System creates new document with:
   - Title from selection or "Untitled"
   - Body extracted from note cards / text elements
4. New document appears in `/documents` list
5. Original canvas elements remain in original document

### 11.5 Private Canvas Items

Items that exist only in canvas view (not part of original document):

```typescript
interface PrivateCanvasItem {
  id: string;
  documentId: string;  ← original document this canvas view is for
  type: 'shape' | 'connector' | 'text' | 'group';

  // The actual element data
  data: ShapeData | ConnectorData | TextData | GroupData;

  // Not linked to any document — purely canvas-local
  isPrivate: true;
}
```

---

## 12. UI/UX Implementation Details

### 12.1 Toolbar Interaction Flow

**Shape Tool Flow:**
1. Click Shape tool (or press `s`)
2. Toolbar shows shape dropdown:
   - Rectangle
   - Ellipse
   - Diamond
   - Triangle
   - (etc.)
3. Click a shape type (or press `Shift-s` to cycle)
4. Click-drag on canvas to create shape
5. Release → shape created with default size
6. Tool stays active → create another
7. Press `ESC` or `v` to return to Select tool

**Connector Tool Flow:**
1. Click Connector tool (or press `c`)
2. Click on element → anchor points appear
3. Click anchor → start connector
4. Drag to another element → target anchor highlights
5. Click target anchor → connector created
6. Tool stays active → create another
7. Press `ESC` or `v` to return to Select tool

**Pan Tool Flow:**
1. Click Pan tool (or press `h`)
2. Click-drag on canvas → pan viewport
3. Release → stay in Pan tool
4. Press `ESC` or `v` to return to Select tool

### 12.2 Space Bar (Temporary Pan)

When holding `Space`:
- Cursor changes to grab hand
- Click-drag pans viewport
- Release Space → returns to previous tool

### 12.3 Mouse Wheel Behavior

| Action | Result |
|--------|--------|
| Scroll wheel | Vertical scroll (if content overflows) |
| Shift + scroll | Horizontal scroll |
| Ctrl/Cmd + scroll | Zoom in/out |
| Alt + scroll | (varies by platform) |

### 12.4 Zoom Interactions

**Zoom to cursor:**
- When zooming (Ctrl+scroll), zoom centers on cursor position
- Maintains relative position of cursor in viewport

**Zoom levels:**
- 10% → 1000% (10x zoom)
- Displayed in bottom-right corner or toolbar

**Fit to screen:**
- `Alt+1` → fit all elements in viewport
- `Alt+2` → fit selected elements in viewport

### 12.5 Grid and Background

**Grid:**
- Toggleable grid display
- Grid spacing: 20px (adjustable)
- Grid color: subtle, doesn't interfere with content

**Background:**
- Solid color or gradient
- Respects dark/light mode

---

## 13. Implementation Priority

### Phase 1 — Core Canvas (Must Have)

| Feature | Priority | Notes |
|---------|----------|-------|
| Basic shapes | P0 | Rectangle, ellipse, text |
| Selection | P0 | Click, multi-select, resize |
| Drag to move | P0 | With snap guides |
| Connectors | P1 | Basic straight lines |
| Pan/Zoom | P0 | Mouse wheel, space bar |
| View mode switch | P0 | Page ↔ Edgeless |
| Document as Note card | P1 | Show doc in canvas |

### Phase 2 — Enhanced Canvas

| Feature | Priority | Notes |
|---------|----------|-------|
| Orthogonal connectors | P1 | A* path routing |
| Frame tool | P2 | Grouping container |
| Connector labels | P2 | Text on connectors |
| Make standalone | P2 | Extract to new doc |
| Private canvas items | P2 | Canvas-only elements |
| Undo/Redo | P1 | Command pattern |

### Phase 3 — Full Feature Parity

| Feature | Priority | Notes |
|---------|----------|-------|
| Note card editing | P1 | Inline block editor |
| Group/ungroup | P2 | Mod+g |
| Alignment tools | P2 | Distribute, align |
| Styles/presets | P3 | Shape templates |
| Animation | P3 | Transitions |

---

## 14. Data Schema for Hypowork

### 14.1 Canvas Nodes Table

```typescript
// In packages/db/src/schema/canvas_nodes.ts
export const canvasNodes = pgTable('canvas_nodes', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').notNull().references(() => documents.id),
  type: text('type').notNull(),  // 'shape', 'text', 'note', 'frame', 'group'

  // Bounds
  xywh: text('xywh').notNull(),  // '[x,y,w,h]'
  zIndex: integer('z_index').notNull().default(0),

  // Type-specific data
  data: jsonb('data').$type<ShapeData | TextData | NoteData | FrameData | GroupData>(),

  // For notes: reference to document
  linkedDocumentId: uuid('linked_document_id'),

  // For connectors
  sourceNodeId: uuid('source_node_id'),
  sourceAnchor: text('source_anchor'),  // 'top', 'right', 'bottom', 'left'
  targetNodeId: uuid('target_node_id'),
  targetAnchor: text('target_anchor'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

### 14.2 Canvas Viewport Table

```typescript
// In packages/db/src/schema/canvas_viewports.ts
export const canvasViewports = pgTable('canvas_viewports', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').notNull().references(() => documents.id),

  // Viewport state
  centerX: numeric('center_x').notNull().default(0),
  centerY: numeric('center_y').notNull().default(0),
  zoom: numeric('zoom').notNull().default(1),

  // Optional: canvas-specific settings
  gridEnabled: boolean('grid_enabled').default(true),
  snapEnabled: boolean('snap_enabled').default(true),

  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

---

## 15. Performance Considerations

### 15.1 Viewport Culling

Only render elements visible in the viewport:

```typescript
// Check if element bounds intersect viewport bounds
function isInViewport(element: CanvasElement, viewport: Viewport): boolean {
  const [ex, ey, ew, eh] = parseXYWH(element.xywh);
  return !(
    ex + ew < viewport.x ||
    ex > viewport.x + viewport.width ||
    ey + eh < viewport.y ||
    ey > viewport.y + viewport.height
  );
}
```

**Culling thresholds:**
- Buffer zone: render elements slightly outside viewport (100px) to avoid pop-in during pan
- Disable culling when zoom < 25%

### 15.2 Level of Detail (LOD)

At different zoom levels, render differently:

| Zoom Level | Rendering |
|------------|----------|
| < 25% | Simplified shapes, no text |
| 25-75% | Full shapes, truncated text |
| > 75% | Full detail |

### 15.3 Canvas Rendering

**Use hardware acceleration:**
```css
.canvas-container {
  transform: translateZ(0);
  will-change: transform;
  contain: layout style paint;
}
```

**Layer caching:**
- Background layer (grid): render once, cache as image
- Static elements: render to off-screen canvas, composite
- Dynamic elements: render each frame

### 15.4 Large Canvas Handling

**For 1000+ elements:**
- Spatial indexing (R-tree) for hit testing
- Batch rendering calls
- Web Workers for path computation
- Lazy load off-screen elements

---

## 16. Collaboration / Multiplayer

### 16.1 CRDT Integration

BlockSuite uses **Yjs** for collaborative editing:

```typescript
// Each element is a Y.Map
const yElements = new Y.Map<string, Y.Map>();

// When element changes, broadcast to peers
yElements.observe((event) => {
  broadcastToPeers(event);
});
```

### 16.2 Presence Awareness

Show other users' cursors and selections:

```typescript
interface UserPresence {
  userId: string;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null;
  selection: string[] | null;  // selected element IDs
}
```

**Display:**
- Small avatar + name at cursor position
- Selection border in user's color
- "User is editing..." indicator on elements

### 16.3 Conflict Resolution

**Last-write-wins for properties:**
- Position, size, style → LWW
- Text content → CRDT merge (Y.Text)

---

## 17. Accessibility

### 17.1 Keyboard Navigation

**Tab navigation:**
- `Tab` → next element
- `Shift+Tab` → previous element
- `Enter` → edit selected element
- `Escape` → exit edit mode

**Focus indicators:**
- Visible focus ring on selected element
- High contrast mode support

### 17.2 Screen Reader Support

**ARIA labels:**
```html
<canvas
  role="application"
  aria-label="Canvas with 15 elements. Press Tab to navigate."
>
```

**Element descriptions:**
- Each element has accessible name
- "Rectangle, 200 by 100 pixels, at position 100, 200"

### 17.3 Reduced Motion

Respect `prefers-reduced-motion`:
- Disable animated pan/zoom
- Instant transitions
- No auto-scroll effects

---

## 18. Mobile / Touch Support

### 18.1 Touch Gestures

| Gesture | Action |
|---------|--------|
| Single tap | Select element |
| Double tap | Edit element |
| Two-finger tap | Context menu |
| Pinch | Zoom |
| Two-finger drag | Pan |
| Long press + drag | Move element |

### 18.2 Mobile Toolbar

**Compact toolbar for touch:**
- Floating action button (FAB) → opens tool picker
- Bottom sheet for tool options
- Gesture-based tool switching

### 18.3 Responsive Layout

| Screen Size | Canvas Layout |
|-------------|--------------|
| Desktop (>1024px) | Full toolbar, side panels |
| Tablet (768-1024px) | Collapsible toolbar, bottom sheet |
| Mobile (<768px) | FAB + gesture-heavy, minimal chrome |

---

## 19. Error Handling

### 19.1 Corrupted Canvas Data

```typescript
try {
  const elements = JSON.parse(canvasData);
} catch {
  // Attempt recovery
  const recovered = recoverPartialData(canvasData);
  if (recovered) {
    showRecoveryDialog(recovered);
  } else {
    showErrorAndReset();
  }
}
```

### 19.2 Missing References

If a connector references a deleted element:
- Set `source.id = null`, store last position
- Show connector as "broken" with warning indicator
- Offer to reconnect or delete

### 19.3 Undo/Redo Limits

- Store last 100 operations
- Compacting: merge rapid small changes (e.g., typing)
- Clear old history on document save

---

## 20. Summary Checklist

Use this checklist when implementing:

### Core Canvas
- [ ] Document model with Page ↔ Edgeless switch
- [ ] Surface block storage
- [ ] Basic shapes (rect, ellipse, text)
- [ ] Selection and resize handles
- [ ] Drag to move with snap guides
- [ ] Connectors with anchor points
- [ ] Pan tool and viewport navigation
- [ ] Zoom with mouse wheel
- [ ] Keyboard shortcuts

### Enhanced Canvas
- [ ] Shape variants (diamond, triangle, etc.)
- [ ] Orthogonal connector routing
- [ ] Frame tool
- [ ] Group/ungroup
- [ ] Connector labels
- [ ] Make standalone
- [ ] Private canvas items

### Polish
- [ ] Undo/redo
- [ ] Copy/paste
- [ ] Context menu
- [ ] Grid and snap
- [ ] Viewport culling
- [ ] Performance optimization
- [ ] Touch support
- [ ] Accessibility

---

## 21. File Reference Map

### Core Canvas Files (BlockSuite)

| File | Purpose |
|------|---------|
| `blocksuite/affine/blocks/root/src/edgeless/edgeless-root-block.ts` | Root edgeless component |
| `blocksuite/affine/blocks/root/src/edgeless/edgeless-root-service.ts` | Service with CRUD operations |
| `blocksuite/affine/blocks/root/src/edgeless/edgeless-keyboard.ts` | Keyboard shortcuts |
| `blocksuite/affine/widgets/edgeless-toolbar/src/edgeless-toolbar.ts` | Main toolbar |
| `blocksuite/affine/model/src/elements/shape/shape.ts` | Shape model |
| `blocksuite/affine/model/src/elements/connector/connector.ts` | Connector model |
| `blocksuite/affine/shared/connector/src/connector-manager.ts` | Connection logic |
| `blocksuite/affine/shared/connector/src/path-generator.ts` | Path computation |

### Mode Switching

| File | Purpose |
|------|---------|
| `packages/frontend/core/src/blocksuite/block-suite-mode-switch/index.tsx` | Mode toggle UI |
| `packages/frontend/core/src/blocksuite/block-suite-mode-switch/switch-items.tsx` | Toggle items |

### Editors

| File | Purpose |
|------|---------|
| `packages/frontend/core/src/blocksuite/editors/edgeless-editor.ts` | Edgeless web component |
| `packages/frontend/core/src/blocksuite/editors/page-editor.ts` | Page (prose) web component |

### Additional BlockSuite References

| File | Purpose |
|------|---------|
| `blocksuite/affine/model/src/elements/index.ts` | All element model exports |
| `blocksuite/affine/std/src/gfx/controller/tool.ts` | Base tool controller |
| `blocksuite/affine/shared/src/utils/src/point.ts` | Point/geometry utilities |
| `blocksuite/affine/shared/connector/src/path-generator.ts` | Connector path generation |

---

*End of architecture study. Last updated: 2026-03-22*
