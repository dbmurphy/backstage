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

import {
  EntityProvider,
  EntityProviderConnection,
} from '@backstage/plugin-catalog-backend';
import * as winston from 'winston';
import { fromTemporaryCredentials } from '@aws-sdk/credential-providers';
import { STS } from '@aws-sdk/client-sts';
import {
  ANNOTATION_LOCATION,
  ANNOTATION_ORIGIN_LOCATION,
} from '@backstage/catalog-model';
import { ANNOTATION_ACCOUNT_ID } from '../annotations';

export abstract class TerraformEntityProvider implements EntityProvider {
  protected readonly accountId: string;
  protected readonly roleArn: string;
  protected readonly region: string;
  protected readonly bucket: string;
  protected readonly state_file_name: string;
  protected readonly logger: winston.Logger;
  protected connection?: EntityProviderConnection;
  private readonly externalId?: string;

  protected constructor(
    account: {
      accountId: string;
      roleArn: string;
      externalId: string | undefined;
      region: string;
      bucket: string;
      state_file_name: string;
    },
    options: { logger: winston.Logger },
  ) {
    this.accountId = account.accountId;
    this.roleArn = account.roleArn;
    this.externalId = account.externalId;
    this.region = account.region;
    this.logger = options.logger;
    this.bucket = account.bucket;
    this.state_file_name = account.state_file_name;
  }

  public abstract getProviderName(): string;

  public async connect(connection: EntityProviderConnection): Promise<void> {
    this.connection = connection;
  }

  protected getCredentials() {
    return fromTemporaryCredentials({
      params: { RoleArn: this.roleArn, ExternalId: this.externalId },
    });
  }

  protected async buildDefaultAnnotations() {
    const sts = new STS({ credentials: this.getCredentials() });

    const account = await sts.getCallerIdentity({});

    const defaultAnnotations: { [name: string]: string } = {
      [ANNOTATION_LOCATION]: `${this.getProviderName()}:${this.roleArn}`,
      [ANNOTATION_ORIGIN_LOCATION]: `${this.getProviderName()}:${this.roleArn}`,
    };

    if (account.Account) {
      defaultAnnotations[ANNOTATION_ACCOUNT_ID] = account.Account;
    }

    return defaultAnnotations;
  }
}
