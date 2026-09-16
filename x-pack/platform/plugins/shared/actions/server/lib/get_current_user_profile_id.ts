/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { KibanaRequest, Logger } from '@kbn/core/server';
import type { SecurityPluginStart } from '@kbn/security-plugin/server';

/** Resolves a profile for HTTP requests; background FakeRequests must use their API key profile. */
export async function getCurrentUserProfileIdFromRequest(
  requestWithAuth: KibanaRequest,
  security: SecurityPluginStart | undefined,
  logger: Logger
): Promise<string | undefined> {
  try {
    const profileId = await security?.userProfiles.getCurrentProfileId({
      request: requestWithAuth,
    });
    if (profileId) {
      return profileId;
    }
  } catch (error) {
    logger.debug(
      `Failed to retrieve user profile from current auth context: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  return undefined;
}
