# Catalog Backend Module for Terraform

This is an extension module to the plugin-catalog-backend plugin, providing
entity providers to read Terraform objects from AWS S3 as Backstage Entities.

You will need to configure the providers in your catalog.ts file in your backstage backend:

TODO: Fix this example

```typescript
import { KafkaClusterProvider } from '@dbmurphy/catalog-backend-module-terraform';

export default async function createPlugin(
  env: PluginEnvironment,
): Promise<Router> {
  const builder = await CatalogBuilder.create(env);
  const KafkaClusterProvider = KafkaClusterProvider.fromConfig(config, env);

  builder.addEntityProvider(KafkaClusterProvider);

  KafkaClusterProvider.run();

  const { processingEngine, router } = await builder.build();
  await processingEngine.start();

  // ...

  return router;
}
```
