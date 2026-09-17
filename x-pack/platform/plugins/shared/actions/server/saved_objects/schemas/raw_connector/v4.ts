/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { schema } from '@kbn/config-schema';
import {
  ACCESS_CONTROL_MAX_ENTRIES,
  ACCESS_CONTROL_PRINCIPAL_ID_MAX_LENGTH,
} from '@kbn/entity-access-control';
import { rawConnectorSchema as rawConnectorSchemaV3 } from './v3';

const profileId = schema.string({
  minLength: 1,
  maxLength: ACCESS_CONTROL_PRINCIPAL_ID_MAX_LENGTH,
});
export const rawConnectorSchema = rawConnectorSchemaV3.extends({
  owner_id: schema.maybe(profileId),
  access_control: schema.maybe(
    schema.object({
      access_mode: schema.oneOf([schema.literal('public'), schema.literal('private')]),
      entries: schema.arrayOf(
        schema.object({
          type: schema.literal('user'),
          id: profileId,
          role: schema.literal('executor'),
          added_at: schema.string({ maxLength: 100 }),
        }),
        { maxSize: ACCESS_CONTROL_MAX_ENTRIES }
      ),
    })
  ),
});
