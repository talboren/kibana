/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { Logger } from '@kbn/core/server';
import { parseYamlToJSONWithoutValidation } from '../../common/lib/yaml/parse_workflow_yaml_to_json_without_validation';

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com';
const REPO_OWNER = 'elastic';
const REPO_NAME = 'workflows';
const REPO_BRANCH = 'main';
const WORKFLOWS_PATH = 'workflows';

interface GitHubTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

interface GitHubTreeResponse {
  sha: string;
  url: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  tags: string[];
  category: string;
  stepTypes: string[];
  yamlContent: string;
  githubUrl: string;
  path: string;
}

interface CacheEntry {
  data: WorkflowTemplate[];
  timestamp: number;
}

/**
 * Service for fetching and parsing workflow templates from GitHub
 */
export class GitHubWorkflowsService {
  private cache: CacheEntry | null = null;
  private readonly cacheTTL: number = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly logger: Logger, private readonly githubToken?: string) {}

  /**
   * Fetch all workflow templates from the GitHub repository
   */
  async getWorkflowTemplates(): Promise<WorkflowTemplate[]> {
    // Check cache first
    if (this.cache && Date.now() - this.cache.timestamp < this.cacheTTL) {
      this.logger.debug('Returning cached workflow templates');
      return this.cache.data;
    }

    try {
      this.logger.info('Fetching workflow templates from GitHub');
      const templates = await this.fetchTemplatesFromGitHub();

      // Update cache
      this.cache = {
        data: templates,
        timestamp: Date.now(),
      };

      this.logger.info(`Successfully fetched ${templates.length} workflow templates`);
      return templates;
    } catch (error) {
      this.logger.error('Failed to fetch workflow templates from GitHub');

      // Return cached data if available, even if expired
      if (this.cache) {
        this.logger.warn('Returning stale cached data due to fetch error');
        return this.cache.data;
      }

      throw error;
    }
  }

  /**
   * Clear the cache (useful for testing)
   */
  clearCache(): void {
    this.cache = null;
  }

  private async fetchTemplatesFromGitHub(): Promise<WorkflowTemplate[]> {
    // Get the tree of files recursively
    const treeUrl = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/${REPO_BRANCH}?recursive=1`;

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Kibana-Workflows-Management',
    };

    // Add authorization header if GitHub token is provided
    if (this.githubToken) {
      headers.Authorization = `Bearer ${this.githubToken}`;
    }

    const treeResponse = await fetch(treeUrl, { headers });

    if (!treeResponse.ok) {
      throw new Error(
        `GitHub API request failed: ${treeResponse.status} ${treeResponse.statusText}`
      );
    }

    const treeData: GitHubTreeResponse = await treeResponse.json();

    // Filter for YAML files in the workflows directory
    const yamlFiles = treeData.tree.filter(
      (item) =>
        item.type === 'blob' &&
        item.path.startsWith(`${WORKFLOWS_PATH}/`) &&
        (item.path.endsWith('.yaml') || item.path.endsWith('.yml'))
    );

    this.logger.debug(`Found ${yamlFiles.length} YAML files in workflows directory`);

    // Fetch and parse each workflow file
    const templates = await Promise.all(yamlFiles.map((file) => this.fetchAndParseWorkflow(file)));

    // Filter out any failed parses (null values)
    return templates.filter((template): template is WorkflowTemplate => template !== null);
  }

  private async fetchAndParseWorkflow(file: GitHubTreeItem): Promise<WorkflowTemplate | null> {
    try {
      // Fetch raw file content
      const rawUrl = `${GITHUB_RAW_BASE}/${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}/${file.path}`;

      const headers: Record<string, string> = {};

      // Add authorization header if GitHub token is provided
      if (this.githubToken) {
        headers.Authorization = `Bearer ${this.githubToken}`;
      }

      const response = await fetch(rawUrl, { headers });

      if (!response.ok) {
        this.logger.warn(`Failed to fetch workflow file: ${file.path}`);
        return null;
      }

      const yamlContent = await response.text();

      // Parse YAML to extract metadata
      const parseResult = parseYamlToJSONWithoutValidation(yamlContent);

      if (!parseResult.success) {
        this.logger.warn(`Failed to parse YAML for file: ${file.path}`);
        return null;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const workflow = parseResult.json as any;

      // Extract metadata
      const name = workflow.name || this.getNameFromPath(file.path);
      const description = workflow.description || '';
      const tags = Array.isArray(workflow.tags) ? workflow.tags : [];
      const category = this.getCategoryFromPath(file.path);
      const stepTypes = this.extractStepTypes(workflow);

      // Generate unique ID from path
      const id = file.path.replace(/\//g, '_').replace(/\.(yaml|yml)$/, '');

      const githubUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/blob/${REPO_BRANCH}/${file.path}`;

      return {
        id,
        name,
        description,
        tags,
        category,
        stepTypes,
        yamlContent,
        githubUrl,
        path: file.path,
      };
    } catch (error) {
      this.logger.warn(`Error processing workflow file: ${file.path}`, error);
      return null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractStepTypes(workflow: any): string[] {
    const stepTypes = new Set<string>();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processSteps = (steps: any[]) => {
      if (!Array.isArray(steps)) {
        return;
      }

      for (const step of steps) {
        if (step.type) {
          // Extract base type for connectors with sub-actions
          const baseType = this.getBaseStepType(step.type);
          stepTypes.add(baseType);
        }

        // Recursively process nested steps in conditionals
        if (step.steps) {
          processSteps(step.steps);
        }

        // Process else branch
        if (step.else) {
          processSteps(step.else);
        }
      }
    };

    if (workflow.steps) {
      processSteps(workflow.steps);
    }

    return Array.from(stepTypes);
  }

  private getBaseStepType(stepType: string): string {
    // Handle special cases
    if (stepType.startsWith('elasticsearch.')) {
      return 'elasticsearch';
    }
    if (stepType.startsWith('kibana.')) {
      return 'kibana';
    }
    if (stepType.startsWith('slack_api')) {
      return 'slack';
    }

    // For connectors with dot notation (e.g., jira.create_issue, data.set)
    if (stepType.startsWith('.')) {
      // Remove leading dot and extract base type
      const withoutDot = stepType.substring(1);
      return withoutDot.includes('.') ? withoutDot.split('.')[0] : withoutDot;
    }

    if (stepType.includes('.')) {
      return stepType.split('.')[0];
    }

    return stepType;
  }

  private getCategoryFromPath(path: string): string {
    // Extract category from path: workflows/category/file.yaml -> category
    const parts = path.split('/');
    if (parts.length >= 2 && parts[0] === WORKFLOWS_PATH) {
      return parts[1];
    }
    return 'uncategorized';
  }

  private getNameFromPath(path: string): string {
    // Extract filename without extension as fallback name
    const parts = path.split('/');
    const filename = parts[parts.length - 1];
    return filename.replace(/\.(yaml|yml)$/, '').replace(/-/g, ' ');
  }
}
