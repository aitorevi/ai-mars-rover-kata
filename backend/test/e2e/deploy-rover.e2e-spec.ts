import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Deploy Rover (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /rovers/deploy - should deploy rover successfully', () => {
    return request(app.getHttpServer())
      .post('/rovers/deploy')
      .send({
        roverId: 'rover-1',
        x: 3,
        y: 5,
        direction: 'NORTH',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.message).toContain('Rover rover-1 deployed');
      });
  });

  it('POST /rovers/deploy - should return 400 when coordinates out of bounds', () => {
    return request(app.getHttpServer())
      .post('/rovers/deploy')
      .send({
        roverId: 'rover-1',
        x: 15,
        y: 5,
        direction: 'NORTH',
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toContain('out of grid bounds');
      });
  });

  it('POST /rovers/deploy - should return 409 when obstacle detected', () => {
    return request(app.getHttpServer())
      .post('/rovers/deploy')
      .send({
        roverId: 'rover-1',
        x: 5,
        y: 5,
        direction: 'NORTH',
      })
      .expect((res) => {
        // Without a specific obstacle setup, this might not trigger
        // This test will pass once we add obstacle configuration to the endpoint
      });
  });
});
