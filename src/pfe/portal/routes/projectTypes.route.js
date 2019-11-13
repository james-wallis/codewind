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
const express = require('express');

const Logger = require('../modules/utils/Logger');
const ProjectTypes = require('../modules/ProjectTypes');

const router = express.Router();
const log = new Logger(__filename);

/**
 * API function to returns a list of supported project types
 * @return JSON array with the list of supported project types
 */
router.get('/api/v1/project-types', async (req, res) => {
  const user = req.cw_user;
  
  try {
    const templates = await user.templates.getEnabledTemplates();
    const providers = await user.templates.getProviders();
    const extensionList = user.extensionList;
    const projectTypes = await ProjectTypes.getTypes(templates, providers, extensionList);
    console.log('templates', templates);
    console.log('providers', providers);
    console.log('extensionList', extensionList);
    console.log('projectTypes', projectTypes);
    
    
    
    res.status(200).send(projectTypes);
  } catch (err) {
    log.error(err);
    res.status(500).send(err);
  }
});

module.exports = router;
