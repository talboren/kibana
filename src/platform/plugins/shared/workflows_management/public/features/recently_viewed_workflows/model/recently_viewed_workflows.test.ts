/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { BehaviorSubject, filter, firstValueFrom } from 'rxjs';
import { httpServiceMock } from '@kbn/core-http-browser-mocks';
import type { RecentlyAccessed, RecentlyAccessedHistoryItem } from '@kbn/recently-accessed';
import {
  getRecentlyViewedWorkflowPath,
  getRecentlyViewedWorkflowsNavItems$,
} from './recently_viewed_workflows';

const createRecentlyViewed = (initialItems: RecentlyAccessedHistoryItem[]) => {
  const items$ = new BehaviorSubject(initialItems);
  const recentlyViewed: jest.Mocked<RecentlyAccessed> = {
    add: jest.fn(),
    remove: jest.fn((id: string) => items$.next(items$.value.filter((item) => item.id !== id))),
    get: jest.fn(() => items$.value),
    get$: jest.fn(() => items$.asObservable()),
  };
  return recentlyViewed;
};

const viewed = (id: string, label: string): RecentlyAccessedHistoryItem => ({
  id,
  label,
  link: getRecentlyViewedWorkflowPath(id),
});

describe('getRecentlyViewedWorkflowsNavItems$', () => {
  let http: ReturnType<typeof httpServiceMock.createStartContract>;

  beforeEach(() => {
    http = httpServiceMock.createStartContract({ basePath: '/s/my-space' });
  });

  it('labels the links with the current workflow names, in history order', async () => {
    http.post.mockResolvedValue([
      { id: 'wf-2', name: 'Second renamed' },
      { id: 'wf-1', name: 'First' },
    ]);
    const recentlyViewed = createRecentlyViewed([
      viewed('wf-1', 'First'),
      viewed('wf-2', 'Second'),
    ]);

    const items = await firstValueFrom(getRecentlyViewedWorkflowsNavItems$(http, recentlyViewed));

    expect(http.post).toHaveBeenCalledWith('/api/workflows/mget', {
      body: JSON.stringify({ ids: ['wf-1', 'wf-2'], source: ['name'] }),
      version: '2023-10-31',
    });
    expect(items).toEqual([
      { id: 'wf-1', href: '/s/my-space/app/workflows/wf-1', label: 'First' },
      { id: 'wf-2', href: '/s/my-space/app/workflows/wf-2', label: 'Second renamed' },
    ]);
  });

  it('drops workflows that no longer exist from the history', async () => {
    http.post.mockImplementation(async () => [{ id: 'wf-1', name: 'First' }]);
    const recentlyViewed = createRecentlyViewed([
      viewed('wf-1', 'First'),
      viewed('wf-deleted', 'Deleted'),
    ]);

    const items = await firstValueFrom(
      getRecentlyViewedWorkflowsNavItems$(http, recentlyViewed).pipe(
        filter((navItems) => navItems.length > 0)
      )
    );

    expect(recentlyViewed.remove).toHaveBeenCalledWith('wf-deleted');
    expect(items).toEqual([{ id: 'wf-1', href: '/s/my-space/app/workflows/wf-1', label: 'First' }]);
  });

  it('falls back to the stored names when the workflows cannot be fetched', async () => {
    http.post.mockRejectedValue(new Error('Forbidden'));
    const recentlyViewed = createRecentlyViewed([viewed('wf-1', 'Stored name')]);

    const items = await firstValueFrom(getRecentlyViewedWorkflowsNavItems$(http, recentlyViewed));

    expect(recentlyViewed.remove).not.toHaveBeenCalled();
    expect(items).toEqual([
      { id: 'wf-1', href: '/s/my-space/app/workflows/wf-1', label: 'Stored name' },
    ]);
  });

  it('does not fetch when nothing was viewed', async () => {
    const items = await firstValueFrom(
      getRecentlyViewedWorkflowsNavItems$(http, createRecentlyViewed([]))
    );

    expect(http.post).not.toHaveBeenCalled();
    expect(items).toEqual([]);
  });
});
