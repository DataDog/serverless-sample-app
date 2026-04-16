//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

// jest.mock is hoisted before const declarations, so mockSend must be defined
// inside the factory to avoid the temporal dead zone error.
jest.mock('@aws-sdk/client-ssm', () => {
  const mockSendFn = jest.fn();
  return {
    SSMClient: jest.fn().mockImplementation(() => ({ send: mockSendFn })),
    GetParameterCommand: jest.fn().mockImplementation((input: unknown) => input),
    _mockSend: mockSendFn,
  };
});

import { reseedUser } from './reseedUser';

// Reach through the mock module to get the shared send function
const mockSend = (jest.requireMock('@aws-sdk/client-ssm') as { _mockSend: jest.Mock })._mockSend;

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('reseedUser', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      USER_API_ENDPOINT_PARAM_NAME: '/dev/Users/api-endpoint',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('posts admin user to the user management API', async () => {
    mockSend.mockResolvedValueOnce({
      Parameter: { Value: 'https://api.example.com/' },
    });
    mockFetch.mockResolvedValueOnce({ status: 200, text: jest.fn() });

    await reseedUser();

    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email_address: 'admin@serverless-sample.com',
        first_name: 'Admin',
        last_name: 'Serverless',
        password: 'Admin!23',
        admin_user: true,
      }),
    });
  });

  it('strips trailing slash from endpoint before appending /user', async () => {
    mockSend.mockResolvedValueOnce({
      Parameter: { Value: 'https://api.example.com/' },
    });
    mockFetch.mockResolvedValueOnce({ status: 200, text: jest.fn() });

    await reseedUser();

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toBe('https://api.example.com/user');
    expect(calledUrl).not.toContain('//user');
  });

  it('throws when USER_API_ENDPOINT_PARAM_NAME is not set', async () => {
    delete process.env.USER_API_ENDPOINT_PARAM_NAME;

    await expect(reseedUser()).rejects.toThrow('USER_API_ENDPOINT_PARAM_NAME must be set');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('throws when SSM parameter is missing', async () => {
    mockSend.mockResolvedValueOnce({ Parameter: { Value: undefined } });

    await expect(reseedUser()).rejects.toThrow('SSM parameter not found');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('throws when the API returns a non-200 status', async () => {
    mockSend.mockResolvedValueOnce({
      Parameter: { Value: 'https://api.example.com' },
    });
    mockFetch.mockResolvedValueOnce({
      status: 500,
      text: jest.fn().mockResolvedValueOnce('Internal Server Error'),
    });

    await expect(reseedUser()).rejects.toThrow('Failed to create admin user: HTTP 500');
  });
});
