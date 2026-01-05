/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { HttpSetup } from '@kbn/core/public';
import { monaco } from '@kbn/monaco';

interface ConnectorInfo {
  id: string;
  name: string;
  type: string;
}

interface WorkflowInlineCompletionsConfig {
  http: HttpSetup;
  connectorId?: string;
  getAvailableConnectors?: () => Promise<ConnectorInfo[]>;
}

export class WorkflowInlineCompletionsProvider
  implements monaco.languages.InlineCompletionsProvider
{
  private isRequesting = false;

  constructor(private config: WorkflowInlineCompletionsConfig) {}

  async provideInlineCompletions(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    context: monaco.languages.InlineCompletionContext,
    token: monaco.CancellationToken
  ): Promise<monaco.languages.InlineCompletions | undefined> {
    console.log('[WorkflowCopilot] provideInlineCompletions called', {
      position: { line: position.lineNumber, column: position.column },
      triggerKind: context.triggerKind,
      isRequesting: this.isRequesting,
    });

    try {
      // Don't trigger if already requesting to avoid overwhelming the API
      if (this.isRequesting) {
        console.log('[WorkflowCopilot] Already requesting, skipping');
        return { items: [] };
      }

      // Only show suggestions if manually triggered or when typing
      if (
        context.triggerKind !== monaco.languages.InlineCompletionTriggerKind.Automatic &&
        context.triggerKind !== monaco.languages.InlineCompletionTriggerKind.Explicit
      ) {
        console.log('[WorkflowCopilot] Trigger kind not supported:', context.triggerKind);
        return { items: [] };
      }

      const fullText = model.getValue();

      // Get text before cursor
      const textBeforeCursor = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      // Get text after cursor for context
      const textAfterCursor = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: model.getLineCount(),
        endColumn: model.getLineMaxColumn(model.getLineCount()),
      });

      // Check if cursor is at the end of a line or meaningful position
      const currentLine = model.getLineContent(position.lineNumber);
      const textAfterCursorOnLine = currentLine.substring(position.column - 1);
      const textBeforeCursorOnLine = currentLine.substring(0, position.column - 1);

      console.log('[WorkflowCopilot] Current line context:', {
        currentLine,
        textBeforeCursorOnLine,
        textAfterCursorOnLine,
        textAfterTrimmed: textAfterCursorOnLine.trim().length,
        textBeforeTrimmed: textBeforeCursorOnLine.trim().length,
      });

      // Only suggest if at end of line or only whitespace after cursor
      if (textAfterCursorOnLine.trim().length > 0) {
        console.log('[WorkflowCopilot] Text after cursor, skipping');
        return { items: [] };
      }

      // Only trigger if we have enough context (at least 2 characters typed on current line)
      if (textBeforeCursorOnLine.trim().length < 2) {
        console.log('[WorkflowCopilot] Not enough context (< 2 chars), skipping');
        return { items: [] };
      }

      // Call AI for suggestion
      console.log('[WorkflowCopilot] Calling AI for suggestion...');
      const suggestion = await this.getAISuggestion(
        textBeforeCursor,
        textAfterCursor,
        fullText,
        token
      );

      if (!suggestion || suggestion.trim().length === 0) {
        console.log('[WorkflowCopilot] No suggestion returned or empty');
        return { items: [] };
      }

      console.log('[WorkflowCopilot] Got suggestion:', suggestion.substring(0, 100));

      // Post-process: Only return the suffix that should be completed
      // Remove any text that was already typed (to avoid duplication)
      const processedSuggestion = this.removeDuplicatePrefix(
        textBeforeCursorOnLine,
        suggestion
      );

      if (!processedSuggestion || processedSuggestion.trim().length === 0) {
        console.log('[WorkflowCopilot] Suggestion fully duplicates existing text, skipping');
        return { items: [] };
      }

      console.log('[WorkflowCopilot] Processed suggestion:', processedSuggestion.substring(0, 100));

      const range = new monaco.Range(
        position.lineNumber,
        position.column,
        position.lineNumber,
        position.column
      );

      return {
        items: [
          {
            insertText: processedSuggestion,
            range,
          },
        ],
      };
    } catch (error) {
      // Silently fail - don't disrupt the user experience
      console.error('[WorkflowCopilot] Error providing inline completions:', error);
      return { items: [] };
    } finally {
      this.isRequesting = false;
    }
  }

  private async getAISuggestion(
    textBeforeCursor: string,
    textAfterCursor: string,
    fullText: string,
    token: monaco.CancellationToken
  ): Promise<string | null> {
    try {
      this.isRequesting = true;

      // Get available connectors for context
      let connectorsContext = '';
      if (this.config.getAvailableConnectors) {
        try {
          const connectors = await this.config.getAvailableConnectors();
          if (connectors.length > 0) {
            connectorsContext = this.formatConnectorsContext(connectors);
          }
        } catch (error) {
          console.warn('[WorkflowCopilot] Failed to get connectors context:', error);
        }
      }

      // Build a context-aware prompt
      const prompt = this.buildPrompt(textBeforeCursor, textAfterCursor, connectorsContext);
      console.log('[WorkflowCopilot] Built prompt (first 200 chars):', prompt.substring(0, 200));

      // Create abort controller from Monaco's cancellation token
      const abortController = new AbortController();
      if (token.isCancellationRequested) {
        console.log('[WorkflowCopilot] Token already cancelled');
        return null;
      }

      // Listen for cancellation
      const disposable = token.onCancellationRequested(() => {
        console.log('[WorkflowCopilot] Request cancelled');
        abortController.abort();
      });

      try {
        console.log('[WorkflowCopilot] Making API request to /api/workflows/ai/complete');
        const response = await this.config.http.post<{
          suggestion: string;
          metadata?: unknown;
        }>('/api/workflows/ai/complete', {
          body: JSON.stringify({
            prompt,
            textBeforeCursor,
            textAfterCursor,
            maxTokens: 100,
            connectorId: this.config.connectorId || '@default',
          }),
          signal: abortController.signal,
        });

        console.log('[WorkflowCopilot] API response received:', {
          suggestion: response.suggestion?.substring(0, 100),
          hasMetadata: !!response.metadata,
        });

        disposable.dispose();
        return response.suggestion || null;
      } catch (error: unknown) {
        disposable.dispose();
        
        // Don't log if request was cancelled
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('[WorkflowCopilot] Request aborted');
          return null;
        }
        
        console.error('[WorkflowCopilot] API request failed:', error);
        throw error;
      }
    } catch (error) {
      console.error('[WorkflowCopilot] Error getting AI suggestion:', error);
      return null;
    }
  }

  private formatConnectorsContext(connectors: ConnectorInfo[]): string {
    const byType = connectors.reduce((acc, conn) => {
      if (!acc[conn.type]) {
        acc[conn.type] = [];
      }
      acc[conn.type].push(conn);
      return acc;
    }, {} as Record<string, ConnectorInfo[]>);

    let context = '\nAvailable connectors in this Kibana instance:\n';
    
    for (const [type, conns] of Object.entries(byType)) {
      context += `\n${type} connectors:\n`;
      conns.slice(0, 5).forEach((conn) => {
        context += `  - id: "${conn.id}", name: "${conn.name}"\n`;
      });
      if (conns.length > 5) {
        context += `  ... and ${conns.length - 5} more\n`;
      }
    }

    return context;
  }

  private removeDuplicatePrefix(textBeforeCursorOnLine: string, suggestion: string): string {
    // Get the last word/partial typed by user
    const trimmedBefore = textBeforeCursorOnLine.trimStart();
    const lastWord = trimmedBefore.split(/[\s:]/).pop() || '';
    
    console.log('[WorkflowCopilot] Checking for duplicate prefix:', {
      lastWord,
      suggestionStart: suggestion.substring(0, 50),
    });

    // If suggestion starts with what user already typed, remove that part
    if (lastWord && suggestion.toLowerCase().startsWith(lastWord.toLowerCase())) {
      const cleaned = suggestion.substring(lastWord.length);
      console.log('[WorkflowCopilot] Removed duplicate prefix, returning:', cleaned.substring(0, 50));
      return cleaned;
    }

    // Also check if the suggestion repeats the entire current line prefix
    const trimmedSuggestion = suggestion.trimStart();
    if (trimmedBefore && trimmedSuggestion.toLowerCase().startsWith(trimmedBefore.toLowerCase())) {
      const cleaned = suggestion.substring(trimmedBefore.length);
      console.log('[WorkflowCopilot] Removed entire line duplicate, returning:', cleaned.substring(0, 50));
      return cleaned;
    }

    return suggestion;
  }

  private buildPrompt(
    textBeforeCursor: string,
    textAfterCursor: string,
    connectorsContext: string
  ): string {
    // Extract the current line context for better completions
    const lines = textBeforeCursor.split('\n');
    const currentLinePrefix = lines[lines.length - 1] || '';
    
    // Determine indentation level
    const indentMatch = currentLinePrefix.match(/^(\s*)/);
    const currentIndent = indentMatch ? indentMatch[1] : '';
    
    // Extract what was already typed on the current line
    const alreadyTyped = currentLinePrefix.trimStart();

    return `You are an AI assistant helping to write Kibana workflow YAML files.

Context about workflows:
- Workflows are defined in YAML format with strict indentation (2 spaces per level)
- Common top-level keys: name, description, triggers, variables, steps
- Steps structure:
  - name: (string) unique identifier
  - type: (string) one of: kibana.request, elasticsearch.query, ai.prompt, custom types
  - with: (object) step inputs/parameters
  - timeout: (string) e.g., "5m", "30s"
  - on-failure: (object) error handling with retry, continue, or fail strategies
- Variables are referenced with: {{ variable.name }} or {{ variables.varName }}
- Steps outputs are accessed via: {{ steps.stepName.output.fieldName }}
- Common kibana.request step fields:
  - method: GET, POST, PUT, DELETE
  - path: API endpoint path
  - headers: request headers
  - body: request body (for POST/PUT)
- Common ai.prompt step fields:
  - connectorId: AI connector ID or "@default"
  - prompt: the prompt text
  - temperature: 0.0 to 1.0
  - outputSchema: JSON schema for structured output
${connectorsContext}

Current workflow (cursor at <CURSOR>):
\`\`\`yaml
${textBeforeCursor}<CURSOR>${textAfterCursor}
\`\`\`

User has already typed on current line: "${alreadyTyped}"

Complete ONLY THE REMAINING TEXT after what the user typed. Critical rules:
1. DO NOT repeat what user already typed ("${alreadyTyped}")
2. Return ONLY the completion suffix (no explanations, no markdown, no code fences)
3. Match indentation: ${currentIndent.length} spaces at start of new lines
4. Keep it concise - prefer completing current line or next logical element
5. Use valid YAML syntax (proper colons, spacing, quotes when needed)
6. If completing a key, include the colon: "key: value"
7. Use real connector IDs from the available connectors list when applicable

Completion (suffix only):`;
  }

  freeInlineCompletions(): void {
    // Cleanup if needed
  }
}
