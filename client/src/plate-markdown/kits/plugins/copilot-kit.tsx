'use client';

import type { TElement } from 'platejs';

import { CopilotPlugin } from '@platejs/ai/react';
import { serializeMd, stripMarkdown } from '@platejs/markdown';

import { GhostText } from '@/ui/ghost-text';

import { MarkdownKit } from './markdown-kit';

export const CopilotKit = [
  ...MarkdownKit,
  CopilotPlugin.configure(({ api }) => ({
    options: {
      completeOptions: {
        api: import.meta.env.VITE_AI_API_URL
          ? `${import.meta.env.VITE_AI_API_URL.replace(/\/$/, '')}/copilot`
          : '',
        credentials: 'include',
        body: {
          system: `You are an advanced AI writing assistant, similar to VSCode Copilot but for general text. Your task is to predict and generate the next part of the text based on the given context.
  
  Rules:
  - Continue the text naturally up to the next punctuation mark (., ,, ;, :, ?, or !).
  - Maintain style and tone. Don't repeat given text.
  - For unclear context, provide the most likely continuation.
  - Handle code snippets, lists, or structured text if needed.
  - Don't include """ in your response.
  - CRITICAL: Always end with a punctuation mark.
  - CRITICAL: Avoid starting a new block. Do not use block formatting like >, #, 1., 2., -, etc. The suggestion should continue in the same block as the context.
  - Language: Respond in English unless the user explicitly asks for a different language.
  - If no context is provided or you can't generate a continuation, return "0" without explanation.`,
        },
        onError: () => {
          const fallbackText = 'Continue writing clear English documentation for this project.';
          // #region agent log
          fetch('http://127.0.0.1:7267/ingest/5414ad03-148a-4367-b6cb-a798cd64057b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'57354f'},body:JSON.stringify({sessionId:'57354f',runId:'initial',hypothesisId:'H2',location:'client/src/plate-markdown/kits/plugins/copilot-kit.tsx:onError',message:'Plate-markdown copilot onError fallback branch used',data:{fallbackPreview:fallbackText.slice(0,80),hasApiBase:Boolean(import.meta.env.VITE_AI_API_URL)},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          // Mock the API response. Remove it when you implement the route /api/ai/copilot
          api.copilot.setBlockSuggestion({
            text: stripMarkdown(fallbackText),
          });
        },
        onFinish: (_, completion) => {
          // #region agent log
          fetch('http://127.0.0.1:7267/ingest/5414ad03-148a-4367-b6cb-a798cd64057b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'57354f'},body:JSON.stringify({sessionId:'57354f',runId:'initial',hypothesisId:'H3',location:'client/src/plate-markdown/kits/plugins/copilot-kit.tsx:onFinish',message:'Plate-markdown copilot completion received',data:{preview:String(completion ?? '').slice(0,80),length:completion?.length ?? 0},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          if (completion === '0') return;

          api.copilot.setBlockSuggestion({
            text: stripMarkdown(completion),
          });
        },
      },
      debounceDelay: 500,
      renderGhostText: GhostText,
      getPrompt: ({ editor }) => {
        const contextEntry = editor.api.block({ highest: true });

        if (!contextEntry) return '';

        const prompt = serializeMd(editor, {
          value: [contextEntry[0] as TElement],
        });

        return `Continue the text up to the next punctuation mark:
  """
  ${prompt}
  """`;
      },
    },
    shortcuts: {
      accept: {
        keys: 'tab',
      },
      acceptNextWord: {
        keys: 'mod+right',
      },
      reject: {
        keys: 'escape',
      },
      triggerSuggestion: {
        keys: 'ctrl+space',
      },
    },
  })),
];
