/*******************************************************************************
 * Copyright (c) 2020 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v2.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v20.html
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/
const express = require('express');

const Logger = require('../../modules/utils/Logger');
// const NetworkError = require('../../modules/utils/errors/ProjectError');
// const Project = require('../../modules/Project');
const { validateReq } = require('../../middleware/reqValidator');

const router = express.Router();
const log = new Logger(__filename);

router.get('/api/v1/projects/:id/network', validateReq, (req, res) => {
  const projectID = req.sanitizeParams('id');
  try {
    const user = req.cw_user;
    const project = user.projectList.retrieveProject(projectID);
    if (!project) {
      const message = `Unable to find project ${projectID}`;
      log.error(message);
      return res.status(404).send({ message });
    }
    res.status(200).send(project.getConnectedProjects());
  } catch (err) {
    log.error(err);
    res.status(500).send(err.info || err);
  }
});

router.post('/api/v1/projects/:id/network', validateReq, async(req, res) => {
  const projectID = req.sanitizeParams('id');
  const conProjectID = req.sanitizeBody('projectID');
  const conProjectName = req.sanitizeBody('projectName');
  const conProjectURL = req.sanitizeBody('projectURL');
  const connectionID = req.sanitizeBody('connectionID');
  const connectionURL = req.sanitizeBody('connectionURL');
  try {
    const user = req.cw_user;
    const project = user.projectList.retrieveProject(projectID);
    if (!project) {
      const message = `Unable to find project ${projectID}`;
      log.error(message);
      return res.status(404).send({ message });
    }
    await project.addConnectedProject(conProjectID, conProjectName, conProjectURL, connectionID, connectionURL);
    await user.fw.buildProject(project, 'build');
    res.status(200).send(project.getConnectedProjects());
  } catch (err) {
    log.error(err);
    res.status(500).send(err.info || err);
  }
});

// DANGER: Will delete complete network object for project
router.delete('/api/v1/projects/:id/network', validateReq, async(req, res) => {
  const projectID = req.sanitizeParams('id');
  try {
    const user = req.cw_user;
    const project = user.projectList.retrieveProject(projectID);
    if (!project) {
      const message = `Unable to find project ${projectID}`;
      log.error(message);
      return res.status(404).send({ message });
    }
    await project.resetNetwork();
    await user.fw.buildProject(project, 'build');
    res.sendStatus(200);
  } catch (err) {
    log.error(err);
    res.status(500).send(err.info || err);
  }
});

module.exports = router;