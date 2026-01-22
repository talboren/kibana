/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { schema } from '@kbn/config-schema';
import { WORKFLOW_ROUTE_OPTIONS } from './route_constants';
import { handleRouteError } from './route_error_handlers';
import { WORKFLOW_READ_SECURITY } from './route_security';
import type { RouteDependencies } from './types';
import type { WorkflowTemplatesResponse } from '../../../common';
import { withLicenseCheck } from '../lib/with_license_check';

export function registerGetWorkflowTemplatesRoute({ router, api, logger }: RouteDependencies) {
  router.get(
    {
      path: '/api/workflows/templates',
      options: WORKFLOW_ROUTE_OPTIONS,
      security: WORKFLOW_READ_SECURITY,
      validate: {
        query: schema.object({
          category: schema.maybe(schema.string()),
          search: schema.maybe(schema.string()),
          tags: schema.maybe(schema.oneOf([schema.string(), schema.arrayOf(schema.string())])),
        }),
      },
    },
    withLicenseCheck(async (context, request, response) => {
      try {
        const { category, search, tags } = request.query as {
          category?: string;
          search?: string;
          tags?: string | string[];
        };

        // Get templates from GitHub service
        const templates = await api.getWorkflowTemplates();

        // Apply filters
        let filteredTemplates = templates;

        if (category) {
          filteredTemplates = filteredTemplates.filter((t) => t.category === category);
        }

        if (search) {
          const searchLower = search.toLowerCase();
          filteredTemplates = filteredTemplates.filter(
            (t) =>
              t.name.toLowerCase().includes(searchLower) ||
              t.description.toLowerCase().includes(searchLower)
          );
        }

        if (tags) {
          const tagArray = Array.isArray(tags) ? tags : [tags];
          filteredTemplates = filteredTemplates.filter((t) =>
            tagArray.some((tag) => t.tags.includes(tag))
          );
        }

        const responseBody: WorkflowTemplatesResponse = {
          templates: filteredTemplates,
          total: filteredTemplates.length,
        };

        return response.ok({ body: responseBody });
      } catch (error) {
        logger.error('Failed to fetch workflow templates', error);
        return handleRouteError(response, error);
      }
    })
  );
}
