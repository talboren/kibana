/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

/**
 * AWS EC2 Connector
 *
 * This connector provides EC2 instance management capabilities:
 * - Describe instances (get current state, type, tags)
 * - Stop instances (required before resizing)
 * - Start instances (after resizing)
 * - Modify instance type (for scaling operations)
 *
 * Authentication follows the same pattern as Elastic's CloudWatch integration:
 * - Access Key ID
 * - Secret Access Key
 * - Region
 */

import { i18n } from '@kbn/i18n';
import { z } from '@kbn/zod/v4';
import type { ActionContext, ConnectorSpec } from '../../connector_spec';
import { UISchemas } from '../../connector_spec_ui';

/**
 * AWS Signature V4 signing helper
 * Note: This is a simplified client-side implementation for demonstration.
 * For production use, AWS signing should be done server-side using the AWS SDK.
 *
 * This implementation uses Web Crypto API for hashing since Node.js crypto
 * is not available in the browser context where connector specs run.
 */
async function signAwsRequest(
  method: string,
  host: string,
  path: string,
  queryParams: Record<string, string>,
  accessKeyId: string,
  secretAccessKey: string,
  region: string
): Promise<Record<string, string>> {
  const service = 'ec2';
  const algorithm = 'AWS4-HMAC-SHA256';
  const now = new Date();
  const dateStamp = now.toISOString().split('T')[0].replace(/-/g, '');
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');

  // eslint-disable-next-line no-console
  console.log('[AWS Signing] Starting signature process:', {
    dateStamp,
    amzDate,
    region,
    service,
  });

  // Build canonical query string
  const sortedParams = Object.keys(queryParams).sort();
  const canonicalQuerystring = sortedParams
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
    .join('&');

  // Build canonical headers
  const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-date';

  // SHA256 hash of empty payload for GET requests
  const payloadHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  // Create canonical request
  const canonicalRequest = [
    method,
    path,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  // eslint-disable-next-line no-console
  console.log('[AWS Signing] Canonical request:', {
    method,
    path: path.substring(0, 50),
    queryStringLength: canonicalQuerystring.length,
    canonicalRequestLength: canonicalRequest.length,
  });

  // Hash the canonical request
  const canonicalRequestHash = await sha256Hash(canonicalRequest);

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  // Create string to sign
  const stringToSign = [algorithm, amzDate, credentialScope, canonicalRequestHash].join('\n');

  // eslint-disable-next-line no-console
  console.log('[AWS Signing] String to sign created:', {
    algorithm,
    credentialScope,
    canonicalRequestHash: canonicalRequestHash.substring(0, 16) + '...',
  });

  // Calculate signature using HMAC-SHA256
  const signature = await calculateSignature(
    secretAccessKey,
    dateStamp,
    region,
    service,
    stringToSign
  );

  // eslint-disable-next-line no-console
  console.log('[AWS Signing] Signature calculated:', signature.substring(0, 16) + '...');

  // Build authorization header
  const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    'X-Amz-Date': amzDate,
    Authorization: authorizationHeader,
  };
}

/**
 * Calculate SHA256 hash using Web Crypto API
 */
async function sha256Hash(message: string): Promise<string> {
  const textEncoder = new TextEncoder();
  const data = textEncoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Calculate HMAC-SHA256 signature using Web Crypto API
 */
async function hmacSha256(key: BufferSource, message: string): Promise<ArrayBuffer> {
  const textEncoder = new TextEncoder();
  const messageData = textEncoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  return await crypto.subtle.sign('HMAC', cryptoKey, messageData);
}

/**
 * Calculate AWS Signature V4 signature
 */
async function calculateSignature(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string,
  stringToSign: string
): Promise<string> {
  const textEncoder = new TextEncoder();

  // kDate = HMAC("AWS4" + secretAccessKey, dateStamp)
  const kDate = await hmacSha256(textEncoder.encode('AWS4' + secretAccessKey), dateStamp);

  // kRegion = HMAC(kDate, region)
  const kRegion = await hmacSha256(kDate, region);

  // kService = HMAC(kRegion, service)
  const kService = await hmacSha256(kRegion, service);

  // kSigning = HMAC(kService, "aws4_request")
  const kSigning = await hmacSha256(kService, 'aws4_request');

  // signature = HMAC(kSigning, stringToSign)
  const signature = await hmacSha256(kSigning, stringToSign);

  // Convert to hex string
  const signatureArray = Array.from(new Uint8Array(signature));
  return signatureArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Helper to make AWS EC2 API calls
 */
async function callEc2Api(
  ctx: ActionContext,
  action: string,
  params: Record<string, string>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const { region, accessKeyId, secretAccessKey } = ctx.config as {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
  const host = `ec2.${region}.amazonaws.com`;
  const path = '/';
  const queryParams: Record<string, string> = {
    Action: action,
    Version: '2016-11-15',
    ...params,
  };

  // eslint-disable-next-line no-console
  console.log('[AWS EC2] Making API call:', {
    action,
    region,
    host,
    accessKeyIdPrefix: accessKeyId.substring(0, 8) + '...',
    params,
  });

  const headers = await signAwsRequest(
    'GET',
    host,
    path,
    queryParams,
    accessKeyId,
    secretAccessKey,
    region
  );

  // eslint-disable-next-line no-console
  console.log('[AWS EC2] Request headers:', {
    ...headers,
    Authorization: headers.Authorization.substring(0, 50) + '...',
  });

  // Build the full URL with query parameters
  const sortedParams = Object.keys(queryParams).sort();
  const queryString = sortedParams
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
    .join('&');

  const url = `https://${host}${path}?${queryString}`;
  // eslint-disable-next-line no-console
  console.log('[AWS EC2] Request URL:', url.substring(0, 100) + '...');

  try {
    const response = await ctx.client.get(url, {
      headers,
    });

    // eslint-disable-next-line no-console
    console.log('[AWS EC2] Request successful, status:', response.status);
    return response.data;
  } catch (error: unknown) {
    const err = error as {
      response?: {
        status?: number;
        statusText?: string;
        data?: string | unknown;
      };
    };

    // Try to parse AWS XML error
    let awsError: { code: string; message: string } | null = null;
    if (err.response?.data && typeof err.response.data === 'string') {
      awsError = parseAwsError(err.response.data);
    }

    // eslint-disable-next-line no-console
    console.error('[AWS EC2] Request failed:', {
      status: err.response?.status,
      statusText: err.response?.statusText,
      awsError,
      rawData:
        typeof err.response?.data === 'string'
          ? err.response.data.substring(0, 500)
          : err.response?.data,
    });

    // Throw a more meaningful error
    if (awsError) {
      throw new Error(`AWS EC2 Error [${awsError.code}]: ${awsError.message}`);
    } else if (err.response?.status === 401) {
      throw new Error(
        'Authentication failed. Please check your AWS Access Key ID and Secret Access Key.'
      );
    } else if (err.response?.status === 403) {
      throw new Error(
        'Access denied. Your AWS IAM user lacks the required permissions for this operation.'
      );
    } else {
      throw new Error(
        `AWS EC2 API request failed: ${err.response?.statusText || (error as Error).message}`
      );
    }
  }
}

/**
 * Parse XML response from AWS (simplified parser for EC2 responses)
 */
function parseXmlResponse(xmlString: string): {
  getValue: (tag: string) => string | null;
  getValues: (tag: string) => string[];
  raw: string;
} {
  // Very basic XML parsing for EC2 responses
  // In production, you'd use a proper XML parser library
  const getValue = (tag: string): string | null => {
    const match = xmlString.match(new RegExp(`<${tag}>([^<]+)</${tag}>`));
    return match ? match[1] : null;
  };

  const getValues = (tag: string): string[] => {
    const regex = new RegExp(`<${tag}>([^<]+)</${tag}>`, 'g');
    const matches = [...xmlString.matchAll(regex)];
    return matches.map((m) => m[1]);
  };

  return {
    getValue,
    getValues,
    raw: xmlString,
  };
}

/**
 * Parse AWS error response and extract the error message
 */
function parseAwsError(xmlString: string): { code: string; message: string } | null {
  try {
    // Extract error code
    const codeMatch = xmlString.match(/<Code>(.*?)<\/Code>/);
    const code = codeMatch ? codeMatch[1] : 'UnknownError';

    // Extract error message
    const messageMatch = xmlString.match(/<Message>(.*?)<\/Message>/);
    const message = messageMatch ? messageMatch[1] : 'An unknown error occurred';

    return { code, message };
  } catch {
    return null;
  }
}

/**
 * Map instance types for scaling operations
 */
const INSTANCE_TYPE_SCALE_MAP: Record<string, { up: string; down: string }> = {
  't3.nano': { up: 't3.micro', down: 't3.nano' },
  't3.micro': { up: 't3.small', down: 't3.nano' },
  't3.small': { up: 't3.medium', down: 't3.micro' },
  't3.medium': { up: 't3.large', down: 't3.small' },
  't3.large': { up: 't3.xlarge', down: 't3.medium' },
  't3.xlarge': { up: 't3.2xlarge', down: 't3.large' },
  't3.2xlarge': { up: 't3.2xlarge', down: 't3.xlarge' },
  't2.nano': { up: 't2.micro', down: 't2.nano' },
  't2.micro': { up: 't2.small', down: 't2.nano' },
  't2.small': { up: 't2.medium', down: 't2.micro' },
  't2.medium': { up: 't2.large', down: 't2.small' },
  't2.large': { up: 't2.xlarge', down: 't2.medium' },
  't2.xlarge': { up: 't2.2xlarge', down: 't2.large' },
  't2.2xlarge': { up: 't2.2xlarge', down: 't2.xlarge' },
};

function getScaledInstanceType(currentType: string, direction: 'up' | 'down'): string {
  const scaleMap = INSTANCE_TYPE_SCALE_MAP[currentType];
  if (!scaleMap) {
    throw new Error(`Instance type ${currentType} is not supported for auto-scaling`);
  }
  return scaleMap[direction];
}

export const AwsEc2Connector: ConnectorSpec = {
  metadata: {
    id: '.aws_ec2',
    displayName: 'AWS EC2',
    description: i18n.translate('connectorSpecs.awsEc2.metadata.description', {
      defaultMessage: 'Manage AWS EC2 instances: describe, stop, start, and modify instance types',
    }),
    minimumLicense: 'gold',
    supportedFeatureIds: ['workflows'],
  },

  schema: z.object({
    region: z
      .string()
      .min(1)
      .describe(
        i18n.translate('connectorSpecs.awsEc2.config.region', {
          defaultMessage: 'AWS Region (e.g., us-east-1, eu-west-1)',
        })
      ),
    accessKeyId: z
      .string()
      .min(1)
      .describe(
        i18n.translate('connectorSpecs.awsEc2.config.accessKeyId', {
          defaultMessage: 'AWS Access Key ID',
        })
      ),
    secretAccessKey: UISchemas.secret().describe(
      i18n.translate('connectorSpecs.awsEc2.config.secretAccessKey', {
        defaultMessage: 'AWS Secret Access Key',
      })
    ),
  }),

  actions: {
    describeInstances: {
      isTool: true,
      input: z.object({
        instanceId: z.string().describe('EC2 Instance ID'),
      }),
      handler: async (ctx, input) => {
        const typedInput = input as { instanceId: string };

        const response = await callEc2Api(ctx, 'DescribeInstances', {
          'InstanceId.1': typedInput.instanceId,
        });

        const parsed = parseXmlResponse(response);
        const instanceType = parsed.getValue('instanceType');
        const state = parsed.getValue('name'); // instance state name
        const instanceId = parsed.getValue('instanceId');

        return {
          instanceId: instanceId || typedInput.instanceId,
          instanceType: instanceType || 'unknown',
          state: state || 'unknown',
          raw: parsed.raw,
        };
      },
    },

    stopInstances: {
      isTool: true,
      input: z.object({
        instanceId: z.string().min(1).describe('EC2 Instance ID to stop'),
      }),
      handler: async (ctx, input) => {
        const typedInput = input as { instanceId: string };

        if (!typedInput.instanceId || typedInput.instanceId.trim() === '') {
          throw new Error(
            'Instance ID is required but was empty. Please check the workflow variable mapping.'
          );
        }

        const response = await callEc2Api(ctx, 'StopInstances', {
          'InstanceId.1': typedInput.instanceId,
        });

        const parsed = parseXmlResponse(response);
        const currentState = parsed.getValue('name');

        return {
          instanceId: typedInput.instanceId,
          previousState: 'running',
          currentState: currentState || 'stopping',
          message: `Instance ${typedInput.instanceId} is stopping`,
        };
      },
    },

    startInstances: {
      isTool: true,
      input: z.object({
        instanceId: z.string().min(1).describe('EC2 Instance ID to start'),
      }),
      handler: async (ctx, input) => {
        const typedInput = input as { instanceId: string };

        if (!typedInput.instanceId || typedInput.instanceId.trim() === '') {
          throw new Error(
            'Instance ID is required but was empty. Please check the workflow variable mapping.'
          );
        }

        const response = await callEc2Api(ctx, 'StartInstances', {
          'InstanceId.1': typedInput.instanceId,
        });

        const parsed = parseXmlResponse(response);
        const currentState = parsed.getValue('name');

        return {
          instanceId: typedInput.instanceId,
          previousState: 'stopped',
          currentState: currentState || 'pending',
          message: `Instance ${typedInput.instanceId} is starting`,
        };
      },
    },

    modifyInstanceType: {
      isTool: true,
      input: z.object({
        instanceId: z.string().describe('EC2 Instance ID'),
        instanceType: z.string().describe('New instance type (e.g., t3.medium)'),
      }),
      handler: async (ctx, input) => {
        const typedInput = input as { instanceId: string; instanceType: string };

        const response = await callEc2Api(ctx, 'ModifyInstanceAttribute', {
          InstanceId: typedInput.instanceId,
          'InstanceType.Value': typedInput.instanceType,
        });

        const parsed = parseXmlResponse(response);
        const returnValue = parsed.getValue('return');

        if (returnValue === 'true') {
          return {
            instanceId: typedInput.instanceId,
            newInstanceType: typedInput.instanceType,
            success: true,
            message: `Instance type modified to ${typedInput.instanceType}`,
          };
        } else {
          throw new Error(`Failed to modify instance type: ${parsed.raw}`);
        }
      },
    },

    scaleUp: {
      isTool: true,
      input: z.object({
        instanceId: z.string().min(1).describe('EC2 Instance ID to scale up'),
      }),
      handler: async (ctx, input) => {
        const typedInput = input as { instanceId: string };

        if (!typedInput.instanceId || typedInput.instanceId.trim() === '') {
          throw new Error(
            'Instance ID is required but was empty. Please check the workflow variable mapping.'
          );
        }

        // Get current instance details
        const describeResponse = await callEc2Api(ctx, 'DescribeInstances', {
          'InstanceId.1': typedInput.instanceId,
        });
        const parsed = parseXmlResponse(describeResponse);
        const currentType = parsed.getValue('instanceType');

        if (!currentType) {
          throw new Error(`Could not determine current instance type for ${typedInput.instanceId}`);
        }

        const newType = getScaledInstanceType(currentType, 'up');

        // Stop the instance
        await callEc2Api(ctx, 'StopInstances', {
          'InstanceId.1': typedInput.instanceId,
        });

        // Wait a bit for the instance to stop (in production, you'd poll the state)
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Modify instance type
        await callEc2Api(ctx, 'ModifyInstanceAttribute', {
          InstanceId: typedInput.instanceId,
          'InstanceType.Value': newType,
        });

        // Start the instance
        await callEc2Api(ctx, 'StartInstances', {
          'InstanceId.1': typedInput.instanceId,
        });

        return {
          instanceId: typedInput.instanceId,
          previousType: currentType,
          newType,
          message: `Successfully scaled up from ${currentType} to ${newType}`,
        };
      },
    },

    scaleDown: {
      isTool: true,
      input: z.object({
        instanceId: z.string().min(1).describe('EC2 Instance ID to scale down'),
      }),
      handler: async (ctx, input) => {
        const typedInput = input as { instanceId: string };

        if (!typedInput.instanceId || typedInput.instanceId.trim() === '') {
          throw new Error(
            'Instance ID is required but was empty. Please check the workflow variable mapping.'
          );
        }

        // Get current instance details
        const describeResponse = await callEc2Api(ctx, 'DescribeInstances', {
          'InstanceId.1': typedInput.instanceId,
        });
        const parsed = parseXmlResponse(describeResponse);
        const currentType = parsed.getValue('instanceType');

        if (!currentType) {
          throw new Error(`Could not determine current instance type for ${typedInput.instanceId}`);
        }

        const newType = getScaledInstanceType(currentType, 'down');

        // Don't scale down if already at minimum
        if (newType === currentType) {
          return {
            instanceId: typedInput.instanceId,
            previousType: currentType,
            newType: currentType,
            message: `Instance is already at minimum size (${currentType}), no action taken`,
          };
        }

        // Stop the instance
        await callEc2Api(ctx, 'StopInstances', {
          'InstanceId.1': typedInput.instanceId,
        });

        // Wait a bit for the instance to stop
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Modify instance type
        await callEc2Api(ctx, 'ModifyInstanceAttribute', {
          InstanceId: typedInput.instanceId,
          'InstanceType.Value': newType,
        });

        // Start the instance
        await callEc2Api(ctx, 'StartInstances', {
          'InstanceId.1': typedInput.instanceId,
        });

        return {
          instanceId: typedInput.instanceId,
          previousType: currentType,
          newType,
          message: `Successfully scaled down from ${currentType} to ${newType}`,
        };
      },
    },
  },

  test: {
    handler: async (ctx) => {
      try {
        // Test by making a simple DescribeRegions call
        await callEc2Api(ctx, 'DescribeRegions', {});
        return {
          ok: true,
          message: 'Successfully connected to AWS EC2 API',
        };
      } catch (error) {
        return {
          ok: false,
          message: `Failed to connect: ${error}`,
        };
      }
    },
    description: i18n.translate('connectorSpecs.awsEc2.test.description', {
      defaultMessage: 'Verifies AWS EC2 API credentials',
    }),
  },
};
