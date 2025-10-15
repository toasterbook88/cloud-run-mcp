/*
Copyright 2025 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { z } from 'zod';
import {
  listProjects,
  createProjectAndAttachBilling,
} from '../lib/cloud-api/projects.js';
import {
  listServices,
  getService,
  getServiceLogs,
} from '../lib/cloud-api/run.js';
import { deploy, deployImage } from '../lib/deployment/deployer.js';
import { createWorkspace } from '../lib/cloud-api/workspace.js';

function createProgressCallback(sendNotification) {
  return (progress) => {
    sendNotification({
      method: 'notifications/message',
      params: { level: progress.level || 'info', data: progress.data },
    });
  };
}

function gcpTool(gcpCredentialsAvailable, fn) {
  if (!gcpCredentialsAvailable) {
    return () => ({
      content: [
        {
          type: 'text',
          text: 'GCP credentials are not available. Please configure your environment.',
        },
      ],
    });
  }
  return fn;
}

// Tool to list GCP projects
function registerListProjectsTool(server, options) {
  server.registerTool(
    'list_projects',
    {
      description: 'Lists available GCP projects',
      inputSchema: {},
    },
    gcpTool(options.gcpCredentialsAvailable, async () => {
      try {
        const projects = await listProjects();
        return {
          content: [
            {
              type: 'text',
              text: `Available GCP Projects:\n${projects.map((p) => `- ${p.id}`).join('\n')}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error listing GCP projects: ${error.message}`,
            },
          ],
        };
      }
    })
  );
}

// Tool to create a new GCP project
function registerCreateProjectTool(server, options) {
  server.registerTool(
    'create_project',
    {
      description:
        'Creates a new GCP project and attempts to attach it to the first available billing account. A project ID can be optionally specified; otherwise it will be automatically generated.',
      inputSchema: {
        projectId: z
          .string()
          .optional()
          .describe(
            'Optional. The desired ID for the new GCP project. If not provided, an ID will be auto-generated.'
          ),
      },
    },
    gcpTool(options.gcpCredentialsAvailable, async ({ projectId }) => {
      if (
        projectId !== undefined &&
        (typeof projectId !== 'string' || projectId.trim() === '')
      ) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: If provided, Project ID must be a non-empty string.',
            },
          ],
        };
      }
      try {
        const result = await createProjectAndAttachBilling(projectId);
        return {
          content: [
            {
              type: 'text',
              text: `Successfully created GCP project with ID "${result.projectId}". You can now use this project ID for deployments.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating GCP project or attaching billing: ${error.message}`,
            },
          ],
        };
      }
    })
  );
}

// Tool to create a new workspace
function registerCreateWorkspaceTool(server, options) {
  server.registerTool(
    'create_workspace',
    {
      description:
        'Creates a complete Cloud Run workspace including a new GCP project with billing. This is a comprehensive setup that prepares everything needed to start deploying to Cloud Run.',
      inputSchema: {
        projectId: z
          .string()
          .optional()
          .describe(
            'Optional. The desired ID for the new GCP project. If not provided, an ID will be auto-generated.'
          ),
        workspaceName: z
          .string()
          .optional()
          .describe(
            'Optional. A friendly name for the workspace. If not provided, the project ID will be used.'
          ),
      },
    },
    gcpTool(
      options.gcpCredentialsAvailable,
      async ({ projectId, workspaceName }) => {
        if (
          projectId !== undefined &&
          (typeof projectId !== 'string' || projectId.trim() === '')
        ) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: If provided, Project ID must be a non-empty string.',
              },
            ],
          };
        }
        if (
          workspaceName !== undefined &&
          (typeof workspaceName !== 'string' || workspaceName.trim() === '')
        ) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: If provided, Workspace Name must be a non-empty string.',
              },
            ],
          };
        }
        try {
          const result = await createWorkspace(projectId, workspaceName);
          return {
            content: [
              {
                type: 'text',
                text: `Successfully created Cloud Run workspace "${result.workspaceName}" with project ID "${result.projectId}".\n\n${result.billingMessage}\n\nYour workspace is ready! You can now deploy services to this project.`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error creating workspace: ${error.message}`,
              },
            ],
          };
        }
      }
    )
  );
}

// Listing Cloud Run services
function registerListServicesTool(server, options) {
  server.registerTool(
    'list_services',
    {
      description: 'Lists all Cloud Run services in a given project.',
      inputSchema: {
        project: z
          .string()
          .describe('Google Cloud project ID')
          .default(options.defaultProjectId),
      },
    },
    gcpTool(options.gcpCredentialsAvailable, async ({ project }) => {
      if (typeof project !== 'string') {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: Project ID must be provided and be a non-empty string.',
            },
          ],
        };
      }
      try {
        const allServices = await listServices(project);
        const content = [];
        for (const region of Object.keys(allServices)) {
          const serviceList = allServices[region];
          const servicesText = serviceList
            .map((s) => {
              const serviceName = s.name.split('/').pop();
              return `- ${serviceName} (URL: ${s.uri})`;
            })
            .join('\n');
          content.push({
            type: 'text',
            text: `Services in project ${project} (location ${region}):\n${servicesText}`,
          });
        }
        return { content };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error listing services for project ${project}: ${error.message}`,
            },
          ],
        };
      }
    })
  );
}

// Dynamic resource for getting a specific service
function registerGetServiceTool(server, options) {
  server.registerTool(
    'get_service',
    {
      description: 'Gets details for a specific Cloud Run service.',
      inputSchema: {
        project: z
          .string()
          .describe('Google Cloud project ID containing the service')
          .default(options.defaultProjectId),
        region: z
          .string()
          .describe('Region where the service is located')
          .default(options.defaultRegion),
        service: z
          .string()
          .describe('Name of the Cloud Run service')
          .default(options.defaultServiceName),
      },
    },
    gcpTool(
      options.gcpCredentialsAvailable,
      async ({ project, region, service }) => {
        if (typeof project !== 'string') {
          return {
            content: [
              { type: 'text', text: 'Error: Project ID must be provided.' },
            ],
          };
        }
        if (typeof service !== 'string') {
          return {
            content: [
              { type: 'text', text: 'Error: Service name must be provided.' },
            ],
          };
        }
        try {
          const serviceDetails = await getService(project, region, service);
          if (serviceDetails) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Name: ${service}\nRegion: ${region}\nProject: ${project}\nURL: ${serviceDetails.uri}\nLast deployed by: ${serviceDetails.lastModifier}`,
                },
              ],
            };
          } else {
            return {
              content: [
                {
                  type: 'text',
                  text: `Service ${service} not found in project ${project} (region ${region}).`,
                },
              ],
            };
          }
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error getting service ${service} in project ${project} (region ${region}): ${error.message}`,
              },
            ],
          };
        }
      }
    )
  );
}

// Get logs for a service
function registerGetServiceLogTool(server, options) {
  server.registerTool(
    'get_service_log',
    {
      description:
        'Gets Logs and Error Messages for a specific Cloud Run service.',
      inputSchema: {
        project: z
          .string()
          .describe('Google Cloud project ID containing the service')
          .default(options.defaultProjectId),
        region: z
          .string()
          .describe('Region where the service is located')
          .default(options.defaultRegion),
        service: z
          .string()
          .describe('Name of the Cloud Run service')
          .default(options.defaultServiceName),
      },
    },
    gcpTool(
      options.gcpCredentialsAvailable,
      async ({ project, region, service }) => {
        let allLogs = [];
        let requestOptions;
        try {
          do {
            // Fetch a page of logs
            const response = await getServiceLogs(
              project,
              region,
              service,
              requestOptions
            );

            if (response.logs) {
              allLogs.push(response.logs);
            }

            // Set the requestOptions incl pagintion token for the next iteration

            requestOptions = response.requestOptions;
          } while (requestOptions); // Continue as long as there is a next page token
          return {
            content: [
              {
                type: 'text',
                text: allLogs.join('\n'),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error getting Logs for service ${service} in project ${project} (region ${region}): ${error.message}`,
              },
            ],
          };
        }
      }
    )
  );
}

// Tool to deploy to Cloud Run from local folder
function registerDeployLocalFolderTool(server, options) {
  server.registerTool(
    'deploy_local_folder',
    {
      description:
        'Deploy a local folder to Cloud Run. Takes an absolute folder path from the local filesystem that will be deployed. Use this tool if the entire folder content needs to be deployed.',
      inputSchema: {
        project: z
          .string()
          .describe(
            'Google Cloud project ID. Do not select it yourself, make sure the user provides or confirms the project ID.'
          )
          .default(options.defaultProjectId),
        region: z
          .string()
          .optional()
          .default(options.defaultRegion)
          .describe('Region to deploy the service to'),
        service: z
          .string()
          .optional()
          .default(options.defaultServiceName)
          .describe('Name of the Cloud Run service to deploy to'),
        folderPath: z
          .string()
          .describe(
            'Absolute path to the folder to deploy (e.g. "/home/user/project/src")'
          ),
      },
    },
    gcpTool(
      options.gcpCredentialsAvailable,
      async (
        { project, region, service, folderPath },
        { sendNotification }
      ) => {
        if (typeof project !== 'string') {
          throw new Error(
            'Project must be specified, please prompt the user for a valid existing Google Cloud project ID.'
          );
        }
        if (typeof folderPath !== 'string' || folderPath.trim() === '') {
          throw new Error(
            'Folder path must be specified and be a non-empty string.'
          );
        }

        const progressCallback = createProgressCallback(sendNotification);

        // Deploy to Cloud Run
        try {
          await progressCallback({
            data: `Starting deployment of local folder for service ${service} in project ${project}...`,
          });
          const response = await deploy({
            projectId: project,
            serviceName: service,
            region: region,
            files: [folderPath],
            skipIamCheck: options.skipIamCheck, // Pass the new flag
            progressCallback,
          });
          return {
            content: [
              {
                type: 'text',
                text: `Cloud Run service ${service} deployed from folder ${folderPath} in project ${project}\nCloud Console: https://console.cloud.google.com/run/detail/${region}/${service}?project=${project}\nService URL: ${response.uri}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error deploying folder to Cloud Run: ${error.message || error}`,
              },
            ],
          };
        }
      }
    )
  );
}

// Tool to deploy to Cloud Run from file contents
function registerDeployFileContentsTool(server, options) {
  server.registerTool(
    'deploy_file_contents',
    {
      description:
        'Deploy files to Cloud Run by providing their contents directly. Takes an array of file objects containing filename and content. Use this tool if the files only exist in the current chat context.',
      inputSchema: {
        project: z
          .string()
          .describe(
            'Google Cloud project ID. Leave unset for the app to be deployed in a new project. If provided, make sure the user confirms the project ID they want to deploy to.'
          )
          .default(options.defaultProjectId),
        region: z
          .string()
          .optional()
          .default(options.defaultRegion)
          .describe('Region to deploy the service to'),
        service: z
          .string()
          .optional()
          .default(options.defaultServiceName)
          .describe('Name of the Cloud Run service to deploy to'),
        files: z
          .array(
            z.object({
              filename: z
                .string()
                .describe(
                  'Name and path of the file (e.g. "src/index.js" or "data/config.json")'
                ),
              content: z
                .string()
                .optional()
                .describe('Text content of the file'),
            })
          )
          .describe('Array of file objects containing filename and content'),
      },
    },
    gcpTool(
      options.gcpCredentialsAvailable,
      async ({ project, region, service, files }, { sendNotification }) => {
        if (typeof project !== 'string') {
          throw new Error(
            'Project must specified, please prompt the user for a valid existing Google Cloud project ID.'
          );
        }
        if (typeof files !== 'object' || !Array.isArray(files)) {
          throw new Error('Files must be specified');
        }
        if (files.length === 0) {
          throw new Error('No files specified for deployment');
        }

        // Validate that each file has either content
        for (const file of files) {
          if (!file.content) {
            throw new Error(`File ${file.filename} must have content`);
          }
        }

        const progressCallback = createProgressCallback(sendNotification);

        // Deploy to Cloud Run
        try {
          await progressCallback({
            data: `Starting deployment of file contents for service ${service} in project ${project}...`,
          });
          const response = await deploy({
            projectId: project,
            serviceName: service,
            region: region,
            files: files,
            skipIamCheck: options.skipIamCheck, // Pass the new flag
            progressCallback,
          });
          return {
            content: [
              {
                type: 'text',
                text: `Cloud Run service ${service} deployed in project ${project}\nCloud Console: https://console.cloud.google.com/run/detail/${region}/${service}?project=${project}\nService URL: ${response.uri}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error deploying to Cloud Run: ${error.message || error}`,
              },
            ],
          };
        }
      }
    )
  );
}

// Tool to deploy to Cloud Run from container image
function registerDeployContainerImageTool(server, options) {
  server.registerTool(
    'deploy_container_image',
    {
      description:
        'Deploys a container image to Cloud Run. Use this tool if the user provides a container image URL.',
      inputSchema: {
        project: z
          .string()
          .describe(
            'Google Cloud project ID. Do not select it yourself, make sure the user provides or confirms the project ID.'
          )
          .default(options.defaultProjectId),
        region: z
          .string()
          .optional()
          .default(options.defaultRegion)
          .describe('Region to deploy the service to'),
        service: z
          .string()
          .optional()
          .default(options.defaultServiceName)
          .describe('Name of the Cloud Run service to deploy to'),
        imageUrl: z
          .string()
          .describe(
            'The URL of the container image to deploy (e.g. "gcr.io/cloudrun/hello")'
          ),
      },
    },
    gcpTool(
      options.gcpCredentialsAvailable,
      async ({ project, region, service, imageUrl }, { sendNotification }) => {
        if (typeof project !== 'string') {
          throw new Error(
            'Project must specified, please prompt the user for a valid existing Google Cloud project ID.'
          );
        }
        if (typeof imageUrl !== 'string' || imageUrl.trim() === '') {
          throw new Error(
            'Container image URL must be specified and be a non-empty string.'
          );
        }

        const progressCallback = createProgressCallback(sendNotification);

        // Deploy to Cloud Run
        try {
          const response = await deployImage({
            projectId: project,
            serviceName: service,
            region: region,
            imageUrl: imageUrl,
            skipIamCheck: options.skipIamCheck,
            progressCallback,
          });
          return {
            content: [
              {
                type: 'text',
                text: `Cloud Run service ${service} deployed in project ${project}\nCloud Console: https://console.cloud.google.com/run/detail/${region}/${service}?project=${project}\nService URL: ${response.uri}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error deploying to Cloud Run: ${error.message || error}`,
              },
            ],
          };
        }
      }
    )
  );
}

export {
  registerListProjectsTool,
  registerCreateProjectTool,
  registerCreateWorkspaceTool,
  registerListServicesTool,
  registerGetServiceTool,
  registerGetServiceLogTool,
  registerDeployLocalFolderTool,
  registerDeployFileContentsTool,
  registerDeployContainerImageTool,
};
