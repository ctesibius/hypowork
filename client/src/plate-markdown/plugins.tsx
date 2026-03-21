import { CopilotKit } from '@/kits/plugins/copilot-kit';
import { EditorKit } from '@/kits/editor-kit';

export const plugins = [...CopilotKit, ...EditorKit];
