/*
 * Copyright 2023 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ResourceEntity } from '@backstage/catalog-model';
import * as winston from 'winston';
import { Config } from '@backstage/config';
import { TerraformEntityProvider } from './TerraformEntityProvider';
import { ANNOTATION_TERRAFORM_KAFKA } from '../annotations';

import { DataTerraformRemoteStateS3, Fn } from 'cdktf';
import { constructor } from 'node';

export class KafkaClusterProvider extends TerraformEntityProvider {
  static fromConfig(config: Config, options: { logger: winston.Logger }) {
    const accountId = config.getString('accountId');
    const roleArn = config.getString('roleArn');
    const externalId = config.getOptionalString('externalId');
    const bucket = config.getString('bucket');
    const state_file_name = config.getString('state_file_name');
    const region = config.getString('region');

    return new KafkaClusterProvider(
      { accountId, roleArn, externalId, region, bucket, state_file_name },
      options,
    );
  }

  getProviderName(): string {
    return `terraform-${this.accountId}`;
  }

  async run(): Promise<void> {
    if (!this.connection) {
      throw new Error('Not initialized');
    }

    this.logger.info(
      `Providing stream cluster resources from terraform: ${this.accountId}`,
    );
    const s3Resources: ResourceEntity[] = [];

    const tfState = await new DataTerraformRemoteStateS3(
      constructor(),
      'currentState',
      {
        bucket: this.bucket,
        key: this.state_file_name,
      },
    );
    const kafkaResources = Fn.lookup(tfState, 'kafka_clusters', '*');

    const defaultAnnotations = this.buildDefaultAnnotations();

    for (const cluster of kafkaResources || []) {
      const annotations: { [name: string]: string } = {
        ...(await defaultAnnotations),
      };

      annotations[ANNOTATION_TERRAFORM_KAFKA] = cluster.name;

      const resource: ResourceEntity = {
        kind: 'Resource',
        apiVersion: 'backstage.io/v1beta1',
        metadata: {
          annotations,
          name: cluster.tags.global_dns,
          title: cluster.name,
        },
        spec: {
          owner: cluster.tags.Owner,
          type: cluster.tags.role,
        },
      };

      s3Resources.push(resource);
    }

    await this.connection.applyMutation({
      type: 'full',
      entities: s3Resources.map(entity => ({
        entity,
        locationKey: `terraform-kafka-provider:${this.accountId}`,
      })),
    });
  }
}
