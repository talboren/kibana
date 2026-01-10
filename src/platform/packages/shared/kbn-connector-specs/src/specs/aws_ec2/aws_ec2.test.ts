/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { ActionContext } from '../../connector_spec';
import { AwsEc2Connector } from './aws_ec2';

describe('AwsEc2Connector', () => {
  const mockClient = {
    get: jest.fn(),
  };

  const mockContext = {
    client: mockClient,
    config: {
      region: 'us-east-1',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    },
    log: {},
  } as unknown as ActionContext;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('describeInstances action', () => {
    it('should describe an EC2 instance and return details', async () => {
      const mockResponse = {
        data: `<?xml version="1.0" encoding="UTF-8"?>
<DescribeInstancesResponse>
  <instancesSet>
    <item>
      <instanceId>i-1234567890abcdef0</instanceId>
      <instanceType>t3.micro</instanceType>
      <instanceState>
        <name>running</name>
      </instanceState>
    </item>
  </instancesSet>
</DescribeInstancesResponse>`,
      };
      mockClient.get.mockResolvedValue(mockResponse);

      const result = await AwsEc2Connector.actions.describeInstances.handler(mockContext, {
        instanceId: 'i-1234567890abcdef0',
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        expect.stringContaining('ec2.us-east-1.amazonaws.com'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Amz-Date': expect.any(String),
            Authorization: expect.stringContaining('AWS4-HMAC-SHA256'),
          }),
        })
      );
      expect(result).toEqual({
        instanceId: 'i-1234567890abcdef0',
        instanceType: 't3.micro',
        state: 'running',
        raw: expect.any(String),
      });
    });

    it('should handle instances with different types', async () => {
      const mockResponse = {
        data: `<?xml version="1.0" encoding="UTF-8"?>
<DescribeInstancesResponse>
  <instancesSet>
    <item>
      <instanceId>i-0987654321fedcba0</instanceId>
      <instanceType>t3.medium</instanceType>
      <instanceState>
        <name>stopped</name>
      </instanceState>
    </item>
  </instancesSet>
</DescribeInstancesResponse>`,
      };
      mockClient.get.mockResolvedValue(mockResponse);

      const result = (await AwsEc2Connector.actions.describeInstances.handler(mockContext, {
        instanceId: 'i-0987654321fedcba0',
      })) as { instanceType: string; state: string };

      expect(result.instanceType).toBe('t3.medium');
      expect(result.state).toBe('stopped');
    });
  });

  describe('stopInstances action', () => {
    it('should stop a running EC2 instance', async () => {
      const mockResponse = {
        data: `<?xml version="1.0" encoding="UTF-8"?>
<StopInstancesResponse>
  <instancesSet>
    <item>
      <instanceId>i-1234567890abcdef0</instanceId>
      <currentState>
        <name>stopping</name>
      </currentState>
    </item>
  </instancesSet>
</StopInstancesResponse>`,
      };
      mockClient.get.mockResolvedValue(mockResponse);

      const result = await AwsEc2Connector.actions.stopInstances.handler(mockContext, {
        instanceId: 'i-1234567890abcdef0',
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        expect.stringContaining('Action=StopInstances'),
        expect.any(Object)
      );
      expect(result).toEqual({
        instanceId: 'i-1234567890abcdef0',
        previousState: 'running',
        currentState: 'stopping',
        message: 'Instance i-1234567890abcdef0 is stopping',
      });
    });
  });

  describe('startInstances action', () => {
    it('should start a stopped EC2 instance', async () => {
      const mockResponse = {
        data: `<?xml version="1.0" encoding="UTF-8"?>
<StartInstancesResponse>
  <instancesSet>
    <item>
      <instanceId>i-1234567890abcdef0</instanceId>
      <currentState>
        <name>pending</name>
      </currentState>
    </item>
  </instancesSet>
</StartInstancesResponse>`,
      };
      mockClient.get.mockResolvedValue(mockResponse);

      const result = await AwsEc2Connector.actions.startInstances.handler(mockContext, {
        instanceId: 'i-1234567890abcdef0',
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        expect.stringContaining('Action=StartInstances'),
        expect.any(Object)
      );
      expect(result).toEqual({
        instanceId: 'i-1234567890abcdef0',
        previousState: 'stopped',
        currentState: 'pending',
        message: 'Instance i-1234567890abcdef0 is starting',
      });
    });
  });

  describe('modifyInstanceType action', () => {
    it('should modify instance type successfully', async () => {
      const mockResponse = {
        data: `<?xml version="1.0" encoding="UTF-8"?>
<ModifyInstanceAttributeResponse>
  <return>true</return>
</ModifyInstanceAttributeResponse>`,
      };
      mockClient.get.mockResolvedValue(mockResponse);

      const result = await AwsEc2Connector.actions.modifyInstanceType.handler(mockContext, {
        instanceId: 'i-1234567890abcdef0',
        instanceType: 't3.medium',
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        expect.stringContaining('Action=ModifyInstanceAttribute'),
        expect.any(Object)
      );
      expect(result).toEqual({
        instanceId: 'i-1234567890abcdef0',
        newInstanceType: 't3.medium',
        success: true,
        message: 'Instance type modified to t3.medium',
      });
    });

    it('should throw error when modification fails', async () => {
      const mockResponse = {
        data: `<?xml version="1.0" encoding="UTF-8"?>
<ModifyInstanceAttributeResponse>
  <return>false</return>
</ModifyInstanceAttributeResponse>`,
      };
      mockClient.get.mockResolvedValue(mockResponse);

      await expect(
        AwsEc2Connector.actions.modifyInstanceType.handler(mockContext, {
          instanceId: 'i-1234567890abcdef0',
          instanceType: 't3.medium',
        })
      ).rejects.toThrow('Failed to modify instance type');
    });
  });

  describe('scaleUp action', () => {
    it('should scale up instance from t3.micro to t3.small', async () => {
      // Mock describe response
      const describeResponse = {
        data: `<?xml version="1.0" encoding="UTF-8"?>
<DescribeInstancesResponse>
  <instancesSet>
    <item>
      <instanceId>i-1234567890abcdef0</instanceId>
      <instanceType>t3.micro</instanceType>
      <instanceState>
        <name>running</name>
      </instanceState>
    </item>
  </instancesSet>
</DescribeInstancesResponse>`,
      };

      const stopResponse = {
        data: `<?xml version="1.0" encoding="UTF-8"?>
<StopInstancesResponse>
  <instancesSet>
    <item>
      <instanceId>i-1234567890abcdef0</instanceId>
      <currentState>
        <name>stopping</name>
      </currentState>
    </item>
  </instancesSet>
</StopInstancesResponse>`,
      };

      const modifyResponse = {
        data: `<?xml version="1.0" encoding="UTF-8"?>
<ModifyInstanceAttributeResponse>
  <return>true</return>
</ModifyInstanceAttributeResponse>`,
      };

      const startResponse = {
        data: `<?xml version="1.0" encoding="UTF-8"?>
<StartInstancesResponse>
  <instancesSet>
    <item>
      <instanceId>i-1234567890abcdef0</instanceId>
      <currentState>
        <name>pending</name>
      </currentState>
    </item>
  </instancesSet>
</StartInstancesResponse>`,
      };

      mockClient.get
        .mockResolvedValueOnce(describeResponse)
        .mockResolvedValueOnce(stopResponse)
        .mockResolvedValueOnce(modifyResponse)
        .mockResolvedValueOnce(startResponse);

      const result = await AwsEc2Connector.actions.scaleUp.handler(mockContext, {
        instanceId: 'i-1234567890abcdef0',
      });

      expect(result).toEqual({
        instanceId: 'i-1234567890abcdef0',
        previousType: 't3.micro',
        newType: 't3.small',
        message: 'Successfully scaled up from t3.micro to t3.small',
      });
    });

    it('should scale up instance from t3.small to t3.medium', async () => {
      const describeResponse = {
        data: `<?xml version="1.0" encoding="UTF-8"?>
<DescribeInstancesResponse>
  <instancesSet>
    <item>
      <instanceId>i-1234567890abcdef0</instanceId>
      <instanceType>t3.small</instanceType>
      <instanceState>
        <name>running</name>
      </instanceState>
    </item>
  </instancesSet>
</DescribeInstancesResponse>`,
      };

      mockClient.get
        .mockResolvedValueOnce(describeResponse)
        .mockResolvedValue({ data: '<Response><return>true</return></Response>' });

      const result = (await AwsEc2Connector.actions.scaleUp.handler(mockContext, {
        instanceId: 'i-1234567890abcdef0',
      })) as { previousType: string; newType: string };

      expect(result.previousType).toBe('t3.small');
      expect(result.newType).toBe('t3.medium');
    });

    it('should throw error for unsupported instance type', async () => {
      const describeResponse = {
        data: `<?xml version="1.0" encoding="UTF-8"?>
<DescribeInstancesResponse>
  <instancesSet>
    <item>
      <instanceId>i-1234567890abcdef0</instanceId>
      <instanceType>c5.large</instanceType>
      <instanceState>
        <name>running</name>
      </instanceState>
    </item>
  </instancesSet>
</DescribeInstancesResponse>`,
      };

      mockClient.get.mockResolvedValueOnce(describeResponse);

      await expect(
        AwsEc2Connector.actions.scaleUp.handler(mockContext, {
          instanceId: 'i-1234567890abcdef0',
        })
      ).rejects.toThrow('Instance type c5.large is not supported for auto-scaling');
    });
  });

  describe('scaleDown action', () => {
    it('should scale down instance from t3.medium to t3.small', async () => {
      const describeResponse = {
        data: `<?xml version="1.0" encoding="UTF-8"?>
<DescribeInstancesResponse>
  <instancesSet>
    <item>
      <instanceId>i-1234567890abcdef0</instanceId>
      <instanceType>t3.medium</instanceType>
      <instanceState>
        <name>running</name>
      </instanceState>
    </item>
  </instancesSet>
</DescribeInstancesResponse>`,
      };

      mockClient.get
        .mockResolvedValueOnce(describeResponse)
        .mockResolvedValue({ data: '<Response><return>true</return></Response>' });

      const result = await AwsEc2Connector.actions.scaleDown.handler(mockContext, {
        instanceId: 'i-1234567890abcdef0',
      });

      expect(result).toEqual({
        instanceId: 'i-1234567890abcdef0',
        previousType: 't3.medium',
        newType: 't3.small',
        message: 'Successfully scaled down from t3.medium to t3.small',
      });
    });

    it('should not scale down instance already at minimum size', async () => {
      const describeResponse = {
        data: `<?xml version="1.0" encoding="UTF-8"?>
<DescribeInstancesResponse>
  <instancesSet>
    <item>
      <instanceId>i-1234567890abcdef0</instanceId>
      <instanceType>t3.micro</instanceType>
      <instanceState>
        <name>running</name>
      </instanceState>
    </item>
  </instancesSet>
</DescribeInstancesResponse>`,
      };

      mockClient.get.mockResolvedValueOnce(describeResponse);

      const result = await AwsEc2Connector.actions.scaleDown.handler(mockContext, {
        instanceId: 'i-1234567890abcdef0',
      });

      expect(result).toEqual({
        instanceId: 'i-1234567890abcdef0',
        previousType: 't3.micro',
        newType: 't3.micro',
        message: 'Instance is already at minimum size (t3.micro), no action taken',
      });
    });

    it('should scale down instance from t3.small to t3.micro', async () => {
      const describeResponse = {
        data: `<?xml version="1.0" encoding="UTF-8"?>
<DescribeInstancesResponse>
  <instancesSet>
    <item>
      <instanceId>i-1234567890abcdef0</instanceId>
      <instanceType>t3.small</instanceType>
      <instanceState>
        <name>running</name>
      </instanceState>
    </item>
  </instancesSet>
</DescribeInstancesResponse>`,
      };

      mockClient.get
        .mockResolvedValueOnce(describeResponse)
        .mockResolvedValue({ data: '<Response><return>true</return></Response>' });

      const result = (await AwsEc2Connector.actions.scaleDown.handler(mockContext, {
        instanceId: 'i-1234567890abcdef0',
      })) as { previousType: string; newType: string };

      expect(result.previousType).toBe('t3.small');
      expect(result.newType).toBe('t3.micro');
    });
  });

  describe('test handler', () => {
    it('should return success when API is accessible', async () => {
      const mockResponse = {
        data: `<?xml version="1.0" encoding="UTF-8"?>
<DescribeRegionsResponse>
  <regionInfo>
    <item>
      <regionName>us-east-1</regionName>
    </item>
  </regionInfo>
</DescribeRegionsResponse>`,
      };
      mockClient.get.mockResolvedValue(mockResponse);

      if (!AwsEc2Connector.test) {
        throw new Error('Test handler not defined');
      }
      const result = await AwsEc2Connector.test.handler(mockContext);

      expect(mockClient.get).toHaveBeenCalledWith(
        expect.stringContaining('Action=DescribeRegions'),
        expect.any(Object)
      );
      expect(result).toEqual({
        ok: true,
        message: 'Successfully connected to AWS EC2 API',
      });
    });

    it('should return failure when API is not accessible', async () => {
      mockClient.get.mockRejectedValue(new Error('Invalid credentials'));

      if (!AwsEc2Connector.test) {
        throw new Error('Test handler not defined');
      }
      const result = await AwsEc2Connector.test.handler(mockContext);

      expect(result.ok).toBe(false);
      expect(result.message).toContain('Failed to connect');
    });
  });
});
