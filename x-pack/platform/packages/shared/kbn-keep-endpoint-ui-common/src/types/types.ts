/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { ConfigProperties } from './dynamic_config/types';

interface ConfigEntry extends ConfigProperties {
  key: string;
}

export * from './dynamic_config/types';

export interface ConfigEntryView extends ConfigEntry {
  isValid: boolean;
  validationErrors: string[];
  value: string | number | boolean | null;
}

export interface KeepProviderConfig {
  [key: string]: {
    required: boolean;
    description: string;
    sensitive: boolean;
    default: any;
    hint?: string;
    validation?: string;
  };
}

export interface KeepProvider {
  id: string | null;
  display_name: string;
  type: string;
  config: KeepProviderConfig;
  details: any;
  can_notify: boolean;
  notify_params: any;
  can_query: boolean;
  query_params: any;
  installed: boolean;
  linked: boolean;
  last_alert_received: string | null;
  supports_webhook: boolean;
  can_setup_webhook: boolean;
  webhook_required: boolean;
  provider_description: string | null;
  oauth2_url: string | null;
  scopes: string[];
  validatedScopes: Record<string, any>;
  methods: string[];
  installed_by: string | null;
  installation_time: string | null;
  pulling_available: boolean;
  pulling_enabled: boolean;
  last_pull_time: string | null;
  docs: string | null;
  tags: string[];
  categories: string[];
  coming_soon: boolean;
  alertsDistribution: any;
  alertExample: any;
  default_fingerprint_fields: string[];
  provisioned: boolean;
  health: boolean;
  provider_metadata: Record<string, any>;
}

export interface KeepProvidersResponse {
  providers: KeepProvider[];
}
