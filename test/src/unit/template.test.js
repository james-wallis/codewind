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
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiSubset = require('chai-subset');
const fs = require('fs-extra');
const path = require('path');
const rewire = require('rewire');

global.codewind = { RUNNING_IN_K8S: false };

const Templates = rewire('../../../src/pfe/portal/modules/Templates');
const {
    styledTemplates,
    defaultCodewindTemplates,
    sampleRepos,
    validUrlNotPointingToIndexJson,
} = require('../../modules/template.service');
const { suppressLogOutput } = require('../../modules/log.service');

chai.use(chaiAsPromised);
chai.use(chaiSubset);
chai.should();
const { expect } = chai;

const testWorkspaceDir = './src/unit/temp/';
const testWorkspaceConfigDir = path.join(testWorkspaceDir, '.config/');
const testRepositoryFile = path.join(testWorkspaceConfigDir, 'repository_list.json');

const sampleCodewindTemplate = styledTemplates.codewind;
const sampleAppsodyTemplate = styledTemplates.appsody;

const mockRepos = {
    enabled: {
        url: '1',
        description: '1',
        enabled: true,
    },
    disabled: {
        url: '2',
        description: '2',
        enabled: false,
    },
    noEnabledStatus: {
        url: '3',
        description: '3',
    },
};
const mockRepoList = Object.values(mockRepos);
describe('Templates.js', function() {
    suppressLogOutput(Templates);
    describe('Class functions', function() {
        describe('initializeRepositoryList()', function() {
            const workspace = path.join(__dirname, 'initializeRepositoryList');
            beforeEach(() => {
                fs.ensureDirSync(workspace);
            });
            afterEach(() => {
                fs.removeSync(workspace);
            });
            it('initialises a Templates Class and creates a repository file', async function() {
                const templateController = new Templates(workspace);
                fs.pathExistsSync(templateController.repositoryFile).should.be.false;
                await templateController.initializeRepositoryList();
                templateController.repositoryList.length.should.equal(2);
                fs.pathExistsSync(templateController.repositoryFile).should.be.true;
            });
            it('reads an existing repository list file', async function() {
                const templateController = new Templates(workspace);
                templateController.projectTemplatesNeedsRefresh = false;
                const { repositoryFile, repositoryList: oldRepositoryList } = templateController;
                await fs.ensureFileSync(repositoryFile);
                await fs.writeJSON(repositoryFile, [ sampleRepos.codewind ]);
                fs.pathExistsSync(repositoryFile).should.be.true;
                oldRepositoryList.should.have.length(2);

                await templateController.initializeRepositoryList();

                const { repositoryList: newRepositoryList } = templateController;
                fs.pathExistsSync(repositoryFile).should.be.true;
                fs.readJsonSync(repositoryFile).should.deep.equal([sampleRepos.codewind]);
                newRepositoryList.length.should.equal(1);
                newRepositoryList.should.deep.equal([sampleRepos.codewind]);
                templateController.projectTemplatesNeedsRefresh.should.be.true;
            });
        });
        describe('getTemplates(showEnabledOnly, projectStyle)', function() {
            it('Gets all templates', async function() {
                this.timeout(10000);
                const templateController = new Templates('');
                const templateList = await templateController.getTemplates(false, false);
                templateList.length.should.be.at.least(defaultCodewindTemplates.length);
            });
            it('Gets only enabled templates', async function() {
                this.timeout(10000);
                const templateController = new Templates('');
                const { repositoryList } = templateController;
                for (let i = 0; i < repositoryList.length; i++) {
                    const repository = repositoryList[i];
                    repository.enabled = false;
                    repository.enabled.should.be.false;
                }
                const templateList = await templateController.getTemplates(true, false);
                templateList.length.should.equal(0);
            });
            it('Gets only templates of a specific style', async function() {
                this.timeout(10000);
                const templateController = new Templates('');
                templateController.projectTemplatesNeedsRefresh = false;
                templateController.projectTemplates = [
                    {
                        name: 'project1',
                        projectStyle: 'otherprojectstyle',
                    },
                    {
                        name: 'project2',
                        projectStyle: 'projectstyle',
                    },
                ];
                const templateList = await templateController.getTemplates(false, 'projectstyle');
                templateList[0].name.should.equal('project2');
                templateList.length.should.equal(1);
            });
            describe('Verifys the Codewind default templates are there and all others contain the required keys', function() {
                it('returns the default templates', async function() {
                    this.timeout(30000);
                    const templateController = new Templates('');
                    const output = await templateController.getTemplates(false, false);
                    output.should.contain.deep.members(defaultCodewindTemplates);
                    for (let i = 0; i < output.length; i++) {
                        const element = output[i];
                        // List of keys required are generated from the API docs
                        element.should.contain.keys('label', 'description', 'language', 'url', 'projectType');
                    }
                });
            });
            describe('and add an extra bad template repo', function() {
                let templateController;
                before(() => {
                    templateController = new Templates('');
                    templateController.repositoryList = [
                        sampleRepos.codewind,
                        { url: 'https://www.google.com/' },
                    ];
                });
                it('returns only the default templates', async function() {
                    const output = await templateController.getTemplates(false, false);
                    output.should.deep.equal(defaultCodewindTemplates);
                });
            });
            describe('and add a provider providing a valid template repo', function() {
                let templateController;
                before(() => {
                    fs.ensureDirSync(testWorkspaceConfigDir);
                    templateController = new Templates(testWorkspaceConfigDir);
                    templateController.addProvider('valid repo', {
                        getRepositories() {
                            return [sampleRepos.appsody];
                        },
                    });
                });
                after(() => {
                    fs.removeSync(testWorkspaceDir);
                });
                it('returns the default templates and more', async function() {
                    this.timeout = 10000;
                    const output = await templateController.getTemplates(false, false);
                    output.should.include.deep.members(defaultCodewindTemplates);
                    (output.length).should.be.above(defaultCodewindTemplates.length);
                });
            });
        });
        describe('getAllTemplateStyles()', function() {
            describe('returns only Codewind templates as it is the style in the projectTemplates', function() {
                const sampleTemplateList = [sampleCodewindTemplate];
                let templateController;
                before(() => {
                    templateController = new Templates('');
                    templateController.projectTemplates = sampleTemplateList;
                    templateController.projectTemplatesNeedsRefresh = false;
                });
                it(`returns ['Codewind']`, async function() {
                    const output = await templateController.getAllTemplateStyles();
                    output.should.deep.equal(['Codewind']);
                });
            });
            describe('returns only Codewind and NewStyle templates as both exist in the projectTemplates', function() {
                const sampleTemplateList = [sampleCodewindTemplate, { projectStyle: 'NewStyle' }];
                let templateController;
                before(() => {
                    templateController = new Templates('');
                    templateController.projectTemplates = sampleTemplateList;
                    templateController.projectTemplatesNeedsRefresh = false;
                });
                it(`returns ['Codewind', 'NewStyle']`, async function() {
                    const output = await templateController.getAllTemplateStyles();
                    output.should.deep.equal(['Codewind', 'NewStyle']);
                });
            });
        });
        describe('getRepositories()', function() {
            let templateController;
            before(() => {
                templateController = new Templates('');
                templateController.repositoryList = [...mockRepoList];
            });
            it('returns all repos', async function() {
                const output = await templateController.getRepositories();
                output.should.deep.equal(mockRepoList);
            });
        });
        describe('getEnabledRepositories()', function() {
            let templateController;
            before(() => {
                templateController = new Templates('');
                templateController.repositoryList = [mockRepos.enabled, mockRepos.disabled];
            });
            it('returns only enabled repos', async function() {
                const output = await templateController.getEnabledRepositories();
                output.should.deep.equal([mockRepos.enabled]);
            });
        });
        describe('doesRepositoryExist()', function() {
            let templateController;
            before(() => {
                templateController = new Templates('');
                templateController.repositoryList = [...mockRepoList];
            });
            it('Returns true as the repository exists', async function() {
                const repoExists = await templateController.doesRepositoryExist('1');
                repoExists.should.be.true;
            });
            it('Returns false as the repository does not exist', async function() {
                const repoExists = await templateController.doesRepositoryExist('http://badurl.com');
                repoExists.should.be.false;
            });
        });
        describe('batchUpdate(requestedOperations)', function() {
            let templateController;
            beforeEach(() => {
                fs.ensureDirSync(testWorkspaceConfigDir);
                templateController = new Templates(testWorkspaceDir);
                templateController.repositoryList = [...mockRepoList];
            });
            afterEach(() => {
                fs.removeSync(testWorkspaceDir);
            });
            describe('when the requested operations are all valid', function() {
                const tests = {
                    'enable 2 existing repos': {
                        input: [
                            {
                                op: 'enable',
                                url: '1',
                                value: 'true',
                            },
                            {
                                op: 'enable',
                                url: '2',
                                value: 'true',
                            },
                        ],
                        output: [
                            {
                                status: 200,
                                requestedOperation: {
                                    op: 'enable',
                                    url: '1',
                                    value: 'true',
                                },
                            },
                            {
                                status: 200,
                                requestedOperation: {
                                    op: 'enable',
                                    url: '2',
                                    value: 'true',
                                },
                            },
                        ],
                        expectedRepoDetails: [
                            {
                                url: '1',
                                description: '1',
                                enabled: true,
                            },
                            {
                                url: '2',
                                description: '2',
                                enabled: true,
                            },
                        ],
                    },
                    'disable 2 existing repos': {
                        input: [
                            {
                                op: 'enable',
                                url: '1',
                                value: 'false',
                            },
                            {
                                op: 'enable',
                                url: '2',
                                value: 'false',
                            },
                        ],
                        output: [
                            {
                                status: 200,
                                requestedOperation: {
                                    op: 'enable',
                                    url: '1',
                                    value: 'false',
                                },
                            },
                            {
                                status: 200,
                                requestedOperation: {
                                    op: 'enable',
                                    url: '2',
                                    value: 'false',
                                },
                            },
                        ],
                        expectedRepoDetails: [
                            {
                                url: '1',
                                description: '1',
                                enabled: false,
                            },
                            {
                                url: '2',
                                description: '2',
                                enabled: false,
                            },
                        ],
                    },
                    'enable an unknown repo': {
                        input: [
                            {
                                op: 'enable',
                                url: '1',
                                value: 'false',
                            },
                            {
                                op: 'enable',
                                url: '2',
                                value: 'false',
                            },
                        ],
                        output: [
                            {
                                status: 200,
                                requestedOperation: {
                                    op: 'enable',
                                    url: '1',
                                    value: 'false',
                                },
                            },
                            {
                                status: 200,
                                requestedOperation: {
                                    op: 'enable',
                                    url: '2',
                                    value: 'false',
                                },
                            },
                        ],
                        expectedRepoDetails: [
                            {
                                url: '1',
                                description: '1',
                                enabled: false,
                            },
                            {
                                url: '2',
                                description: '2',
                                enabled: false,
                            },
                        ],
                    },
                    'enable an unknown repo': {
                        input: [
                            {
                                op: 'enable',
                                url: 'unknownRepoUrl',
                                value: 'true',
                            },
                        ],
                        output: [
                            {
                                status: 404,
                                error: 'Unknown repository URL',
                                requestedOperation: {
                                    op: 'enable',
                                    url: 'unknownRepoUrl',
                                    value: 'true',
                                },
                            },
                        ],
                    },
                    'disable an unknown repo': {
                        input: [
                            {
                                op: 'enable',
                                url: 'unknownRepoUrl',
                                value: 'false',
                            },
                        ],
                        output: [
                            {
                                status: 404,
                                error: 'Unknown repository URL',
                                requestedOperation: {
                                    op: 'enable',
                                    url: 'unknownRepoUrl',
                                    value: 'false',
                                },
                            },
                        ],
                    },
                    'disable an existing repo and an unknown repo': {
                        input: [
                            {
                                op: 'enable',
                                url: '1',
                                value: 'false',
                            },
                            {
                                op: 'enable',
                                url: 'unknownRepoUrl',
                                value: 'false',
                            },
                        ],
                        output: [
                            {
                                status: 200,
                                requestedOperation: {
                                    op: 'enable',
                                    url: '1',
                                    value: 'false',
                                },
                            },
                            {
                                status: 404,
                                error: 'Unknown repository URL',
                                requestedOperation: {
                                    op: 'enable',
                                    url: 'unknownRepoUrl',
                                    value: 'false',
                                },
                            },
                        ],
                        expectedRepoDetails: [
                            {
                                url: '1',
                                description: '1',
                                enabled: false,
                            },
                        ],
                    },
                };
                for (const [testName, test] of Object.entries(tests)) {
                    // eslint-disable-next-line no-loop-func
                    it(`${testName}`, async function() {
                        const output = await templateController.batchUpdate(test.input);
                        output.should.deep.equal(test.output);
                        // console.log(testName, output);
                        
                        if (test.expectedRepoDetails) {
                            const repoFile = fs.readJsonSync(templateController.repositoryFile);
                            // console.log(testName, repoFile);
                            
                            repoFile.should.include.deep.members(test.expectedRepoDetails);
                        }
                    });
                }
            });
        });
        describe('performOperationOnRepository(operation)', function() {
            let templateController;
            beforeEach(() => {
                templateController = new Templates('');
                templateController.repositoryList = [...mockRepoList];
            });
            describe('when `operation.url` is an existing url', function() {
                const tests = {
                    'enable an existing repo': {
                        input: {
                            op: 'enable',
                            url: '1',
                            value: 'true',
                        },
                        output: {
                            status: 200,
                            requestedOperation: {
                                op: 'enable',
                                url: '1',
                                value: 'true',
                            },
                        },
                        expectedRepoDetails: {
                            url: '1',
                            description: '1',
                            enabled: true,
                        },
                    },
                    'disable an existing repo': {
                        input: {
                            op: 'enable',
                            url: '1',
                            value: 'false',
                        },
                        output: {
                            status: 200,
                            requestedOperation: {
                                op: 'enable',
                                url: '1',
                                value: 'false',
                            },
                        },
                        expectedRepoDetails: {
                            url: '1',
                            description: '1',
                            enabled: false,
                        },
                    },
                };
                for (const [testName, test] of Object.entries(tests)) {
                    describe(testName, function() { // eslint-disable-line no-loop-func
                        it(`returns the expected operation info and correctly updates the repository file`, async function() {
                            const output = await templateController.performOperationOnRepository(test.input);
                            output.should.deep.equal(test.output);
                        });
                    });
                }
            });
            describe('when `operation.url` is an unknown url', function() {
                const tests = {
                    'enable an unknown repo': {
                        input: {
                            op: 'enable',
                            url: 'unknownRepoUrl',
                            value: 'true',
                        },
                        output: {
                            status: 404,
                            error: 'Unknown repository URL',
                            requestedOperation: {
                                op: 'enable',
                                url: 'unknownRepoUrl',
                                value: 'true',
                            },
                        },
                    },
                    'disable an unknown repo': {
                        input: {
                            op: 'enable',
                            url: 'unknownRepoUrl',
                            value: 'false',
                        },
                        output: {
                            status: 404,
                            error: 'Unknown repository URL',
                            requestedOperation: {
                                op: 'enable',
                                url: 'unknownRepoUrl',
                                value: 'false',
                            },
                        },
                    },
                };
                for (const [testName, test] of Object.entries(tests)) {
                    describe(testName, function() { // eslint-disable-line no-loop-func
                        it(`returns the expected operation info`, async function() {
                            const output = await templateController.performOperationOnRepository(test.input);
                            output.should.deep.equal(test.output);
                        });
                    });
                }
            });
        });
        describe('enableOrDisableRepository({ url, value })', () => {
            it('returns 404 as its status as the repository does not exist', async() => {
                const templateController = new Templates('');
                const operationResponse = await templateController.enableOrDisableRepository({ url: 'urlThatDoesNotExist' });
                operationResponse.should.have.property('status', 404);
                operationResponse.should.have.property('error', 'Unknown repository URL');
            });
            const tests = {
                'enables a project (Boolean)': { input: true, output: true },
                'enables a project (String)': { input: 'true', output: true },
                'disables a project (Boolean)': { input: false, output: false },
                'disables a project (String)': { input: 'false', output: false },
            };
            for (const [title, test] of Object.entries(tests)) {
                const { input, output } = test;
                // eslint-disable-next-line no-loop-func
                it(`returns 200 and ${title}`, async() => {
                    const templateController = new Templates('');
                    const testRepo = (output) ? mockRepos.disabled : mockRepos.enabled;
                    templateController.repositoryList = [testRepo];

                    const operationResponse = await templateController.enableOrDisableRepository({ url: testRepo.url, value: input });
                    operationResponse.should.have.property('status', 200);
                    operationResponse.should.not.have.property('error');

                    const repoPostChange = await templateController.getRepository(testRepo.url);
                    repoPostChange.should.have.property('enabled', output);
                });
            }
        });
        describe('addRepository(repoUrl, repoDescription)', function() {
            const mockRepoList = [{ id: 'notanid', url: 'https://made.up/url' }];
            let templateController;
            beforeEach(() => {
                fs.ensureDirSync(testWorkspaceConfigDir);
                templateController = new Templates(testWorkspaceDir);
                templateController.repositoryList = [...mockRepoList];
            });
            afterEach(() => {
                fs.removeSync(testWorkspaceDir);
            });
            describe('repo without name and description in templates.json', () => {
                describe('(<invalidUrl>, <validDesc>)', function() {
                    it('throws an error', function() {
                        const url = 'some string';
                        const func = () => templateController.addRepository(url, 'description');
                        return func().should.be.rejectedWith(`Invalid URL: ${url}`);
                    });
                });
                describe('(<existingUrl>, <validDesc>)', function() {
                    it('throws an error', function() {
                        const { url } = mockRepoList[0];
                        const func = () => templateController.addRepository(url, 'description');
                        return func().should.be.rejectedWith(`${url} is already a template repository`);
                    });
                });
                describe('(<validUrlNotPointingToIndexJson>, <validDesc>)', function() {
                    it('throws an error', function() {
                        const url = validUrlNotPointingToIndexJson;
                        const func = () => templateController.addRepository(url, 'description');
                        return func().should.be.rejectedWith(`${url} does not point to a JSON file of the correct form`);
                    });
                });
                describe('(<validUrlPointingToIndexJson>, <validDesc>, <validName>)', function() {
                    it('succeeds', async function() {
                        const url = 'https://raw.githubusercontent.com/codewind-resources/codewind-templates/3af4928a928a5c08b07908c54799cc1675b9f965/devfiles/index.json';
                        const func = () => templateController.addRepository(url, 'description', 'name');
                        await (func().should.not.be.rejected);
                        templateController.repositoryList.should.containSubset([{
                            url,
                            name: 'name',
                            description: 'description',
                            enabled: true,
                            projectStyles: ['Codewind'],
                        }]);
                        templateController.repositoryList.forEach(obj => {
                            obj.should.have.property('id');
                            obj.id.should.be.a('string');
                        });
                    });
                });
                describe('(<validUrlUnprotected>, <validDesc>, <validName>)', function() {
                    it('succeeds', async function() {
                        const url = 'https://raw.githubusercontent.com/codewind-resources/codewind-templates/3af4928a928a5c08b07908c54799cc1675b9f965/devfiles/index.json';
                        const isRepoProtected = false;
                        const func = () => templateController.addRepository(url, 'description', 'name', isRepoProtected);
                        await (func().should.not.be.rejected);
                        templateController.repositoryList.should.containSubset([{
                            url,
                            name: 'name',
                            description: 'description',
                            enabled: true,
                            projectStyles: ['Codewind'],
                            protected: false,
                        }]);
                        templateController.repositoryList.forEach(obj => {
                            obj.should.have.property('id');
                            obj.id.should.be.a('string');
                        });
                    });
                });
            });
            describe('repo with name and description in templates.json', () => {
                describe('(<validUrl>, <ValidDesc>, <ValidName>)', function() {
                    it('succeeds, and allows the user to set the name and description', async function() {
                        const url = 'https://raw.githubusercontent.com/codewind-resources/codewind-templates/master/devfiles/index.json';
                        const func = () => templateController.addRepository(url, 'description', 'name', false);
                        await (func().should.not.be.rejected);
                        templateController.repositoryList.should.containSubset([{ ...sampleRepos.codewind,
                            name: 'name',
                            description: 'description',
                            protected: false,
                        }]);
                    });
                });
                describe('(repo with templates.json, <validUrl>, <NoDesc>, <NoName>)', function() {
                    it('succeeds, and gets the name and description from templates.json', async function() {
                        const url = 'https://raw.githubusercontent.com/codewind-resources/codewind-templates/master/devfiles/index.json';
                        const func = () => templateController.addRepository(url, '', '', false);
                        await (func().should.not.be.rejected);
                        templateController.repositoryList.should.containSubset([{ ...sampleRepos.codewind, protected: false }]);
                    });
                });
            });
        });
        describe('deleteRepository(repoUrl)', function() {
            beforeEach(() => {
                fs.ensureDirSync(testWorkspaceConfigDir);
            });
            afterEach(() => {
                fs.removeSync(testWorkspaceDir);
            });
            it('deletes an existing URL and updates the repository_list.json correctly', async function() {
                const mockRepoList = [sampleRepos.codewind];
                const templateController = new Templates(testWorkspaceDir);
                templateController.repositoryList = [...mockRepoList];
                const url = mockRepoList[0].url;
                await templateController.deleteRepository(url);
                templateController.repositoryList.should.deep.equal([]);
            });
            it('attempts to delete a repo that does not exist', async function() {
                const mockRepoList = [sampleRepos.codewind];
                const templateController = new Templates(testWorkspaceDir);
                templateController.repositoryList = [...mockRepoList];
                await templateController.deleteRepository('http://urlthatdoesnotexist.com');
                templateController.repositoryList.should.deep.equal([...mockRepoList]);
            });
        });
        describe('addProvider(name, provider)', () => {
            it('ignores the invalid provider', () => {
                const templateController = new Templates('');
                const originalProviders = { ...templateController.providers };
                templateController.addProvider('empty obj', {});
                templateController.providers.should.deep.equal(originalProviders);
            });
            it('successfully adds a provider', () => {
                const templateController = new Templates('');
                const newProvider = {
                    getRepositories: () => {
                        return '';
                    },
                };
                const { providers } = templateController;
                templateController.addProvider('newProvider', newProvider);
                providers.should.have.property('newProvider');
                providers.newProvider.should.containSubset(newProvider);
            });
        });
        describe('addRepositoryToProviders(repo)', () => {
            it('adds a repository to a provider', async() => {
                const templateController = new Templates('');
                templateController.providers = {
                    firstProvider: {
                        repositories: [],
                        canHandle() {
                            return true;
                        },
                        addRepository(newRepo) {
                            this.repositories.push(newRepo);
                            return this.repositories;
                        },
                    },
                };
                const { firstProvider } = templateController.providers;
                firstProvider.repositories.should.have.length(0);
                await templateController.addRepositoryToProviders({ ...sampleRepos.codewind });
                firstProvider.repositories.should.have.length(1);
            });
        });
        describe('removeRepositoryFromProviders(repo)', () => {
            it('removes a repository from a provider', async() => {
                const templateController = new Templates('');
                templateController.providers = {
                    firstProvider: {
                        repositories: [{ ...sampleRepos.codewind }],
                        canHandle() {
                            return true;
                        },
                        removeRepository(repoURLToDelete) {
                            this.repositories.splice(this.repositories.findIndex(repo => repo.url === repoURLToDelete), 1);
                            return this.repositories;
                        },
                    },
                };
                const { firstProvider } = templateController.providers;
                firstProvider.repositories.should.have.length(1);
                await templateController.removeRepositoryFromProviders(sampleRepos.codewind.url);
                firstProvider.repositories.should.have.length(0);
            });
        });
    });

    describe('Local functions', function() {
        describe('writeRepositoryList(repositoryFile, repositoryList)', () => {
            const writeRepositoryList = Templates.__get__('writeRepositoryList');
            beforeEach(() => {
                fs.removeSync(testWorkspaceConfigDir);
            });
            after(() => {
                fs.removeSync(testWorkspaceConfigDir);
            });
            it('Creates a new repository file if one doesn\'t exist', async() => {
                fs.pathExistsSync(testRepositoryFile).should.be.false;
                await writeRepositoryList(testRepositoryFile, []);
                fs.pathExistsSync(testRepositoryFile).should.be.true;
            });
            it('Overwrites an existing repository file', async() => {
                fs.pathExistsSync(testRepositoryFile).should.be.false;
                await writeRepositoryList(testRepositoryFile, [{ field: 'string' }]);
                fs.pathExistsSync(testRepositoryFile).should.be.true;
                const jsonPreChange = await fs.readJson(testRepositoryFile);
                jsonPreChange[0].should.have.property('field', 'string');

                await writeRepositoryList(testRepositoryFile, [{ field: 123 }]);
                const jsonPostChange = await fs.readJson(testRepositoryFile);
                jsonPostChange[0].should.have.property('field', 123);
            });
        });
        describe('getRepositoryIndex(url, repositories)', () => {
            const getRepositoryIndex = Templates.__get__('getRepositoryIndex');
            it('returns an index of greater than -1 as the repository exists', () => {
                const index = getRepositoryIndex('http://goodurl.com', [ { url: 'http://goodurl.com' } ]);
                index.should.equal(0);
            });
            it('returns an index of -1 as the repository does not exist', () => {
                const index = getRepositoryIndex('http://badurl.com', [ { url: 'http://goodurl.com' } ]);
                index.should.equal(-1);
            });
        });
        describe('updateRepoListWithReposFromProviders(providers, repositoryList, repositoryFile)', function() {
            describe('when providers do not provide valid repos', function() {
                const tests = {
                    'invalid provider: string': {
                        provider: 'string',
                    },
                    'invalid provider: empty obj': {
                        provider: {},
                    },
                    'provider provides non-array': {
                        provider: {
                            getRepositories() {
                                return 'should be array';
                            },
                        },
                    },
                    'provider provides array of non-repo objects': {
                        provider: {
                            getRepositories() {
                                return ['should be repo object'];
                            },
                        },
                    },
                    'provider provides array of objects missing URLs': {
                        provider: {
                            getRepositories() {
                                return [{ description: 'missing URL' }];
                            },
                        },
                    },
                    'provider provides a duplicate repo': {
                        provider: {
                            getRepositories() {
                                return [{
                                    description: 'duplicate URL',
                                    url: mockRepoList[0].url,
                                }];
                            },
                        },
                    },
                };
                for (const [testName, test] of Object.entries(tests)) {
                    describe(testName, function() { // eslint-disable-line no-loop-func
                        before(() => {
                            fs.ensureDirSync(testWorkspaceConfigDir);
                        });
                        after(() => {
                            fs.removeSync(testWorkspaceDir);
                        });
                        it(`does not update the repository_list.json`, async function() {
                            fs.existsSync(testRepositoryFile).should.be.false;
                            const updateRepoListWithReposFromProviders = Templates.__get__('updateRepoListWithReposFromProviders'); 
                            await updateRepoListWithReposFromProviders([test.provider], [...mockRepoList], testRepositoryFile);
                            // repository file should not have been created as the repo list had not been updated
                            fs.existsSync(testRepositoryFile).should.be.false;
                        });
                    });
                }
            });
            describe('when providers list valid repos', function() {
                const validCodewindRepo = {
                    url: 'https://raw.githubusercontent.com/codewind-resources/codewind-templates/3af4928a928a5c08b07908c54799cc1675b9f965/devfiles/index.json',
                    description: 'The default set of templates for new projects in Codewind.',
                };
                before(() => {
                    fs.ensureFileSync(testRepositoryFile);
                });
                after(() => {
                    fs.removeSync(testWorkspaceDir);
                });
                it(`updates the repository_list.json correctly`, async function() {
                    const expectedRepo = {
                        ...validCodewindRepo,
                        enabled: true,
                        protected: true,
                        name: 'Default templates',
                        projectStyles: ['Codewind'],
                    };
                    const updateRepoListWithReposFromProviders = Templates.__get__('updateRepoListWithReposFromProviders'); 
                    const provider = {
                        getRepositories() {
                            return [validCodewindRepo];
                        },
                    };
                    await updateRepoListWithReposFromProviders([provider], [...mockRepoList], testRepositoryFile);
                    const repoFile = await fs.readJson(testRepositoryFile);
                    repoFile.should.deep.equal([
                        ...mockRepoList,
                        expectedRepo,
                    ]);
                });
            });
        });
        describe('fetchAllRepositoryDetails(repos)', function() {
            const fetchAllRepositoryDetails = Templates.__get__('fetchAllRepositoryDetails');
            const tests = {
                '1 repo containing only Codewind templates': {
                    input: [sampleRepos.codewind],
                    output: [{
                        ...sampleRepos.codewind,
                        projectStyles: ['Codewind'],
                    }],
                },
                '1 repo containing only Appsody templates': {
                    // We don't use `sampleRepos.appsody` here because for some reason it was being modified by a previous test
                    // We should prevent decoupling systematically, by deep cloning `sampleRepos` whenever it is used
                    input: [{
                        url: 'https://raw.githubusercontent.com/kabanero-io/codewind-appsody-templates/master/devfiles/index.json',
                        description: 'Appsody extension for Codewind',
                        enabled: true,
                    }],
                    output: [{
                        url: 'https://raw.githubusercontent.com/kabanero-io/codewind-appsody-templates/master/devfiles/index.json',
                        description: 'Appsody extension for Codewind',
                        enabled: true,
                        projectStyles: ['Appsody'],
                    }],
                },
            };
            for (const [testName, test] of Object.entries(tests)) {
                describe(testName, function() { // eslint-disable-line no-loop-func
                    it(`returns the expected operation info`, async function() {
                        const output = await fetchAllRepositoryDetails(test.input);
                        output.should.deep.equal(test.output);
                    });
                });
            }
        });
        describe('fetchRepositoryDetails(repo)', function() {
            const fetchRepositoryDetails = Templates.__get__('fetchRepositoryDetails');
            it('Returns the details for a repository', async() => {
                const details = await fetchRepositoryDetails(sampleRepos.codewind);
                details.should.have.keys(['url', 'description', 'enabled', 'protected', 'projectStyles', 'name']);
                details.should.deep.equal(sampleRepos.codewind);
            });
            it('Returns the correct name and description for a repository from its url (json file)', async() => {
                const repo = { ...sampleRepos.codewind };
                delete repo.name;
                delete repo.description;
                repo.should.not.have.keys(['name', 'description']);
                const details = await fetchRepositoryDetails(sampleRepos.codewind);
                details.should.have.keys(['url', 'description', 'enabled', 'protected', 'projectStyles', 'name']);
                details.should.deep.equal(sampleRepos.codewind);
            });
            it('Returns the default "Codewind" projectStyles when it is doesn\'t exist', async() => {
                const repo = { ...sampleRepos.codewind };
                delete repo.projectStyles;
                repo.should.not.have.key('projectStyles');
                const details = await fetchRepositoryDetails(sampleRepos.codewind);
                details.should.have.deep.property('projectStyles', ['Codewind']);
            });
        });
        describe('readRepoTemplatesJSON(repository)', function() {
            const readRepoTemplatesJSON = Templates.__get__('readRepoTemplatesJSON');
            it('Throws an error as no url is given', () => {
                return readRepoTemplatesJSON({})
                    .should.be.eventually.rejectedWith('repository must have a URL')
                    .and.be.an.instanceOf(Error);
            });
            it('Returns the given object without changes as the URL given is a file', async() => {
                const obj = { url: 'file://something/something' };
                const repo = await readRepoTemplatesJSON(obj);
                repo.should.deep.equal(obj);
            });
            it('Returns with as the URL is valid', async() => {
                const { url } = sampleRepos.codewind;
                const repo = await readRepoTemplatesJSON({ url });
                repo.should.contain.keys(['url', 'name', 'description']);
            });
            it('Overwrites the name if a description is not given', async() => {
                const { url } = sampleRepos.codewind;
                const repo = await readRepoTemplatesJSON({ url, name: 'string' });
                repo.should.contain.keys(['url', 'name', 'description']);
                repo.name.should.equal(sampleRepos.codewind.name);
            });
            it('Overwrites the description if a name is not given', async() => {
                const { url } = sampleRepos.codewind;
                const repo = await readRepoTemplatesJSON({ url, description: 'string' });
                repo.should.contain.keys(['url', 'name', 'description']);
                repo.description.should.equal(sampleRepos.codewind.description);
            });
        });
        describe('getTemplatesFromRepos(repositoryList)', function() {
            const getTemplatesFromRepos = Templates.__get__('getTemplatesFromRepos');
            it('throws an error as no repos are given', function() {
                const func = () => getTemplatesFromRepos();
                return func().should.be.rejected;
            });
            it('returns no templates as an empty repository list is given', async function() {
                const output = await getTemplatesFromRepos([]);
                output.should.deep.equal([]);
            });
            it('returns the default Codewind templates', async function() {
                const output = await getTemplatesFromRepos([sampleRepos.codewind]);
                output.should.deep.equal(defaultCodewindTemplates);
            });
        });
        describe('getTemplatesFromRepo(repository)', function() {
            const getTemplatesFromRepo = Templates.__get__('getTemplatesFromRepo'); 
            it('returns the correct templates from a valid repository', async function() {
                const output = await getTemplatesFromRepo(sampleRepos.codewind);
                output.should.have.deep.members(defaultCodewindTemplates);
            });
            it('throws a useful error when a string is given', function() {
                const func = () => getTemplatesFromRepo('string');
                return func().should.be.rejectedWith(`repo 'string' must have a URL`);
            });
            it('throws a useful error when an invalid url is given', function() {
                const func = () => getTemplatesFromRepo({ url: 'invalidURL' });
                return func().should.be.rejectedWith('Invalid URL');
            });
            it('throws a useful error when a valid URL is given but it does not point to JSON', function() {
                const func = () => getTemplatesFromRepo({ url: 'https://www.google.com/' });
                return func().should.be.rejectedWith(`URL 'https://www.google.com/' should return JSON`);
            });
            it('throws a useful error when an invalid file path is given', function() {
                const func = () => getTemplatesFromRepo({ url: 'file://someting.json' });
                return func().should.be.rejectedWith(`repo file 'file://someting.json/' should return json`);
            });
        });
        describe('filterTemplatesByStyle(templates, projectStyle)', function() {
            const filterTemplatesByStyle = Templates.__get__('filterTemplatesByStyle');
            const templates = [sampleCodewindTemplate, sampleAppsodyTemplate];
            it('returns only Codewind templates', function() {
                const output = filterTemplatesByStyle(templates, 'Codewind');
                output.should.deep.equal([sampleCodewindTemplate]);
            });
            it('returns only Appsody templates', function() {
                const output = filterTemplatesByStyle(templates, 'Appsody');
                output.should.deep.equal([sampleAppsodyTemplate]);
            });
            it('returns no templates as an empty string was given', function() {
                const output = filterTemplatesByStyle(templates, '');
                output.length.should.equal(0);
            });
            it('returns no templates as an invalid string was given', function() {
                const output = filterTemplatesByStyle(templates, 'doNotExist');
                output.length.should.equal(0);
            });
        });
        describe('getTemplateStyles(templates)', function() {
            const getTemplateStyles = Templates.__get__('getTemplateStyles');
            it('returns Codewind by default', function() {
                const output = getTemplateStyles([mockRepos.enabled]);
                output.should.deep.equal(['Codewind']);
            });
            it('returns Codewind as the templates are Codewind ones', function() {
                const output = getTemplateStyles([sampleCodewindTemplate]);
                output.should.deep.equal(['Codewind']);
            });
            it('returns Other when the projectStyle of Other is given', function() {
                const output = getTemplateStyles([{ projectStyle: 'Other' }]);
                output.should.deep.equal(['Other']);
            });
            it('returns Codewind and Other when both styles of templates are given', function() {
                const output = getTemplateStyles([sampleCodewindTemplate, { projectStyle: 'Other' }]);
                output.should.deep.equal(['Codewind', 'Other']);
            });
        });
        describe('getTemplateStyle(template)', () => {
            const getTemplateStyle = Templates.__get__('getTemplateStyle');
            it('returns Codewind by default', function() {
                const output = getTemplateStyle({});
                output.should.deep.equal('Codewind');
            });
            it('returns Other when the projectStyle of Other is given', function() {
                const output = getTemplateStyle({ projectStyle: 'Other' });
                output.should.deep.equal('Other');
            });
        });
        describe('getReposFromProviders(providers)', function() {
            const getReposFromProviders = Templates.__get__('getReposFromProviders');
            const tests = {
                'invalid provider: string': {
                    input: ['string'],
                    output: [],
                },
                'invalid provider: empty obj': {
                    input: [{}],
                    output: [],
                },
                'provider provides non-array': {
                    input: [{
                        getRepositories() {
                            return 'should be array';
                        },
                    }],
                    output: [],
                },
                'provider provides a repo with URL': {
                    input: [{
                        getRepositories() {
                            return [{
                                url: 'https://www.google.com/',
                                description: 'not a GitHub repo',
                            }];
                        },
                    }],
                    output: [{
                        url: 'https://www.google.com/',
                        description: 'not a GitHub repo',
                    }],
                },
            };
            for (const [testName, test] of Object.entries(tests)) {
                describe(testName, function() {
                    it(`returns the expected repos`, async function() {
                        const output = await getReposFromProviders(test.input);
                        output.should.deep.equal(test.output);
                    });
                });
            }
        });
        describe('isRepo(obj)', () => {
            const isRepo = Templates.__get__('isRepo');
            it('Returns true as obj with a url field is a repo', () => {
                isRepo({ url: 'something' }).should.be.true;
            });
            it('Returns false as obj is undefined', () => {
                expect(isRepo()).to.be.false;
            });
            it('Returns false as obj has no url field', () => {
                expect(isRepo({})).to.be.false;
            });
        });
        describe('doesURLPointToIndexJSON(obj)', () => {
            const doesURLPointToIndexJSON = Templates.__get__('doesURLPointToIndexJSON');
            it('Returns true a valid URL is given', () => {
                const { url } = sampleRepos.codewind;
                return doesURLPointToIndexJSON(url).should.eventually.be.true;
            });
            it('Returns false as the URL does not point to JSON', function() {
                this.timeout(5000);
                return doesURLPointToIndexJSON('http://google.com').should.eventually.be.false;
            });
            it('Returns false as the file URL does not point to JSON', () => {
                return doesURLPointToIndexJSON('file://doesNotExist').should.eventually.be.false;
            });
            it('Returns true as the file URL does point to JSON', () => {
                const testFile = path.join(__dirname, 'doesURLPointToIndexJSON.json');
                fs.ensureFileSync(testFile);
                const template = {
                    displayName: 'test',
                    description: 'test',
                    language: 'test',
                    projectType: 'test',
                    location: 'test',
                    links: 'test',
                };
                fs.writeJSONSync(testFile, [template]);
                return doesURLPointToIndexJSON(path.join('file://', testFile)).should.eventually.be.true;
            });
            after(() => {
                fs.removeSync(path.join(__dirname, 'doesURLPointToIndexJSON.json'));
            });
        });
        describe('isTemplateSummary(obj)', () => {
            const isTemplateSummary = Templates.__get__('isTemplateSummary');
            const dummyTemplate = {
                displayName: 'test',
                description: 'test',
                language: 'test',
                projectType: 'test',
                location: 'test',
                links: 'test',
            };
            it('returns true as the given object has all the required fields', () => {
                isTemplateSummary(dummyTemplate).should.be.true;
            });
            it('returns false as the given object does not have a description field', () => {
                const template = { ...dummyTemplate };
                delete template.description;
                template.should.not.have.property('description');
                isTemplateSummary(template).should.be.false;
            });
            it('returns true as the given object has all the required fields and an extra one', () => {
                const template = { ...dummyTemplate };
                template.extraField = 'string';
                isTemplateSummary(template).should.be.true;
            });
        });
    });
});