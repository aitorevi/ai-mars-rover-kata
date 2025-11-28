import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Move Rover (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Deploy a rover first for testing movement
    await request(app.getHttpServer())
      .post('/rovers/deploy')
      .send({
        roverId: 'test-rover',
        x: 5,
        y: 5,
        direction: 'NORTH',
      })
      .expect(201);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /rovers/:id/move', () => {
    it('should move rover forward successfully', () => {
      return request(app.getHttpServer())
        .post('/rovers/test-rover/move')
        .send({ command: 'F' })
        .expect(200)
        .expect((res) => {
          expect(res.body.roverId).toBe('test-rover');
          expect(res.body.x).toBe(5);
          expect(res.body.y).toBe(6); // moved north
          expect(res.body.direction).toBe('NORTH');
        });
    });

    it('should move rover backward successfully', () => {
      return request(app.getHttpServer())
        .post('/rovers/test-rover/move')
        .send({ command: 'B' })
        .expect(200)
        .expect((res) => {
          expect(res.body.y).toBe(4); // moved south (backward)
        });
    });

    it('should return 404 when rover does not exist', () => {
      return request(app.getHttpServer())
        .post('/rovers/non-existent/move')
        .send({ command: 'F' })
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toContain('not found');
        });
    });

    it('should return 400 when movement exceeds grid boundaries', async () => {
      // Deploy rover at north edge
      await request(app.getHttpServer())
        .post('/rovers/deploy')
        .send({
          roverId: 'edge-rover',
          x: 5,
          y: 9,
          direction: 'NORTH',
        })
        .expect(201);

      return request(app.getHttpServer())
        .post('/rovers/edge-rover/move')
        .send({ command: 'F' })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('out of grid bounds');
        });
    });

    it('should handle multiple sequential movements', async () => {
      // Move forward
      await request(app.getHttpServer())
        .post('/rovers/test-rover/move')
        .send({ command: 'F' })
        .expect(200);

      // Move forward again
      await request(app.getHttpServer())
        .post('/rovers/test-rover/move')
        .send({ command: 'F' })
        .expect(200);

      // Move backward
      const response = await request(app.getHttpServer())
        .post('/rovers/test-rover/move')
        .send({ command: 'B' })
        .expect(200);

      expect(response.body.x).toBe(5);
      expect(response.body.y).toBe(6); // 5 + 2 - 1 = 6
    });
  });
});
