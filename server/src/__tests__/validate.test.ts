import express, { Request, Response } from 'express';
import request from 'supertest';
import { z } from 'zod';
import { validateRequest } from '../middlewares/validate.middleware';
import { errorHandler } from '../middlewares/error.middleware';

describe('validateRequest Middleware Write-Back', () => {
  it('writes parsed, coerced, and default values back to req.body, req.query, and req.params', async () => {
    const app = express();
    app.use(express.json());

    const schema = z.object({
      body: z.object({
        count: z.coerce.number(),
        role: z.string().default('STUDENT'),
      }),
      query: z.object({
        page: z.coerce.number().default(1),
      }),
      params: z.object({
        id: z.string().transform((val) => val.toUpperCase()),
      }),
    });

    app.post(
      '/test/:id',
      validateRequest(schema),
      (req: Request, res: Response) => {
        res.json({
          body: req.body,
          query: req.query,
          params: req.params,
        });
      }
    );

    app.use(errorHandler);

    const res = await request(app)
      .post('/test/abc-123?page=5')
      .send({ count: '42' });

    expect(res.status).toBe(200);
    expect(res.body.body.count).toBe(42);
    expect(res.body.body.role).toBe('STUDENT');
    expect(res.body.query.page).toBe(5);
    expect(res.body.params.id).toBe('ABC-123');
  });
});
