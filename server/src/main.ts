import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for specific domains
  app.enableCors({
    origin: [
      // Allow localhost and preview URLs. Add your own domains in Railway settings.
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8080',
      /^http:\/\/localhost:\d+$/,
      // Railway.app production URLs
      /^https:\/\/.*\.up\.railway\.app$/,
    ],
    credentials: true,
  });

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('SignalBox LLM API')
    .setDescription('General-purpose LLM agent API with tools')
    .setVersion('1.0')
    .addTag('agent', 'AI agent chat operations')
    .addTag('health', 'Health check endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  
  // Serve OpenAPI JSON at /api/json
  app.getHttpAdapter().get('/api/json', (req, res) => {
    res.json(document);
  });
  
  // Serve Swagger UI
  SwaggerModule.setup('api', app, document);

  // Serve Scalar API Reference
  app.use(
    '/reference',
    apiReference({
      theme: 'default',
      content: document,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
  
  console.log(`Application is running on: ${await app.getUrl()}`);
  console.log(`Swagger documentation: ${await app.getUrl()}/api`);
  console.log(`Swagger JSON: ${await app.getUrl()}/api/json`);
  console.log(`Scalar API reference: ${await app.getUrl()}/reference`);
}
bootstrap();
