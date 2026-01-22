/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

/**
 * Represents a workflow template from the GitHub repository
 */
export interface WorkflowTemplate {
  /** Unique identifier for the template (derived from file path) */
  id: string;

  /** Display name of the workflow */
  name: string;

  /** Description of what the workflow does */
  description: string;

  /** Tags associated with the workflow */
  tags: string[];

  /** Category derived from the folder structure (e.g., 'ai-agents', 'security', 'examples') */
  category: string;

  /** Unique step types used in the workflow (base types extracted) */
  stepTypes: string[];

  /** Full YAML content of the workflow */
  yamlContent: string;

  /** URL to view the workflow on GitHub */
  githubUrl: string;

  /** Relative path in the repository */
  path: string;
}

/**
 * Response from the workflow templates API
 */
export interface WorkflowTemplatesResponse {
  /** Array of workflow templates */
  templates: WorkflowTemplate[];

  /** Total number of templates */
  total: number;
}

/**
 * Query parameters for filtering workflow templates
 */
export interface WorkflowTemplatesQuery {
  /** Filter by category */
  category?: string;

  /** Filter by search term (searches name and description) */
  search?: string;

  /** Filter by tags */
  tags?: string[];
}
