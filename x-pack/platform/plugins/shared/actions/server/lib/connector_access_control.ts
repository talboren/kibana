/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import Boom from '@hapi/boom';
import { prepareAccessControl } from '@kbn/entity-access-control';
import type { AccessControlInput } from '@kbn/entity-access-control';
import { CONNECTOR_ACCESS_ROLES, getConnectorPermissions } from '../../common/access_control';
import type { ConnectorAccessResponse, ConnectorAccessSubject } from '../../common/access_control';
import type { ActionsClientContext } from '../actions_client';
import type { RawAction } from '../types';

type AccessContext = Pick<
  ActionsClientContext,
  'request' | 'getCurrentUserProfileId' | 'unsecuredSavedObjectsClient'
> & { authorization: Pick<ActionsClientContext['authorization'], 'ensureAuthorized'> };

export const assertConnectorAccess = (
  connector: ConnectorAccessSubject,
  profileId: string | undefined,
  operation: 'read' | 'execute' | 'edit' | 'manage'
): void => {
  if (!getConnectorPermissions(connector, profileId)[operation]) {
    throw Boom.notFound('Connector not found');
  }
};

export const ensureConnectorAccess = async (
  context: AccessContext,
  connector: ConnectorAccessSubject,
  operation: 'read' | 'execute' | 'edit'
): Promise<void> => {
  if (connector.access_control?.access_mode === 'private') {
    assertConnectorAccess(
      connector,
      await context.getCurrentUserProfileId?.(context.request),
      operation
    );
  }
};

export const getConnectorAccess = async (
  context: AccessContext,
  id: string
): Promise<ConnectorAccessResponse> => {
  await context.authorization.ensureAuthorized({ operation: 'get' });
  const { attributes } = await context.unsecuredSavedObjectsClient.get<RawAction>('action', id);
  const profileId = await context.getCurrentUserProfileId?.(context.request);
  assertConnectorAccess(attributes, profileId, 'read');
  const permissions = getConnectorPermissions(attributes, profileId);
  return {
    permissions,
    ...(permissions.manage
      ? { owner_id: attributes.owner_id, access_control: attributes.access_control }
      : {}),
  };
};

export const updateConnectorAccess = async (
  context: AccessContext,
  id: string,
  input: AccessControlInput<'executor'>,
  validateRecipients: (uids: Set<string>) => Promise<void>
): Promise<void> => {
  await context.authorization.ensureAuthorized({ operation: 'update' });
  const { attributes, version } = await context.unsecuredSavedObjectsClient.get<RawAction>(
    'action',
    id
  );
  const profileId = await context.getCurrentUserProfileId?.(context.request);
  if (!profileId) {
    throw Boom.forbidden('A user profile is required to manage connector access');
  }
  assertConnectorAccess(attributes, profileId, 'manage');
  const accessControl = prepareAccessControl({
    input: { ...input, entries: input.access_mode === 'private' ? input.entries : [] },
    ownerId: profileId,
    previous: attributes.access_control,
    roles: CONNECTOR_ACCESS_ROLES,
  });
  const previousIds = new Set(
    attributes.access_control?.access_mode === 'private'
      ? attributes.access_control.entries.map(({ id: uid }) => uid)
      : []
  );
  const newRecipients = new Set(
    accessControl.entries.filter(({ id: uid }) => !previousIds.has(uid)).map(({ id: uid }) => uid)
  );
  if (newRecipients.size) {
    await validateRecipients(newRecipients);
  }
  await context.unsecuredSavedObjectsClient.update<RawAction>(
    'action',
    id,
    {
      owner_id: profileId,
      access_control: accessControl,
    },
    { version }
  );
};
