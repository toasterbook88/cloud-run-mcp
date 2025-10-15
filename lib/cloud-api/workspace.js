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

import { createProjectAndAttachBilling } from './projects.js';

/**
 * Creates a complete Cloud Run workspace including a new GCP project with billing.
 * This is a convenience function that sets up everything needed to start deploying to Cloud Run.
 * @async
 * @function createWorkspace
 * @param {string} [projectId] - Optional. The desired ID for the new project.
 * @param {string} [workspaceName] - Optional. A friendly name for the workspace.
 * @returns {Promise<{projectId: string, workspaceName: string, billingMessage: string}>} Workspace details.
 */
export async function createWorkspace(projectId, workspaceName) {
  // Create the project with billing
  const projectResult = await createProjectAndAttachBilling(projectId);

  const workspace = {
    projectId: projectResult.projectId,
    workspaceName: workspaceName || projectResult.projectId,
    billingMessage: projectResult.billingMessage,
  };

  return workspace;
}
