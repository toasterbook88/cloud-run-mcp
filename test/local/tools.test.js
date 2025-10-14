import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import esmock from 'esmock';

describe('registerTools', () => {
  it('should register all tools', async () => {
    const server = {
      registerTool: mock.fn(),
    };

    const { registerTools } = await esmock('../../tools/tools.js', {});

    registerTools(server);

    assert.strictEqual(server.registerTool.mock.callCount(), 9);
    const toolNames = server.registerTool.mock.calls.map(
      (call) => call.arguments[0]
    );
    assert.deepStrictEqual(
      toolNames.sort(),
      [
        'create_new_workspace',
        'create_project',
        'deploy_container_image',
        'deploy_file_contents',
        'deploy_local_folder',
        'get_service',
        'get_service_log',
        'list_projects',
        'list_services',
      ].sort()
    );
  });

  describe('list_projects', () => {
    it('should list projects', async () => {
      const server = {
        registerTool: mock.fn(),
      };

      const { registerTools } = await esmock(
        '../../tools/tools.js',
        {},
        {
          '../../lib/cloud-api/projects.js': {
            listProjects: () =>
              Promise.resolve([{ id: 'project1' }, { id: 'project2' }]),
          },
        }
      );

      registerTools(server, { gcpCredentialsAvailable: true });

      const handler = server.registerTool.mock.calls.find(
        (call) => call.arguments[0] === 'list_projects'
      ).arguments[2];
      const result = await handler({});

      assert.deepStrictEqual(result, {
        content: [
          {
            type: 'text',
            text: 'Available GCP Projects:\n- project1\n- project2',
          },
        ],
      });
    });
  });

  describe('create_project', () => {
    it('should create a project with a provided id', async () => {
      const server = {
        registerTool: mock.fn(),
      };

      const { registerTools } = await esmock(
        '../../tools/tools.js',
        {},
        {
          '../../lib/cloud-api/projects.js': {
            createProjectAndAttachBilling: (projectId) =>
              Promise.resolve({
                projectId: projectId,
                billingMessage: 'billing message',
              }),
          },
        }
      );

      registerTools(server, { gcpCredentialsAvailable: true });

      const handler = server.registerTool.mock.calls.find(
        (call) => call.arguments[0] === 'create_project'
      ).arguments[2];
      const result = await handler({ projectId: 'my-project' });

      assert.deepStrictEqual(result, {
        content: [
          {
            type: 'text',
            text: 'Successfully created GCP project with ID "my-project". You can now use this project ID for deployments.',
          },
        ],
      });
    });

    it('should create a project with a generated id', async () => {
      const server = {
        registerTool: mock.fn(),
      };

      const { registerTools } = await esmock(
        '../../tools/tools.js',
        {},
        {
          '../../lib/cloud-api/projects.js': {
            createProjectAndAttachBilling: () =>
              Promise.resolve({
                projectId: 'generated-project',
                billingMessage: 'billing message',
              }),
          },
        }
      );

      registerTools(server, { gcpCredentialsAvailable: true });

      const handler = server.registerTool.mock.calls.find(
        (call) => call.arguments[0] === 'create_project'
      ).arguments[2];
      const result = await handler({});

      assert.deepStrictEqual(result, {
        content: [
          {
            type: 'text',
            text: 'Successfully created GCP project with ID "generated-project". You can now use this project ID for deployments.',
          },
        ],
      });
    });
  });

  describe('create_new_workspace', () => {
    it('should create a workspace with a provided name', async () => {
      const server = {
        registerTool: mock.fn(),
      };

      const { registerTools } = await esmock(
        '../../tools/tools.js',
        {},
        {
          '../../lib/cloud-api/projects.js': {
            createProjectAndAttachBilling: (workspaceName) =>
              Promise.resolve({
                projectId: workspaceName,
                billingMessage: 'billing message',
              }),
          },
        }
      );

      registerTools(server, { gcpCredentialsAvailable: true });

      const handler = server.registerTool.mock.calls.find(
        (call) => call.arguments[0] === 'create_new_workspace'
      ).arguments[2];
      const result = await handler({ workspaceName: 'my-workspace' });

      assert.deepStrictEqual(result, {
        content: [
          {
            type: 'text',
            text: 'Successfully created workspace with ID "my-workspace". You can now use this workspace ID for deployments.',
          },
        ],
      });
    });

    it('should create a workspace with a generated id', async () => {
      const server = {
        registerTool: mock.fn(),
      };

      const { registerTools } = await esmock(
        '../../tools/tools.js',
        {},
        {
          '../../lib/cloud-api/projects.js': {
            createProjectAndAttachBilling: () =>
              Promise.resolve({
                projectId: 'generated-workspace',
                billingMessage: 'billing message',
              }),
          },
        }
      );

      registerTools(server, { gcpCredentialsAvailable: true });

      const handler = server.registerTool.mock.calls.find(
        (call) => call.arguments[0] === 'create_new_workspace'
      ).arguments[2];
      const result = await handler({});

      assert.deepStrictEqual(result, {
        content: [
          {
            type: 'text',
            text: 'Successfully created workspace with ID "generated-workspace". You can now use this workspace ID for deployments.',
          },
        ],
      });
    });
  });

  describe('list_services', () => {
    it('should list services', async () => {
      const server = {
        registerTool: mock.fn(),
      };

      const { registerTools } = await esmock(
        '../../tools/tools.js',
        {},
        {
          '../../lib/cloud-api/run.js': {
            listServices: () =>
              Promise.resolve({
                'my-region1': [
                  { name: 'service1', uri: 'uri1' },
                  { name: 'service2', uri: 'uri2' },
                ],
                'my-region2': [
                  { name: 'service3', uri: 'uri3' },
                  { name: 'service4', uri: 'uri4' },
                ],
              }),
          },
        }
      );

      registerTools(server, { gcpCredentialsAvailable: true });

      const handler = server.registerTool.mock.calls.find(
        (call) => call.arguments[0] === 'list_services'
      ).arguments[2];
      const result = await handler({
        project: 'my-project',
      });

      assert.deepStrictEqual(result, {
        content: [
          {
            type: 'text',
            text: 'Services in project my-project (location my-region1):\n- service1 (URL: uri1)\n- service2 (URL: uri2)',
          },
          {
            type: 'text',
            text: 'Services in project my-project (location my-region2):\n- service3 (URL: uri3)\n- service4 (URL: uri4)',
          },
        ],
      });
    });
  });

  describe('get_service', () => {
    it('should get a service', async () => {
      const server = {
        registerTool: mock.fn(),
      };

      const { registerTools } = await esmock(
        '../../tools/tools.js',
        {},
        {
          '../../lib/cloud-api/run.js': {
            getService: () =>
              Promise.resolve({
                name: 'my-service',
                uri: 'my-uri',
                lastModifier: 'me',
              }),
          },
        }
      );

      registerTools(server, { gcpCredentialsAvailable: true });

      const handler = server.registerTool.mock.calls.find(
        (call) => call.arguments[0] === 'get_service'
      ).arguments[2];
      const result = await handler({
        project: 'my-project',
        region: 'my-region',
        service: 'my-service',
      });

      assert.deepStrictEqual(result, {
        content: [
          {
            type: 'text',
            text: 'Name: my-service\nRegion: my-region\nProject: my-project\nURL: my-uri\nLast deployed by: me',
          },
        ],
      });
    });
  });

  describe('get_service_log', () => {
    it('should get service logs', async () => {
      const server = {
        registerTool: mock.fn(),
      };

      let callCount = 0;
      const getServiceLogs = () => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            logs: 'log1\nlog2',
            requestOptions: { pageToken: 'nextPage' },
          });
        }
        return Promise.resolve({ logs: 'log3\nlog4', requestOptions: null });
      };

      const { registerTools } = await esmock(
        '../../tools/tools.js',
        {},
        {
          '../../lib/cloud-api/run.js': {
            getServiceLogs: getServiceLogs,
          },
        }
      );

      registerTools(server, { gcpCredentialsAvailable: true });

      const handler = server.registerTool.mock.calls.find(
        (call) => call.arguments[0] === 'get_service_log'
      ).arguments[2];
      const result = await handler({
        project: 'my-project',
        region: 'my-region',
        service: 'my-service',
      });

      assert.deepStrictEqual(result, {
        content: [
          {
            type: 'text',
            text: 'log1\nlog2\nlog3\nlog4',
          },
        ],
      });
    });
  });

  describe('deploy_local_folder', () => {
    it('should deploy local folder', async () => {
      const server = {
        registerTool: mock.fn(),
      };

      const { registerTools } = await esmock(
        '../../tools/tools.js',
        {},
        {
          '../../lib/deployment/deployer.js': {
            deploy: () => Promise.resolve({ uri: 'my-uri' }),
          },
        }
      );

      registerTools(server, { gcpCredentialsAvailable: true });

      const handler = server.registerTool.mock.calls.find(
        (call) => call.arguments[0] === 'deploy_local_folder'
      ).arguments[2];
      const result = await handler(
        {
          project: 'my-project',
          region: 'my-region',
          service: 'my-service',
          folderPath: '/my/folder',
        },
        { sendNotification: mock.fn() }
      );

      assert.deepStrictEqual(result, {
        content: [
          {
            type: 'text',
            text: 'Cloud Run service my-service deployed from folder /my/folder in project my-project\nCloud Console: https://console.cloud.google.com/run/detail/my-region/my-service?project=my-project\nService URL: my-uri',
          },
        ],
      });
    });
  });

  describe('deploy_file_contents', () => {
    it('should deploy file contents', async () => {
      const server = {
        registerTool: mock.fn(),
      };

      const { registerTools } = await esmock(
        '../../tools/tools.js',
        {},
        {
          '../../lib/deployment/deployer.js': {
            deploy: () => Promise.resolve({ uri: 'my-uri' }),
          },
        }
      );

      registerTools(server, { gcpCredentialsAvailable: true });

      const handler = server.registerTool.mock.calls.find(
        (call) => call.arguments[0] === 'deploy_file_contents'
      ).arguments[2];
      const result = await handler(
        {
          project: 'my-project',
          region: 'my-region',
          service: 'my-service',
          files: [{ filename: 'file1', content: 'content1' }],
        },
        { sendNotification: mock.fn() }
      );

      assert.deepStrictEqual(result, {
        content: [
          {
            type: 'text',
            text: 'Cloud Run service my-service deployed in project my-project\nCloud Console: https://console.cloud.google.com/run/detail/my-region/my-service?project=my-project\nService URL: my-uri',
          },
        ],
      });
    });
  });

  describe('deploy_container_image', () => {
    it('should deploy container image', async () => {
      const server = {
        registerTool: mock.fn(),
      };

      const { registerTools } = await esmock(
        '../../tools/tools.js',
        {},
        {
          '../../lib/deployment/deployer.js': {
            deployImage: () => Promise.resolve({ uri: 'my-uri' }),
          },
        }
      );

      registerTools(server, { gcpCredentialsAvailable: true });

      const handler = server.registerTool.mock.calls.find(
        (call) => call.arguments[0] === 'deploy_container_image'
      ).arguments[2];
      const result = await handler(
        {
          project: 'my-project',
          region: 'my-region',
          service: 'my-service',
          imageUrl: 'gcr.io/my-project/my-image',
        },
        { sendNotification: mock.fn() }
      );

      assert.deepStrictEqual(result, {
        content: [
          {
            type: 'text',
            text: 'Cloud Run service my-service deployed in project my-project\nCloud Console: https://console.cloud.google.com/run/detail/my-region/my-service?project=my-project\nService URL: my-uri',
          },
        ],
      });
    });
  });

  describe('when gcp credentials are not available', () => {
    it('should return an error for all tools', async () => {
      const server = {
        registerTool: mock.fn(),
      };

      const { registerTools } = await esmock('../../tools/tools.js', {});

      registerTools(server, { gcpCredentialsAvailable: false });

      const toolNames = server.registerTool.mock.calls.map(
        (call) => call.arguments[0]
      );

      for (const toolName of toolNames) {
        const handler = server.registerTool.mock.calls.find(
          (call) => call.arguments[0] === toolName
        ).arguments[2];
        const result = await handler({});
        assert.deepStrictEqual(result, {
          content: [
            {
              type: 'text',
              text: 'GCP credentials are not available. Please configure your environment.',
            },
          ],
        });
      }
    });
  });
});
