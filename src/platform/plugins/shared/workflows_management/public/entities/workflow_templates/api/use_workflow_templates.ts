/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { useQuery } from '@kbn/react-query';
import type {
  WorkflowTemplate,
  WorkflowTemplatesQuery,
  WorkflowTemplatesResponse,
} from '../../../../common';
import { useKibana } from '../../../hooks/use_kibana';

export const WORKFLOW_TEMPLATES_QUERY_KEY = 'workflowTemplates';

/**
 * React Query hook to fetch workflow templates from GitHub
 */
export function useWorkflowTemplates(query?: WorkflowTemplatesQuery) {
  const { http } = useKibana().services;

  return useQuery<WorkflowTemplate[], Error>({
    queryKey: [WORKFLOW_TEMPLATES_QUERY_KEY, query],
    queryFn: async () => {
      const params = new URLSearchParams();

      if (query?.category) {
        params.append('category', query.category);
      }

      if (query?.search) {
        params.append('search', query.search);
      }

      if (query?.tags && query.tags.length > 0) {
        query.tags.forEach((tag) => params.append('tags', tag));
      }

      const queryString = params.toString();
      const url = `/api/workflows/templates${queryString ? `?${queryString}` : ''}`;

      const response = await http.get<WorkflowTemplatesResponse>(url);
      return response.templates;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - matches server cache TTL
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to get a single template by ID
 */
export function useWorkflowTemplate(templateId: string | undefined) {
  const { data: templates, ...rest } = useWorkflowTemplates();

  const template = templates?.find((t) => t.id === templateId);

  return {
    data: template,
    ...rest,
  };
}
