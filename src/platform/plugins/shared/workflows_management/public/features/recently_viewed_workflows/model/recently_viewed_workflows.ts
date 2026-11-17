/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { catchError, from, map, type Observable, of, switchMap } from 'rxjs';
import type { HttpStart } from '@kbn/core/public';
import type { ProjectNavigationLinkItem } from '@kbn/core-chrome-browser';
import type { RecentlyAccessed, RecentlyAccessedHistoryItem } from '@kbn/recently-accessed';
import { WorkflowApi } from '@kbn/workflows-ui';
import { PLUGIN_ID } from '../../../../common';

export const RECENTLY_VIEWED_WORKFLOWS_KEY = 'workflowsRecentlyViewed';

/** The app path stored for a recently viewed workflow, without the base path. */
export const getRecentlyViewedWorkflowPath = (id: string): string =>
  `/app/${PLUGIN_ID}/${encodeURIComponent(id)}`;

const toNavItems = (
  http: HttpStart,
  items: readonly RecentlyAccessedHistoryItem[]
): ProjectNavigationLinkItem[] =>
  items.map(({ id, link, label }) => ({ id, href: http.basePath.prepend(link), label }));

/**
 * Recently viewed workflows as side navigation links, labelled with their current names.
 * Workflows that no longer exist are dropped from the history; when the names cannot be
 * fetched, the names stored at view time are used.
 */
export const getRecentlyViewedWorkflowsNavItems$ = (
  http: HttpStart,
  recentlyViewed: RecentlyAccessed
): Observable<ProjectNavigationLinkItem[]> => {
  const api = new WorkflowApi(http);

  return recentlyViewed.get$().pipe(
    switchMap((items) => {
      if (items.length === 0) {
        return of([]);
      }
      return from(api.mgetWorkflows({ ids: items.map(({ id }) => id), source: ['name'] })).pipe(
        map((workflows) => {
          const names = new Map(workflows.map(({ id, name }) => [id, name]));
          const existing = items.filter(({ id }) => names.has(id));
          items.filter(({ id }) => !names.has(id)).forEach(({ id }) => recentlyViewed.remove(id));
          return toNavItems(
            http,
            existing.map((item) => ({ ...item, label: names.get(item.id) || item.label }))
          );
        }),
        catchError(() => of(toNavItems(http, items)))
      );
    })
  );
};
