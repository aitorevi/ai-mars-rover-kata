import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Rotate Rover (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Deploy a rover first for testing rotation
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

  describe('POST /rovers/:id/rotate', () => {
    it('should rotate rover left successfully', () => {
      return request(app.getHttpServer())
        .post('/rovers/test-rover/rotate')
        .send({ command: 'L' })
        .expect(200)
        .expect((res) => {
          expect(res.body.roverId).toBe('test-rover');
          expect(res.body.x).toBe(5);           // unchanged
          expect(res.body.y).toBe(5);           // unchanged
          expect(res.body.direction).toBe('WEST'); // rotated left from NORTH
        });
    });

    it('should rotate rover right successfully', () => {
      return request(app.getHttpServer())
        .post('/rovers/test-rover/rotate')
        .send({ command: 'R' })
        .expect(200)
        .expect((res) => {
          expect(res.body.roverId).toBe('test-rover');
          expect(res.body.x).toBe(5);
          expect(res.body.y).toBe(5);
          expect(res.body.direction).toBe('EAST'); // rotated right from NORTH
        });
    });

    it('should return 404 when rover does not exist', () => {
      return request(app.getHttpServer())
        .post('/rovers/non-existent/rotate')
        .send({ command: 'L' })
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toContain('not found');
        });
    });

    it('should handle multiple sequential rotations', async () => {
      // Rotate left (NORTH → WEST)
      await request(app.getHttpServer())
        .post('/rovers/test-rover/rotate')
        .send({ command: 'L' })
        .expect(200);

      // Rotate left again (WEST → SOUTH)
      await request(app.getHttpServer())
        .post('/rovers/test-rover/rotate')
        .send({ command: 'L' })
        .expect(200);

      // Rotate right (SOUTH → WEST)
      const response = await request(app.getHttpServer())
        .post('/rovers/test-rover/rotate')
        .send({ command: 'R' })
        .expect(200);

      expect(response.body.direction).toBe('WEST');
      // Coordinates still unchanged after 3 rotations
      expect(response.body.x).toBe(5);
      expect(response.body.y).toBe(5);
    });

    it('should return to original direction after 4 left rotations', async () => {
      await request(app.getHttpServer())
        .post('/rovers/test-rover/rotate')
        .send({ command: 'L' })
        .expect(200);

      await request(app.getHttpServer())
        .post('/rovers/test-rover/rotate')
        .send({ command: 'L' })
        .expect(200);

      await request(app.getHttpServer())
        .post('/rovers/test-rover/rotate')
        .send({ command: 'L' })
        .expect(200);

      const response = await request(app.getHttpServer())
        .post('/rovers/test-rover/rotate')
        .send({ command: 'L' })
        .expect(200);

      expect(response.body.direction).toBe('NORTH'); // back to original
    });

    it('should keep rover at same position after rotations', async () => {
      // Deploy rover at specific position
      await request(app.getHttpServer())
        .post('/rovers/deploy')
        .send({
          roverId: 'position-test-rover',
          x: 3,
          y: 7,
          direction: 'SOUTH',
        })
        .expect(201);

      // Perform multiple rotations
      await request(app.getHttpServer())
        .post('/rovers/position-test-rover/rotate')
        .send({ command: 'L' })
        .expect(200);

      await request(app.getHttpServer())
        .post('/rovers/position-test-rover/rotate')
        .send({ command: 'R' })
        .expect(200);

      const response = await request(app.getHttpServer())
        .post('/rovers/position-test-rover/rotate')
        .send({ command: 'R' })
        .expect(200);

      // Position unchanged
      expect(response.body.x).toBe(3);
      expect(response.body.y).toBe(7);
    });

  });
});
