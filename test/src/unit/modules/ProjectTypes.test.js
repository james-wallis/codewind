/*******************************************************************************
 * Copyright (c) 2019 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v2.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v20.html
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
*******************************************************************************/
global.codewind = { RUNNING_IN_K8S: false };

const fs = require('fs-extra');
const path = require('path');
const rewire = require('rewire');
const assert = require('assert');
const chai = require('chai');
const chaiSubset = require('chai-subset');
const chaiAsPromised = require('chai-as-promised');

const ProjectTypes = rewire('../../../../src/pfe/portal/modules/ProjectTypes');
const Templates = require('../../../../src/pfe/portal/modules/Templates');
const ExtensionList = require('../../../../src/pfe/portal/modules/ExtensionList');
const { suppressLogOutput } = require('../../../modules/log.service');

chai.use(chaiSubset);
chai.use(chaiAsPromised);
chai.should();

// const mockedProvider = {
//     getProjectTypes: () => {
//         return {

//         };
//     },
// }

describe('ProjectTypes.js', () => {
    suppressLogOutput(ProjectTypes);
    beforeEach(() => {
        global.codewind = { 
            RUNNING_IN_K8S: false,  
            CODEWIND_WORKSPACE: `${__dirname}/projectypes_temp/`, 
            CODEWIND_TEMP_WORKSPACE: `${__dirname}/projectypes_temp/temp/`,
        };
        fs.ensureDirSync(global.codewind.CODEWIND_TEMP_WORKSPACE);
    });
    after(() => {
        fs.remove(global.codewind.CODEWIND_WORKSPACE);
    });
    describe('sanitizeProjectType(array, type)', () => {

    });
    describe.skip('getTypes(templates, providers, extensionList', () => {
        it('test', async() => {
            const templates = new Templates(global.codewind.CODEWIND_WORKSPACE);
            await templates.initializeRepositoryList();

            const extensionList = new ExtensionList();
            // await extensionList.installBuiltInExtensions(path.join(global.codewind.CODEWIND_WORKSPACE));
            await extensionList.initialise(path.join(global.codewind.CODEWIND_WORKSPACE, '.extensions'), templates);

            const templatesList = await templates.getEnabledTemplates();
            const providers = await templates.getProviders();
            // Attempt to install built-in extension packages
            // try {
            //     await this.extensionList.installBuiltInExtensions(this.directories.extensions);
            // } catch (error) {
            //     console.log(`Failed to install built-in Codewind extensions. Error ${error}`);
            // }

            
            console.log('templatesList', templatesList);
            console.log('providers', providers);
            console.log('extensionList', extensionList);
            
            
            
            const t = await ProjectTypes.getTypes(templatesList, providers, extensionList);
            console.log(t);
            
            
            
            // const templates = await user.templates.getEnabledTemplates();
            // const providers = await user.templates.getProviders();
            // const extensionList = user.extensionList;
        });
    });
});