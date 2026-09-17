/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import Boom from '@hapi/boom';
import { schema } from '@kbn/config-schema';
import { InvalidAccessControlError } from '@kbn/entity-access-control';
import { connectorAccessControlSchema } from '../../../common/access_control';
import type { RouteOptions } from '..';
import { verifyAccessAndContext } from '../verify_access_and_context';
import { DEFAULT_ACTION_ROUTE_SECURITY } from '../constants';

export const connectorAccessControlRoutes = ({
  router,
  licenseState,
  core,
}: RouteOptions): void => {
  const params = schema.object({ id: schema.string({ minLength: 1, maxLength: 1024 }) });
  const path = '/internal/actions/connector/{id}/access_control';
  const getRecipientPrivileges = async () => {
    const [coreStart, { security, spaces }] = await core.getStartServices();
    const authz = security?.authz;
    return {
      coreStart,
      spaces,
      authz,
      kibana: authz
        ? [
            authz.actions.savedObject.get('action', 'get'),
            authz.actions.savedObject.get('action_task_params', 'create'),
          ]
        : [],
    };
  };

  router.get(
    { path, security: DEFAULT_ACTION_ROUTE_SECURITY, validate: { params } },
    router.handleLegacyErrors(
      verifyAccessAndContext(licenseState, async (context, request, response) => {
        const client = (await context.actions).getActionsClient();
        return response.ok({ body: await client.getAccessControl(request.params.id) });
      })
    )
  );
  router.put(
    {
      path,
      security: DEFAULT_ACTION_ROUTE_SECURITY,
      validate: { params, body: connectorAccessControlSchema },
    },
    router.handleLegacyErrors(
      verifyAccessAndContext(licenseState, async (context, request, response) => {
        const client = (await context.actions).getActionsClient();
        const { authz, kibana, spaces } = await getRecipientPrivileges();
        try {
          await client.updateAccessControl(request.params.id, request.body, async (uids) => {
            const result = await authz
              ?.checkUserProfilesPrivileges(uids)
              .atSpace(spaces?.spacesService.getSpaceId(request) ?? 'default', { kibana });
            if (!result || [...uids].some((uid) => !result.hasPrivilegeUids.includes(uid))) {
              throw Boom.badRequest(
                'Selected users must have permission to view and execute connectors in this space'
              );
            }
          });
        } catch (error) {
          if (error instanceof InvalidAccessControlError) throw Boom.badRequest(error.message);
          throw error;
        }
        return response.noContent();
      })
    )
  );
  router.post(
    {
      path: `${path}/_suggest_user_profiles`,
      security: DEFAULT_ACTION_ROUTE_SECURITY,
      validate: {
        params,
        body: schema.object({
          name: schema.string({ maxLength: 1024 }),
          size: schema.number({ min: 1, max: 100, defaultValue: 20 }),
          dataPath: schema.maybe(schema.string({ maxLength: 1024 })),
        }),
      },
    },
    router.handleLegacyErrors(
      verifyAccessAndContext(licenseState, async (context, request, response) => {
        const client = (await context.actions).getActionsClient();
        const { permissions } = await client.getAccessControl(request.params.id);
        if (!permissions.manage) throw Boom.forbidden('Only the owner can manage connector access');
        const { coreStart, spaces, authz, kibana } = await getRecipientPrivileges();
        if (!authz) return response.ok({ body: [] });
        const profiles = await coreStart.userProfile.suggest({
          ...request.body,
          requiredPrivileges: {
            spaceId: spaces?.spacesService.getSpaceId(request) ?? 'default',
            privileges: { kibana },
          },
        });
        return response.ok({ body: profiles });
      })
    )
  );
};
