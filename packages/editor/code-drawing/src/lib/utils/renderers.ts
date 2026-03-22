import type { CodeDrawingType } from '../constants';
import { preprocessMermaidSourceForDarkMode } from './mermaidDarkModeSource';

/**
 * Generate a random string for unique IDs
 */
function randomString(
  length: number,
  type: 'lowerCase' | 'upperCase' = 'lowerCase'
): string {
  const chars =
    type === 'lowerCase'
      ? 'abcdefghijklmnopqrstuvwxyz'
      : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Convert SVG string to data URL
 */
function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${window.btoa(unescape(encodeURIComponent(svg)))}`;
}

/**
 * Render PlantUml diagram
 * Uses plantuml-encoder to encode content and fetches SVG from PlantUml server
 */
export async function renderPlantUml(content: string): Promise<string> {
  try {
    // Dynamic import of plantuml-encoder
    const plantumlEncoder = await import('plantuml-encoder');
    const encoded = plantumlEncoder.default.encode(content);
    const svgUrl = `https://www.plantuml.com/plantuml/svg/${encoded}`;

    // Fetch SVG
    const response = await fetch(svgUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch PlantUml SVG');
    }
    const svg = await response.text();
    return svgToDataUrl(svg);
  } catch (error) {
    console.error('PlantUml rendering error:', error);
    throw error;
  }
}

/**
 * Render Graphviz diagram
 * Uses viz.js to render Graphviz DOT syntax to SVG
 */
export async function renderGraphviz(content: string): Promise<string> {
  try {
    // Dynamic import of viz.js
    // Try different import patterns for compatibility
    let Viz: any;
    let Module: any;
    let render: any;

    try {
      const vizModule = await import('viz.js');
      Viz = vizModule.default || vizModule;

      const fullRender = await import('viz.js/full.render.js');
      Module = fullRender.Module;
      render = fullRender.render;
    } catch (_importError) {
      // Fallback: try alternative import
      const vizModule = await import('viz.js');
      Viz = vizModule.default || vizModule;
      const fullRender = await import('viz.js/full.render');
      Module = fullRender.Module;
      render = fullRender.render;
    }

    const viz = new Viz({ Module, render });
    const svg = await viz.renderString(content, {
      format: 'svg',
      engine: 'dot',
    });

    return svgToDataUrl(svg);
  } catch (error) {
    console.error('Graphviz rendering error:', error);
    throw error;
  }
}

/**
 * Render Flowchart diagram
 * Uses flowchart.js to parse and render flowchart syntax
 */
export async function renderFlowchart(content: string): Promise<string> {
  try {
    // Dynamic import of flowchart.js
    const flowchart = (await import('flowchart.js')).default;

    const chart = flowchart.parse(content);
    const el = document.createElement('div');
    el.style.display = 'none';
    document.body.appendChild(el);

    chart.drawSVG(el);
    const svg = el.innerHTML;
    document.body.removeChild(el);

    return svgToDataUrl(svg);
  } catch (error) {
    console.error('Flowchart rendering error:', error);
    throw error;
  }
}

/**
 * Render Mermaid diagram
 * Uses mermaid to render Mermaid syntax
 */
let elkLayoutsRegistered = false;

function isDocumentDark(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

/** ELK renderer injects stroke/fill #333 in inline styles; themeVariables do not replace those. */
function boostMermaidEdgeContrastForDark(svg: string): string {
  return svg
    .replace(/stroke:\s*#333333\b/gi, 'stroke: #d4d4d4')
    .replace(/stroke:\s*#333\b/gi, 'stroke: #d4d4d4')
    .replace(/fill:\s*#333333\b/gi, 'fill: #d4d4d4')
    .replace(/fill:\s*#333\b/gi, 'fill: #d4d4d4');
}

function diagramRequestsElk(source: string): boolean {
  return (
    /defaultRenderer\s*:\s*['"]elk['"]/i.test(source) ||
    /layout\s*:\s*elk\b/i.test(source) ||
    /\bflowchart-elk\b/i.test(source)
  );
}

/** Mermaid 11+ ships ELK separately; must call registerLayoutLoaders **before** initialize (see @mermaid-js/layout-elk README). */
async function registerElkLayouts(
  mermaid: typeof import('mermaid').default
): Promise<void> {
  if (elkLayoutsRegistered) return;
  try {
    const elkMod = await import('@mermaid-js/layout-elk');
    const layouts = elkMod.default ?? elkMod;
    mermaid.registerLayoutLoaders(layouts as never);
    elkLayoutsRegistered = true;
  } catch (e) {
    console.error(
      '[mermaid] Failed to load @mermaid-js/layout-elk (ELK diagrams will not render):',
      e
    );
  }
}

export async function renderMermaid(content: string): Promise<string> {
  try {
    const mermaid = await import('mermaid');
    const api = mermaid.default;

    // Register ELK loaders first, then initialize — required for ELK flowcharts in Mermaid 11+.
    await registerElkLayouts(api);

    if (diagramRequestsElk(content) && !elkLayoutsRegistered) {
      throw new Error(
        'ELK layout failed to load (@mermaid-js/layout-elk). Remove the init line or run pnpm install.'
      );
    }

    const dark = isDocumentDark();
    // Re-initialize each render so theme matches app chrome (Plate preview uses a data-URL <img>, not live SVG).
    api.initialize({
      startOnLoad: false,
      // HTML in labels (e.g. <br/>) and class styles need non-strict mode in Mermaid 11.
      securityLevel: 'loose',
      flowchart: { htmlLabels: true },
      theme: dark ? 'dark' : 'default',
      ...(dark
        ? {
            themeVariables: {
              // Dark theme defaults + ELK inline #333 are too low-contrast on app background.
              lineColor: '#d4d4d4',
              arrowheadColor: '#d4d4d4',
            },
          }
        : {}),
    });

    const id = `mermaid-${randomString(6, 'lowerCase')}`;
    const sourceToRender = dark ? preprocessMermaidSourceForDarkMode(content) : content;
    let { svg } = await api.render(id, sourceToRender);

    if (svg) {
      if (dark) {
        svg = boostMermaidEdgeContrastForDark(svg);
      }
      return svgToDataUrl(svg);
    }

    throw new Error('Mermaid rendering failed');
  } catch (error) {
    console.error('Mermaid rendering error:', error);
    throw error;
  }
}

/**
 * Render code drawing based on type
 */
export async function renderCodeDrawing(
  type: CodeDrawingType,
  content: string
): Promise<string> {
  if (!content || !content.trim()) {
    return '';
  }

  switch (type) {
    case 'PlantUml':
      return renderPlantUml(content);
    case 'Graphviz':
      return renderGraphviz(content);
    case 'Flowchart':
      return renderFlowchart(content);
    case 'Mermaid':
      return renderMermaid(content);
    default:
      throw new Error(`Unsupported drawing type: ${type}`);
  }
}
