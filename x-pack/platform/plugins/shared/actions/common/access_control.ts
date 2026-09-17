/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { createAccessControlSchema, hasEntityAccess } from '@kbn/entity-access-control';
import type { AccessControl } from '@kbn/entity-access-control';

export const CONNECTOR_ACCESS_ROLES = ['executor'] as const;
export const connectorAccessControlSchema = createAccessControlSchema(CONNECTOR_ACCESS_ROLES);

export interface ConnectorAccessSubject {
  owner_id?: string;
  access_control?: AccessControl<'executor'>;
}

export const getConnectorPermissions = (
  connector: ConnectorAccessSubject,
  profileId?: string
): { read: boolean; execute: boolean; edit: boolean; manage: boolean } => {
  const isOwner = !!profileId && connector.owner_id === profileId;
  const { access_control: accessControl } = connector;
  const isPublic = accessControl?.access_mode !== 'private';
  const read =
    isPublic ||
    (!!accessControl &&
      hasEntityAccess({
        accessControl,
        ownerId: connector.owner_id,
        profileId,
        roles: CONNECTOR_ACCESS_ROLES,
      }));
  return {
    read,
    execute: read,
    edit: isPublic || isOwner,
    manage: !!profileId && ((!connector.owner_id && isPublic) || isOwner),
  };
};

export interface ConnectorAccessResponse extends ConnectorAccessSubject {
  permissions: ReturnType<typeof getConnectorPermissions>;
}
