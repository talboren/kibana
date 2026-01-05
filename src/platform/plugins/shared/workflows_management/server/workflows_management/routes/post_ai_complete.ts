/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { schema } from '@kbn/config-schema';
import type { InferenceServerStart } from '@kbn/inference-plugin/server';
import { WORKFLOW_ROUTE_OPTIONS } from './route_constants';
import { handleRouteError } from './route_error_handlers';
import { WORKFLOW_READ_SECURITY } from './route_security';
import type { RouteDependencies } from './types';

interface AiCompleteDependencies extends RouteDependencies {
  getInference: () => InferenceServerStart | undefined;
}

export function registerPostAiCompleteRoute({
  router,
  logger,
  getInference,
}: AiCompleteDependencies) {
  router.post(
    {
      path: '/api/workflows/ai/complete',
      options: WORKFLOW_ROUTE_OPTIONS,
      security: WORKFLOW_READ_SECURITY,
      validate: {
        body: schema.object({
          prompt: schema.string(),
          textBeforeCursor: schema.string(),
          textAfterCursor: schema.maybe(schema.string()),
          maxTokens: schema.maybe(schema.number({ defaultValue: 100 })),
          connectorId: schema.maybe(schema.string()),
        }),
      },
    },
    async (context, request, response) => {
      try {
        logger.info('[WorkflowCopilot] AI complete request received');
        
        const inference = getInference();
        
        if (!inference) {
          logger.warn('[WorkflowCopilot] Inference plugin not available for AI completion');
          return response.custom({
            statusCode: 503,
            body: { message: 'AI completion service not available' },
          });
        }

        const { prompt, connectorId } = request.body;
        logger.info('[WorkflowCopilot] Request details:', {
          promptLength: prompt.length,
          requestedConnectorId: connectorId,
        });

        // Get default connector or use specified one
        let resolvedConnectorId = connectorId;
        if (!resolvedConnectorId || resolvedConnectorId === '@default') {
          logger.info('[WorkflowCopilot] Getting default connector...');
          const defaultConnector = await inference.getDefaultConnector(request);
          resolvedConnectorId = defaultConnector?.connectorId;
          logger.info('[WorkflowCopilot] Default connector:', resolvedConnectorId);
        }

        if (!resolvedConnectorId) {
          logger.warn('[WorkflowCopilot] No AI connector configured');
          return response.badRequest({
            body: { message: 'No AI connector configured. Please configure an inference connector.' },
          });
        }

        // Get chat model
        logger.info('[WorkflowCopilot] Getting chat model for connector:', resolvedConnectorId);
        const chatModel = await inference.getChatModel({
          connectorId: resolvedConnectorId,
          request,
          chatModelOptions: {
            temperature: 0.3, // Lower temperature for more deterministic code completion
            maxRetries: 1,
          },
        });

        // Call the model
        logger.info('[WorkflowCopilot] Invoking AI model...');
        const modelResponse = await chatModel.invoke([
          {
            role: 'user',
            content: prompt,
          },
        ]);

        logger.info('[WorkflowCopilot] Model response received:', {
          contentLength: typeof modelResponse.content === 'string' ? modelResponse.content.length : 0,
          hasMetadata: !!modelResponse.response_metadata,
        });

        // Extract and clean the suggestion
        let suggestion = typeof modelResponse.content === 'string' ? modelResponse.content : '';

        // Post-process: remove markdown code fences if present
        suggestion = suggestion
          .replace(/```yaml\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();

        logger.info('[WorkflowCopilot] Returning suggestion:', {
          suggestionLength: suggestion.length,
          suggestionPreview: suggestion.substring(0, 100),
        });

        return response.ok({
          body: {
            suggestion,
            metadata: modelResponse.response_metadata,
          },
        });
      } catch (error) {
        logger.error(`[WorkflowCopilot] Failed to get AI completion: ${error.message}`, error);
        return handleRouteError(response, error);
      }
    }
  );
}
