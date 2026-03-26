import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { registerRequestContext } from '../plugins/requestContext.js';
import { registerProjectRoutes } from './projectsRoutes.js';

vi.mock('../services/exportService.js', () => ({
  createProjectExport: vi.fn(async (projectId: string, body: { format: string; createdBy: string }) => ({
    artifact: {
      id: 'e1',
      projectId,
      versionId: 'v1',
      format: body.format,
      title: 't',
      createdAt: new Date().toISOString(),
      createdBy: body.createdBy,
      status: 'ready',
      fileName: `x.${body.format}`,
      storagePath: null,
      errorMessage: null,
    },
    snapshot: {
      projectSummary: {
        projectId,
        projectTitle: 'P',
        versionId: 'v1',
        versionNumber: 1,
        generatedBy: body.createdBy,
        floorsCount: 1,
      },
      wallSummaries: [],
      panelizationSummary: { eligibleWalls: 0, panelizedWalls: 0, generatedPanels: 0, warnings: 0, errors: 0 },
      specSummary: { totalPanels: 0, totalTrimmedPanels: 0, totalPanelAreaM2: 0, wallCountIncluded: 0, warningCount: 0 },
      aggregatedSpecItems: [],
      warnings: [],
      panelSettings: {
        defaultPanelTypeId: null,
        allowTrimmedPanels: true,
        minTrimWidthMm: 250,
        preferFullPanels: true,
        labelPrefixWall: 'W',
        labelPrefixRoof: 'R',
        labelPrefixSlab: 'S',
      },
      generatedAt: new Date().toISOString(),
      basedOnVersionId: 'v1',
    },
  })),
  listProjectExports: vi.fn(async () => [{ id: 'e1', projectId: 'p1', versionId: 'v1', format: 'pdf', title: 't', createdAt: new Date().toISOString(), createdBy: 'u1', status: 'ready', fileName: 'x.pdf', storagePath: null, errorMessage: null }]),
  getProjectExport: vi.fn(async () => ({ artifact: { id: 'e1', projectId: 'p1', versionId: 'v1', format: 'pdf', title: 't', createdAt: new Date().toISOString(), createdBy: 'u1', status: 'ready', fileName: 'x.pdf', storagePath: null, errorMessage: null }, snapshot: null })),
}));

describe('project exports routes', () => {
  it('create/list/get export endpoints', async () => {
    const app = Fastify();
    registerRequestContext(app);
    await registerProjectRoutes(app);

    const headers = { 'x-sip-user-id': 'u1' };
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/projects/p1/exports',
      headers,
      payload: { createdBy: 'u1', format: 'pdf' },
    });
    expect(createRes.statusCode).toBe(201);

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/projects/p1/exports',
      headers,
    });
    expect(listRes.statusCode).toBe(200);

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/projects/p1/exports/e1',
      headers,
    });
    expect(getRes.statusCode).toBe(200);
    await app.close();
  });
});
