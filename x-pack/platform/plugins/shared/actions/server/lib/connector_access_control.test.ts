/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import Boom from '@hapi/boom';
import { httpServerMock, savedObjectsClientMock } from '@kbn/core/server/mocks';
import { actionsAuthorizationMock } from '../authorization/actions_authorization.mock';
import type { RawAction } from '../types';
import {
  getConnectorAccess,
  updateConnectorAccess,
  ensureConnectorAccess,
} from './connector_access_control';

const entry = (id: string) => ({
  type: 'user' as const,
  id,
  role: 'executor' as const,
  added_at: '2026-09-16T00:00:00.000Z',
});
const attributes: RawAction = {
  name: 'Private',
  actionTypeId: '.webhook',
  config: {},
  secrets: {},
  isMissingSecrets: false,
  owner_id: 'owner',
  access_control: { access_mode: 'private', entries: [entry('alice'), entry('bob')] },
};
const context = {
  request: httpServerMock.createKibanaRequest(),
  authorization: actionsAuthorizationMock.create(),
  unsecuredSavedObjectsClient: savedObjectsClientMock.create(),
  getCurrentUserProfileId: jest.fn(),
};
const validate = jest.fn();
beforeEach(() => {
  jest.resetAllMocks();
  context.getCurrentUserProfileId.mockResolvedValue('owner');
  context.unsecuredSavedObjectsClient.get.mockResolvedValue({
    id: 'connector',
    type: 'action',
    attributes,
    references: [],
    version: 'version-1',
  });
});

test.each([
  ['owner', true, true],
  ['alice', true, false],
  ['unlisted', false, false],
  [undefined, false, false],
])('private access for %s', async (profile, canRead, canEdit) => {
  context.getCurrentUserProfileId.mockResolvedValue(profile);
  for (const [operation, allowed] of [
    ['read', canRead],
    ['execute', canRead],
    ['edit', canEdit],
  ] as const) {
    const result = ensureConnectorAccess(context, attributes, operation);
    if (allowed) await expect(result).resolves.toBeUndefined();
    else await expect(result).rejects.toThrow('Connector not found');
  }
});

test('public access does not require a profile', async () => {
  context.getCurrentUserProfileId.mockResolvedValue(undefined);
  await expect(
    ensureConnectorAccess(
      context,
      { access_control: { access_mode: 'public', entries: [] } },
      'execute'
    )
  ).resolves.toBeUndefined();
  expect(context.getCurrentUserProfileId).not.toHaveBeenCalled();
});

test('an Executor cannot see the sharing list', async () => {
  context.getCurrentUserProfileId.mockResolvedValue('alice');
  expect(await getConnectorAccess(context, 'connector')).toEqual({
    permissions: { read: true, execute: true, edit: false, manage: false },
  });
});

test('RBAC denial stops reads and sharing changes even for the owner', async () => {
  context.authorization.ensureAuthorized.mockRejectedValue(Boom.forbidden('RBAC denied'));
  await expect(getConnectorAccess(context, 'connector')).rejects.toThrow('RBAC denied');
  await expect(
    updateConnectorAccess(context, 'connector', { access_mode: 'public' }, validate)
  ).rejects.toThrow('RBAC denied');
  expect(context.unsecuredSavedObjectsClient.get).not.toHaveBeenCalled();
});

test('removing Alice does not revalidate unchanged Bob after his RBAC is removed', async () => {
  validate.mockRejectedValue(Boom.badRequest('Bob lacks RBAC'));
  await updateConnectorAccess(
    context,
    'connector',
    { access_mode: 'private', entries: [entry('bob')] },
    validate
  );
  expect(validate).not.toHaveBeenCalled();
  expect(context.unsecuredSavedObjectsClient.update).toHaveBeenCalledWith(
    'action',
    'connector',
    { owner_id: 'owner', access_control: { access_mode: 'private', entries: [entry('bob')] } },
    { version: 'version-1' }
  );
});

test('new recipients must pass RBAC validation', async () => {
  validate.mockRejectedValue(Boom.badRequest('Missing connector privileges'));
  await expect(
    updateConnectorAccess(
      context,
      'connector',
      { access_mode: 'private', entries: [entry('new-user')] },
      validate
    )
  ).rejects.toThrow('Missing connector privileges');
  expect(validate).toHaveBeenCalledWith(new Set(['new-user']));
  expect(context.unsecuredSavedObjectsClient.update).not.toHaveBeenCalled();
});

test.each(['alice', 'unlisted', undefined])('%s cannot change sharing', async (profile) => {
  context.getCurrentUserProfileId.mockResolvedValue(profile);
  await expect(
    updateConnectorAccess(context, 'connector', { access_mode: 'public' }, validate)
  ).rejects.toThrow();
  expect(context.unsecuredSavedObjectsClient.update).not.toHaveBeenCalled();
});

test('a concurrent ACL change returns a conflict without retrying', async () => {
  context.unsecuredSavedObjectsClient.update.mockRejectedValue(Boom.conflict());
  await expect(
    updateConnectorAccess(
      context,
      'connector',
      { access_mode: 'private', entries: [entry('bob')] },
      validate
    )
  ).rejects.toThrow('Conflict');
  expect(context.unsecuredSavedObjectsClient.update).toHaveBeenCalledTimes(1);
});
